/**
 * UPI pay URL + WhatsApp due-reminder text (Simple Invoicing–style helpers).
 * Pure functions — safe for invoice PDF and Payment Reminders.
 */

/** Build upi://pay URL for QR. Amount = outstanding balance when provided. */
export function buildUpiPayUrl({
  upiId,
  payeeName = '',
  amount,
  currency = 'INR',
  note = '',
}) {
  const pa = String(upiId || '').trim();
  if (!pa) return '';
  const am = Math.max(0, Number(amount) || 0);
  const params = [
    'pa=' + encodeURIComponent(pa),
    'pn=' + encodeURIComponent(String(payeeName || '').slice(0, 80)),
    'cu=' + encodeURIComponent(currency || 'INR'),
  ];
  if (am > 0.009) params.push('am=' + am.toFixed(2));
  if (note) params.push('tn=' + encodeURIComponent(String(note).slice(0, 80)));
  return 'upi://pay?' + params.join('&');
}

/** Digits-only phone for wa.me (India: ensure country code 91 when 10 digits). */
export function normalizeWaPhone(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 10) d = '91' + d;
  if (d.length < 11) return '';
  return d;
}

/** Pre-filled WhatsApp reminder for overdue / due balance. */
export function buildWhatsAppDueReminderText({
  clientName = 'Customer',
  invoiceNumber = '',
  amountText = '',
  dueDate = '',
  companyName = '',
  upiId = '',
}) {
  const lines = [
    'Dear ' + (clientName || 'Customer') + ',',
    '',
    'Payment reminder for invoice ' + (invoiceNumber || '—') + '.',
    'Outstanding: ' + (amountText || '—'),
    'Due date: ' + (dueDate || '—'),
    '',
  ];
  if (upiId) {
    lines.push('You can pay via UPI: ' + upiId);
    lines.push('');
  }
  lines.push('Please arrange payment at the earliest.');
  if (companyName) {
    lines.push('');
    lines.push('Regards,');
    lines.push(companyName);
  }
  return lines.join('\n');
}

export function buildWhatsAppDueUrl(phone, text) {
  const p = normalizeWaPhone(phone);
  if (!p) return '';
  return 'https://wa.me/' + p + '?text=' + encodeURIComponent(text || '');
}
