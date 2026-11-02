# Reset counters through the server API after taking a data backup.
# This calls the route supplied for SD Dynamics; server.js must implement it.
$ErrorActionPreference='Stop'
$ScriptDir=Split-Path -Parent $MyInvocation.MyCommand.Path
$port=47371; $portFile=Join-Path $ScriptDir 'data\port.txt'
if(Test-Path $portFile){$raw=(Get-Content $portFile -Raw).Trim();if($raw -match '^\d{1,5}$' -and [int]$raw -ge 1 -and [int]$raw -le 65535){$port=[int]$raw}}
Write-Host 'SD Dynamics - Reset Document Counters' -ForegroundColor Cyan
Write-Host 'This may cause document number reuse. Use only in a test company/database.' -ForegroundColor Yellow
$answer=Read-Host 'Type RESET to continue'
if($answer -cne 'RESET'){Write-Host 'Cancelled.';exit 0}
$dataDir=Join-Path $ScriptDir 'data'
if(-not(Test-Path $dataDir)){throw "Data folder not found: $dataDir"}
$backupHome=Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'SDDynamics Backups'
New-Item -ItemType Directory -Path $backupHome -Force | Out-Null
$backup=Join-Path $backupHome ('pre-counter-reset-'+(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')+'.zip')
Compress-Archive -Path (Join-Path $dataDir '*') -DestinationPath $backup -Force
Write-Host "Safety backup: $backup" -ForegroundColor Green
try{$response=Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/meta/resetCounters" -Method POST -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop;Write-Host "API returned HTTP $([int]$response.StatusCode)." -ForegroundColor Green;Write-Output $response.Content}
catch{Write-Error "Counter reset API call failed. No success is claimed. Verify server.js route and server status. $($_.Exception.Message)";exit 1}
Read-Host 'Press Enter to close'
