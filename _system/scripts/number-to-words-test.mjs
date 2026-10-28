/**
 * Regression: Indian amount-in-words (crore groups >= 100).
 * Run: node scripts/number-to-words-test.mjs
 */
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '../src/utils.js'), 'utf8');
// Dynamic import of utils may need vite; eval extracted export instead
const m = src.match(/export const numberToWords = \(num\) => \{[\s\S]*?\n\};/);
if (!m) {
  console.error('numberToWords not found');
  process.exit(1);
}
const fn = new Function(m[0].replace('export const numberToWords', 'const numberToWords') + '\nreturn numberToWords;')();

const cases = [
  [0, /Zero Rupees Only/],
  [1, /One.*Rupees Only/],
  [1234.56, /Thousand.*Paise Only/],
  [1e7, /One Crore Rupees Only/],
  [99e7, /Ninety Nine Crore/],
  [1e9, /Hundred Crore/],
  [1e10, /Thousand Crore/],
];
let fail = 0;
for (const [n, re] of cases) {
  const w = fn(n);
  const ok = re.test(w) && !/undefined/i.test(w);
  console.log((ok ? 'OK' : 'FAIL'), n, '=>', w);
  if (!ok) fail++;
}
process.exit(fail ? 1 : 0);
