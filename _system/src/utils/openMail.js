/**
 * Email helpers: prefer server SMTP, never navigate the app tab away to Gmail.
 */
export function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  } catch (_) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  } catch (_) {}
  return Promise.resolve();
}

function sessionHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const t = sessionStorage.getItem('sd_session_token');
    if (t) headers.Authorization = `Bearer ${t}`;
  } catch (_) {}
  return headers;
}

/**
 * Try backend SMTP first. Returns { ok, error, code }.
 */
export async function tryServerSendMail({ to, subject, text, body } = {}) {
  const email = String(to || '').trim();
  const sub = String(subject || '').trim();
  const msg = String(text || body || '').trim();
  if (!email) return { ok: false, error: 'No recipient email', code: 'no-to' };
  if (!sub) return { ok: false, error: 'No subject', code: 'no-subject' };
  try {
    const r = await fetch('/api/mail/send', {
      method: 'POST',
      credentials: 'same-origin',
      headers: sessionHeaders(),
      body: JSON.stringify({ to: email, subject: sub, text: msg }),
    });
    const ct = r.headers.get('content-type') || '';
    const raw = await r.text();
    let j = {};
    if (ct.includes('json') || (raw && raw[0] === '{')) {
      try { j = JSON.parse(raw); } catch (_) {}
    }
    if (r.ok) return { ok: true, messageId: j.messageId };
    // HTML response = route missing on this server
    if (raw.trim().startsWith('<')) {
      return { ok: false, error: 'Mail API not on this server — restart with updated server.js + npm install nodemailer', code: 'no-route' };
    }
    return { ok: false, error: j.error || `Send failed (${r.status})`, code: j.code || String(r.status) };
  } catch (e) {
    return { ok: false, error: e.message || 'Network error', code: 'network' };
  }
}

/**
 * Client-only open. Never uses window.location (keeps you in the app).
 * preferGmail: open Gmail compose in NEW tab only.
 */
export function openMailClient({ to = '', subject = '', body = '', preferGmail = false } = {}) {
  const email = String(to || '').trim();
  let subj = String(subject || '');
  let bod = String(body || '');
  if (bod.length > 1500) bod = bod.slice(0, 1490) + '\n…';

  const mailto = `mailto:${email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(bod)}`;
  const gmail =
    `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}` +
    `&su=${encodeURIComponent(subj)}&body=${encodeURIComponent(bod)}`;

  copyText(bod);

  if (preferGmail) {
    const w = window.open(gmail, '_blank', 'noopener,noreferrer');
    return { method: 'gmail', href: gmail, popupBlocked: !w };
  }

  try {
    const a = document.createElement('a');
    a.href = mailto;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { a.remove(); } catch (_) {} }, 400);
  } catch (_) {}
  return { method: 'mailto', href: mailto, gmailFallback: gmail };
}

/**
 * SMTP first → on failure optional Gmail new-tab (never same tab).
 */
export async function sendMailSmart({ to, subject, body, allowGmailFallback = true } = {}) {
  const server = await tryServerSendMail({ to, subject, text: body });
  if (server.ok) return { ...server, method: 'smtp' };
  if (!allowGmailFallback) return { ...server, method: 'smtp-failed' };
  const open = openMailClient({ to, subject, body, preferGmail: true });
  return {
    ok: false,
    method: open.method,
    smtpError: server.error,
    smtpCode: server.code,
    popupBlocked: open.popupBlocked,
  };
}

export function openGmailCompose(opts) {
  return openMailClient({ ...opts, preferGmail: true });
}
