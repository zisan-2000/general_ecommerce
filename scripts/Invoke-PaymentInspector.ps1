param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$')][string]$RequestId,
  [ValidateSet('gen_eco', 'gen_eco_transport_uat')][string]$Database = 'gen_eco',
  [string]$DatabaseUser = 'postgres',
  [ValidateRange(1, 20)][int]$Page = 1,
  [ValidatePattern('^[^"\x00-\x1f]+\.json$')][string]$OutputFile
)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$nodeExecutable = Join-Path $env:TEMP 'deshiplus-transport-node-24.22.1\node-v24.22.1-win-x64\node.exe'
$expectedNodeHash = 'D702DAA815EABBFF763C7D3808E235CF031CF2CA70211B56847BC72F51E240E5'
$secret = $null; $secretPointer = [IntPtr]::Zero; $processInfo = $null; $inspectorProcess = $null
function ConvertTo-InspectorSafeFailure([object]$Failure) {
  $allowedErrors = @('INVALID_ARGUMENTS', 'INVALID_REQUEST_ID', 'INVALID_TIMELINE_PAGE', 'INVALID_OUTPUT_FILE',
    'LOCAL_DATABASE_CONFIGURATION_REQUIRED', 'READ_ONLY_LOCAL_TARGET_REJECTED', 'RECORDED_REQUEST_NOT_FOUND',
    'OUTPUT_FILE_ALREADY_EXISTS', 'INSPECTOR_READ_OR_EXPORT_FAILED')
  if ($Failure.error -isnot [string] -or $allowedErrors -cnotcontains $Failure.error) { throw 'INVALID_INSPECTOR_FAILURE' }
  $safe = [ordered]@{ error = $Failure.error }
  if ($Failure.error -ceq 'READ_ONLY_LOCAL_TARGET_REJECTED' -and $null -ne $Failure.diagnostics) {
    $checks = [ordered]@{}
    foreach ($name in @('TARGET_ROW_VALID', 'TARGET_DATABASE_MATCH', 'TARGET_READ_ONLY', 'TARGET_SERVER_LOOPBACK')) {
      $value = $Failure.diagnostics.checks.$name
      if ($value -isnot [bool]) { throw 'INVALID_INSPECTOR_DIAGNOSTIC' }
      $checks[$name] = $value
    }
    $category = $Failure.diagnostics.serverAddressCategory
    if ($category -isnot [string] -or @('IPV4_LOOPBACK', 'IPV6_LOOPBACK', 'IPV4_MAPPED_LOOPBACK',
      'UNNORMALIZED_LOOPBACK', 'OTHER_OR_UNAVAILABLE') -cnotcontains $category) { throw 'INVALID_INSPECTOR_DIAGNOSTIC' }
    $safe.diagnostics = [ordered]@{ checks = $checks; serverAddressCategory = $category }
  }
  return ($safe | ConvertTo-Json -Depth 4 -Compress)
}
try {
  if (!(Test-Path -LiteralPath $nodeExecutable) -or (Get-FileHash -LiteralPath $nodeExecutable -Algorithm SHA256).Hash -ne $expectedNodeHash) {
    throw 'PORTABLE_NODE_CHECKSUM_FAILED'
  }
  $secret = Read-Host -Prompt "Local PostgreSQL password (read-only inspection of $Database)" -AsSecureString
  $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  $passwordText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  $inspectorUrl = 'postgresql://{0}:{1}@127.0.0.1:5432/{2}?schema=public' -f [Uri]::EscapeDataString($DatabaseUser),[Uri]::EscapeDataString($passwordText),$Database
  $processInfo = New-Object System.Diagnostics.ProcessStartInfo
  $processInfo.FileName = $nodeExecutable
  $inspectorScript = Join-Path $PSScriptRoot 'payment-inspector.mjs'
  $processInfo.Arguments = '--import tsx "{0}" --request-id {1} --page {2}' -f $inspectorScript,$RequestId,$Page
  if ($OutputFile) { $processInfo.Arguments += ' --output "{0}"' -f $OutputFile }
  $processInfo.WorkingDirectory = $projectDirectory
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true
  $processInfo.RedirectStandardOutput = $true
  $processInfo.RedirectStandardError = $true
  $processInfo.EnvironmentVariables['PAYMENT_INSPECTOR_DATABASE_URL'] = $inspectorUrl
  $processInfo.EnvironmentVariables.Remove('DATABASE_URL')
  $processInfo.EnvironmentVariables['NODE_OPTIONS'] = ''
  $processInfo.EnvironmentVariables['PAYMENT_TRANSPORT_MONITORING_MODE'] = 'off'
  $processInfo.EnvironmentVariables['PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED'] = 'false'
  $processInfo.EnvironmentVariables['PAYMENT_TRANSPORT_STORAGE_ENABLED'] = 'false'
  $inspectorProcess = [Diagnostics.Process]::Start($processInfo)
  $stdoutTask = $inspectorProcess.StandardOutput.ReadToEndAsync()
  $stderrTask = $inspectorProcess.StandardError.ReadToEndAsync()
  $passwordText = $null; $inspectorUrl = $null
  $processInfo.EnvironmentVariables.Remove('PAYMENT_INSPECTOR_DATABASE_URL')
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer); $secretPointer = [IntPtr]::Zero
  $secret.Dispose(); $secret = $null
  if (!$inspectorProcess.WaitForExit(30000)) { $inspectorProcess.Kill(); throw 'INSPECTOR_TIMEOUT' }
  $reportText = $stdoutTask.GetAwaiter().GetResult()
  $errorText = $stderrTask.GetAwaiter().GetResult()
  if ($inspectorProcess.ExitCode -ne 0) {
    $safeError = $errorText | ConvertFrom-Json
    [Console]::Error.WriteLine((ConvertTo-InspectorSafeFailure $safeError))
    $global:LASTEXITCODE = 1
  } else {
    $report = $reportText | ConvertFrom-Json
    if ($report.format -ne 'LOCAL_PAYMENT_INSPECTOR' -or $report.readOnly -ne $true -or $report.requestId -ne $RequestId) { throw 'INVALID_INSPECTOR_OUTPUT' }
    [Console]::Out.Write($reportText)
    $global:LASTEXITCODE = 0
  }
} catch {
  [Console]::Error.WriteLine('{"error":"INSPECTOR_START_OR_EXECUTION_FAILED"}')
  $global:LASTEXITCODE = 1
} finally {
  $passwordText = $null; $inspectorUrl = $null
  if ($secretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
  if ($secret) { $secret.Dispose() }
  if ($processInfo) { $processInfo.EnvironmentVariables.Remove('PAYMENT_INSPECTOR_DATABASE_URL') }
  if ($inspectorProcess) { $inspectorProcess.Dispose() }
}
