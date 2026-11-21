import { sendMailSmart } from '../utils/openMail';
import { toast } from './Toast';
import { useState, useEffect, useMemo } from 'react';
import { Bell, RefreshCw, Mail, MessageCircle, ExternalLink, IndianRupee } from 'lucide-react';
import { getAllBills } from '../store';
import { formatCurrency } from '../utils';
import { isReceivableDocument, isCancelled, isConverted, normalizeInvoiceType } from '../utils/revenueFilter';
import { buildWhatsAppDueReminderText, buildWhatsAppDueUrl } from '../utils/paymentShare';

function daysOverdue(dueOrInv) {
  if (!dueOrInv) return 0;
  const d = new Date(dueOrInv);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

const chipBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  border: '1px solid var(--border)',
  background: 'var(--card, #fff)',
};

export default function PaymentRemindersView({ onOpenInvoice }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [bucket, setBucket] = useState('all'); // all | 1-30 | 31-60 | 60+
  const [sched, setSched] = useState({ enabled: false, interval: 'daily', lastRunAt: null });

  const saveSched = async (patch) => {
    const next = { ...sched, ...patch };
    setSched(next);
    try {
      await fetch('/api/meta/reminderSchedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ value: next }),
      });
      toast('Reminder schedule saved (runs while server is open)', 'success');
    } catch {
      toast('Could not save schedule', 'error');
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const all = await getAllBills();
      setBills(Array.isArray(all) ? all : (all?.items || []));
    } catch {
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    fetch('/api/meta/reminderSchedule', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((j) => { if (j?.value) setSched({ enabled: false, interval: 'daily', ...j.value }); })
      .catch(() => {});
  }, []);

  const overdue = useMemo(() => {
    const list = (bills || [])
      .filter((b) => {
        if (isCancelled(b) || isConverted(b)) return false;
        if (!isReceivableDocument(b)) return false;
        const t = normalizeInvoiceType(b);
        if (/proforma|quotation|estimate|delivery|challan|credit/.test(t)) return false;
        const total = Number(b.totalAmount ?? b.data?.totals?.total ?? b.data?.totals?.grandTotal ?? 0) || 0;
        const paid = Number(b.paidAmount ?? 0) || 0;
        return total - paid > 0.5;
      })
      .map((b) => {
        const total = Number(b.totalAmount ?? b.data?.totals?.total ?? b.data?.totals?.grandTotal ?? 0) || 0;
        const paid = Number(b.paidAmount ?? 0) || 0;
        const due = b.dueDate || b.data?.details?.dueDate || b.invoiceDate;
        return { ...b, _rem: total - paid, _days: daysOverdue(due), _due: due };
      })
      .filter((b) => b._days > 0 || (b._days === 0 && b._rem > 0.5 && b._due && new Date(b._due) <= new Date()))
      .sort((a, b) => b._days - a._days);
    const qq = q.trim().toLowerCase();
    let out = list;
    if (qq) {
      out = out.filter((b) =>
        String(b.invoiceNumber || '').toLowerCase().includes(qq) ||
        String(b.clientName || '').toLowerCase().includes(qq)
      );
    }
    if (bucket === '1-30') out = out.filter((b) => b._days >= 1 && b._days <= 30);
    else if (bucket === '31-60') out = out.filter((b) => b._days >= 31 && b._days <= 60);
    else if (bucket === '60+') out = out.filter((b) => b._days > 60);
    return out;
  }, [bills, q, bucket]);

  const summary = useMemo(() => {
    const all = (bills || []).filter((b) => {
      if (isCancelled(b) || isConverted(b)) return false;
      if (!isReceivableDocument(b)) return false;
      const t = normalizeInvoiceType(b);
      if (/proforma|quotation|estimate|delivery|challan|credit/.test(t)) return false;
      const total = Number(b.totalAmount ?? b.data?.totals?.total ?? b.data?.totals?.grandTotal ?? 0) || 0;
      const paid = Number(b.paidAmount ?? 0) || 0;
      if (total - paid <= 0.5) return false;
      const due = b.dueDate || b.data?.details?.dueDate || b.invoiceDate;
      const days = daysOverdue(due);
      return days > 0 || (days === 0 && due && new Date(due) <= new Date());
    }).map((b) => {
      const total = Number(b.totalAmount ?? 0) || 0;
      const paid = Number(b.paidAmount ?? 0) || 0;
      const due = b.dueDate || b.data?.details?.dueDate || b.invoiceDate;
      return { rem: total - paid, days: daysOverdue(due) };
    });
    const totalRem = all.reduce((s, x) => s + x.rem, 0);
    return {
      count: all.length,
      totalRem,
      d30: all.filter((x) => x.days >= 1 && x.days <= 30).length,
      d60: all.filter((x) => x.days >= 31 && x.days <= 60).length,
      d60p: all.filter((x) => x.days > 60).length,
    };
  }, [bills]);

  const openEmail = async (b) => {
    const email = (b.data?.client?.email || b.clientEmail || '').trim();
    const subject = 'Payment reminder: ' + (b.invoiceNumber || '');
    const bodyText =
      'Dear ' + (b.clientName || 'Customer') + ',\n\n' +
      'This is a reminder that invoice ' + (b.invoiceNumber || '') + ' has an outstanding balance of ' + formatCurrency(b._rem) + '.\n' +
      'Due date: ' + (b.dueDate || b.invoiceDate || '—') + '\n\n' +
      'Please arrange payment at the earliest.\n\nThank you.';
    if (!email) {
      toast('No client email on file', 'warning');
      return;
    }
    toast('Sending via SMTP…', 'info', 2000);
    const result = await sendMailSmart({ to: email, subject, body: bodyText, allowGmailFallback: true });
    if (result.method === 'smtp' && result.ok) {
      toast('Reminder sent via SMTP to ' + email, 'success');
      return;
    }
    const why = result.smtpError || 'SMTP failed';
    if (result.popupBlocked) {
      toast(why + '. Allow pop-ups for Gmail fallback.', 'warning', 8000);
    } else {
      toast(why + '. Gmail opened in a new tab (fallback).', 'info', 7000);
    }
  };

  const openWhatsApp = (b) => {
    const phone = b.data?.client?.phone || b.clientPhone || '';
    const text = buildWhatsAppDueReminderText({
      clientName: b.clientName || 'Customer',
      invoiceNumber: b.invoiceNumber || '',
      amountText: formatCurrency(b._rem),
      dueDate: b.dueDate || b.invoiceDate || '—',
      companyName: b.data?.profile?.businessName || '',
      upiId: b.data?.profile?.upiId || '',
    });
    const url = buildWhatsAppDueUrl(phone, text);
    if (!url) {
      toast('Add client mobile number (10 digits) to send WhatsApp reminder', 'warning');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openInv = (b) => {
    if (typeof onOpenInvoice === 'function') onOpenInvoice(b);
    else toast('Open Invoices list to edit this bill', 'info');
  };

  const bucketChip = (id, label, n, color) => (
    <button
      key={id}
      type="button"
      onClick={() => setBucket(id)}
      style={{
        ...chipBase,
        cursor: 'pointer',
        borderColor: bucket === id ? color : 'var(--border)',
        background: bucket === id ? color + '18' : 'var(--card, #fff)',
        color: bucket === id ? color : 'var(--text)',
      }}
    >
      {label}
      <span style={{
        minWidth: 20, height: 20, borderRadius: 10, padding: '0 6px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, background: bucket === id ? color : 'var(--bg-muted, #f1f5f9)',
        color: bucket === id ? '#fff' : 'var(--text-muted)',
      }}>{n}</span>
    </button>
  );

  return (
    <div className="page list-module-page" style={{ maxWidth: '100%', width: '100%', padding: '0 4px' }}>
      <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg,#dc2626,#f59e0b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0,
          }}>
            <Bell size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Payment dues</h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Overdue tax invoices — Email · WhatsApp · Open
            </p>
          </div>
          <div style={{ ...chipBase, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>
            <IndianRupee size={14} />
            {formatCurrency(summary.totalRem)} outstanding
          </div>
          <input
            className="form-input"
            style={{ maxWidth: 220, height: 36 }}
            placeholder="Filter client / invoice…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {bucketChip('all', 'All overdue', summary.count, '#dc2626')}
          {bucketChip('1-30', '1–30 days', summary.d30, '#d97706')}
          {bucketChip('31-60', '31–60 days', summary.d60, '#ea580c')}
          {bucketChip('60+', '60+ days', summary.d60p, '#b91c1c')}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', fontSize: 13 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={!!sched.enabled} onChange={(e) => saveSched({ enabled: e.target.checked })} />
            Schedule while server runs
          </label>
          <select className="form-input" style={{ width: 'auto' }} value={sched.interval || 'daily'}
            onChange={(e) => saveSched({ interval: e.target.value })}>
            <option value="daily">Daily tick</option>
            <option value="weekly">Weekly tick</option>
          </select>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Last tick: {sched.lastRunAt ? new Date(sched.lastRunAt).toLocaleString('en-IN') : '—'}
          </span>
        </div>
      </div>

      {loading && <p className="text-muted">Loading…</p>}
      {!loading && overdue.length === 0 && (
        <div style={{
          padding: 48, textAlign: 'center', color: 'var(--text-muted)',
          border: '1px dashed var(--border)', borderRadius: 12, background: 'var(--card, #fff)',
        }}>
          No overdue balances in this filter — all clear.
        </div>
      )}

      {!loading && overdue.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {overdue.map((b) => (
            <div
              key={b.id || b.invoiceNumber}
              style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                border: '1px solid var(--border)',
                borderRadius: 12,
                background: 'var(--card, #fff)',
                borderLeft: '4px solid ' + (b._days > 60 ? '#b91c1c' : b._days > 30 ? '#ea580c' : '#d97706'),
              }}
            >
              <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{b.invoiceNumber || '—'}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{b.clientName || '—'}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Due {b.dueDate || b.invoiceDate || '—'}
              </div>
              <span style={{
                ...chipBase,
                color: b._days > 30 ? '#b91c1c' : '#b45309',
                borderColor: b._days > 30 ? '#fecaca' : '#fde68a',
                background: b._days > 30 ? '#fef2f2' : '#fffbeb',
              }}>
                {b._days}d overdue
              </span>
              <div style={{ fontWeight: 700, fontSize: 15, minWidth: 100, textAlign: 'right' }}>
                {formatCurrency(b._rem)}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
                <button type="button" className="btn btn-secondary" title="Open invoice"
                  onClick={() => openInv(b)}
                  style={{ height: 34, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ExternalLink size={14} /> Open
                </button>
                <button type="button" className="btn btn-secondary" title="Email"
                  onClick={() => openEmail(b)}
                  style={{ height: 34, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Mail size={14} /> Email
                </button>
                <button type="button" className="btn btn-secondary" title="WhatsApp"
                  onClick={() => openWhatsApp(b)}
                  style={{
                    height: 34, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857',
                  }}>
                  <MessageCircle size={14} /> WA
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
