/**
 * CA integrity unit tests — payment ceiling, revenue filter, period lock, advance apply shape
 * Run: node scripts/ca-integrity-test.mjs
 */
import { checkPaymentCeiling, invoiceOutstanding } from '../src/utils/paymentGuard.js';
import { isRevenueDocument, isReceivableDocument, isConverted, revenueSignedAmount } from '../src/utils/revenueFilter.js';
import { isMonthLocked, withLockedMonth, monthKeyFromDate } from '../src/utils/periodLock.js';
import { journalApplyCustomerAdvance, journalReversePayment } from '../src/utils/ledger.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); failed++; }
  else console.log('  OK', msg);
}

console.log('1) Payment ceiling');
{
  const bill = { totalAmount: 1000, paidAmount: 400, payments: [{ amount: 400 }] };
  assert(invoiceOutstanding(bill) === 600, 'outstanding 600');
  assert(checkPaymentCeiling(600, bill).ok, 'exact outstanding ok');
  assert(!checkPaymentCeiling(601.01, bill).ok, 'over by >1 rejected');
  assert(checkPaymentCeiling(601, bill, { tolerance: 1 }).ok, 'tol ₹1 ok');
  assert(checkPaymentCeiling(700, bill, { allowAdvance: true }).asAdvance, 'excess as advance');
}

console.log('2) Revenue exclusions');
{
  const ti = { invoiceType: 'tax-invoice', status: 'paid', totalAmount: 100 };
  const pi = { invoiceType: 'proforma', status: 'unpaid', totalAmount: 100 };
  const quo = { invoiceType: 'quotation', status: 'converted', totalAmount: 100, data: { convertedLocked: true } };
  const cn = { invoiceType: 'credit-note', status: 'issued', totalAmount: 50 };
  assert(isRevenueDocument(ti), 'TI is revenue');
  assert(!isRevenueDocument(pi), 'PI not revenue');
  assert(!isRevenueDocument(quo), 'converted QUO not revenue');
  assert(isConverted(quo), 'converted flag');
  assert(!isReceivableDocument(pi), 'PI not AR');
  assert(isReceivableDocument({ ...ti, status: 'unpaid', paidAmount: 0 }), 'unpaid TI is AR');
  assert(revenueSignedAmount(ti) === 100, 'TI amount');
  assert(revenueSignedAmount(pi) === 0, 'PI amount 0');
}

console.log('3) Period lock');
{
  let meta = {};
  meta = withLockedMonth(meta, '2026-09');
  assert(isMonthLocked(meta, '2026-09-15'), 'Sep locked');
  assert(!isMonthLocked(meta, '2026-10-01'), 'Oct open');
  assert(monthKeyFromDate('2026-09-07') === '2026-09', 'month key');
}

console.log('4) PI→TI advance journal (no bank)');
{
  const j = journalApplyCustomerAdvance(
    { invoiceNumber: 'SD/2026-27/001', clientName: 'Test', invoiceDate: '2026-10-07' },
    177000,
    { sourceDocNumber: 'PI/2026-27/001' }
  );
  assert(j && j.refType === 'advance-application', 'refType');
  assert(j.entries.length === 2, '2 legs');
  const bank = j.entries.some(e => /bank|cash/i.test(e.account));
  assert(!bank, 'no bank leg on advance apply');
  const dr = j.entries.reduce((s, e) => s + (e.debit || 0), 0);
  const cr = j.entries.reduce((s, e) => s + (e.credit || 0), 0);
  assert(Math.abs(dr - cr) < 0.01, 'balanced');
}

console.log('5) Append-only reversal');
{
  const orig = {
    id: 'jnl_1',
    narration: 'Advance received — client',
    refType: 'advance',
    invoiceNumber: 'PI/1',
    entries: [
      { account: 'Bank', debit: 100, credit: 0 },
      { account: 'Advance from Customers', debit: 0, credit: 100 },
    ],
  };
  const rev = journalReversePayment(orig, 'Reversal of Advance Receipt against PI/1');
  assert(rev && rev.refType === 'payment-reversal', 'reversal type');
  assert(!/was:/i.test(rev.narration), 'clean narration');
  assert(rev.id !== orig.id, 'new id');
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nca-integrity-test OK');
