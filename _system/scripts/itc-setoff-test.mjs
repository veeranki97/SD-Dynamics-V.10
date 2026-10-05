/**
 * Unit tests: applyItcSetOff (Sec 49 / Rule 88A)
 * Run: node scripts/itc-setoff-test.mjs
 */
function applyItcSetOff(outputTax, itc) {
  let oI = Math.max(0, Number(outputTax?.igst) || 0);
  let oC = Math.max(0, Number(outputTax?.cgst) || 0);
  let oS = Math.max(0, Number(outputTax?.sgst) || 0);
  let cI = Math.max(0, Number(itc?.igst) || 0);
  let cC = Math.max(0, Number(itc?.cgst) || 0);
  let cS = Math.max(0, Number(itc?.sgst) || 0);
  const utilised = { igst: 0, cgst: 0, sgst: 0 };
  let use = Math.min(cI, oI); oI -= use; cI -= use; utilised.igst += use;
  use = Math.min(cI, oC); oC -= use; cI -= use; utilised.igst += use;
  use = Math.min(cI, oS); oS -= use; cI -= use; utilised.igst += use;
  use = Math.min(cC, oC); oC -= use; cC -= use; utilised.cgst += use;
  use = Math.min(cC, oI); oI -= use; cC -= use; utilised.cgst += use;
  use = Math.min(cS, oS); oS -= use; cS -= use; utilised.sgst += use;
  use = Math.min(cS, oI); oI -= use; cS -= use; utilised.sgst += use;
  const r2 = (n) => Math.round(n * 100) / 100;
  return {
    payable: { igst: r2(oI), cgst: r2(oC), sgst: r2(oS) },
    utilised: { igst: r2(utilised.igst), cgst: r2(utilised.cgst), sgst: r2(utilised.sgst) },
    carryForward: { igst: r2(cI), cgst: r2(cC), sgst: r2(cS) },
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function eq(a, b, msg) {
  assert(Math.abs(a - b) < 0.011, `${msg}: ${a} !== ${b}`);
}

// Cross-utilisation: IGST credit covers CGST
{
  const r = applyItcSetOff({ igst: 0, cgst: 100, sgst: 100 }, { igst: 150, cgst: 0, sgst: 0 });
  eq(r.payable.cgst, 0, 'IGST→CGST');
  eq(r.payable.sgst, 50, 'IGST residual SGST');
  eq(r.carryForward.igst, 0, 'no IGST CF');
}

// CGST cannot settle SGST
{
  const r = applyItcSetOff({ igst: 0, cgst: 50, sgst: 50 }, { igst: 0, cgst: 100, sgst: 0 });
  eq(r.payable.cgst, 0, 'CGST settles CGST');
  eq(r.payable.sgst, 50, 'CGST never SGST');
  eq(r.carryForward.cgst, 50, 'CGST CF');
}

// Carry-forward excess ITC
{
  const r = applyItcSetOff({ igst: 10, cgst: 0, sgst: 0 }, { igst: 40, cgst: 0, sgst: 0 });
  eq(r.payable.igst, 0, 'paid');
  eq(r.carryForward.igst, 30, 'CF 30');
}

// Intra-only: same-head when no cross needed (unchanged vs max(0,out-itc))
{
  const r = applyItcSetOff({ igst: 0, cgst: 90, sgst: 90 }, { igst: 0, cgst: 40, sgst: 40 });
  eq(r.payable.cgst, 50, 'intra CGST');
  eq(r.payable.sgst, 50, 'intra SGST');
  eq(r.payable.igst, 0, 'intra IGST');
}

console.log('itc-setoff-test: all passed');
