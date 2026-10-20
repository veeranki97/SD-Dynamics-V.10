/** CSV rows shaped for SD Dynamics-style import */
export function billsToSdCsv(bills) {
  const headers = [
    'InvoiceNo', 'InvoiceDate', 'BillPeriodFrom', 'BillPeriodTo', 'ClientName', 'ClientGSTIN',
    'Site', 'WorkOrderNo', 'PlaceOfSupply', 'Taxable', 'CGST', 'SGST', 'IGST', 'RoundOff', 'GrandTotal', 'Status',
  ];
  const lines = [headers.join(',')];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const b of bills || []) {
    const d = b.data?.details || {};
    const tot = b.data?.totals || b.totals || {};
    const cgst = Number(tot.cgst ?? tot.CGST ?? 0) || 0;
    const sgst = Number(tot.sgst ?? tot.SGST ?? 0) || 0;
    const igst = Number(tot.igst ?? tot.IGST ?? 0) || 0;
    const grand = Number(b.totalAmount ?? tot.grandTotal ?? tot.total ?? 0) || 0;
    let taxable = tot.taxable ?? tot.taxableValue ?? tot.subTotal ?? tot.subtotal;
    if (taxable === '' || taxable == null || taxable === undefined) {
      const taxSum = cgst + sgst + igst;
      taxable = taxSum > 0 && grand > 0 ? Math.round((grand - taxSum) * 100) / 100 : (tot.subTotal ?? '');
    }
    lines.push([
      b.invoiceNumber, b.invoiceDate || d.invoiceDate, d.periodStart, d.periodEnd,
      b.clientName, b.data?.client?.gstin, b.site || d.site, d.workOrderNo,
      d.placeOfSupply, taxable, cgst || '', sgst || '', igst || '',
      tot.roundOff ?? '', grand || b.totalAmount, b.status,
    ].map(esc).join(','));
  }
  return lines.join('\n');
}

export function downloadSdExport(filename, csvText) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csvText], { type: 'text/csv;charset=utf-8' }));
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  a.click();
}
