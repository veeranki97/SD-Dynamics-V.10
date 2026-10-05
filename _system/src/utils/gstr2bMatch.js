/**
 * Match GSTR-2B rows to local purchases (₹1 taxable tolerance).
 */
function num(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function normalize2bRow(r) {
  return {
    supplierGstin: String(r.ctin || r.gstin || r.supplierGstin || '').toUpperCase(),
    invoiceNumber: String(r.inum || r.invoiceNumber || r.inv_num || '').trim(),
    invoiceDate: String(r.dt || r.invoiceDate || r.date || '').slice(0, 10),
    taxable: num(r.txval ?? r.taxable ?? r.taxableValue),
    igst: num(r.iamt ?? r.igst),
    cgst: num(r.camt ?? r.cgst),
    sgst: num(r.samt ?? r.sgst),
  };
}

export function matchGstr2bToPurchases(twoBRows, purchases, tolerance = 1) {
  const books = (purchases || []).map(p => ({
    id: p.id,
    supplierGstin: String(p.supplierGstin || '').toUpperCase(),
    invoiceNumber: String(p.invoiceNumber || '').trim(),
    invoiceDate: String(p.date || p.invoiceDate || '').slice(0, 10),
    taxable: num(p.totals?.taxable ?? p.taxable ?? p.subtotal),
    raw: p,
  }));
  const portal = (twoBRows || []).map(normalize2bRow);
  const matched = [];
  const inBooksNotIn2b = [];
  const in2bNotInBooks = [];
  const mismatch = [];
  const usedBooks = new Set();
  const usedPortal = new Set();

  for (let i = 0; i < portal.length; i++) {
    const pr = portal[i];
    let found = -1;
    for (let j = 0; j < books.length; j++) {
      if (usedBooks.has(j)) continue;
      const b = books[j];
      if (b.supplierGstin && pr.supplierGstin && b.supplierGstin !== pr.supplierGstin) continue;
      if (b.invoiceNumber && pr.invoiceNumber && b.invoiceNumber.toLowerCase() !== pr.invoiceNumber.toLowerCase()) continue;
      found = j;
      break;
    }
    if (found < 0) {
      in2bNotInBooks.push(pr);
      continue;
    }
    usedBooks.add(found);
    usedPortal.add(i);
    const b = books[found];
    if (Math.abs(b.taxable - pr.taxable) > tolerance) {
      mismatch.push({ portal: pr, books: b, delta: num(b.taxable - pr.taxable) });
    } else {
      matched.push({ portal: pr, books: b });
    }
  }
  for (let j = 0; j < books.length; j++) {
    if (!usedBooks.has(j)) inBooksNotIn2b.push(books[j]);
  }
  return { matched, inBooksNotIn2b, in2bNotInBooks, mismatch };
}
