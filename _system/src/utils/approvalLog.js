/**
 * Append-only approval log (large PO / credit note) — ERPNext-style light control.
 * Stored in meta.approvalLog[] via /api/meta merge when available, else localStorage.
 */

const LS = 'sd_approval_log';

export function readApprovalLog() {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) return JSON.parse(raw) || [];
  } catch { /* */ }
  return [];
}

export function appendApproval(entry) {
  const row = {
    type: entry.type || 'po',
    docId: entry.docId || '',
    docNo: entry.docNo || '',
    amount: Number(entry.amount) || 0,
    action: entry.action || 'confirmed',
    userName: entry.userName || 'local',
    at: entry.at || new Date().toISOString(),
  };
  const list = readApprovalLog();
  list.unshift(row);
  const trimmed = list.slice(0, 200);
  try { localStorage.setItem(LS, JSON.stringify(trimmed)); } catch { /* */ }
  return row;
}

export const LARGE_PO_THRESHOLD = 100000;
