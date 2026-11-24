# SD Dynamics - Stop local application server (all instances + free ports)
$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'SD Dynamics - Stop Server'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$portFile = Join-Path $ScriptDir 'data\port.txt'

Write-Host ""
Write-Host "SD Dynamics - Stop Server" -ForegroundColor Cyan

$killed = 0

# 1) Kill every node.exe whose command line mentions server.js (this install or any)
try {
  $procs = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match '(?i)server\.js') })
  foreach ($p in $procs) {
    Write-Host "Stopping server.js (PID $($p.ProcessId))..." -ForegroundColor Cyan
    Stop-Process -Id ([int]$p.ProcessId) -Force -ErrorAction SilentlyContinue
    $killed++
  }
} catch {
  Write-Host "Process scan warning: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 2) Also free the port listed in port.txt (listener may not match regex)
$portsToFree = @()
if (Test-Path -LiteralPath $portFile) {
  $raw = (Get-Content -LiteralPath $portFile -Raw -ErrorAction SilentlyContinue)
  if ($raw -match '(\d{4,5})') { $portsToFree += [int]$Matches[1] }
}
# Common SD Dynamics range
$portsToFree += 47371..47390
$portsToFree = $portsToFree | Select-Object -Unique

foreach ($port in $portsToFree) {
  try {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
      $opid = $c.OwningProcess
      if ($opid -and $opid -gt 0) {
        $proc = Get-Process -Id $opid -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -match 'node') {
          Write-Host "Freeing port $port (PID $opid)..." -ForegroundColor Cyan
          Stop-Process -Id $opid -Force -ErrorAction SilentlyContinue
          $killed++
        }
      }
    }
  } catch { }
}

Start-Sleep -Milliseconds 500

if (Test-Path -LiteralPath $portFile) {
  Remove-Item -LiteralPath $portFile -Force -ErrorAction SilentlyContinue
  Write-Host "Cleared data\port.txt" -ForegroundColor Green
}

if ($killed -gt 0) {
  Write-Host ""
  Write-Host "RESULT: Stopped $killed process(es). Ports cleared." -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "RESULT: No SD Dynamics server was running." -ForegroundColor Yellow
}

Write-Host ""
Read-Host 'Press Enter to close'
