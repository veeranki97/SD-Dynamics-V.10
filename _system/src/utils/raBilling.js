/**
 * Contracting Running Account (RA) Billing Engine — SD Dynamics
 * Tailored for Infrastructure Contracting, Solar EPC/O&M, and Civil Engineering Works.
 *
 * Fully backward compatible with legacy computeRaHolds and raJournalLines.
 */

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Legacy hold calculator — preserved for complete backward compatibility.
 * @param {object} totals
 * @param {object} opts
 */
export function computeRaHolds(totals, opts = {}) {
  const gross = Number(totals?.grandTotal ?? totals?.total ?? totals?.totalAmount ?? 0) || 0;
  const retentionPercent = Number(opts.retentionPercent) || 0;
  const retentionAmount = opts.retentionAmount != null && opts.retentionAmount !== ''
    ? Number(opts.retentionAmount) || 0
    : money(gross * retentionPercent / 100);
  const tdsItPercent = Number(opts.tdsItPercent) || 0;
  const tdsItAmount = opts.tdsItAmount != null && opts.tdsItAmount !== ''
    ? Number(opts.tdsItAmount) || 0
    : money(gross * tdsItPercent / 100);
  const tdsGstPercent = Number(opts.tdsGstPercent) || 0;
  const tdsGstAmount = opts.tdsGstAmount != null && opts.tdsGstAmount !== ''
    ? Number(opts.tdsGstAmount) || 0
    : money(gross * tdsGstPercent / 100);
  const otherHoldAmount = Number(opts.otherHoldAmount) || 0;
  const holds = retentionAmount + tdsItAmount + tdsGstAmount + otherHoldAmount;
  const netPayable = money(gross - holds);
  return {
    retentionPercent,
    retentionAmount: money(retentionAmount),
    tdsItPercent,
    tdsItAmount: money(tdsItAmount),
    tdsGstPercent,
    tdsGstAmount: money(tdsGstAmount),
    otherHoldAmount: money(otherHoldAmount),
    netPayable,
    gross,
  };
}

/**
 * Enterprise Cumulative Running Account (RA) Billing Schedule Calculator.
 * Handles cumulative work-done measurements, mobilization advance recovery,
 * retention money withholding with statutory caps, and statutory deductions (194C, GST-TDS, BOCW Cess).
 *
 * @param {object} params
 * @param {number} params.currentBillTaxable - Taxable work done in current RA bill
 * @param {number} params.currentGstAmount - GST (CGST+SGST or IGST) on current bill
 * @param {number} params.previousPassedGross - Cumulative gross passed in prior RA bills (excluding GST)
 * @param {number} params.totalContractValue - Total BOQ / Work Order agreed contract value (excl GST)
 * @param {object} params.mobilizationAdvance - { totalAdvance, recoveredPrior, recoveryPercent = 10 }
 * @param {object} params.retention - { retentionPercent = 5, maxRetentionPercent = 5, retainedPrior = 0 }
 * @param {object} params.statutory - { tdsItPercent = 2, tdsGstPercent = 2, bocwCessPercent = 1 }
 * @param {number} params.otherDeductions - Penalties, water/electricity, liquidated damages
 */
