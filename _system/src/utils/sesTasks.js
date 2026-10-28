/** Ariba SES → invoice upload follow-up (localStorage) with real due/overdue reminders. */
const KEY = 'sd_tasks_v1';
const NAG_KEY = 'sd_ses_nag_day';

export function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveTasks(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
  try {
    window.dispatchEvent(new CustomEvent('sd-tasks-changed'));
  } catch (_) {}
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Days past due (negative = due in future). 0 = due today. */
export function daysRelativeToDue(due) {
  if (!due) return null;
  const d = new Date(String(due).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date();
  t.setHours(12, 0, 0, 0);
  return Math.floor((t - d) / 86400000);
}

export function getOpenSesTasks(list) {
  return (list || loadTasks()).filter((t) => !t.done && t.type === 'ariba_ses');
}

/**
 * Buckets for bell / dashboard:
 * overdue (due < today), dueToday, upcoming (due within 7 days)
 */
export function getSesReminderBuckets(list) {
  const open = getOpenSesTasks(list);
  const overdue = [];
  const dueToday = [];
  const upcoming = [];
  open.forEach((t) => {
    const rel = daysRelativeToDue(t.due);
    if (rel == null) {
      upcoming.push(t);
      return;
    }
    if (rel > 0) overdue.push({ ...t, _daysLate: rel });
    else if (rel === 0) dueToday.push(t);
    else if (rel >= -7) upcoming.push({ ...t, _daysUntil: -rel });
  });
  overdue.sort((a, b) => (b._daysLate || 0) - (a._daysLate || 0));
  return { overdue, dueToday, upcoming, open };
}

export function billRequiresAribaSesFollowUp(bill) {
  if (!bill) return false;
  const t = String(bill.invoiceType || bill.data?.invoiceType || '').toLowerCase();
  if (t.includes('quot') || t.includes('proforma') || t.includes('credit') || t.includes('delivery') || t.includes('challan')) {
    return false;
  }
  const d = bill.data?.details || bill.data || {};
  if (bill.requiresAribaSes || bill.aribaSesRequired || d.requiresAribaSes || d.aribaSesRequired) return true;
  const ses = bill.sesRef || bill.aribaSes || d.sesRef || d.aribaSes || d.sesNumber;
  if (ses && String(ses).trim()) return true;
  return false;
}

export function createSesFollowUpFromBill(bill, extra = {}) {
  if (!bill) return { skipped: true, task: null, reason: 'no-bill' };
  // Action menu uses force / fromActionMenu so user click always runs create path
  if (!extra.force && !extra.fromActionMenu && !billRequiresAribaSesFollowUp(bill)) {
    return { skipped: true, task: null, reason: 'not-eligible' };
  }
  const inv =
    bill.invoiceNumber ||
    bill.number ||
    bill.data?.details?.invoiceNumber ||
    extra.invoiceNo ||
    bill.id ||
    'invoice';
  const party =
    bill.client?.name || bill.clientName || bill.party || extra.clientName || '';
  const sesRef =
    extra.sesRef ||
    bill.sesRef ||
    bill.aribaSes ||
    bill.buyerOrderNo ||
    bill.poNumber ||
    bill.data?.buyerOrderNo ||
    bill.data?.sesRef ||
    bill.data?.details?.buyerOrderNo ||
    '';
  return createSesFollowUpTask({
    invoiceNo: String(inv),
    clientName: String(party || ''),
    sesRef: String(sesRef || ''),
    dueDays: extra.dueDays != null ? extra.dueDays : 3,
    billId: bill.id,
  });
}

export function createSesFollowUpTask({
  invoiceNo,
  clientName,
  sesRef,
  dueDays = 3,
  billId,
} = {}) {
  const list = loadTasks();
  const inv = (invoiceNo || 'invoice').trim() || 'invoice';
  const party = (clientName || '').trim() || 'client';
  const title = sesRef
    ? 'Ariba: upload invoice ' + inv + ' for SES ' + sesRef + ' (' + party + ')'
    : 'Ariba: after SES created, upload invoice ' + inv + ' (' + party + ')';
  const due = new Date();
  due.setDate(due.getDate() + (Number(dueDays) || 3));
  const dueStr = due.toISOString().slice(0, 10);
  const task = {
    id: 'task_ses_' + Date.now(),
    title,
    due: dueStr,
    done: false,
    type: 'ariba_ses',
    invoiceNo: inv,
    clientName: party,
    sesRef: sesRef || '',
    billId: billId || '',
    remindCount: 0,
    lastRemindedAt: null,
    createdAt: new Date().toISOString(),
  };
  const invKey = String(inv || '').trim();
  const existing = list.find(
    (t) => !t.done && t.type === 'ariba_ses' && String(t.invoiceNo || '').trim() === invKey
  );
  if (existing) {
    try { window.dispatchEvent(new CustomEvent('sd-tasks-changed')); } catch (_) {}
    return { skipped: true, task: existing, reason: 'duplicate' };
  }
  saveTasks([task, ...list]);
  try { window.dispatchEvent(new CustomEvent('sd-tasks-changed')); } catch (_) {}
  return { skipped: false, task, reason: 'created' };
}

/** Push due date by N days (default +3). */
export function snoozeSesTask(id, days = 3) {
  const list = loadTasks();
  const next = list.map((t) => {
    if (t.id !== id) return t;
    const base = t.due ? new Date(String(t.due).slice(0, 10) + 'T12:00:00') : new Date();
    if (Number.isNaN(base.getTime())) base.setTime(Date.now());
    base.setDate(base.getDate() + (Number(days) || 3));
    return {
      ...t,
      due: base.toISOString().slice(0, 10),
      snoozedAt: new Date().toISOString(),
    };
  });
  saveTasks(next);
  return next.find((t) => t.id === id) || null;
}

export function markSesDone(id) {
  const list = loadTasks();
  const next = list.map((t) =>
    t.id === id
      ? { ...t, done: true, completedAt: new Date().toISOString() }
      : t
  );
  saveTasks(next);
}

export function bumpRemindCount(id) {
  const list = loadTasks();
  const next = list.map((t) =>
    t.id === id
      ? {
          ...t,
          remindCount: (t.remindCount || 0) + 1,
          lastRemindedAt: new Date().toISOString(),
        }
      : t
  );
  saveTasks(next);
}

/** Once per calendar day: return summary text if SES overdue/due today, else null. */
export function consumeDailySesNag() {
  const day = todayStr();
  try {
    if (localStorage.getItem(NAG_KEY) === day) return null;
  } catch (_) {}
  const { overdue, dueToday } = getSesReminderBuckets();
  if (!overdue.length && !dueToday.length) return null;
  try {
    localStorage.setItem(NAG_KEY, day);
  } catch (_) {}
  const parts = [];
  if (overdue.length)
    parts.push(overdue.length + ' overdue Ariba SES upload' + (overdue.length > 1 ? 's' : ''));
  if (dueToday.length)
    parts.push(dueToday.length + ' due today');
  return parts.join(' · ') + ' — open Tasks';
}
