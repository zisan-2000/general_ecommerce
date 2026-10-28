$ErrorActionPreference = 'Stop'
# Parse the launcher and execute ONLY its pure error-formatting function.
# Never dot-source the complete launcher, prompt for credentials, or start Node.
$tokens = $null; $parseErrors = $null
$sourcePath = Join-Path $PSScriptRoot '..\scripts\Invoke-PaymentInspector.ps1'
$ast = [System.Management.Automation.Language.Parser]::ParseFile($sourcePath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'LAUNCHER_SYNTAX_FAILED' }
$formatter = $ast.Find({ param($node)
  $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'ConvertTo-InspectorSafeFailure'
}, $true)
if (!$formatter) { throw 'FORMATTER_MISSING' }
. ([ScriptBlock]::Create($formatter.Extent.Text))

$checks = [ordered]@{ TARGET_ROW_VALID = $true; TARGET_DATABASE_MATCH = $true; TARGET_READ_ONLY = $true; TARGET_SERVER_LOOPBACK = $false }
$checks.PRIVATE_SENTINEL = 'PRIVATE_SENTINEL'
$failure = [pscustomobject]@{
  error = 'READ_ONLY_LOCAL_TARGET_REJECTED'
  password = 'PRIVATE_SENTINEL'
  diagnostics = [pscustomobject]@{ checks = $checks; serverAddressCategory = 'IPV4_MAPPED_LOOPBACK'; rawAddress = 'PRIVATE_SENTINEL' }
}
$json = ConvertTo-InspectorSafeFailure $failure
$safe = $json | ConvertFrom-Json
if ($json.Contains('PRIVATE_SENTINEL') -or @($safe.PSObject.Properties).Count -ne 2) { throw 'FORMATTER_REDACTION_FAILED' }
if (@($safe.diagnostics.checks.PSObject.Properties).Count -ne 4 -or
  $safe.diagnostics.checks.TARGET_SERVER_LOOPBACK -ne $false -or
  $safe.diagnostics.serverAddressCategory -ne 'IPV4_MAPPED_LOOPBACK') { throw 'FORMATTER_DIAGNOSTICS_LOST' }

foreach ($unsafe in @('string_boolean', 'unknown_category', 'unknown_error')) {
  $bad = $json | ConvertFrom-Json
  if ($unsafe -eq 'string_boolean') { $bad.diagnostics.checks.TARGET_READ_ONLY = 'PRIVATE_SENTINEL' }
  if ($unsafe -eq 'unknown_category') { $bad.diagnostics.serverAddressCategory = 'PRIVATE_SENTINEL' }
  if ($unsafe -eq 'unknown_error') { $bad.error = 'PRIVATE_SENTINEL' }
  $rejected = $false
  try { $null = ConvertTo-InspectorSafeFailure $bad } catch { $rejected = $true }
  if (!$rejected) { throw 'FORMATTER_UNSAFE_FIELD_ACCEPTED' }
}
$legacy = ConvertTo-InspectorSafeFailure ([pscustomobject]@{ error = 'READ_ONLY_LOCAL_TARGET_REJECTED' })
if ($legacy -ne '{"error":"READ_ONLY_LOCAL_TARGET_REJECTED"}') { throw 'FORMATTER_LEGACY_FAILED' }
[Console]::Out.WriteLine('{"result":"PASS"}')
