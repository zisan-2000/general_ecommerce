# Windows PowerShell 5.1 / PowerShell 7. Runs ONLY when an operator starts this file.
# No packet capture, gateway requests, DNS discovery, credentials on disk or raw error logs.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This collector requires Windows.' }
$agentId = $env:NETWORK_MONITOR_AGENT_ID
$agentToken = $env:NETWORK_MONITOR_AGENT_TOKEN
if ($agentId -notmatch '^[A-Za-z0-9_-]{1,64}$' -or $agentToken -notmatch '^[A-Za-z0-9_-]{32,256}$') {
    throw 'Set a collector ID and its per-agent token in process environment variables.'
}
$apiUri = $null
if (-not [Uri]::TryCreate($env:NETWORK_MONITOR_API_URL, [UriKind]::Absolute, [ref]$apiUri) -or
    $apiUri.UserInfo -or $apiUri.Query -or $apiUri.Fragment -or
    ($apiUri.Scheme -ne 'https' -and -not ($apiUri.Scheme -eq 'http' -and $apiUri.IsLoopback))) {
    throw 'Monitoring API URL requires HTTPS, or HTTP loopback for local development.'
}
$apiBase = $apiUri.AbsoluteUri.TrimEnd('/')
Add-Type -AssemblyName System.Net.Http
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$handler = [Net.Http.HttpClientHandler]::new()
$handler.AllowAutoRedirect = $false # Never forward the agent token to a redirect target.
if ($apiUri.IsLoopback) { $handler.UseProxy = $false }
$client = [Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds(10)
$client.MaxResponseContentBufferSize = 65536
$client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $agentToken)
$client.DefaultRequestHeaders.Add('x-network-agent-id', $agentId)
$sessionId = [Guid]::NewGuid().ToString()
$sequence = 0
$queue = [Collections.Generic.List[object]]::new()
$lastProbe = @{}
$configuration = $null
$leaseUntil = [DateTime]::MinValue
$lastHostAt = [DateTime]::MinValue

