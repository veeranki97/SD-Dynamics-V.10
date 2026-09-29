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
    const tot = b.data?.totals || {};
    lines.push([
      b.invoiceNumber, b.invoiceDate || d.invoiceDate, d.periodStart, d.periodEnd,
      b.clientName, b.data?.client?.gstin, b.site || d.site, d.workOrderNo,
      d.placeOfSupply, tot.subTotal ?? '', tot.cgst ?? '', tot.sgst ?? '', tot.igst ?? '',
      tot.roundOff ?? '', b.totalAmount, b.status,
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
