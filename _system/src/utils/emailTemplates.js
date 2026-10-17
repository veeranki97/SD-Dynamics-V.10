/**
 * SD Dynamics — email HTML from legacy GAS (CodeGSV1 sendInvoiceEmail + monthly executive).
 * Plain text fallback always included for SMTP.
 */

export function brandHeader(businessName = 'SD Dynamics') {
  const name = String(businessName || 'SD Dynamics').replace(/[<>]/g, '');
  return `
  <div style="background-color:#003366;padding:20px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:22px;letter-spacing:1px;">${name}</h1>
  </div>`;
}

export function brandFooter(addressLine = '') {
  const addr = String(addressLine || '').replace(/[<>]/g, '');
  return `
  <div style="background-color:#f8f9fa;padding:16px;text-align:center;font-size:12px;color:#6c757d;border-top:1px solid #e0e0e0;">
    This is an automated message from SD Dynamics.<br>
    ${addr || 'Offline GST ERP — PIN is a screen lock only; data files are not encrypted.'}
  </div>`;
}

/** Invoice / document email (matches GAS sendInvoiceEmail layout) */
export function invoiceEmailHtml({ businessName, bodyText, pdfUrl, addressLine }) {
  const formatted = String(bodyText || 'Dear Customer,\n\nPlease find your document attached.\n\nThank you.')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  const btn = pdfUrl
    ? `<div style="text-align:center;margin-top:20px;">
         <a href="${String(pdfUrl).replace(/"/g, '')}" style="background-color:#007aff;color:#ffffff;padding:12px 25px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">View PDF</a>
       </div>`
    : '';
  return `
  <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
    ${brandHeader(businessName)}
    <div style="padding:28px;background:#ffffff;color:#333;line-height:1.6;font-size:15px;">
      ${formatted}
      ${btn}
    </div>
    ${brandFooter(addressLine)}
  </div>`;
}

/** Overdue / payment reminder (site-wise style from GAS checkAndSendOverdueEmails) */
export function overdueReminderHtml({ businessName, clientName, siteName, rowsHtml, totalDue, addressLine }) {
  return `
  <div style="font-family:Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
    ${brandHeader(businessName)}
    <div style="padding:24px;background:#fff;color:#333;font-size:14px;line-height:1.5;">
      <p>Dear <strong>${escapeHtml(clientName || 'Customer')}</strong>,</p>
      <p>The following invoices for site <strong>${escapeHtml(siteName || 'Main')}</strong> are overdue. Kindly arrange payment at the earliest.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="text-align:left;padding:8px;border:1px solid #e2e8f0;">Invoice</th>
            <th style="text-align:left;padding:8px;border:1px solid #e2e8f0;">Date</th>
            <th style="text-align:right;padding:8px;border:1px solid #e2e8f0;">Outstanding</th>
          </tr>
        </thead>
        <tbody>${rowsHtml || ''}</tbody>
      </table>
      <p style="font-size:16px;"><strong>Total due: ₹${formatInr(totalDue)}</strong></p>
      <p>Regards,<br>${escapeHtml(businessName || 'SD Dynamics')}</p>
    </div>
    ${brandFooter(addressLine)}
  </div>`;
}

/** Monthly executive snapshot (GAS generateAndEmailMonthlyReport) */
export function monthlyExecutiveHtml({
  businessName = 'SD Dynamics',
  monthName,
  year,
  totalBilled = 0,
  totalCollected = 0,
  totalOutstanding = 0,
  defaulterRows = '',
  gstPaid = null,
  gstMismatch = false,
}) {
  const name = escapeHtml(businessName);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#333;margin:0;padding:0}
    .header{background:#1a73e8;color:#fff;padding:24px;text-align:center}
    .container{padding:28px}
    .card{background:#f8f9fa;border-radius:8px;padding:18px;margin-bottom:18px;border:1px solid #e8eaed}
    .row{display:table;width:100%;margin-bottom:12px}
    .col{display:table-cell;width:33%;text-align:center;border-right:1px solid #ddd;vertical-align:top}
    .col:last-child{border-right:none}
    .metric-title{font-size:10pt;color:#5f6368;text-transform:uppercase;font-weight:bold;margin-bottom:4px}
    .metric-val{font-size:16pt;font-weight:bold;color:#1a73e8}
    .val-success{color:#188038}.val-danger{color:#d93025}
    table{width:100%;border-collapse:collapse}
  </style></head><body>
  <div class="header">
    <h1 style="margin:0;font-size:22pt;letter-spacing:1px;">${name}</h1>
    <p style="margin:6px 0 0;opacity:.9;">Executive Financial Snapshot | <strong>${escapeHtml(monthName)} ${year}</strong></p>
  </div>
  <div class="container">
    <h3 style="border-bottom:2px solid #1a73e8;padding-bottom:6px;color:#1a73e8;">Monthly Cash Flow Overview</h3>
    <div class="card"><div class="row">
      <div class="col"><div class="metric-title">Billed</div><div class="metric-val">₹${formatInr(totalBilled)}</div></div>
      <div class="col"><div class="metric-title">Collected</div><div class="metric-val val-success">₹${formatInr(totalCollected)}</div></div>
      <div class="col"><div class="metric-title">Outstanding</div><div class="metric-val val-danger">₹${formatInr(totalOutstanding)}</div></div>
    </div></div>
    <h3 style="border-bottom:2px solid #1a73e8;padding-bottom:6px;color:#1a73e8;">Top outstanding</h3>
    <div class="card">
      <table>
        <tr style="background:#f1f5f9;"><th style="text-align:left;padding:8px;">Client / Invoice</th><th style="text-align:right;padding:8px;">Due</th></tr>
        ${defaulterRows || '<tr><td colspan="2" style="text-align:center;padding:10px;color:#188038;">No outstanding dues</td></tr>'}
      </table>
    </div>
    ${gstPaid != null ? `<div class="card"><p style="margin:0;">GST paid (ledger): <strong>₹${formatInr(gstPaid)}</strong></p>
      ${gstMismatch ? '<p style="color:#d93025;font-weight:bold;font-size:9pt;">⚠ Review GST paid vs liability.</p>' : '<p style="color:#188038;font-size:9pt;">✔ Snapshot generated for review.</p>'}
    </div>` : ''}
    <p style="text-align:center;font-size:8pt;color:#9aa0a6;margin-top:32px;">Automated report from SD Dynamics. Do not reply.</p>
  </div>
  </body></html>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatInr(n) {
  const x = Number(n) || 0;
  try {
    return x.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return x.toFixed(2);
  }
}

export function defaultInvoiceBody(invNum, clientName, businessName) {
  return `Dear ${clientName || 'Customer'},

Please find invoice ${invNum || ''} from ${businessName || 'our firm'}.

Thank you for your business.

Regards,
${businessName || 'SD Dynamics'}`;
}
