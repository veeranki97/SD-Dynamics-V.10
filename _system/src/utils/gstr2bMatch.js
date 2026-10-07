
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
