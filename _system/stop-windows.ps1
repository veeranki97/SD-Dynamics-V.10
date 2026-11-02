# SD Dynamics - Stop the local application server with visible verification.
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'SD Dynamics - Stop Server'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$portFile = Join-Path $ScriptDir 'data\port.txt'
$port = 47391

try {
    if (Test-Path -LiteralPath $portFile) {
        $raw = (Get-Content -LiteralPath $portFile -Raw).Trim()
        if ($raw -match '^\d{1,5}$' -and [int]$raw -ge 1 -and [int]$raw -le 65535) {
            $port = [int]$raw
        } else {
            Write-Warning "Invalid port in $portFile; using default port $port."
        }
    }

    Write-Host "`nSD Dynamics - Stop Server" -ForegroundColor Cyan
    Write-Host "Checking port $port ...`n"

    $connections = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    if (-not $connections) {
        Write-Host "RESULT: SD Dynamics is already stopped (nothing listening on port $port)." -ForegroundColor Yellow
        Read-Host 'Press Enter to close'
        exit 0
    }

    $ownerIds = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
    $stoppedAny = $false

    foreach ($ownerId in $ownerIds) {
        $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $ownerId" -ErrorAction SilentlyContinue
        if (-not $processInfo) {
            Write-Host "PID $ownerId has already exited." -ForegroundColor Yellow
            continue
        }

        $cmdLine = [string]$processInfo.CommandLine
        $looksLikeServer = ($processInfo.Name -ieq 'node.exe') -and ($cmdLine -match '(?i)server\.js')
        if (-not $looksLikeServer) {
            Write-Host "SAFETY: Port $port belongs to PID $ownerId ($($processInfo.Name)), not a recognizable Node server.js process." -ForegroundColor Red
            Write-Host "It was not stopped. Check the process before terminating it."
            continue
        }

        Write-Host "Stopping SD Dynamics server (PID $ownerId) ..." -ForegroundColor Cyan
        Stop-Process -Id ([int]$ownerId) -ErrorAction Stop
        $stoppedAny = $true

        $deadline = (Get-Date).AddSeconds(8)
        do {
            Start-Sleep -Milliseconds 400
            $stillRunning = Get-Process -Id ([int]$ownerId) -ErrorAction SilentlyContinue
        } while ($stillRunning -and (Get-Date) -lt $deadline)

        if ($stillRunning) {
            Write-Warning "Process did not exit after stop request; forcing termination."
            Stop-Process -Id ([int]$ownerId) -Force -ErrorAction Stop
        }
    }

    Start-Sleep -Milliseconds 700
    $remaining = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    if (-not $remaining) {
        Write-Host "`nRESULT: SD Dynamics has stopped successfully. (Port $port is clear.)" -ForegroundColor Green
    } elseif ($stoppedAny) {
        Write-Host "`nRESULT: A process is still listening on port $port. Stop was not fully confirmed." -ForegroundColor Red
    } else {
        Write-Host "`nRESULT: No SD Dynamics process was stopped. Review the safety message above." -ForegroundColor Red
    }
}
catch {
    Write-Host "`nERROR: Stop operation failed: $($_.Exception.Message)" -ForegroundColor Red
}
finally {
    Read-Host 'Press Enter to close'
}