function Invoke-MonitorRequest([string]$Path, [object]$Payload) {
    $response = $null; $content = $null
    try {
        if ($null -eq $Payload) { $response = $client.GetAsync($apiBase + $Path).GetAwaiter().GetResult() }
        else {
            $content = [Net.Http.StringContent]::new(($Payload | ConvertTo-Json -Depth 8 -Compress), [Text.Encoding]::UTF8, 'application/json')
            $response = $client.PostAsync($apiBase + $Path, $content).GetAwaiter().GetResult()
        }
        $code = [int]$response.StatusCode
        $body = $null
        if ($code -eq 200 -and $null -eq $Payload) {
            $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
        }
        return @{ code = $code; body = $body }
    } catch { return @{ code = 0; body = $null } }
    finally { if ($null -ne $response) { $response.Dispose() }; if ($null -ne $content) { $content.Dispose() } }
}
function Read-OsCounter([scriptblock]$Read) {
    try {
        $value = & $Read
        if ($null -eq $value -or $value -lt 0) { return $null }
        return ([decimal]$value).ToString('0', [Globalization.CultureInfo]::InvariantCulture)
    } catch { return $null }
}
function Get-HostCounters {
    $result = @{ adapterKey = $null; packetsSent = $null; packetsReceived = $null; packetsDropped = $null;
        tcpRetransmissions = $null; tcpConnectionFailures = $null }
    # An explicit interface is required. No guessed adapter, MAC or address is uploaded.
    if ($env:NETWORK_MONITOR_INTERFACE_ID) {
        try {
            $adapters = @([Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() | Where-Object {
                $_.Id -eq $env:NETWORK_MONITOR_INTERFACE_ID -or $_.Name -eq $env:NETWORK_MONITOR_INTERFACE_ID
            })
            if ($adapters.Count -eq 1 -and $adapters[0].OperationalStatus -eq [Net.NetworkInformation.OperationalStatus]::Up) {
                $stats = $adapters[0].GetIPv4Statistics()
                $sha = [Security.Cryptography.SHA256]::Create()
                try { $result.adapterKey = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($adapters[0].Id))).Replace('-', '').ToLowerInvariant() }
                finally { $sha.Dispose() }
                $result.packetsSent = Read-OsCounter { [decimal]$stats.UnicastPacketsSent + [decimal]$stats.NonUnicastPacketsSent }
                $result.packetsReceived = Read-OsCounter { [decimal]$stats.UnicastPacketsReceived + [decimal]$stats.NonUnicastPacketsReceived }
                $result.packetsDropped = Read-OsCounter { [decimal]$stats.IncomingPacketsDiscarded + [decimal]$stats.OutgoingPacketsDiscarded }
            }
        } catch { # Unsupported/unavailable interface statistics remain null.
        }
    }
    try {
        $tcp = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetTcpIPv4Statistics()
        $result.tcpRetransmissions = Read-OsCounter { $tcp.SegmentsResent }
        $result.tcpConnectionFailures = Read-OsCounter { $tcp.FailedConnectionAttempts }
    } catch { # Unsupported host TCP statistics remain null.
    }
    return $result
}
function Invoke-ApprovedProbe([object]$Target) {
    $ip = $null
    if (-not [Net.IPAddress]::TryParse([string]$Target.address, [ref]$ip) -or
        $Target.intervalSeconds -lt 60 -or $Target.intervalSeconds -gt 3600 -or
        $Target.timeoutMs -lt 100 -or $Target.timeoutMs -gt 5000 -or
        $Target.protocol -notin @('TCP', 'ICMP')) { return $null }
    if ($Target.protocol -eq 'TCP' -and ($Target.port -lt 1 -or $Target.port -gt 65535)) { return $null }
    $startedAt = [DateTime]::UtcNow
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $outcome = 'ERROR'; $errorCode = $null; $latency = $null
    $connection = $null; $ping = $null
    try {
        if ($Target.protocol -eq 'TCP') {
            $connection = [Net.Sockets.TcpClient]::new($ip.AddressFamily)
            $task = $connection.ConnectAsync($ip, [int]$Target.port)
            if (-not $task.Wait([int]$Target.timeoutMs)) { $outcome = 'TIMEOUT' }
            else { $task.GetAwaiter().GetResult(); $outcome = 'SUCCESS'; $latency = $watch.Elapsed.TotalMilliseconds }
        } else {
            # ICMP is unavailable in the default server approval policy. Only explicit future approval permits it.
            $ping = [Net.NetworkInformation.Ping]::new()
            $reply = $ping.Send($ip, [int]$Target.timeoutMs)
            if ($reply.Status -eq [Net.NetworkInformation.IPStatus]::Success) { $outcome = 'SUCCESS'; $latency = [double]$reply.RoundtripTime }
            elseif ($reply.Status -eq [Net.NetworkInformation.IPStatus]::TimedOut) { $outcome = 'TIMEOUT' }
            else { $outcome = 'UNREACHABLE' }
        }
    } catch {
        $cause = $_.Exception
        while ($null -ne $cause.InnerException) { $cause = $cause.InnerException }
        if ($cause -is [Net.Sockets.SocketException]) {
            switch ($cause.SocketErrorCode.ToString()) {
                'ConnectionRefused' { $outcome = 'UNREACHABLE'; $errorCode = 'CONNECTION_REFUSED' }
                'NetworkUnreachable' { $outcome = 'UNREACHABLE'; $errorCode = 'NETWORK_UNREACHABLE' }
                'HostUnreachable' { $outcome = 'UNREACHABLE'; $errorCode = 'NETWORK_UNREACHABLE' }
                'TimedOut' { $outcome = 'TIMEOUT' }
                'AccessDenied' { $errorCode = 'ACCESS_DENIED' }
                default { $errorCode = 'SOCKET_ERROR' }
            }
        } else { $errorCode = 'UNKNOWN_ERROR' }
    } finally {
        $watch.Stop()
        if ($null -ne $connection) { $connection.Dispose() }
        if ($null -ne $ping) { $ping.Dispose() }
    }
    return @{ targetId = $Target.id; targetVersion = [int]$Target.version; startedAt = $startedAt.ToString('o');
        completedAt = [DateTime]::UtcNow.ToString('o'); outcome = $outcome; latencyMs = $latency;
        elapsedMs = $watch.Elapsed.TotalMilliseconds; errorCode = $errorCode }
}

