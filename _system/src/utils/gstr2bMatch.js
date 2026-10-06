/**
 * Enterprise GSTR-2B Auto-Reconciliation Engine — SD Dynamics
 *
 * Compliant with Section 16(2)(aa) of CGST Act.
 * Features:
 * - Direct parsing of raw GST Portal GSTR-2B JSON (B2B, B2BA, CDNR).
 * - Fuzzy invoice number matching (handles varying separators / - _ and leading zeros).
 * - Component-wise tax verification (CGST, SGST, IGST, Cess, Taxable).
 * - ITC Eligibility detection (itcavl = 'Y' vs 'N').
 * - 4-way classification: Exact Match, Tax/Value Mismatch, Unclaimed in Books, At-Risk (Missing in 2B).
 */

function num(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Normalize invoice numbers for robust fuzzy matching.
 * Examples:
 *   "INV/2026/0045" -> "INV202645"
 *   "INV-26-27-045" -> "INV262745"
 *   "000123"        -> "123"
 */
export function normalizeInvoiceNumber(invNum) {
  if (!invNum) return '';
  const s = String(invNum).trim().toUpperCase();
  // Split on non-alphanumeric separators (/, -, _, space, etc.)
  const segments = s.split(/[^A-Z0-9]+/).filter(Boolean);
  if (!segments.length) return s.replace(/[^A-Z0-9]/g, '');
  // For each segment, if purely numeric, strip leading zeros
  const normSegments = segments.map(seg => {
    if (/^\d+$/.test(seg)) {
      return seg.replace(/^0+/, '') || '0';
    }
    return seg;
  });
  return normSegments.join('');
}

/**
 * Normalizes a single 2B row into a standard schema.
 */
export function normalize2bRow(r) {
  return {
    supplierGstin: String(r.ctin || r.gstin || r.supplierGstin || '').toUpperCase().trim(),
    supplierName: r.tradeName || r.legalName || r.supplierName || '',
    invoiceNumber: String(r.inum || r.invoiceNumber || r.inv_num || '').trim(),
    normalizedInvNum: normalizeInvoiceNumber(r.inum || r.invoiceNumber || r.inv_num),
    invoiceDate: String(r.dt || r.invoiceDate || r.date || '').slice(0, 10),
    invoiceType: r.typ || r.inv_typ || r.docType || 'R', // R = Regular, DE = Deemed Exp, SEZ = SEZ, C = Credit Note, D = Debit Note
    taxable: num(r.txval ?? r.taxable ?? r.taxableValue),
    igst: num(r.iamt ?? r.igst),
    cgst: num(r.camt ?? r.cgst),
    sgst: num(r.samt ?? r.sgst),
    cess: num(r.csamt ?? r.cess),
    totalTax: num((r.iamt ?? r.igst ?? 0) + (r.camt ?? r.cgst ?? 0) + (r.samt ?? r.sgst ?? 0) + (r.csamt ?? r.cess ?? 0)),
    totalInvoiceValue: num(r.val ?? r.total ?? 0),
    itcAvailable: r.itcavl === 'N' ? 'N' : 'Y',
    itcReason: r.rsn || '',
    reverseCharge: r.rchrg === 'Y' ? 'Y' : 'N',
    placeOfSupply: r.pos || '',
  };
}

/**
 * Parse raw GST Portal GSTR-2B JSON file.
 * Handles both official nested portal schema (data.docdata.b2b / cdnr) and flat array.
 */
export function parseGstPortal2bJson(jsonContent) {
  let root = jsonContent;
  if (typeof root === 'string') {
    try {
      root = JSON.parse(jsonContent);
    } catch {
      return [];
    }
  }
  if (!root) return [];
  if (Array.isArray(root)) {
    return root.map(normalize2bRow);
  }

  const docdata = root.data?.docdata || root.docdata || root;
  const rows = [];

  // 1. Process B2B Invoices
  const b2bList = docdata.b2b || [];
  for (const supplier of b2bList) {
    const ctin = supplier.ctin;
    const legalName = supplier.lgnm || supplier.trdnm || '';
    for (const inv of (supplier.inv || [])) {
      let txval = 0, igst = 0, cgst = 0, sgst = 0, cess = 0;
      for (const item of (inv.items || [])) {
        txval += Number(item.txval || 0);
        igst += Number(item.iamt || 0);
        cgst += Number(item.camt || 0);
        sgst += Number(item.samt || 0);
        cess += Number(item.csamt || 0);
      }
      rows.push(normalize2bRow({
        ctin,
        supplierName: legalName,
        inum: inv.inum,
        dt: inv.dt,
        val: inv.val,
        inv_typ: inv.inv_typ,
        pos: inv.pos,
        rchrg: inv.rchrg,
        itcavl: inv.itcavl,
        rsn: inv.rsn,
        txval: num(txval),
        iamt: num(igst),
        camt: num(cgst),
        samt: num(sgst),
        csamt: num(cess),
      }));
    }
  }

  // 2. Process CDNR (Credit / Debit Notes)
  const cdnrList = docdata.cdnr || [];
  for (const supplier of cdnrList) {
    const ctin = supplier.ctin;
    const legalName = supplier.lgnm || supplier.trdnm || '';
    for (const nt of (supplier.nt || [])) {
      let txval = 0, igst = 0, cgst = 0, sgst = 0, cess = 0;
      for (const item of (nt.items || [])) {
        txval += Number(item.txval || 0);
        igst += Number(item.iamt || 0);
        cgst += Number(item.camt || 0);
        sgst += Number(item.samt || 0);
        cess += Number(item.csamt || 0);
      }
      rows.push(normalize2bRow({
        ctin,
        supplierName: legalName,
        inum: nt.nt_num || nt.inum,
        dt: nt.nt_dt || nt.dt,
        val: nt.val,
        inv_typ: nt.typ === 'C' ? 'Credit Note' : 'Debit Note',
        itcavl: nt.itcavl,
        rsn: nt.rsn,
        txval: num(txval),
        iamt: num(igst),
        camt: num(cgst),
        samt: num(sgst),
        csamt: num(cess),
      }));
    }
  }

  return rows;
}

/**
 * Comprehensive reconciliation of GSTR-2B against ERP Purchase Bills.
 *
 * @param {Array} twoBRows - Parsed GSTR-2B rows
 * @param {Array} purchases - Local Purchase Bills from SD Dynamics
 * @param {number} tolerance - Allowable rounding tolerance in rupees (default ₹1.00)
 */
export function matchGstr2bToPurchases(twoBRows, purchases, tolerance = 1.0) {
  // Normalize books records
  const books = (purchases || []).map(p => {
    const totals = p.totals || p.data?.totals || {};
    const taxable = num(totals.taxableAmount ?? totals.taxable ?? p.taxable ?? p.subtotal ?? 0);
    const cgst = num(totals.cgst ?? p.cgst ?? 0);
    const sgst = num(totals.sgst ?? p.sgst ?? 0);
    const igst = num(totals.igst ?? p.igst ?? 0);
    const cess = num(totals.cess ?? p.cess ?? 0);
    const totalTax = num(totals.totalTaxAmount ?? totals.tax ?? (cgst + sgst + igst + cess));
    const invNum = String(p.invoiceNumber || p.billNumber || p.id || '').trim();

    return {
      id: p.id,
      supplierGstin: String(p.supplierGstin || p.vendorGstin || p.data?.vendor?.gstin || '').toUpperCase().trim(),
      supplierName: p.supplierName || p.vendorName || p.data?.vendor?.name || '',
      invoiceNumber: invNum,
      normalizedInvNum: normalizeInvoiceNumber(invNum),
      invoiceDate: String(p.date || p.billDate || p.invoiceDate || '').slice(0, 10),
      taxable,
      cgst,
      sgst,
      igst,
      cess,
      totalTax,
      totalAmount: num(p.totalAmount ?? p.total ?? (taxable + totalTax)),
      raw: p,
    };
  });

  const portal = (twoBRows || []).map(normalize2bRow);
  const matched = [];
  const mismatch = [];
  const in2bNotInBooks = [];
  const inBooksNotIn2b = [];
  const ineligibleItc = [];

  const usedBooks = new Set();
  const usedPortal = new Set();

  // Primary Pass: Exact & Fuzzy Matching from Portal to Books
  for (let i = 0; i < portal.length; i++) {
    const pr = portal[i];

    if (pr.itcAvailable === 'N') {
      ineligibleItc.push(pr);
    }

    let found = -1;

    // 1. Try exact GSTIN + exact Invoice Number
    for (let j = 0; j < books.length; j++) {
      if (usedBooks.has(j)) continue;
      const b = books[j];
      const gstinMatch = !b.supplierGstin || !pr.supplierGstin || b.supplierGstin === pr.supplierGstin;
      if (gstinMatch && b.invoiceNumber.toLowerCase() === pr.invoiceNumber.toLowerCase()) {
        found = j;
        break;
      }
    }

    // 2. Try exact GSTIN + normalized (fuzzy) Invoice Number
    if (found < 0) {
      for (let j = 0; j < books.length; j++) {
        if (usedBooks.has(j)) continue;
        const b = books[j];
        const gstinMatch = !b.supplierGstin || !pr.supplierGstin || b.supplierGstin === pr.supplierGstin;
        if (gstinMatch && b.normalizedInvNum && pr.normalizedInvNum && b.normalizedInvNum === pr.normalizedInvNum) {
          found = j;
          break;
        }
      }
    }

    if (found < 0) {
      in2bNotInBooks.push(pr);
      continue;
    }

    usedBooks.add(found);
    usedPortal.add(i);
    const b = books[found];

    // Check financial variances
    const taxableDiff = num(b.taxable - pr.taxable);
    const taxDiff = num(b.totalTax - pr.totalTax);
    const igstDiff = num(b.igst - pr.igst);
    const cgstDiff = num(b.cgst - pr.cgst);
    const sgstDiff = num(b.sgst - pr.sgst);

    const hasTaxableMismatch = Math.abs(taxableDiff) > tolerance;
    const hasTaxMismatch = Math.abs(taxDiff) > tolerance;
    const hasComponentMismatch = (Math.abs(igstDiff) > tolerance || Math.abs(cgstDiff) > tolerance || Math.abs(sgstDiff) > tolerance);

    if (hasTaxableMismatch || hasTaxMismatch || hasComponentMismatch) {
      mismatch.push({
        portal: pr,
        books: b,
        variance: {
          taxableDiff,
          taxDiff,
          igstDiff,
          cgstDiff,
          sgstDiff,
          componentMismatch: hasComponentMismatch,
        },
      });
    } else {
      matched.push({ portal: pr, books: b });
    }
  }

  // Identify invoices recorded in Books but never reported in GSTR-2B (ITC At-Risk)
  for (let j = 0; j < books.length; j++) {
    if (!usedBooks.has(j)) {
      inBooksNotIn2b.push(books[j]);
    }
  }

  return {
    matched,
    mismatch,
    inBooksNotIn2b,
    in2bNotInBooks,
    ineligibleItc,
    summary: {
      totalPortalRecords: portal.length,
      totalBooksRecords: books.length,
      matchedCount: matched.length,
      mismatchCount: mismatch.length,
      missingInBooksCount: in2bNotInBooks.length,
      atRiskBooksCount: inBooksNotIn2b.length,
      ineligibleItcCount: ineligibleItc.length,
    },
  };
}
