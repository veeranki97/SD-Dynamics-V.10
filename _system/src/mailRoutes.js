/**
 * SMTP + monthly executive report (GAS parity).
 * registerMailRoutes(app, { readJSON, writeJSON, META_PATH, readAllFromDir })
 */
export function registerMailRoutes(app, ctx) {
  const { readJSON, writeJSON, META_PATH, readAllFromDir } = ctx || {};
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
        lastMonthlyReportAt: meta.lastMonthlyReportAt || null,
        lastMonthlyReportMonth: meta.lastMonthlyReportMonth || null,
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
        return res.status(400).json({ error: 'Configure SMTP in Settings (Gmail App Password).', code: 'no-smtp' });
      }
      const to = String(req.body?.to || '').trim();
      const subject = String(req.body?.subject || '').trim();
      const text = String(req.body?.text || req.body?.body || '').trim();
      const html = req.body?.html ? String(req.body.html) : undefined;
      if (!to.includes('@')) return res.status(400).json({ error: 'Valid recipient email required' });
      if (!subject) return res.status(400).json({ error: 'subject required' });
      let nodemailer;
      try {
        nodemailer = (await import('nodemailer')).default;
      } catch {
        return res.status(503).json({ error: 'Run: npm install nodemailer', code: 'no-nodemailer' });
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
        text: text || subject,
        html,
      });
      res.json({ ok: true, messageId: info.messageId });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Send failed' });
    }
  });

  app.post('/api/mail/monthly-report', async (req, res) => {
    try {
      const meta = readJSON(META_PATH, {}) || {};
      const s = meta.smtp || {};
      let profiles = [];
      try {
        profiles = typeof readAllFromDir === 'function' ? readAllFromDir('profiles') || [] : [];
      } catch (_) {}
      const profile = profiles[0] || {};
      const businessName = profile.businessName || profile.name || meta.companyName || 'SD Dynamics';
      const adminEmail = String(req.body?.to || s.from || s.user || '').trim();
      if (!adminEmail.includes('@')) {
        return res.status(400).json({ error: 'Set SMTP user/from or pass { to: "admin@..." }' });
      }
      const now = new Date();
      const reportDate = req.body?.month
        ? new Date(String(req.body.month) + '-01')
        : new Date(now.getFullYear(), now.getMonth(), 1);
      const monthStr = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`;
      const monthName = reportDate.toLocaleString('en-IN', { month: 'long' });
      const year = reportDate.getFullYear();

      let bills = [], receipts = [];
      try {
        bills = typeof readAllFromDir === 'function' ? readAllFromDir('bills') || [] : [];
        receipts = typeof readAllFromDir === 'function' ? readAllFromDir('receipts') || [] : [];
      } catch (_) {}

      let totalBilled = 0, totalCollected = 0;
      const pending = [];
      for (const b of bills) {
        if (b.isDeleted || b.deleted) continue;
        const t = String(b.invoiceType || b.type || '').toLowerCase();
        const st = String(b.status || '').toLowerCase();
        if (st.includes('cancel')) continue;
        if (t.includes('quot') || t.includes('proforma') || t.includes('challan') || t.includes('delivery')) continue;
        const d = String(b.invoiceDate || b.date || '').slice(0, 7);
        const total = Number(b.grandTotal ?? b.totalAmount ?? b.total) || 0;
        const paid = Number(b.paidAmount) || 0;
        if (d === monthStr) {
          if (t.includes('credit')) totalBilled -= Math.abs(total);
          else totalBilled += total;
        }
        const due = total - paid;
        if (due > 1) {
          pending.push({
            client: b.clientName || b.company || b.customerName || '',
            inv: b.invoiceNumber || b.invNum || b.id,
            due,
          });
        }
      }
      for (const r of receipts) {
        if (r.isDeleted) continue;
        const d = String(r.date || r.receiptDate || '').slice(0, 7);
        if (d === monthStr) totalCollected += Math.abs(Number(r.amount) || 0);
      }
      pending.sort((a, b) => b.due - a.due);
      const top = pending.slice(0, 5);
      const defaulterRows = top
        .map(
          (d) =>
            `<tr><td style="padding:8px;border-bottom:1px solid #eee">${String(d.client).replace(/</g, '')} (${String(d.inv).replace(/</g, '')})</td><td style="padding:8px;text-align:right;color:#d93025;font-weight:bold">₹${(d.due || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>`
        )
        .join('') ||
        '<tr><td colspan="2" style="text-align:center;padding:10px;color:#188038">No outstanding dues</td></tr>';
      const totalOutstanding = pending.reduce((s, x) => s + x.due, 0);

      const html = `<!DOCTYPE html><html><body style="font-family:Helvetica,Arial,sans-serif;color:#333;margin:0">
        <div style="background:#1a73e8;color:#fff;padding:24px;text-align:center">
          <h1 style="margin:0;letter-spacing:1px">${String(businessName).replace(/</g, '')}</h1>
          <p style="margin:6px 0 0;opacity:.95">Executive Financial Snapshot | <strong>${monthName} ${year}</strong></p>
        </div>
        <div style="padding:28px">
          <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
            <div style="flex:1;min-width:120px;background:#f8f9fa;padding:14px;border-radius:8px;text-align:center"><div style="font-size:11px;color:#5f6368">BILLED</div><div style="font-size:18px;font-weight:bold;color:#1a73e8">₹${totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div>
            <div style="flex:1;min-width:120px;background:#f8f9fa;padding:14px;border-radius:8px;text-align:center"><div style="font-size:11px;color:#5f6368">COLLECTED</div><div style="font-size:18px;font-weight:bold;color:#188038">₹${totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div>
            <div style="flex:1;min-width:120px;background:#f8f9fa;padding:14px;border-radius:8px;text-align:center"><div style="font-size:11px;color:#5f6368">OUTSTANDING</div><div style="font-size:18px;font-weight:bold;color:#d93025">₹${totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div>
          </div>
          <h3 style="border-bottom:2px solid #1a73e8;color:#1a73e8">Top outstanding</h3>
          <table style="width:100%;border-collapse:collapse">${defaulterRows}</table>
          <p style="text-align:center;font-size:11px;color:#9aa0a6;margin-top:28px">Automated report from SD Dynamics.</p>
        </div></body></html>`;

      if (!s.user || !s.pass) {
        return res.status(400).json({ error: 'Configure SMTP first', monthStr, totalBilled, totalCollected, totalOutstanding });
      }
      let nodemailer;
      try {
        nodemailer = (await import('nodemailer')).default;
      } catch {
        return res.status(503).json({ error: 'npm install nodemailer' });
      }
      const transporter = nodemailer.createTransport({
        host: s.host || 'smtp.gmail.com',
        port: Number(s.port) || 465,
        secure: s.secure !== false,
        auth: { user: s.user, pass: s.pass },
      });
      const info = await transporter.sendMail({
        from: s.from || s.user,
        to: adminEmail,
        subject: `${businessName} Executive Report - ${monthName} ${year}`,
        text: `Billed ₹${totalBilled} | Collected ₹${totalCollected} | Outstanding ₹${totalOutstanding}`,
        html,
      });
      meta.lastMonthlyReportAt = new Date().toISOString();
      meta.lastMonthlyReportMonth = monthStr;
      writeJSON(META_PATH, meta);
      res.json({ ok: true, messageId: info.messageId, monthStr, totalBilled, totalCollected, totalOutstanding });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  console.log('[mail] routes: settings, send, monthly-report');
}
