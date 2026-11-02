# Create a privacy-conscious diagnostics report; excludes business data and credentials.
$ErrorActionPreference='Continue'
$ScriptDir=Split-Path -Parent $MyInvocation.MyCommand.Path
$Root=Split-Path -Parent $ScriptDir
$report=Join-Path ([Environment]::GetFolderPath('MyDocuments')) ('SDDynamics-Diagnostics-'+(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')+'.txt')
$port=47371;$pf=Join-Path $ScriptDir 'data\port.txt';if(Test-Path $pf){$v=(Get-Content $pf -Raw).Trim();if($v -match '^\d{1,5}$'){$port=[int]$v}}
"SD Dynamics diagnostics | $(Get-Date -Format o)" | Set-Content $report
"Launcher root: $Root`nSystem root: $ScriptDir`nConfigured port: $port`nOS: $([Environment]::OSVersion.VersionString)`nPowerShell: $($PSVersionTable.PSVersion)" | Add-Content $report
$node=Join-Path $ScriptDir 'node\node.exe';if(Test-Path $node){"Node: $(& $node --version 2>&1) (bundled)"|Add-Content $report}elseif(Get-Command node -ErrorAction SilentlyContinue){"Node: $(node --version) (PATH)"|Add-Content $report}else{'Node: not found'|Add-Content $report}
if(Test-Path (Join-Path $ScriptDir 'package.json')){try{$pkg=Get-Content (Join-Path $ScriptDir 'package.json') -Raw|ConvertFrom-Json;"Package version: $($pkg.version)"|Add-Content $report}catch{'Package version: unreadable'|Add-Content $report}}
if(Test-Path (Join-Path $ScriptDir 'node_modules')){'Dependencies: node_modules present'|Add-Content $report}else{'Dependencies: node_modules missing'|Add-Content $report}
if(Test-Path (Join-Path $ScriptDir 'dist\index.html')){'Build: dist/index.html present'|Add-Content $report}else{'Build: dist/index.html missing'|Add-Content $report}
try{$r=Invoke-WebRequest "http://127.0.0.1:$port/api/profile" -TimeoutSec 3 -UseBasicParsing;"Server: responding HTTP $([int]$r.StatusCode)"|Add-Content $report}catch{'Server: not responding at configured port'|Add-Content $report}
Write-Host "Diagnostics report created: $report" -ForegroundColor Green
Start-Process notepad.exe $report
Read-Host 'Press Enter to close'
