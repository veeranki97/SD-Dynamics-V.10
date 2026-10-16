/**
 * Fixed sample for Site / WO P&L — run: node src/utils/pnl-sample-test.mjs
 * Expected: income 95000, expense 50000, profit 45000
 */
import { siteWisePnL, woWisePnL } from './ledger.js';

const journals = [
  {
    date: '2026-10-01', site: 'S1', workOrderId: 'W1',
    entries: [
      { account: 'Sales', credit: 100000, debit: 0 },
      { account: 'Debtors', debit: 100000, credit: 0 },
    ],
  },
  {
    date: '2026-10-02', site: 'S1', workOrderId: 'W1',
    entries: [
      { account: 'Direct Expenses', debit: 40000, credit: 0 },
      { account: 'Bank', credit: 40000, debit: 0 },
    ],
  },
  {
    date: '2026-10-03', site: 'S1', workOrderId: 'W1',
    entries: [
      { account: 'Expenses', debit: 10000, credit: 0 },
      { account: 'Bank', credit: 10000, debit: 0 },
    ],
  },
  {
    date: '2026-10-04', site: 'S1', workOrderId: 'W1',
    entries: [
      { account: 'Sales', debit: 5000, credit: 0 }, // CN reduces income
      { account: 'Debtors', credit: 5000, debit: 0 },
    ],
  },
];

const site = siteWisePnL(journals, '2026-10-01', '2026-10-31');
const wo = woWisePnL(journals, '2026-10-01', '2026-10-31');
const s1 = site.find(x => x.site === 'S1');
const w1 = wo.find(x => x.workOrderId === 'W1');
const ok =
  s1 && Math.abs(s1.income - 95000) < 0.02 &&
  Math.abs(s1.expense - 50000) < 0.02 &&
  Math.abs(s1.profit - 45000) < 0.02 &&
  w1 && Math.abs(w1.net - 45000) < 0.02;
console.log(JSON.stringify({ site: s1, wo: w1, ok }, null, 2));
if (!ok) process.exit(1);
