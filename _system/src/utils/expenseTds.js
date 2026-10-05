/** Vendor TDS on expenses (194C / 194J / 194I) */
export const TDS_SECTIONS = [
  { code: '194C', label: '194C — Contractors', defaultRate: 1 },
  { code: '194J', label: '194J — Professional fees', defaultRate: 10 },
  { code: '194I', label: '194I — Rent', defaultRate: 10 },
];

export function computeExpenseTds({ amount, gstAmount = 0, deductTds, tdsSection, tdsRate }) {
  const base = Number(amount) || 0;
  if (!deductTds) {
    return { tdsAmount: 0, netPayable: base + (Number(gstAmount) || 0), tdsRate: 0, tdsSection: tdsSection || '' };
  }
  const rate = Number(tdsRate) || 0;
  const tdsAmount = Math.round(base * rate) / 100;
  const netPayable = Math.round((base + (Number(gstAmount) || 0) - tdsAmount) * 100) / 100;
  return { tdsAmount, netPayable, tdsRate: rate, tdsSection: tdsSection || '194C' };
}