Write-Host 'Collector started. Measurements only; packet capture disabled. Ctrl+C stops collection.'
$collectorStage = 'CONFIGURATION'
try {
    while ($true) {
        $cycleStart = [DateTime]::UtcNow
        $collectorStage = 'CONFIGURATION'
        $configResult = Invoke-MonitorRequest '/api/network-monitor/config' $null
        if ($configResult.code -eq 200) {
            $candidate = $configResult.body
            if ($candidate.agentId -eq $agentId -and $candidate.hostIntervalSeconds -ge 60 -and
                $candidate.leaseSeconds -ge 60 -and $candidate.leaseSeconds -le 180 -and @($candidate.targets).Count -le 4) {
                $configuration = $candidate
                $leaseUntil = [DateTime]::UtcNow.AddSeconds([int]$candidate.leaseSeconds)
            } else { $configuration = $null; $leaseUntil = [DateTime]::MinValue }
        } elseif ($configResult.code -in @(401, 403)) {
            $configuration = $null; $leaseUntil = [DateTime]::MinValue; $queue.Clear()
        }
        $probes = @()
        $collectorStage = 'APPROVED_PROBE'
        if ($null -ne $configuration -and [DateTime]::UtcNow -lt $leaseUntil) {
            foreach ($target in @($configuration.targets)) {
                # Sequential and rate limited; no overlap, retries, scans or payload requests.
                if ([DateTime]::UtcNow -ge $leaseUntil) { break }
                if ($lastProbe.ContainsKey($target.id)) {
                    $remaining = ($lastProbe[$target.id].AddSeconds([int]$target.intervalSeconds) - [DateTime]::UtcNow).TotalMilliseconds
                    if ($remaining -gt 10000) { continue }
                    if ($remaining -gt 0) { Start-Sleep -Milliseconds ([int][Math]::Ceiling($remaining) + 20) }
                    if ([DateTime]::UtcNow -ge $leaseUntil) { break }
                }
                $lastProbe[$target.id] = [DateTime]::UtcNow
                $measurement = Invoke-ApprovedProbe $target
                if ($null -ne $measurement) {
                    $lastProbe[$target.id] = [DateTime]::Parse($measurement.startedAt).ToUniversalTime()
                    $probes += $measurement
                }
            }
        }
        # Enforce >=60 seconds between host observations even if connection timing changes.
        $collectorStage = 'HOST_COUNTERS'
        $hostWait = ($lastHostAt.AddSeconds(60) - [DateTime]::UtcNow).TotalMilliseconds
        if ($hostWait -gt 0) { Start-Sleep -Milliseconds ([int][Math]::Ceiling($hostWait) + 20) }
        $hostCounters = Get-HostCounters
        $lastHostAt = [DateTime]::UtcNow; $sequence++
        $collectorStage = 'QUEUE'
        $queue.Add(@{ id = [Guid]::NewGuid().ToString(); sessionId = $sessionId; sequence = $sequence;
            observedAt = $lastHostAt.ToString('o'); host = $hostCounters; probes = @($probes) })
        # A bounded RAM buffer allows a short localhost outage to appear after restart. No disk spooling.
        while ($queue.Count -gt 4 -or ($queue.Count -gt 0 -and
            ([DateTime]::UtcNow - [DateTime]::Parse($queue[0].observedAt).ToUniversalTime()).TotalSeconds -gt 270)) { $queue.RemoveAt(0) }
        $collectorStage = 'INGESTION'
        while ($queue.Count -gt 0) {
            $result = Invoke-MonitorRequest '/api/network-monitor/ingest' $queue[0]
            if ($result.code -eq 200 -or $result.code -in @(400, 409, 413)) { $queue.RemoveAt(0); continue }
            if ($result.code -in @(401, 403)) { $configuration = $null; $leaseUntil = [DateTime]::MinValue; $queue.Clear() }
            Write-Host 'Monitoring upload unavailable; no response body or credentials logged.'
            break
        }
        $collectorStage = 'SAMPLING_WAIT'
        $delay = ($cycleStart.AddSeconds(60) - [DateTime]::UtcNow).TotalMilliseconds
        if ($delay -gt 0) { Start-Sleep -Milliseconds ([int][Math]::Ceiling($delay)) }
    }
} catch {
    # Only fixed codes and a locally assigned stage are safe to print. Never emit $_ or exception text.
    $failureCode = 'COLLECTOR_RUNTIME_FAILURE'
    if ($_.Exception -is [System.Management.Automation.SessionStateUnauthorizedAccessException]) {
        $failureCode = 'COLLECTOR_VARIABLE_WRITE_REJECTED'
    }
    Write-Host "Collector stopped; diagnostic=$failureCode; stage=$collectorStage. Raw exception details suppressed."
}
finally { $client.Dispose(); $handler.Dispose(); $queue.Clear(); $agentToken = $null }
