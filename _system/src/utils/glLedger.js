/**
 * COMPATIBILITY SHIM — do not implement a second GL here.
 * All double-entry logic lives in ./ledger.js (journalFromTaxInvoice, journalFromPayment, …).
 * This file re-exports soft-delete DOCSTATUS and documents the correct posting path.
 */
export { DOCSTATUS } from './softDelete.js';

/** @deprecated Use journalFromTaxInvoice / journalFromPayment from ledger.js */
export function makeGLEntry() {
  throw new Error(
    'makeGLEntry is disabled. Use journalFromTaxInvoice / journalFromPayment from src/utils/ledger.js and saveJournal().'
  );
}

/** @deprecated Use journalReversePayment from ledger.js */
export function reverseGLEntry() {
  throw new Error(
    'reverseGLEntry is disabled. Use journalReversePayment from src/utils/ledger.js and saveJournal().'
  );
}