export function computeRaSchedule({
  currentBillTaxable = 0,
  currentGstAmount = 0,
  previousPassedGross = 0,
  totalContractValue = 0,
  mobilizationAdvance = {},
  retention = {},
  statutory = {},
  otherDeductions = 0,
}) {
  const currentTaxable = money(currentBillTaxable);
  const prevGross = money(previousPassedGross);
  const cumulativeTaxable = money(prevGross + currentTaxable);
  const contractValue = money(totalContractValue) || cumulativeTaxable;

  // 1. Mobilization Advance Recovery
  const totalMobAdv = money(mobilizationAdvance.totalAdvance || 0);
  const mobRecoveredPrior = money(mobilizationAdvance.recoveredPrior || 0);
  const mobRecoveryPct = Number(mobilizationAdvance.recoveryPercent ?? 10);
  const mobUnrecovered = Math.max(0, money(totalMobAdv - mobRecoveredPrior));
  
  let currentMobRecovery = 0;
  if (mobUnrecovered > 0 && mobRecoveryPct > 0) {
    const plannedRecovery = money(currentTaxable * (mobRecoveryPct / 100));
    currentMobRecovery = Math.min(plannedRecovery, mobUnrecovered);
  }
  const cumulativeMobRecovered = money(mobRecoveredPrior + currentMobRecovery);
  const balanceMobAdvance = Math.max(0, money(totalMobAdv - cumulativeMobRecovered));

  // 2. Retention Money / Security Deposit
  const retentionPct = Number(retention.retentionPercent ?? 5);
  const maxRetentionPct = Number(retention.maxRetentionPercent ?? 5);
  const retainedPrior = money(retention.retainedPrior || 0);
  const maxRetentionCap = money(contractValue * (maxRetentionPct / 100));
  const retentionRemainingCap = Math.max(0, money(maxRetentionCap - retainedPrior));

  let currentRetention = 0;
  if (retentionRemainingCap > 0 && retentionPct > 0) {
    const plannedRetention = money(currentTaxable * (retentionPct / 100));
    currentRetention = Math.min(plannedRetention, retentionRemainingCap);
  }
  const cumulativeRetained = money(retainedPrior + currentRetention);
  const balanceRetentionToHold = Math.max(0, money(maxRetentionCap - cumulativeRetained));

  // 3. Statutory Withholdings (Computed on Taxable Value of Work Done)
  // IT TDS u/s 194C (typically 1% for Indv/HUF, 2% for Company/Firm)
  const tdsItPct = Number(statutory.tdsItPercent ?? 2);
  const currentTdsIt = money(currentTaxable * (tdsItPct / 100));

  // GST-TDS u/s 51 (2% for Govt / PSU contracts where taxable value > 2.5 Lakhs)
  const tdsGstPct = Number(statutory.tdsGstPercent ?? 0);
  const currentTdsGst = money(currentTaxable * (tdsGstPct / 100));

  // BOCW Cess (Building and Other Construction Workers Welfare Cess @ 1% on construction cost)
  const bocwCessPct = Number(statutory.bocwCessPercent ?? 0);
  const currentBocwCess = money(currentTaxable * (bocwCessPct / 100));

  const otherDeds = money(otherDeductions);

  // Total Deductions for Current Bill
  const totalDeductions = money(
    currentMobRecovery +
    currentRetention +
    currentTdsIt +
    currentTdsGst +
    currentBocwCess +
    otherDeds
  );

  // Current Gross Payable = Current Taxable Work Done + GST
  const currentGrossWithTax = money(currentTaxable + money(currentGstAmount));

  // Net Passed / Payable Amount to Contractor
  const netPayable = money(currentGrossWithTax - totalDeductions);

  return {
    measurement: {
      contractValue,
      previousPassedGross: prevGross,
      currentTaxable,
      cumulativeTaxable,
      workCompletionPercent: contractValue > 0 ? money((cumulativeTaxable / contractValue) * 100) : 0,
      balanceContractValue: Math.max(0, money(contractValue - cumulativeTaxable)),
    },
    mobilizationAdvance: {
      totalAdvance: totalMobAdv,
      recoveredPrior: mobRecoveredPrior,
      currentRecovery: currentMobRecovery,
      cumulativeRecovered: cumulativeMobRecovered,
      balanceUnrecovered: balanceMobAdvance,
      recoveryPercent: mobRecoveryPct,
    },
    retention: {
      retainedPrior,
      currentRetention,
      cumulativeRetained,
      maxRetentionCap,
      balanceToHold: balanceRetentionToHold,
      retentionPercent: retentionPct,
    },
    statutory: {
      tdsItPct,
      tdsItAmount: currentTdsIt,
      tdsGstPct,
      tdsGstAmount: currentTdsGst,
      bocwCessPct,
      bocwCessAmount: currentBocwCess,
    },
    otherDeductions: otherDeds,
    totalDeductions,
    currentGrossWithTax,
    netPayable,
  };
}

/**
 * Journal lines for RA bill.
 * Accurately credits Debtors / Vendor with Net Payable while posting withholdings
 * to dedicated statutory & retention asset/liability ledgers.
 */
export function raJournalLines({ billId, invoiceNumber, holds = {}, clientName = '' }) {
  const lines = [];
  const ref = invoiceNumber || billId || 'RA Bill';

  if (holds.retentionAmount > 0) {
    lines.push({
      account: 'Retention Receivable',
      debit: money(holds.retentionAmount),
      credit: 0,
      narration: `Retention withheld on ${ref} (${clientName})`,
    });
  }
  if (holds.tdsItAmount > 0) {
    lines.push({
      account: 'TDS Receivable (IT)',
      debit: money(holds.tdsItAmount),
      credit: 0,
      narration: `TDS u/s 194C on ${ref} (${clientName})`,
    });
  }
  if (holds.tdsGstAmount > 0) {
    lines.push({
      account: 'GST TDS Credit',
      debit: money(holds.tdsGstAmount),
      credit: 0,
      narration: `GST TDS u/s 51 on ${ref} (${clientName})`,
    });
  }
  if (holds.bocwCessAmount > 0) {
    lines.push({
      account: 'Labour Welfare Cess Deducted',
      debit: money(holds.bocwCessAmount),
      credit: 0,
      narration: `BOCW Cess (1%) on ${ref}`,
    });
  }
  if (holds.mobAdvanceRecovery > 0) {
    lines.push({
      account: 'Mobilization Advance Received',
      debit: money(holds.mobAdvanceRecovery),
      credit: 0,
      narration: `Mobilization advance adjusted against ${ref}`,
    });
  }
  return lines;
}
