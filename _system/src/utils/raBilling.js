/**
 * Contracting RA / retention / TDS holds — pure helpers for totals + PDF schedule.
 */
export function computeRaHolds(totals, opts = {}) {
  const gross = Number(totals?.grandTotal ?? totals?.total ?? totals?.totalAmount ?? 0) || 0;
  const retentionPercent = Number(opts.retentionPercent) || 0;
  const retentionAmount = opts.retentionAmount != null && opts.retentionAmount !== ''
    ? Number(opts.retentionAmount) || 0
    : Math.round(gross * retentionPercent) / 100;
  const tdsItPercent = Number(opts.tdsItPercent) || 0;
  const tdsItAmount = opts.tdsItAmount != null && opts.tdsItAmount !== ''
    ? Number(opts.tdsItAmount) || 0
    : Math.round(gross * tdsItPercent) / 100;
  const tdsGstPercent = Number(opts.tdsGstPercent) || 0;
  const tdsGstAmount = opts.tdsGstAmount != null && opts.tdsGstAmount !== ''
    ? Number(opts.tdsGstAmount) || 0
    : Math.round(gross * tdsGstPercent) / 100;
  const otherHoldAmount = Number(opts.otherHoldAmount) || 0;
  const holds = retentionAmount + tdsItAmount + tdsGstAmount + otherHoldAmount;
  const netPayable = Math.round((gross - holds) * 100) / 100;
  return {
    retentionPercent,
    retentionAmount: Math.round(retentionAmount * 100) / 100,
    tdsItPercent,
    tdsItAmount: Math.round(tdsItAmount * 100) / 100,
    tdsGstPercent,
    tdsGstAmount: Math.round(tdsGstAmount * 100) / 100,
    otherHoldAmount: Math.round(otherHoldAmount * 100) / 100,
    netPayable,
    gross,
  };
}

/** Journal lines for RA bill (additive to existing sales JE). */
export function raJournalLines({ billId, invoiceNumber, holds, clientName }) {
  const lines = [];
  if (holds.retentionAmount > 0) {
    lines.push({ account: 'Retention Receivable', debit: holds.retentionAmount, credit: 0, narration: `Retention on ${invoiceNumber}` });
  }
  if (holds.tdsItAmount > 0) {
    lines.push({ account: 'TDS Receivable (IT)', debit: holds.tdsItAmount, credit: 0, narration: `TDS 194C on ${invoiceNumber}` });
  }
  if (holds.tdsGstAmount > 0) {
    lines.push({ account: 'GST TDS Credit', debit: holds.tdsGstAmount, credit: 0, narration: `Sec 51 TDS GST on ${invoiceNumber}` });
  }
  return lines;
}
