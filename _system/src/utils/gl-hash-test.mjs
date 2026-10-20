import { hashGlLines, toPaise } from './glPosting.js';
const a = [
  { accountId: 'acc_1300', debit: 23541, credit: 0 },
  { accountId: 'acc_4100', debit: 0, credit: 19950 },
  { accountId: 'acc_2210', debit: 0, credit: 1795.5 },
  { accountId: 'acc_2220', debit: 0, credit: 1795.5 },
];
const b = JSON.parse(JSON.stringify(a));
const c = a.map((x) => ({ ...x, debit: x.debit ? 100 : 0, credit: x.credit ? 100 : 0 }));
const h1 = hashGlLines(a);
const h2 = hashGlLines(b);
const h3 = hashGlLines(c);
if (h1 !== h2) throw new Error('same lines must match');
if (h1 === h3) throw new Error('changed lines must differ');
console.log('ok', h1.slice(0, 40) + '...');
