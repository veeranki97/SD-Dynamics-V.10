/** Local backup reminder — no cloud required. */
const KEY = 'sd_last_backup_at';
const DAYS = 7;

export function markBackupDone() {
  try { localStorage.setItem(KEY, new Date().toISOString()); } catch { /* */ }
}

export function daysSinceBackup() {
  try {
    const v = localStorage.getItem(KEY);
    if (!v) return 999;
    const ms = Date.now() - new Date(v).getTime();
    return Math.floor(ms / 86400000);
  } catch {
    return 999;
  }
}

export function shouldNagBackup() {
  return daysSinceBackup() >= DAYS;
}

export function backupNagMessage() {
  const d = daysSinceBackup();
  if (d >= 999) return 'No backup recorded yet. Use Settings → Backups or copy the data/ folder.';
  return `Last backup ${d} day(s) ago. Please backup data/ (or Settings → Backups).`;
}
