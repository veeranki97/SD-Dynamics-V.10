/** Payment ceiling helpers — CA: never accept receipt > outstanding (₹1 tol). */

export function money2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

/** Outstanding = grand total − paid (excluding this draft amount if needed). */
export function invoiceOutstanding(bill, opts = {}) {
  if (!bill) return 0;
  const total = money2(bill.totalAmount ?? bill.data?.totals?.grandTotal ?? bill.data?.totals?.total);
  let paid = money2(bill.paidAmount);
  if (Array.isArray(bill.payments) && bill.payments.length) {
    const sum = bill.payments.reduce((s, p) => s + money2(p.amount), 0);
    if (sum > paid) paid = money2(sum);
  }
  if (opts.excludePaymentId && Array.isArray(bill.payments)) {
    const excl = bill.payments.find(p => p.id === opts.excludePaymentId);
    if (excl) paid = money2(paid - money2(excl.amount));
  }
  return money2(Math.max(0, total - paid));
}

/**
 * @param {number} amount - payment being recorded
 * @param {object} bill
 * @param {{ allowAdvance?: boolean, tolerance?: number }} opts
 * allowAdvance: if true, excess is treated as customer advance (caller must flag)
 */
export function checkPaymentCeiling(amount, bill, opts = {}) {
  const tol = opts.tolerance != null ? opts.tolerance : 1;
  const amt = money2(amount);
  if (amt < 0) return { ok: false, error: 'Payment amount cannot be negative' };
  if (!bill) return { ok: true, outstanding: 0, excess: 0 };
  const outstanding = invoiceOutstanding(bill, opts);
  if (amt > outstanding + tol) {
    if (opts.allowAdvance) {
      return {
        ok: true,
        outstanding,
        excess: money2(amt - outstanding),
        asAdvance: true,
        warning: `₹${money2(amt - outstanding).toFixed(2)} exceeds outstanding and will be treated as customer advance`,
      };
    }
    return {
      ok: false,
      outstanding,
      excess: money2(amt - outstanding),
      error: `Payment ₹${amt.toFixed(2)} exceeds outstanding ₹${outstanding.toFixed(2)} (invoice total ₹${money2(bill.totalAmount).toFixed(2)}). Tolerance ₹${tol}. Uncheck advance only if explicitly recording customer credit.`,
    };
  }
  return { ok: true, outstanding, excess: 0 };
}
