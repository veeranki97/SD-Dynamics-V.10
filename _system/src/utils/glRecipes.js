/**
 * Document → balanced GL lines (Phase C recipes).
 * Used only when meta.useGlEngine === true via postDocument.
 * Amounts in rupees; engine normalizes to paise.
 *
 * MVP wired: tax_invoice, receipt, pi_to_ti_advance, expense, purchase, vendor_payment, opening_balance, period_close
 */

import { DEFAULT_GL_MAP } from './coaSeed.js';

function mapId(meta, key) {
  const m = (meta && meta.glMap) || {};
  return m[key] || DEFAULT_GL_MAP[key];
}

function n(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

/** Tax invoice (final): Dr Debtors · Cr Revenue · Cr Output tax · Round-off */
export function linesTaxInvoice(bill, meta) {
  const data = bill.data || bill;
  const totals = data.totals || bill.totals || {};
  const total = n(bill.totalAmount != null ? bill.totalAmount : totals.grandTotal);
  const cgst = n(totals.cgst);
  const sgst = n(totals.sgst);
  const igst = n(totals.igst);
  const tax = n(totals.totalTax != null ? totals.totalTax : cgst + sgst + igst);
  let taxable = n(totals.subTotal != null ? totals.subTotal : totals.taxable);
  if (!taxable && total) taxable = n(total - tax);

  const lines = [
    { accountId: mapId(meta, 'receivables'), debit: total, credit: 0 },
    { accountId: mapId(meta, 'revenue'), debit: 0, credit: Math.max(0, taxable) },
  ];
  if (cgst > 0) lines.push({ accountId: mapId(meta, 'outputCgst'), debit: 0, credit: cgst });
  if (sgst > 0) lines.push({ accountId: mapId(meta, 'outputSgst'), debit: 0, credit: sgst });
  if (igst > 0) lines.push({ accountId: mapId(meta, 'outputIgst'), debit: 0, credit: igst });

  const dr = lines.reduce((s, e) => s + e.debit, 0);
  const cr = lines.reduce((s, e) => s + e.credit, 0);
  const diff = n(dr - cr);
  if (Math.abs(diff) >= 0.01) {
    if (diff > 0) lines.push({ accountId: mapId(meta, 'roundOff'), debit: 0, credit: diff });
    else lines.push({ accountId: mapId(meta, 'roundOff'), debit: -diff, credit: 0 });
  }

  const party = bill.clientName || data.client?.name || '';
  return lines.map((l) => ({
    ...l,
    partyType: 'client',
    partyId: party,
    workOrderId: bill.workOrderId || data.workOrderId || null,
    site: bill.site || data.site || null,
    costCenterId: bill.costCenterId || data.costCenterId || null,
  }));
}

/** Customer receipt / invoice payment: Dr Bank|Cash · Cr Debtors (no second bank on advance-apply) */
export function linesReceipt(payment, meta) {
  if (payment?.noBank || payment?.settlement === 'advance-apply' || payment?.mode === 'advance-apply') {
    return null;
  }
  const amt = n(payment.amount || payment.paidAmount);
  if (amt <= 0) return null;
  const mode = String(payment.mode || payment.paymentMode || 'bank').toLowerCase();
  const bankId = mode.includes('cash') ? mapId(meta, 'cash') : mapId(meta, 'operatingBank');
  return [
    { accountId: bankId, debit: amt, credit: 0, partyType: 'client', partyId: payment.clientName || payment.party || '' },
    { accountId: mapId(meta, 'receivables'), debit: 0, credit: amt, partyType: 'client', partyId: payment.clientName || payment.party || '' },
  ];
}

/** PI → TI: transfer advance — Dr Advances · Cr Debtors (no bank) */
export function linesPiToTiAdvance(amount, party, meta) {
  const amt = n(amount);
  if (amt <= 0) return null;
  return [
    { accountId: mapId(meta, 'advancesFromCustomers'), debit: amt, credit: 0, partyType: 'client', partyId: party || '' },
    { accountId: mapId(meta, 'receivables'), debit: 0, credit: amt, partyType: 'client', partyId: party || '' },
  ];
}

/** Expense: Dr expense (+ ITC) · Cr Bank/Cash or Creditors */
export function linesExpense(exp, meta) {
  const amt = n(exp.amount || exp.total);
  if (amt <= 0) return null;
  const gst = n(exp.gstAmount || exp.tax || 0);
  const base = n(amt - (exp.amountIncludesGst ? gst : 0));
  const netBase = exp.amountIncludesGst ? n(amt - gst) : amt;
  const expenseId = mapId(meta, 'projectExpense');
  const lines = [{ accountId: expenseId, debit: netBase > 0 ? netBase : amt, credit: 0, costCenterId: exp.costCenterId, workOrderId: exp.workOrderId, site: exp.site }];
  if (gst > 0) {
    if (exp.interstate) lines.push({ accountId: mapId(meta, 'inputIgst'), debit: gst, credit: 0 });
    else {
      const half = n(gst / 2);
      lines.push({ accountId: mapId(meta, 'inputCgst'), debit: half, credit: 0 });
      lines.push({ accountId: mapId(meta, 'inputSgst'), debit: n(gst - half), credit: 0 });
    }
  }
  const totalDr = lines.reduce((s, e) => s + e.debit, 0);
  // Paid now (Bank/Cash/UPI) → Cr Bank/Cash. Unpaid credit → Cr Creditors.
  const mode = String(exp.paymentMode || exp.mode || exp.payMode || '').toLowerCase();
  const status = String(exp.status || exp.paymentStatus || '').toLowerCase();
  const paidFlag = exp.paid === true || exp.isPaid === true || Number(exp.paidAmount || 0) >= totalDr - 0.01;
  const isCashLike = /cash|petty/.test(mode);
  const isBankLike = /bank|upi|neft|rtgs|imps|card|cheque|online|transfer/.test(mode);
  const isPaidNow = paidFlag || status === 'paid' || isCashLike || isBankLike || (!exp.vendorName && !exp.vendorId);
  let creditAcc;
  let partyType = null;
  let partyId = '';
  if (isPaidNow) {
    creditAcc = isCashLike ? mapId(meta, 'cash') : mapId(meta, 'operatingBank');
  } else if (exp.vendorName || exp.vendorId) {
    creditAcc = mapId(meta, 'payables');
    partyType = 'vendor';
    partyId = exp.vendorName || exp.vendorId || '';
  } else {
    creditAcc = mapId(meta, 'operatingBank');
  }
  lines.push({
    accountId: creditAcc,
    debit: 0,
    credit: totalDr,
    partyType,
    partyId,
  });
  return lines;
}

/** Purchase bill: Dr expense/material + ITC · Cr Creditors */
export function linesPurchase(purch, meta) {
  const total = n(purch.totalAmount || purch.grandTotal || purch.amount);
  if (total <= 0) return null;
  const cgst = n(purch.cgst || purch.totals?.cgst);
  const sgst = n(purch.sgst || purch.totals?.sgst);
  const igst = n(purch.igst || purch.totals?.igst);
  const tax = cgst + sgst + igst;
  const taxable = n(purch.taxable || purch.subTotal || total - tax);
  const lines = [
    { accountId: mapId(meta, 'projectExpense'), debit: taxable, credit: 0, workOrderId: purch.workOrderId, site: purch.site, costCenterId: purch.costCenterId },
  ];
  if (cgst > 0) lines.push({ accountId: mapId(meta, 'inputCgst'), debit: cgst, credit: 0 });
  if (sgst > 0) lines.push({ accountId: mapId(meta, 'inputSgst'), debit: sgst, credit: 0 });
  if (igst > 0) lines.push({ accountId: mapId(meta, 'inputIgst'), debit: igst, credit: 0 });
  const dr = lines.reduce((s, e) => s + e.debit, 0);
  const mode = String(purch.paymentMode || purch.mode || '').toLowerCase();
  const status = String(purch.status || purch.paymentStatus || '').toLowerCase();
  const paidNow = status === 'paid' || purch.paid === true || /bank|cash|upi|card|neft|paid/.test(mode);
  if (paidNow) {
    const bankId = /cash/.test(mode) ? mapId(meta, 'cash') : mapId(meta, 'operatingBank');
    lines.push({ accountId: bankId, debit: 0, credit: dr });
  } else {
    lines.push({
      accountId: mapId(meta, 'payables'),
      debit: 0,
      credit: dr,
      partyType: 'vendor',
      partyId: purch.vendorName || purch.supplierName || '',
    });
  }
  return lines;
}

/** Vendor payment: Dr Creditors · Cr Bank/Cash */
export function linesVendorPayment(pay, meta) {
  const amt = n(pay.amount);
  if (amt <= 0) return null;
  const mode = String(pay.mode || 'bank').toLowerCase();
  const bankId = mode.includes('cash') ? mapId(meta, 'cash') : mapId(meta, 'operatingBank');
  return [
    { accountId: mapId(meta, 'payables'), debit: amt, credit: 0, partyType: 'vendor', partyId: pay.vendorName || '' },
    { accountId: bankId, debit: 0, credit: amt },
  ];
}

/**
 * Opening balances: lines already balanced by caller (OP Dr / OP Cr leaves).
 * sourceType opening_balance.
 */
export function linesOpeningFromRows(rows) {
  return (rows || [])
    .filter((r) => (Number(r.debit) || 0) > 0 || (Number(r.credit) || 0) > 0)
    .map((r) => ({
      accountId: r.accountId,
      account: r.account,
      debit: n(r.debit),
      credit: n(r.credit),
    }));
}

/** FY close: close income (credit bal) and expense (debit bal) to Retained Earnings */
export function linesPeriodClose(tbRows, meta) {
  const re = mapId(meta, 'retainedEarnings');
  const lines = [];
  let net = 0;
  for (const r of tbRows || []) {
    const type = String(r.type || r.accountType || '').toLowerCase();
    const dr = n(r.debit);
    const cr = n(r.credit);
    const bal = dr - cr;
    if (type === 'income' || /sales|revenue|income/i.test(r.account || '')) {
      if (Math.abs(bal) < 0.01) continue;
      // Income normally credit balance (bal negative) → debit income to zero
      if (bal < 0) {
        lines.push({ accountId: r.accountId, account: r.account, debit: -bal, credit: 0 });
        net += -bal;
      } else if (bal > 0) {
        lines.push({ accountId: r.accountId, account: r.account, debit: 0, credit: bal });
        net -= bal;
      }
    } else if (type === 'expense' || /expense|cost|salary|rent/i.test(r.account || '')) {
      if (Math.abs(bal) < 0.01) continue;
      if (bal > 0) {
        lines.push({ accountId: r.accountId, account: r.account, debit: 0, credit: bal });
        net -= bal;
      } else if (bal < 0) {
        lines.push({ accountId: r.accountId, account: r.account, debit: -bal, credit: 0 });
        net += -bal;
      }
    }
  }
  if (Math.abs(net) >= 0.01) {
    if (net > 0) lines.push({ accountId: re, debit: 0, credit: net }); // profit
    else lines.push({ accountId: re, debit: -net, credit: 0 }); // loss
  }
  return lines.length ? lines : null;
}
