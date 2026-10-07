/**
 * Enterprise Vendor TDS Engine — SD Dynamics
 * Full compliance with Indian Income Tax Act (Sections 194C, 194J, 194I, 194H, 194Q, 206AA, 206AB).
 */

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export const TDS_SECTIONS = [
  {
    code: '194C',
    label: '194C — Contractors & Subcontractors',
    defaultRate: 1, // 1% Individual/HUF, 2% Company/Firm
    singleLimit: 30000,
    annualLimit: 100000,
    description: 'Civil contracts, labor supply, solar installation, transport',
  },
  {
    code: '194J',
    label: '194J — Professional & Technical Services',
    defaultRate: 10,
    rates: { professional: 10, technical: 2 },
    singleLimit: 30000,
    annualLimit: 30000,
    description: 'Engineering consultancy, architectural design, software',
  },
  {
    code: '194I',
    label: '194I — Rent (Plant/Machinery 2%, Land/Building 10%)',
    defaultRate: 2,
    rates: { machinery: 2, building: 10 },
    annualLimit: 240000,
    description: 'Crane/JCB rental, site office rent, warehouse lease',
  },
  {
    code: '194H',
    label: '194H — Commission & Brokerage',
    defaultRate: 5,
    annualLimit: 15000,
    description: 'Tender procurement commission, broker charges',
  },
  {
    code: '194Q',
    label: '194Q — Purchase of Goods exceeding ₹50 Lakhs',
    defaultRate: 0.1,
    annualLimit: 5000000,
    description: 'High-value solar module & steel procurement',
  },
];

/**
 * Validate 10-character Indian Permanent Account Number (PAN).
 * Structure: 5 letters, 4 digits, 1 letter.
 */
export function validatePan(pan) {
  if (!pan || typeof pan !== 'string') return false;
  const clean = pan.trim().toUpperCase();
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(clean);
}

/**
 * Detect entity type from 4th character of PAN:
 * P: Individual
 * C: Company
 * F: Firm / Limited Liability Partnership (LLP)
 * H: Hindu Undivided Family (HUF)
 * A: Association of Persons (AOP)
 * T: Trust
 * J: Artificial Juridical Person
 * B: Body of Individuals (BOI)
 * G: Government Agency
 */
export function detectPanEntityType(pan) {
  if (!validatePan(pan)) return 'UNKNOWN';
  const char4 = pan.trim().toUpperCase()[3];
  switch (char4) {
    case 'P': return 'INDIVIDUAL';
    case 'C': return 'COMPANY';
    case 'F': return 'FIRM';
    case 'H': return 'HUF';
    case 'A': return 'AOP';
    case 'T': return 'TRUST';
    case 'G': return 'GOVERNMENT';
    default: return 'OTHER';
  }
}

/**
 * Resolve statutory TDS rate based on Section, PAN entity, and penal provisions.
 * Section 206AA: Mandates 20% if PAN is missing or invalid.
 * Section 206AB: Non-filer of ITR higher rate.
 */
export function resolveTdsRate({
  sectionCode = '194C',
  vendorPan = '',
  isNonFiler206AB = false,
  subType = null, // e.g., 'technical' vs 'professional' for 194J, 'machinery' vs 'building' for 194I
  overrideRate = null,
}) {
  if (overrideRate != null && overrideRate !== '') {
    return Number(overrideRate) || 0;
  }

  // Sec 206AA penal rate if PAN missing or invalid
  const hasValidPan = validatePan(vendorPan);
  if (!hasValidPan) {
    return 20.0;
  }

  const entity = detectPanEntityType(vendorPan);
  let baseRate = 0;

  switch (sectionCode.toUpperCase()) {
    case '194C':
      // 1% for Individual & HUF, 2% for Company, Firm, LLP, etc.
      baseRate = (entity === 'INDIVIDUAL' || entity === 'HUF') ? 1.0 : 2.0;
      break;

    case '194J':
      // 2% for Technical services / Royalty / Call center, 10% for Professional
      baseRate = subType === 'technical' ? 2.0 : 10.0;
      break;

    case '194I':
      // 2% for Plant & Machinery rental (cranes/generators), 10% for Land/Building
      baseRate = subType === 'building' ? 10.0 : 2.0;
      break;

    case '194H':
      baseRate = 5.0;
      break;

    case '194Q':
      baseRate = 0.1;
      break;

    default:
      baseRate = 1.0;
      break;
  }

  // Sec 206AB: Higher of 2x normal rate or 5%
  if (isNonFiler206AB) {
    baseRate = Math.max(baseRate * 2, 5.0);
  }

  return baseRate;
}

