/**
 * Read-only document ↔ journal reconciliation helpers.
 */
import { isActiveJournal } from './ledger';

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

/**
 * @param {object[]} journals
 * @param {{ bills?: object[], expenses?: object[] }} docs
 */
export function reconcileDocumentsToJournals(journals, docs = {}) {
  const active = (journals || []).filter(isActiveJournal);
  const byRef = new Map();
  for (const j of active) {
    const key = `${norm(j.refType)}::${norm(j.refId)}`;
    if (!byRef.has(key)) byRef.set(key, []);
    byRef.get(key).push(j);
  }

  const missingInvoiceJournals = [];
  for (const b of docs.bills || []) {
    const t = String(b.invoiceType || b.data?.invoiceType || '').toLowerCase();
    if (!(t.includes('tax') || t === 'invoice' || t.includes('debit'))) continue;
    const ids = [b.id, b.invoiceNumber].filter(Boolean);
    const found = ids.some((id) => byRef.has(`invoice::${norm(id)}`));
    if (!found) {
      missingInvoiceJournals.push({
        entityType: 'invoice',
        entityId: b.invoiceNumber || b.id,
        totalAmount: b.totalAmount,
        status: b.status,
      });
    }
  }

  const missingExpenseJournals = [];
  for (const e of docs.expenses || []) {
    const ids = [e.id, e.expenseNumber, e.voucherNo].filter(Boolean);
    const found = ids.some((id) => byRef.has(`expense::${norm(id)}`));
    if (!found) {
      missingExpenseJournals.push({
        entityType: 'expense',
        entityId: e.expenseNumber || e.voucherNo || e.id,
        amount: e.amount,
      });
    }
  }

  const known = new Set();
  for (const b of docs.bills || []) {
    if (b.id) known.add(norm(b.id));
    if (b.invoiceNumber) known.add(norm(b.invoiceNumber));
  }
  for (const e of docs.expenses || []) {
    if (e.id) known.add(norm(e.id));
    if (e.expenseNumber) known.add(norm(e.expenseNumber));
  }

  const orphanJournals = active
    .filter((j) => ['invoice', 'expense', 'payment'].includes(String(j.refType || '')) && j.refId && !known.has(norm(j.refId)))
    .map((j) => ({ id: j.id, refType: j.refType, refId: j.refId, narration: j.narration }));

  return {
    missingInvoiceJournals,
    missingExpenseJournals,
    orphanJournals,
    summary: {
      missingInvoices: missingInvoiceJournals.length,
      missingExpenses: missingExpenseJournals.length,
      orphans: orphanJournals.length,
    },
  };
}
