/** Period lock after GSTR filing — block edits in locked YYYY-MM months. */

export function monthKeyFromDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).slice(0, 10);
  if (s.length >= 7) return s.slice(0, 7); // YYYY-MM
  return '';
}

export function isMonthLocked(meta, dateStr) {
  const key = monthKeyFromDate(dateStr);
  if (!key || !meta) return false;
  const locked = meta.lockedMonths || meta.locked_months || [];
  return Array.isArray(locked) && locked.includes(key);
}

export function withLockedMonth(meta, yyyymm) {
  const m = { ...(meta || {}) };
  const set = new Set(m.lockedMonths || []);
  set.add(String(yyyymm).slice(0, 7));
  m.lockedMonths = [...set].sort();
  return m;
}

export function withoutLockedMonth(meta, yyyymm) {
  const m = { ...(meta || {}) };
  const key = String(yyyymm).slice(0, 7);
  m.lockedMonths = (m.lockedMonths || []).filter(x => x !== key);
  return m;
}