/**
 * Comprehensive Vendor TDS calculator.
 * Fully backward compatible with legacy computeExpenseTds signature.
 *
 * NOTE: As per CBDT Circular No. 23/2017, TDS is deducted on the base taxable value
 * excluding the GST component if GST is separately indicated on the invoice.
 */
export function computeExpenseTds({
  amount = 0,
  gstAmount = 0,
  deductTds = false,
  tdsSection = '194C',
  tdsRate = null,
  vendorPan = '',
  cumulativeYtdExpense = 0,
  isNonFiler206AB = false,
  subType = null,
}) {
  const base = Number(amount) || 0;
  const gst = Number(gstAmount) || 0;

  if (!deductTds) {
    return {
      tdsAmount: 0,
      netPayable: money(base + gst),
      tdsRate: 0,
      tdsSection: tdsSection || '',
      panValid: validatePan(vendorPan),
      exemptionApplied: false,
    };
  }

  // Check exemption thresholds if rate not explicitly forced
  const sec = TDS_SECTIONS.find(s => s.code === String(tdsSection).toUpperCase());
  let exemptionApplied = false;

  if (tdsRate == null || tdsRate === '') {
    if (sec?.singleLimit && base < sec.singleLimit) {
      const ytd = (Number(cumulativeYtdExpense) || 0) + base;
      if (sec.annualLimit && ytd <= sec.annualLimit) {
        exemptionApplied = true;
      }
    }
  }

  const effectiveRate = exemptionApplied
    ? 0
    : resolveTdsRate({
        sectionCode: tdsSection,
        vendorPan,
        isNonFiler206AB,
        subType,
        overrideRate: tdsRate,
      });

  // Calculate TDS on Base Amount (excluding GST as per CBDT Circular 23/2017)
  const tdsAmount = exemptionApplied ? 0 : money(base * (effectiveRate / 100));
  const netPayable = money(base + gst - tdsAmount);

  return {
    tdsAmount,
    netPayable,
    tdsRate: effectiveRate,
    tdsSection: tdsSection || '194C',
    panValid: validatePan(vendorPan),
    panEntity: detectPanEntityType(vendorPan),
    isPenalRate206AA: !validatePan(vendorPan) && !exemptionApplied && effectiveRate >= 20,
    exemptionApplied,
  };
}

/**
 * Form 26Q Quarterly Return Data Generator.
 * Compiles expense vouchers into NSDL Form 26Q format ready for e-TDS return filing.
 */
export function generateForm26QRecords(expenses = [], deductorTan = '') {
  return expenses
    .filter(e => e.deductTds && (Number(e.tdsAmount) || 0) > 0)
    .map((e, idx) => {
      const pan = String(e.vendorPan || e.pan || '').toUpperCase().trim();
      const panValid = validatePan(pan);
      return {
        recordNumber: idx + 1,
        deductorTan: String(deductorTan || '').toUpperCase().trim(),
        deducteePan: panValid ? pan : 'PANNOTAVBL',
        deducteeName: e.vendorName || e.supplierName || e.payee || 'Vendor',
        sectionCode: e.tdsSection || '194C',
        dateOfPayment: e.date || e.expenseDate || new Date().toISOString().split('T')[0],
        amountCredited: money(e.amount || 0),
        tdsDeducted: money(e.tdsAmount || 0),
        tdsRate: Number(e.tdsRate) || 0,
        panValid,
        challanNumber: e.tdsChallanNumber || '',
        bsrCode: e.tdsBsrCode || '',
        dateOfDeposit: e.tdsDepositDate || '',
      };
    });
}
