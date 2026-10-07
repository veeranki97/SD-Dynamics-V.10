/** Client-side GST month Issues panel (no GSTN filing). */
export function collectGstMonthIssues(bills, periodFilter) {
  const issues = [];
  for (const b of bills || []) {
    if (periodFilter && !periodFilter(b)) continue;
    const t = String(b.invoiceType || b.data?.invoiceType || '').toLowerCase();
    if (t.includes('quotation') || t.includes('challan')) continue;
    const items = b.data?.items || b.items || [];
    const client = b.data?.client || {};
    const gstin = client.gstin || b.clientGstin || '';
    for (const it of items) {
      const hsn = String(it.hsn || it.sac || '').replace(/\D/g, '');
      if (gstin && hsn && hsn.length < 4) {
        issues.push({
          severity: 'warn',
          code: 'HSN_SHORT',
          message: `HSN/SAC "${it.hsn || it.sac}" under 4 digits`,
          billId: b.id,
          invoiceNumber: b.invoiceNumber,
        });
      }
    }
    if (!gstin && (Number(b.totalAmount) || 0) > 0 && !t.includes('b2c')) {
      // optional soft note for large B2B-looking
    }
    if (gstin && gstin.length !== 15 && gstin.length > 0) {
      issues.push({
        severity: 'error',
        code: 'GSTIN_LEN',
        message: `Client GSTIN length ${gstin.length} (need 15)`,
        billId: b.id,
        invoiceNumber: b.invoiceNumber,
      });
    }
  }
  return issues;
}
