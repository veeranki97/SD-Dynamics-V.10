$ErrorActionPreference = 'Continue'
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir
$NodeDir = Join-Path $RootDir 'node'
$NodeExe = Join-Path $NodeDir 'node.exe'
if (-not (Test-Path $NodeExe)) {
  $c = Get-Command node -EA SilentlyContinue
  $NodeExe = if ($c) { $c.Source } else { 'node.exe' }
}
$port = 47371
$pf = Join-Path $RootDir 'data\port.txt'
function Up($p) {
  try { Invoke-WebRequest "http://127.0.0.1:$p/api/version" -TimeoutSec 2 -UseBasicParsing | Out-Null; return $true } catch { return $false }
}
if (Test-Path $pf) { try { $port = [int](Get-Content $pf -Raw).Trim() } catch {} }
if (Up $port) { Start-Process "http://localhost:$port/"; exit 0 }
Start-Process -FilePath $NodeExe -ArgumentList 'server.js' -WorkingDirectory $RootDir -WindowStyle Hidden
$end = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $end) {
  Start-Sleep -Milliseconds 500
  if (Test-Path $pf) { try { $port = [int](Get-Content $pf -Raw).Trim() } catch {} }
  if (Up $port) { Start-Process "http://localhost:$port/"; exit 0 }
}
Write-Host "Try browser: http://localhost:$port/"
Read-Host 'Press Enter'
