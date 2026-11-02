# SD Dynamics - Windows restore-from-backup.
#
# Prompts for a backup ZIP via a file-picker dialog. Snapshots
# CURRENT data/ first as safety net, then extracts the backup ZIP
# on top. Never destructive without a pre-restore snapshot.

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'SD Dynamics - Restore'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SystemDir = $ScriptDir
$dataDir = Join-Path $SystemDir 'data'

Add-Type -AssemblyName System.Windows.Forms

$dlg = New-Object System.Windows.Forms.OpenFileDialog
$dlg.Title = 'Select a SD Dynamics backup ZIP'
$dlg.Filter = 'ZIP files (*.zip)|*.zip'
$dlg.InitialDirectory = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'SDDynamics Backups'
if ($dlg.ShowDialog() -ne 'OK') {
  Write-Host '  Cancelled.'
  exit 0
}
$zipPath = $dlg.FileName

# --- Safety snapshot of current data folder ---
if (Test-Path $dataDir) {
  $backupsHome = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'SDDynamics Backups'
  if (-not (Test-Path $backupsHome)) { New-Item -ItemType Directory -Path $backupsHome | Out-Null }
  $stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
  $preRestore = Join-Path $backupsHome "pre-restore-$stamp.zip"
  Write-Host "  Snapshotting current data -> $preRestore ..."
  Compress-Archive -Path "$dataDir\*" -DestinationPath $preRestore -Force
}

# --- Validate and stage restore before replacing data ---
Add-Type -AssemblyName System.IO.Compression.FileSystem
$entries = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  if ($entries.Entries.Count -eq 0) { throw 'The selected ZIP is empty.' }
  $names = @($entries.Entries | ForEach-Object { $_.FullName })
  if (-not ($names | Where-Object { $_ -match '(^|/)meta\.json$|(^|/)bills/' })) { throw 'This ZIP does not look like an SD Dynamics data backup.' }
} finally { $entries.Dispose() }
$stageDir = Join-Path $SystemDir ('data-restore-stage-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stageDir | Out-Null
Write-Host '  Extracting and validating backup in a temporary folder...'
Expand-Archive -Path $zipPath -DestinationPath $stageDir -Force
if (-not (Get-ChildItem -LiteralPath $stageDir -Force | Select-Object -First 1)) { throw 'Extracted backup is empty; current data was not changed.' }
$oldData = Join-Path $SystemDir ('data-pre-restore-' + (Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'))
if (Test-Path $dataDir) { Move-Item -LiteralPath $dataDir -Destination $oldData -Force }
try { Move-Item -LiteralPath $stageDir -Destination $dataDir -Force }
catch { if (Test-Path $oldData) { Move-Item -LiteralPath $oldData -Destination $dataDir -Force }; throw }
Write-Host ('  Previous data retained at: ' + $oldData) -ForegroundColor Yellow

Write-Host ''
Write-Host '  [OK] Restore complete!' -ForegroundColor Green
Write-Host '  Restart the app to see the restored data.'
Read-Host '  Press Enter to close'
