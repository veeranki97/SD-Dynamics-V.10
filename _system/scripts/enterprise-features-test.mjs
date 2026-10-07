import { computeRaSchedule, computeRaHolds } from '../src/utils/raBilling.js';
import { computeExpenseTds, validatePan, detectPanEntityType, generateForm26QRecords } from '../src/utils/expenseTds.js';
import { parseGstPortal2bJson, normalizeInvoiceNumber, matchGstr2bToPurchases } from '../src/utils/gstr2bMatch.js';

let passed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
  passed++;
}

console.log('\n--- Testing RA Billing ---');
// RA Bill with Work Order ₹1 Crore, ₹20L current taxable, ₹10L mob advance with 10% recovery, 5% retention
const ra = computeRaSchedule({
  currentBillTaxable: 2000000,
  currentGstAmount: 360000,
  previousPassedGross: 1000000,
  totalContractValue: 10000000,
  mobilizationAdvance: {
    totalAdvance: 1000000,
    recoveredPrior: 100000,
    recoveryPercent: 10,
  },
  retention: {
    retentionPercent: 5,
    maxRetentionPercent: 5,
    retainedPrior: 50000,
  },
  statutory: {
    tdsItPercent: 2,
    tdsGstPercent: 2,
    bocwCessPercent: 1,
  },
  otherDeductions: 10000,
});

assert(ra.measurement.cumulativeTaxable === 3000000, 'Cumulative taxable is ₹30 Lakhs');
assert(ra.mobilizationAdvance.currentRecovery === 200000, 'Mob advance recovery is 10% of 20L = ₹2 Lakhs');
assert(ra.retention.currentRetention === 100000, 'Retention deduction is 5% of 20L = ₹1 Lakh');
assert(ra.statutory.tdsItAmount === 40000, 'TDS 194C (2%) is ₹40,000');
assert(ra.statutory.tdsGstAmount === 40000, 'GST-TDS (2%) is ₹40,000');
assert(ra.statutory.bocwCessAmount === 20000, 'BOCW Cess (1%) is ₹20,000');
assert(ra.totalDeductions === 410000, 'Total deductions sum to ₹4,10,000');
assert(ra.currentGrossWithTax === 2360000, 'Gross with GST is ₹23,60,000');
assert(ra.netPayable === 1950000, 'Net payable certified is ₹19,50,000');

// Backward compatibility check for computeRaHolds
const legacyHolds = computeRaHolds({ grandTotal: 100000 }, { retentionPercent: 5, tdsItPercent: 2 });
assert(legacyHolds.retentionAmount === 5000, 'Legacy hold retention matches');
assert(legacyHolds.netPayable === 93000, 'Legacy hold net payable matches');

console.log('\n--- Testing Vendor TDS & PAN Engine ---');
assert(validatePan('AAACT1234F') === true, 'Valid company PAN passes');
assert(validatePan('ABCDE1234') === false, 'Short PAN fails');
assert(detectPanEntityType('AAACT1234F') === 'COMPANY', '4th char C detected as COMPANY');
assert(detectPanEntityType('BKUPK9999M') === 'INDIVIDUAL', '4th char P detected as INDIVIDUAL');

// 194C on company with valid PAN -> 2%
const tdsCompany = computeExpenseTds({
  amount: 100000,
  gstAmount: 18000,
  deductTds: true,
  tdsSection: '194C',
  vendorPan: 'AAACT1234F',
});
assert(tdsCompany.tdsRate === 2.0, 'Company 194C gets 2% rate');
assert(tdsCompany.tdsAmount === 2000, 'TDS calculated on base 100k excl GST is 2000');
assert(tdsCompany.netPayable === 116000, 'Net payable is 100k + 18k GST - 2k TDS = 116,000');

// 194C on individual with valid PAN -> 1%
const tdsIndiv = computeExpenseTds({
  amount: 100000,
  gstAmount: 18000,
  deductTds: true,
  tdsSection: '194C',
  vendorPan: 'BKUPK9999M',
});
assert(tdsIndiv.tdsRate === 1.0, 'Individual 194C gets 1% rate');
assert(tdsIndiv.tdsAmount === 1000, 'TDS calculated is 1000');

// Section 206AA: Invalid/missing PAN -> 20% penal rate
const tdsNoPan = computeExpenseTds({
  amount: 100000,
  gstAmount: 18000,
  deductTds: true,
  tdsSection: '194C',
  vendorPan: 'INVALID',
});
assert(tdsNoPan.tdsRate === 20.0, 'Invalid PAN triggers 20% rate under Sec 206AA');
assert(tdsNoPan.tdsAmount === 20000, 'TDS is 20k');
assert(tdsNoPan.isPenalRate206AA === true, 'isPenalRate206AA flag set');

// Form 26Q export
const f26q = generateForm26QRecords([
  { deductTds: true, tdsAmount: 2000, tdsRate: 2, amount: 100000, vendorPan: 'AAACT1234F', vendorName: 'Acme Infra', tdsSection: '194C' }
], 'BLRK12345A');
assert(f26q.length === 1 && f26q[0].deductorTan === 'BLRK12345A', 'Form 26Q record successfully created');

console.log('\n--- Testing GSTR-2B Matching Engine ---');
assert(normalizeInvoiceNumber('INV/2026/0045') === 'INV202645', 'Fuzzy invoice number normalization works');
assert(normalizeInvoiceNumber('inv-2026-45') === 'INV202645', 'Dashes and lowercase normalize identically');

// Test nested portal JSON structure
const portalJson = {
  data: {
    docdata: {
      b2b: [
        {
          ctin: '29ABCDE1234F1Z5',
          lgnm: 'Solar Supplies Ltd',
          inv: [
            {
              inum: 'INV/2026/0045',
              dt: '2026-08-15',
              val: 118000,
              itcavl: 'Y',
              items: [{ num: 1, rate: 18, txval: 100000, iamt: 18000, camt: 0, samt: 0 }]
            }
          ]
        }
      ]
    }
  }
};
const parsed2b = parseGstPortal2bJson(portalJson);
assert(parsed2b.length === 1, 'Portal JSON parsed successfully');
assert(parsed2b[0].supplierGstin === '29ABCDE1234F1Z5', 'GSTIN extracted');
assert(parsed2b[0].taxable === 100000, 'Taxable amount extracted');
assert(parsed2b[0].igst === 18000, 'IGST extracted');

// Reconcile with books where invoice number has dashes instead of slashes: 'inv-2026-45'
const localPurchases = [
  {
    id: 'pur_1',
    supplierGstin: '29ABCDE1234F1Z5',
    invoiceNumber: 'inv-2026-45',
    date: '2026-08-15',
    totals: { taxableAmount: 100000, igst: 18000, totalTaxAmount: 18000, total: 118000 }
  }
];

const recon = matchGstr2bToPurchases(parsed2b, localPurchases);
assert(recon.matched.length === 1, 'Fuzzy invoice number successfully matched');
assert(recon.mismatch.length === 0, 'No tax mismatch');
assert(recon.inBooksNotIn2b.length === 0, 'No missing books');

console.log(`\n🎉 All ${passed} tests passed!`);
