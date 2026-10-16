/**
 * Level-1 GST filing assist (offline) — due dates + pre-file checks.
 * Does NOT call GSTN / GSP. JSON export stays in GSTReturns.jsx.
 */

/** Calendar month YYYY-MM of the return period (tax period, not due month). */
export function periodKeyFromDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Due dates for a tax period (YYYY-MM).
 * Monthly filer defaults: GSTR-1 = 11th of next month, GSTR-3B = 20th of next month.
 * QRMP: GSTR-1 = 13th of month after quarter end; GSTR-3B = 22nd (simplified — user can still file on portal).
 */
export function getReturnDueDates(periodYm, opts = {}) {
  const qrmp = !!opts.qrmp;
  const [ys, ms] = String(periodYm || '').split('-').map(Number);
  if (!ys || !ms) return null;
  const periodEnd = new Date(ys, ms, 0); // last day of tax month
  if (qrmp) {
    // Quarter containing this month ends at Mar/Jun/Sep/Dec
    const qEndMonth = Math.ceil(ms / 3) * 3; // 3,6,9,12
    const qEnd = new Date(ys, qEndMonth, 0);
    const after = new Date(qEnd.getFullYear(), qEnd.getMonth() + 1, 1);
    return {
      periodYm,
      gstr1Due: new Date(after.getFullYear(), after.getMonth(), 13),
      gstr3bDue: new Date(after.getFullYear(), after.getMonth(), 22),
      label: `QRMP Q${Math.ceil(ms / 3)} ${ys}`,
    };
  }
  const next = new Date(ys, ms, 1); // first of month after tax period
  return {
    periodYm,
    gstr1Due: new Date(next.getFullYear(), next.getMonth(), 11),
    gstr3bDue: new Date(next.getFullYear(), next.getMonth(), 20),
    label: periodYm,
  };
}

export function daysUntil(date, today = new Date()) {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((d - t) / 86400000);
}

function isTaxInvoiceLike(b) {
  const t = String(b.invoiceType || b.data?.invoiceOptions?.type || '').toLowerCase();
  if (/cancel/i.test(String(b.status || ''))) return false;
  if (/quot|proforma|challan|delivery|estimate/i.test(t)) return false;
  return /tax|invoice|credit|debit|bill.of.supply|b2b|b2c/i.test(t) || !t;
}

/**
 * Pre-file checklist for the period's bills (already filtered by period).
 * Returns { ok, items: [{ id, level: 'error'|'warn'|'ok', msg }] }
 */
export function buildPrefileChecklist(bills, profile = {}) {
  const items = [];
  const list = Array.isArray(bills) ? bills : [];
  const tax = list.filter(isTaxInvoiceLike);
  const hostGstin = String(profile.gstin || profile.GSTIN || '').trim().toUpperCase();

  items.push({
    id: 'count',
    level: 'ok',
    msg: `${tax.length} tax document(s) in this period (excl. quotation / proforma / DC / cancelled).`,
  });

  let missingGstin = 0;
  let shortHsn = 0;
  let noHsn = 0;
  const nums = [];

  for (const b of tax) {
    const gstin = String(b.data?.client?.gstin || b.clientGstin || '').trim().toUpperCase();
    const isB2b = gstin.length === 15;
    if (isB2b) {
      /* ok */
    } else if (/credit|debit/i.test(String(b.invoiceType || ''))) {
      /* CN may be B2C */
    } else {
      // large B2B without GSTIN is a risk
      const tot = Number(b.totalAmount || 0);
      if (tot >= 250000) missingGstin += 1;
    }
    const itemsArr = b.data?.items || b.items || [];
    for (const it of itemsArr) {
      const h = String(it.hsn || it.sac || it.hsnSac || '').replace(/\D/g, '');
      if (!h) noHsn += 1;
      else if (h.length < 4) shortHsn += 1;
    }
    const inv = String(b.invoiceNumber || '').trim();
    if (inv) nums.push(inv);
  }

  if (missingGstin) {
    items.push({
      id: 'gstin',
      level: 'error',
      msg: `${missingGstin} high-value invoice(s) without 15-digit customer GSTIN (check B2B).`,
    });
  } else {
    items.push({ id: 'gstin', level: 'ok', msg: 'No high-value invoices missing customer GSTIN.' });
  }

  if (shortHsn || noHsn) {
    items.push({
      id: 'hsn',
      level: shortHsn ? 'error' : 'warn',
      msg: `${noHsn} line(s) without HSN/SAC; ${shortHsn} with code shorter than 4 digits.`,
    });
  } else {
    items.push({ id: 'hsn', level: 'ok', msg: 'HSN/SAC present (min 4 digits) on lines checked.' });
  }

  if (!hostGstin || hostGstin.length !== 15) {
    items.push({
      id: 'host',
      level: 'warn',
      msg: 'Business GSTIN in Settings is missing or not 15 characters — JSON may fail portal validation.',
    });
  } else {
    items.push({ id: 'host', level: 'ok', msg: `Business GSTIN set (${hostGstin.slice(0, 5)}…).` });
  }

  // Soft sequence note
  items.push({
    id: 'seq',
    level: 'ok',
    msg: 'After export: upload GSTR-1 JSON on portal (Prepare Offline), then file GSTR-1 before GSTR-3B.',
  });

  const errors = items.filter((i) => i.level === 'error').length;
  return { ok: errors === 0, errors, items };
}
