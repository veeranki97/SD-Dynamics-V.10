/** Ariba SES → invoice upload follow-up tasks (localStorage). */
const KEY = 'sd_tasks_v1';

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

/**
 * Auto-create SES follow-up from an invoice/bill object (no prompts).
 * Returns { skipped, task }.
 */
export function createSesFollowUpFromBill(bill, extra = {}) {
  if (!bill) return { skipped: true, task: null };
  const inv =
    bill.invoiceNumber ||
    bill.number ||
    bill.id ||
    extra.invoiceNo ||
    'invoice';
  const party =
    bill.client?.name ||
    bill.clientName ||
    bill.party ||
    extra.clientName ||
    '';
  const sesRef =
    extra.sesRef ||
    bill.sesRef ||
    bill.aribaSes ||
    bill.buyerOrderNo ||
    bill.poNumber ||
    bill.data?.buyerOrderNo ||
    bill.data?.sesRef ||
    '';
  return createSesFollowUpTask({
    invoiceNo: String(inv),
    clientName: String(party || ''),
    sesRef: String(sesRef || ''),
    dueDays: extra.dueDays != null ? extra.dueDays : 3,
  });
}

export function createSesFollowUpTask({ invoiceNo, clientName, sesRef, dueDays = 3 } = {}) {
  const list = loadTasks();
  const inv = (invoiceNo || 'invoice').trim() || 'invoice';
  const party = (clientName || '').trim() || 'client';
  const title = sesRef
    ? 'Ariba: upload SES → invoice ' + inv + ' (' + party + ') · SES ' + sesRef
    : 'Ariba: upload SES → invoice ' + inv + ' (' + party + ') after SES created';
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
    createdAt: new Date().toISOString(),
  };
  const exists = list.some(
    (t) => !t.done && t.type === 'ariba_ses' && String(t.invoiceNo) === String(inv)
  );
  if (exists) return { skipped: true, task: null };
  saveTasks([task, ...list]);
  return { skipped: false, task };
}
