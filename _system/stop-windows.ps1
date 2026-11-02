# SD Dynamics - safe Windows server stop. Stops only the process owning the configured local port.
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'SD Dynamics - Stop Server'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$portFile = Join-Path $ScriptDir 'data\port.txt'
$port = 47371
if (Test-Path -LiteralPath $portFile) { $raw=(Get-Content -LiteralPath $portFile -Raw).Trim(); if ($raw -match '^\d{1,5}$' -and [int]$raw -ge 1 -and [int]$raw -le 65535) { $port=[int]$raw } }
try { $connections = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop) } catch { $connections=@() }
if (-not $connections) { Write-Host "SD Dynamics is not listening on port $port." -ForegroundColor Yellow; Read-Host 'Press Enter to close'; exit 0 }
$pids = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
foreach ($pidValue in $pids) {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $pidValue" -ErrorAction SilentlyContinue
  if (-not $proc) { Write-Warning "Process $pidValue already exited."; continue }
  $command = [string]$proc.CommandLine
  if ($proc.Name -ine 'node.exe' -or ($command -notmatch '(?i)(^|[\\/\s])server\.js([\s"']|$)')) {
    Write-Warning "Port $port is owned by PID $pidValue ($($proc.Name)); it does not look like SD Dynamics server.js. It was NOT stopped."
    continue
  }
  try { Stop-Process -Id $pidValue -ErrorAction Stop; Write-Host "Requested graceful stop for SD Dynamics (PID $pidValue)." -ForegroundColor Green }
  catch { Write-Warning "Graceful stop failed: $($_.Exception.Message)" }
  Start-Sleep -Seconds 2
  if (Get-Process -Id $pidValue -ErrorAction SilentlyContinue) { Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue; Write-Host 'Force-stopped the remaining process.' -ForegroundColor Yellow }
}
Read-Host 'Press Enter to close'
