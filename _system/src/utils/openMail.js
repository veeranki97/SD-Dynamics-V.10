/**
 * Prefer server SMTP (nodemailer). If no SMTP / send fails → Gmail compose in NEW tab.
 * If client email missing → promptForEmail (Swal or window.prompt).
 * Does NOT import from store.js (apiFetch is not exported there).
 */
import { invoiceEmailHtml, defaultInvoiceBody } from './emailTemplates';

async function postJson(path, body) {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const tok = sessionStorage.getItem('sd_session_token');
    if (tok) headers['Authorization'] = `Bearer ${tok}`;
  } catch (_) {}
  const res = await fetch(path, {
    method: 'POST',
    headers,
    credentials: 'same-origin',
    body: JSON.stringify(body ?? {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error(data?.error || `API ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export async function promptForEmail(defaultEmail = '') {
  const existing = String(defaultEmail || '').trim();
  if (existing.includes('@')) return existing;
  if (typeof window !== 'undefined' && window.Swal) {
    const r = await window.Swal.fire({
      title: 'Client email missing',
      text: 'Enter the email address to send this message. You can also save it on the Client master.',
      input: 'email',
      inputPlaceholder: 'client@company.com',
      showCancelButton: true,
      confirmButtonText: 'Continue',
      inputValidator: (v) => {
        if (!v || !String(v).includes('@')) return 'Valid email required';
        return null;
      },
    });
    if (r.isDismissed) return null;
    return String(r.value || '').trim();
  }
  const v = window.prompt('Client email is missing. Enter email to send:', '');
  if (!v || !v.includes('@')) return null;
  return v.trim();
}

export async function sendMailPreferred({
  to,
  subject,
  body,
  html,
  businessName,
  pdfUrl,
  addressLine,
  useInvoiceTemplate = false,
}) {
  let email = String(to || '').trim();
  if (!email.includes('@')) {
    email = await promptForEmail('');
    if (!email) return { ok: false, cancelled: true, error: 'No email' };
  }

  let htmlBody = html;
  if (useInvoiceTemplate || (!html && body)) {
    htmlBody = invoiceEmailHtml({
      businessName: businessName || 'SD Dynamics',
      bodyText: body || defaultInvoiceBody(subject, '', businessName),
      pdfUrl,
      addressLine,
    });
  }

  try {
    const res = await postJson('/api/mail/send', {
      to: email,
      subject: subject || 'Message from SD Dynamics',
      text: body || subject || '',
      html: htmlBody || undefined,
    });
    if (res && (res.ok || res.messageId)) {
      return { ok: true, via: 'smtp', to: email, ...res };
    }
  } catch (_) {
    /* SMTP unavailable — fall through */
  }

  const gmail =
    'https://mail.google.com/mail/?view=cm&fs=1&to=' +
    encodeURIComponent(email) +
    '&su=' +
    encodeURIComponent(subject || '') +
    '&body=' +
    encodeURIComponent(body || '');
  try {
    if (navigator.clipboard && body) await navigator.clipboard.writeText(body);
  } catch (_) {}
  window.open(gmail, '_blank', 'noopener,noreferrer');
  return { ok: true, via: 'gmail-compose', to: email };
}

export async function sendMonthlyReportNow() {
  try {
    return await postJson('/api/mail/monthly-report', {});
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Alias used by Dashboard.jsx / PaymentReminders.
 * Accepts either (opts object) or legacy (to, subject, body).
 */
export async function sendMailSmart(a, b, c) {
  if (a && typeof a === 'object' && !Array.isArray(a)) {
    return sendMailPreferred(a);
  }
  return sendMailPreferred({
    to: a,
    subject: b,
    body: c,
    useInvoiceTemplate: true,
  });
}

export { sendMailPreferred as openMail };
