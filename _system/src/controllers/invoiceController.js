/**
 * Invoice helpers aligned with SD-Dynamics file API + ledger.js.
 * NOT a parallel Express app. Real routes stay in root server.js.
 * Real client posting: InvoiceGenerator / Dashboard → saveJournal(ledger.js builders).
 */
import { DOCSTATUS, softDeleteRecord, isSoftDeleted, isSubmitted, assertCanEdit } from '../utils/softDelete.js';

export { DOCSTATUS, softDeleteRecord, isSoftDeleted, isSubmitted, assertCanEdit };

/**
 * Mark tax invoices as submitted after successful save (optional metadata).
 * Does not replace journal posting — journals remain client/server via /api/journals.
 */
export function withSubmittedFlag(bill) {
  const type = String(bill?.invoiceType || bill?.data?.invoiceType || 'tax-invoice').toLowerCase();
  const financial = !/quotation|delivery|challan|bill-of-supply|composition/.test(type);
  if (!financial) return { ...bill, docstatus: bill.docstatus ?? DOCSTATUS.DRAFT };
  return { ...bill, docstatus: DOCSTATUS.SUBMITTED };
}

/**
 * Fields allowed when editing a submitted invoice without full unlock
 * (payment status updates only).
 */
export const ALLOWED_WHEN_SUBMITTED = new Set([
  'status', 'paidAmount', 'payments', 'data', 'updatedAt', 'lastModified',
]);
