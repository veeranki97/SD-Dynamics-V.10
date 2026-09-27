# SD Dynamics — Rebuild UI (npm run build) without full reinstall
$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'SD Dynamics - Rebuild'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppRoot = $ScriptDir
if (-not (Test-Path (Join-Path $AppRoot 'package.json'))) {
  $parent = Split-Path -Parent $ScriptDir
  if (Test-Path (Join-Path $parent 'package.json')) { $AppRoot = $parent }
}
Set-Location $AppRoot
Write-Host "App root: $AppRoot"
$NodeDir = Join-Path $ScriptDir 'node'
$npm = 'npm'
if (Test-Path (Join-Path $NodeDir 'npm.cmd')) { $npm = Join-Path $NodeDir 'npm.cmd' }
Write-Host "Running npm run build (this can take 1–3 minutes)..."
& $npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "Build failed. Check errors above." -ForegroundColor Red
  Read-Host "Press Enter"
  exit 1
}
Write-Host "Build OK. Restart the app (Stop then Open App) to load new UI." -ForegroundColor Green
Read-Host "Press Enter"
