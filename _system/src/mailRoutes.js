/**
 * SMTP routes — register with: import { registerMailRoutes } from './src/mailRoutes.js';
 *   registerMailRoutes(app, { readJSON, writeJSON, META_PATH });
 * Call BEFORE the SPA / "No such endpoint" catch-all.
 */
export function registerMailRoutes(app, { readJSON, writeJSON, META_PATH }) {
  if (!app || typeof app.get !== 'function') throw new Error('registerMailRoutes: app required');
  if (app.__sdMailRoutesRegistered) return;
  app.__sdMailRoutesRegistered = true;

  app.get('/api/mail/settings', (req, res) => {
    try {
      const meta = readJSON(META_PATH, {}) || {};
      const s = meta.smtp || {};
      res.json({
        host: s.host || 'smtp.gmail.com',
        port: s.port || 465,
        secure: s.secure !== false,
        user: s.user || '',
        from: s.from || s.user || '',
        configured: !!(s.user && s.pass),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/mail/settings', (req, res) => {
    try {
      const meta = readJSON(META_PATH, {}) || {};
      const body = req.body || {};
      const prev = meta.smtp || {};
      meta.smtp = {
        host: String(body.host || prev.host || 'smtp.gmail.com').trim(),
        port: Number(body.port) || 465,
        secure: body.secure !== false,
        user: String(body.user || prev.user || '').trim(),
        pass: body.pass != null && String(body.pass).length ? String(body.pass) : (prev.pass || ''),
        from: String(body.from || body.user || prev.from || '').trim(),
      };
      writeJSON(META_PATH, meta);
      res.json({ ok: true, configured: !!(meta.smtp.user && meta.smtp.pass) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/mail/send', async (req, res) => {
    try {
      const meta = readJSON(META_PATH, {}) || {};
      const s = meta.smtp || {};
      if (!s.user || !s.pass) {
        return res.status(400).json({
          error: 'Configure SMTP in Settings (Gmail App Password). PIN is screen lock only — not encryption.',
        });
      }
      const to = String(req.body?.to || '').trim();
      const subject = String(req.body?.subject || '').trim();
      const text = String(req.body?.text || req.body?.body || '').trim();
      if (!to || !subject) return res.status(400).json({ error: 'to and subject required' });

      let nodemailer;
      try {
        nodemailer = (await import('nodemailer')).default;
      } catch {
        return res.status(503).json({
          error: 'Run: npm install nodemailer',
          code: 'no-nodemailer',
        });
      }

      const transporter = nodemailer.createTransport({
        host: s.host || 'smtp.gmail.com',
        port: Number(s.port) || 465,
        secure: s.secure !== false,
        auth: { user: s.user, pass: s.pass },
      });
      const info = await transporter.sendMail({
        from: s.from || s.user,
        to,
        subject,
        text,
      });
      res.json({ ok: true, messageId: info.messageId });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Send failed' });
    }
  });

  console.log('[mail] routes registered: GET/POST /api/mail/settings, POST /api/mail/send');
}
