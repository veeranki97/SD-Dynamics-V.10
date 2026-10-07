import { checkPaymentCeiling, invoiceOutstanding } from '../src/utils/paymentGuard.js';

const bill = { totalAmount: 1000, paidAmount: 400, payments: [{ amount: 400 }] };
let r = checkPaymentCeiling(600, bill);
if (!r.ok) { console.error('fail equal outstanding', r); process.exit(1); }
r = checkPaymentCeiling(601.01, bill);
if (r.ok) { console.error('fail should reject', r); process.exit(1); }
r = checkPaymentCeiling(601, bill, { tolerance: 1 });
if (!r.ok) { console.error('fail tol1', r); process.exit(1); }
console.log('payment-guard-test OK outstanding=', invoiceOutstanding(bill));
