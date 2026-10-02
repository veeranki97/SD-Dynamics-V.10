import { isSubmitted, isSoftDeleted, DOCSTATUS } from './softDelete.js';

export { isSubmitted, isSoftDeleted, DOCSTATUS };

/** Use in invoice edit screens: disable fields when submitted. */
export function invoiceIsReadOnly(bill) {
  if (!bill) return false;
  if (isSoftDeleted(bill)) return true;
  return isSubmitted(bill);
}
