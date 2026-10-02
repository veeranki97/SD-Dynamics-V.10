# SD Dynamics - Rebuild UI
$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'SD Dynamics - Rebuild'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppRoot = $ScriptDir
if (-not (Test-Path (Join-Path $AppRoot 'package.json'))) {
  $parent = Split-Path -Parent $ScriptDir
  if (Test-Path (Join-Path $parent 'package.json')) { $AppRoot = $parent }
}
Set-Location -LiteralPath $AppRoot
Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ' SD Dynamics - Rebuild npm run build' -ForegroundColor Cyan
Write-Host " App folder: $AppRoot"
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''
$NodeDir = Join-Path $ScriptDir 'node'
$npmCmd = $null
if (Test-Path (Join-Path $NodeDir 'npm.cmd')) { $npmCmd = Join-Path $NodeDir 'npm.cmd' }
elseif (Get-Command npm -ErrorAction SilentlyContinue) { $npmCmd = 'npm' }
else {
  Write-Host 'FAILED: npm not found. Install Node.js first.' -ForegroundColor Red
  Read-Host 'Press Enter to close'
  exit 1
}
Write-Host "Running: $npmCmd run build ..."
Write-Host 'Cold build after an update can take a few minutes.'
Write-Host ''
& $npmCmd run build
$code = $LASTEXITCODE
Write-Host ''
if ($code -ne 0) {
  Write-Host '========================================' -ForegroundColor Red
  Write-Host " BUILD FAILED exit code $code" -ForegroundColor Red
  Write-Host ' Fix the error above, then try Rebuild again.' -ForegroundColor Red
  Write-Host '========================================' -ForegroundColor Red
  Read-Host 'Press Enter to close'
  exit $code
}
Write-Host '========================================' -ForegroundColor Green
Write-Host ' BUILD OK - SUCCESS' -ForegroundColor Green
Write-Host ' Next: Stop the app, then Open App again.' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Read-Host 'Press Enter to close'
