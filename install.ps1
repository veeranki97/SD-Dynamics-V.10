# SD Dynamics V.10 - One-line PowerShell Web Installer
# Usage: irm https://raw.githubusercontent.com/veeranki97/SD-Dynamics-V.10/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host '   SD Dynamics V.10 - Fast One-Click Installer' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ''

$installDir = Join-Path $env:LOCALAPPDATA 'Programs\SD Dynamics'
$zipUrl = 'https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest/download/SD-Dynamics-V.10.zip'
$tmpZip = Join-Path $env:TEMP "SD-Dynamics-Setup-$([Guid]::NewGuid().ToString('N')).zip"
$tmpExtract = Join-Path $env:TEMP "SD-Dynamics-Extract-$([Guid]::NewGuid().ToString('N'))"

try {
    Write-Host "-> Target install folder: $installDir"
    if (-not (Test-Path $installDir)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    }

    Write-Host '-> Downloading latest SD Dynamics release...' -ForegroundColor Yellow
    Invoke-WebRequest -Uri $zipUrl -OutFile $tmpZip -UseBasicParsing
    
    Write-Host '-> Extracting files...' -ForegroundColor Yellow
    Expand-Archive -Path $tmpZip -DestinationPath $tmpExtract -Force

    # If the zip has a nested root folder, copy its contents
    $extractedItems = Get-ChildItem -Path $tmpExtract
    if ($extractedItems.Count -eq 1 -and $extractedItems[0].PSIsContainer) {
        $sourceDir = $extractedItems[0].FullName
    } else {
        $sourceDir = $tmpExtract
    }

    Copy-Item -Path "$sourceDir\*" -Destination $installDir -Recurse -Force
    Write-Host '-> Application files placed successfully.' -ForegroundColor Green
} catch {
    Write-Host "-> Download or extraction failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Falling back to local setup if already inside repo...'
    $installDir = $PSScriptRoot
} finally {
    if (Test-Path $tmpZip) { Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue }
    if (Test-Path $tmpExtract) { Remove-Item $tmpExtract -Recurse -Force -ErrorAction SilentlyContinue }
}

$systemDir = Join-Path $installDir '_system'
$installWinScript = Join-Path $systemDir 'install-windows.ps1'

if (Test-Path $installWinScript) {
    Write-Host '-> Running local dependency configuration...' -ForegroundColor Yellow
    & powershell.exe -ExecutionPolicy Bypass -File $installWinScript
} else {
    Write-Host "-> Note: Run 'SD Dynamics - WINDOWS.hta' inside $installDir to complete setup." -ForegroundColor Yellow
}

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host '   SD Dynamics V.10 Installation Complete!' -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ''
