
/** GSTR-2B match buckets (taxable ±₹1, normalized invoice no). */
export function normalizeInvNo(n) {
  return String(n || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}
export function match2bRow(booksRow, portalRows, tol = 1) {
  const inv = normalizeInvNo(booksRow.invoiceNumber || booksRow.inv_no);
  const tax = Number(booksRow.taxable || booksRow.taxableAmount || 0);
  const hits = (portalRows || []).filter(p => normalizeInvNo(p.inum || p.invoiceNumber) === inv);
  if (!hits.length) return { bucket: 'Books-not-2B', risk: true };
  const p = hits[0];
  const ptax = Number(p.txval || p.taxable || 0);
  if (Math.abs(ptax - tax) <= tol) return { bucket: 'Matched', risk: false, portal: p };
  return { bucket: 'Mismatch', risk: true, portal: p, diff: ptax - tax };
}
export function portalOnly(portalRows, booksRows) {
  const bookSet = new Set((booksRows || []).map(b => normalizeInvNo(b.invoiceNumber || b.inv_no)));
  return (portalRows || []).filter(p => !bookSet.has(normalizeInvNo(p.inum || p.invoiceNumber)))
    .map(p => ({ bucket: '2B-not-books', portal: p }));
}

/** Normalize invoice references for portal/book matching, including numeric padding. */
export function normalizeInvoiceNumber(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\d+/g, (digits) => digits.replace(/^0+(?=\d)/, ''))
    .replace(/[^A-Z0-9]+/g, '');
}

/**
 * Parse common GST portal GSTR-2B JSON exports into a flat, stable row shape.
 * Accepts the portal's data.docdata.b2b shape and already-normalized b2b arrays.
 */
export function parseGstPortal2bJson(input) {
  let data = input;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { throw new Error('Invalid GSTR-2B JSON'); }
  }
  if (!data || typeof data !== 'object') return [];
  const root = data.data && typeof data.data === 'object' ? data.data : data;
  const suppliers = root.docdata?.b2b || root.b2b || data.docdata?.b2b || data.b2b || [];
  const rows = [];
  for (const supplier of suppliers) {
    const supplierGstin = String(supplier.ctin || supplier.gstin || '').trim().toUpperCase();
    const supplierName = supplier.trdnm || supplier.lgnm || supplier.name || '';
    for (const invoice of supplier.inv || []) {
      const items = Array.isArray(invoice.items) ? invoice.items : [];
      const totals = items.reduce((acc, item) => ({
        taxable: acc.taxable + (Number(item.txval ?? item.taxable) || 0),
        igst: acc.igst + (Number(item.iamt ?? item.igst) || 0),
        cgst: acc.cgst + (Number(item.camt ?? item.cgst) || 0),
        sgst: acc.sgst + (Number(item.samt ?? item.sgst) || 0),
      }), { taxable: 0, igst: 0, cgst: 0, sgst: 0 });
      rows.push({
        supplierGstin,
        supplierName,
        invoiceNumber: String(invoice.inum || invoice.invoiceNumber || ''),
        date: invoice.dt || invoice.idt || '',
        taxable: totals.taxable,
        igst: totals.igst,
        cgst: totals.cgst,
        sgst: totals.sgst,
        totalTaxAmount: totals.igst + totals.cgst + totals.sgst,
        total: Number(invoice.val) || totals.taxable + totals.igst + totals.cgst + totals.sgst,
        itcAvailable: String(invoice.itcavl ?? 'Y').toUpperCase() !== 'N',
      });
    }
  }
  return rows;
}

/** Reconcile normalized portal rows against purchase records without mutating either input. */
export function matchGstr2bToPurchases(portalRows, purchases, tolerance = 1) {
  const matched = [];
  const mismatch = [];
  const inBooksNotIn2b = [];
  const matchedPurchaseIndexes = new Set();
  const usedPortalIndexes = new Set();
  const portal = Array.isArray(portalRows) ? portalRows : [];
  const books = Array.isArray(purchases) ? purchases : [];

  portal.forEach((row, portalIndex) => {
    const inv = normalizeInvoiceNumber(row.invoiceNumber || row.invNo || row.inum);
    const gstin = String(row.supplierGstin || row.gstin || row.ctin || '').toUpperCase();
    const purchaseIndex = books.findIndex((purchase, index) => !matchedPurchaseIndexes.has(index)
      && normalizeInvoiceNumber(purchase.invoiceNumber || purchase.inv_no) === inv
      && (!gstin || !purchase.supplierGstin || String(purchase.supplierGstin).toUpperCase() === gstin));
    if (purchaseIndex < 0) return;
    const purchase = books[purchaseIndex];
    matchedPurchaseIndexes.add(purchaseIndex);
    usedPortalIndexes.add(portalIndex);
    const totals = purchase.totals || {};
    const purchaseTaxable = Number(totals.taxableAmount ?? totals.subtotal ?? purchase.taxable ?? 0) || 0;
    const purchaseTax = Number(totals.totalTaxAmount ?? ((Number(totals.igst) || 0) + (Number(totals.cgst) || 0) + (Number(totals.sgst) || 0))) || 0;
    const portalTax = Number(row.totalTaxAmount ?? ((Number(row.igst) || 0) + (Number(row.cgst) || 0) + (Number(row.sgst) || 0))) || 0;
    const taxableDiff = Math.abs(Number(row.taxable) - purchaseTaxable);
    const taxDiff = Math.abs(portalTax - purchaseTax);
    const result = { portal: row, purchase, taxableDiff, taxDiff };
    if (taxableDiff <= tolerance && taxDiff <= tolerance) matched.push(result);
    else mismatch.push(result);
  });

  books.forEach((purchase, index) => {
    if (!matchedPurchaseIndexes.has(index)) inBooksNotIn2b.push(purchase);
  });
  return {
    matched,
    mismatch,
    inBooksNotIn2b,
    portalNotInBooks: portal.filter((_, index) => !usedPortalIndexes.has(index)),
  };
}
