/** Minimal Tally-compatible XML for sales (tax invoices) and purchases — import via Tally gateway optional. */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n) {
  const x = Number(n);
  return (Number.isFinite(x) ? x : 0).toFixed(2);
}

/** Sales vouchers from bills array (tax-invoice / bill-of-supply style). */
export function buildTallySalesXml(bills, companyName = 'SD Dynamics') {
  const rows = (bills || []).filter(b => {
    const t = String(b.invoiceType || b.type || '').toLowerCase();
    if (t.includes('quotation') || t.includes('proforma') || t.includes('challan') || t.includes('delivery')) return false;
    if (String(b.status || '').toLowerCase() === 'cancelled') return false;
    return true;
  });
  const vouchers = rows.map(b => {
    const num = b.invoiceNumber || b.id || '';
    const date = (b.data?.details?.invoiceDate || b.invoiceDate || '').replace(/-/g, '');
    const party = b.clientName || b.data?.client?.name || 'Customer';
    const amt = money(b.totalAmount ?? b.data?.totals?.grandTotal ?? 0);
    return `  <VOUCHER VCHTYPE="Sales" ACTION="Create">
    <DATE>${esc(date)}</DATE>
    <VOUCHERNUMBER>${esc(num)}</VOUCHERNUMBER>
    <PARTYLEDGERNAME>${esc(party)}</PARTYLEDGERNAME>
    <NARRATION>Imported from SD Dynamics</NARRATION>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${esc(party)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-${amt}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Sales</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>${amt}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Vouchers</REPORTNAME>
    <STATICVARIABLES>
     <SVCURRENTCOMPANY>${esc(companyName)}</SVCURRENTCOMPANY>
    </STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>
${vouchers}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>
`;
}

export function buildTallyPurchaseXml(purchases, companyName = 'SD Dynamics') {
  const rows = purchases || [];
  const vouchers = rows.map(p => {
    const num = p.invoiceNumber || p.billNo || p.id || '';
    const date = String(p.date || p.billDate || '').replace(/-/g, '');
    const party = p.supplierName || p.vendorName || 'Supplier';
    const amt = money(p.totalAmount ?? p.grandTotal ?? 0);
    return `  <VOUCHER VCHTYPE="Purchase" ACTION="Create">
    <DATE>${esc(date)}</DATE>
    <VOUCHERNUMBER>${esc(num)}</VOUCHERNUMBER>
    <PARTYLEDGERNAME>${esc(party)}</PARTYLEDGERNAME>
    <NARRATION>Imported from SD Dynamics</NARRATION>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Purchase</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-${amt}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${esc(party)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>${amt}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Vouchers</REPORTNAME>
    <STATICVARIABLES>
     <SVCURRENTCOMPANY>${esc(companyName)}</SVCURRENTCOMPANY>
    </STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>
${vouchers}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>
`;
}
