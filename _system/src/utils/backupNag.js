/** Local backup reminder — nag if older than 2 days (or never). */
const KEY = 'sd_last_backup_at';
const DAYS = 2;

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
  if (d >= 999) return 'No backup recorded yet. Use Settings → Backups (or wait for daily snapshot under data/backups/).';
  return `Last backup ${d} day(s) ago. Please run Settings → Backups or copy data/ (incl. sd-dynamics.sqlite).`;
}
