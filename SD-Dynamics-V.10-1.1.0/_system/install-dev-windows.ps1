$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'SD Dynamics Install'
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir
Write-Host "Installing in: $RootDir"
$NodeDir = Join-Path $RootDir 'node'
$NodeExe = Join-Path $NodeDir 'node.exe'
if (Test-Path $NodeExe) { $env:Path = "$NodeDir;$env:Path" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Downloading portable Node.js (no admin)...'
  $ver = 'v20.19.0'
  $arch = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
  $name = "node-$ver-win-$arch"
  $zip = Join-Path $env:TEMP "$name.zip"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri "https://nodejs.org/dist/$ver/$name.zip" -OutFile $zip -UseBasicParsing
  Expand-Archive $zip $env:TEMP -Force
  if (Test-Path $NodeDir) { Remove-Item $NodeDir -Recurse -Force }
  Move-Item (Join-Path $env:TEMP $name) $NodeDir
  $env:Path = "$NodeDir;$env:Path"
}
Write-Host 'npm install...'
npm install
if ($LASTEXITCODE -ne 0) { Read-Host 'npm install failed - press Enter'; exit 1 }
Write-Host 'npm run build...'
npm run build
if ($LASTEXITCODE -ne 0) { Read-Host 'build failed - press Enter'; exit 1 }
Write-Host 'Starting app...'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RootDir 'start-dev-windows.ps1')
