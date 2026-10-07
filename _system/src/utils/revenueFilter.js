/** Documents that count toward turnover / GSTR outward taxable sales / AR. */

export function normalizeInvoiceType(bill) {
  return String(bill?.invoiceType || bill?.data?.invoiceType || bill?.type || 'tax-invoice').toLowerCase().trim();
}

export function isCancelled(bill) {
  const s = String(bill?.status || '').toLowerCase();
  return s === 'cancelled' || s === 'canceled' || bill?.deleted || bill?.isDeleted;
}

export function isConverted(bill) {
  const s = String(bill?.status || '').toLowerCase();
  return s === 'converted' || !!bill?.convertedToInvoiceId || !!bill?.data?.convertedLocked || !!bill?.data?.convertedToInvoiceId;
}

/** Quotation, proforma, delivery challan — not revenue / not AR (unless you explicitly track PI AR before convert). */
export function isNonRevenueType(type) {
  const t = String(type || '').toLowerCase();
  return /quotation|quote|estimate|proforma|delivery[\s-]?challan|challan/.test(t);
}

/**
 * Tax invoice / bill of supply / debit note — revenue.
 * Converted / cancelled / quotation / PI / DC excluded.
 */
export function isRevenueDocument(bill) {
  if (!bill || isCancelled(bill) || isConverted(bill)) return false;
  const t = normalizeInvoiceType(bill);
  if (isNonRevenueType(t)) return false;
  if (/credit/.test(t)) return false;
  return /tax|invoice|bill-of-supply|bill_of_supply|debit/.test(t) || t === '' || t === 'tax-invoice';
}

export function isCreditNote(bill) {
  return /credit/.test(normalizeInvoiceType(bill)) && !isCancelled(bill);
}

/** AR / outstanding: only open tax invoices (and optional unpaid PI that is NOT converted). */
export function isReceivableDocument(bill) {
  if (!bill || isCancelled(bill) || isConverted(bill)) return false;
  const t = normalizeInvoiceType(bill);
  if (/quotation|quote|estimate|delivery|challan/.test(t)) return false;
  // Proforma only if still open (not converted) — many CAs prefer excluding PI from AR; exclude PI from aging
  if (/proforma/.test(t)) return false;
  if (/credit/.test(t)) return false;
  return true;
}

export function revenueSignedAmount(bill) {
  const amt = Number(bill?.totalAmount) || Number(bill?.data?.totals?.grandTotal) || 0;
  if (isCreditNote(bill)) return -Math.abs(amt);
  if (!isRevenueDocument(bill)) return 0;
  return amt;
}

export function revenueSignedTaxable(bill) {
  const t = Number(bill?.taxableAmount)
    || Number(bill?.data?.totals?.taxable)
    || Number(bill?.data?.totals?.subTotal)
    || 0;
  if (isCreditNote(bill)) return -Math.abs(t);
  if (!isRevenueDocument(bill)) return 0;
  return t;
}

export function revenueSignedTax(bill) {
  const tax = Number(bill?.totalTaxAmount)
    || Number(bill?.data?.totals?.totalTax)
    || ((Number(bill?.data?.totals?.cgst) || 0) + (Number(bill?.data?.totals?.sgst) || 0) + (Number(bill?.data?.totals?.igst) || 0));
  if (isCreditNote(bill)) return -Math.abs(tax);
  if (!isRevenueDocument(bill)) return 0;
  return tax;
}
