param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-zA-Z0-9-]{8,80}$')][string]$RunId,
  [string]$DatabaseUser = 'postgres'
)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$nodeExecutable = Join-Path $env:TEMP 'deshiplus-transport-node-24.22.1\node-v24.22.1-win-x64\node.exe'
$expectedNodeHash = 'D702DAA815EABBFF763C7D3808E235CF031CF2CA70211B56847BC72F51E240E5'
$secret = $null
$secretPointer = [IntPtr]::Zero
$processInfo = $null
$uatProcess = $null
try {
  if (!(Test-Path -LiteralPath $nodeExecutable) -or (Get-FileHash -LiteralPath $nodeExecutable -Algorithm SHA256).Hash -ne $expectedNodeHash) {
    throw 'PORTABLE_NODE_CHECKSUM_FAILED'
  }
  $secret = Read-Host -Prompt "PostgreSQL password for $DatabaseUser (localhost:5432, gen_eco_transport_uat ONLY)" -AsSecureString
  $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  $passwordText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  $uatUrl = 'postgresql://{0}:{1}@localhost:5432/gen_eco_transport_uat?schema=public' -f [Uri]::EscapeDataString($DatabaseUser),[Uri]::EscapeDataString($passwordText)
  $processInfo = New-Object System.Diagnostics.ProcessStartInfo
  $processInfo.FileName = $nodeExecutable
  $sessionScript = Join-Path $PSScriptRoot 'payment-transport-local-uat-session.mjs'
  $processInfo.Arguments = '--import tsx "{0}" "{1}"' -f $sessionScript,$RunId
  $processInfo.WorkingDirectory = $projectDirectory
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true
  $processInfo.RedirectStandardError = $true
  $processInfo.EnvironmentVariables['PAYMENT_TRANSPORT_UAT_DATABASE_URL'] = $uatUrl
  $processInfo.EnvironmentVariables['DATABASE_URL'] = $uatUrl
  $processInfo.EnvironmentVariables['PAYMENT_TRANSPORT_MONITORING_MODE'] = 'off'
  $processInfo.EnvironmentVariables['PAYMENT_TRANSPORT_STORAGE_ENABLED'] = 'false'
  $processInfo.EnvironmentVariables['PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED'] = 'false'
  $processInfo.EnvironmentVariables['PAYMENT_TRANSPORT_ALLOWED_PROVIDERS'] = ''
  $processInfo.EnvironmentVariables['PAYMENT_TRANSPORT_ALLOWED_OPERATIONS'] = ''
  $processInfo.EnvironmentVariables['NEXT_TELEMETRY_DISABLED'] = '1'
  $processInfo.EnvironmentVariables['PATH'] = (Split-Path -Parent $nodeExecutable) + ';' + $env:PATH
  Write-Host 'Running isolated local UAT. Password/URL will not be saved. Waiting for agent browser checks may take several minutes.'
  $uatProcess = [Diagnostics.Process]::Start($processInfo)
  $stderrTask = $uatProcess.StandardError.ReadToEndAsync()
  # Clear the parent's short-lived plaintext copies immediately after spawn.
  $passwordText = $null; $uatUrl = $null
  $processInfo.EnvironmentVariables.Remove('PAYMENT_TRANSPORT_UAT_DATABASE_URL')
  $processInfo.EnvironmentVariables.Remove('DATABASE_URL')
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer); $secretPointer = [IntPtr]::Zero
  $secret.Dispose(); $secret = $null
  if (!$uatProcess.WaitForExit(1200000)) { $uatProcess.Kill(); throw 'LOCAL_UAT_TIMEOUT' }
  $null = $stderrTask.GetAwaiter().GetResult() # Never echo raw third-party errors.
  $result = $uatProcess.ExitCode
  Write-Host "Local UAT process finished (exit $result). Sanitized results are available to the agent."
  if ($result -ne 0) { Write-Error 'LOCAL_UAT_REQUIRES_REVIEW (no credentials logged)' }
} catch {
  Write-Error 'LOCAL_UAT_START_OR_EXECUTION_FAILED (raw details suppressed)'
} finally {
  $passwordText = $null; $uatUrl = $null
  if ($secretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
  if ($secret) { $secret.Dispose() }
  if ($processInfo) {
    $processInfo.EnvironmentVariables.Remove('PAYMENT_TRANSPORT_UAT_DATABASE_URL')
    $processInfo.EnvironmentVariables.Remove('DATABASE_URL')
  }
  if ($uatProcess) { $uatProcess.Dispose() }
}
