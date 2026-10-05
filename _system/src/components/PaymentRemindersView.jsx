import { useState, useEffect, useMemo } from 'react';
import { Bell, RefreshCw, Mail, MessageCircle } from 'lucide-react';
import { getAllBills } from '../store';
import { formatCurrency } from '../utils';

function daysOverdue(dueOrInv) {
  if (!dueOrInv) return 0;
  const d = new Date(dueOrInv);
  if (Number.isNaN(d.getTime())) return 0;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export default function PaymentRemindersView() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

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

  const overdue = useMemo(() => {
    const list = (bills || [])
      .filter((b) => {
        const t = String(b.invoiceType || b.data?.invoiceType || '').toLowerCase();
        if (t && !t.includes('tax') && !t.includes('proforma') && t !== 'invoice') return false;
        const st = String(b.status || '').toLowerCase();
        if (st === 'cancelled' || st === 'paid' || st === 'received') return false;
        const total = Number(b.totalAmount ?? b.data?.totals?.total ?? 0) || 0;
        const paid = Number(b.paidAmount ?? 0) || 0;
        return total - paid > 0.5;
      })
      .map((b) => {
        const total = Number(b.totalAmount ?? b.data?.totals?.total ?? 0) || 0;
        const paid = Number(b.paidAmount ?? 0) || 0;
        const due = b.dueDate || b.data?.details?.dueDate || b.invoiceDate;
        return { ...b, _rem: total - paid, _days: daysOverdue(due) };
      })
      .filter((b) => b._days >= 0)
      .sort((a, b) => b._days - a._days);
    const qq = q.trim().toLowerCase();
    if (!qq) return list;
    return list.filter((b) =>
      String(b.invoiceNumber || '').toLowerCase().includes(qq) ||
      String(b.clientName || '').toLowerCase().includes(qq)
    );
  }, [bills, q]);

  const openEmail = (b) => {
    const email = b.data?.client?.email || b.clientEmail || '';
    const sub = encodeURIComponent(`Payment reminder: ${b.invoiceNumber || ''}`);
    const body = encodeURIComponent(
      `Dear ${b.clientName || 'Customer'},\n\nThis is a reminder that invoice ${b.invoiceNumber || ''} for ${formatCurrency(b._rem)} is outstanding (due ${b.dueDate || b.invoiceDate || '—'}).\n\nThank you.`
    );
    window.location.href = `mailto:${email}?subject=${sub}&body=${body}`;
  };

  const openWhatsApp = (b) => {
    const phone = String(b.data?.client?.phone || b.clientPhone || '').replace(/\D/g, '');
    const text = encodeURIComponent(
      `Payment reminder: Invoice ${b.invoiceNumber || ''} — outstanding ${formatCurrency(b._rem)} (due ${b.dueDate || b.invoiceDate || '—'}).`
    );
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg,#dc2626,#f59e0b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0,
        }}>
          <Bell size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <h1 style={{ margin: 0, fontSize: '1.35rem' }}>Payment reminders</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Overdue tax / proforma invoices
          </p>
        </div>
        <input
          className="form-input"
          style={{ maxWidth: 220, height: 36 }}
          placeholder="Filter client / invoice…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading} title="Refresh"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36 }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {loading && <p className="text-muted">Loading…</p>}
      {!loading && overdue.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 12 }}>
          No overdue balances — all clear.
        </div>
      )}

      {!loading && overdue.length > 0 && (
        <div className="table-responsive" style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '16%' }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--bg-muted, #f8fafc)' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Invoice</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Client</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Due</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Days</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Outstanding</th>
                <th style={{ textAlign: 'center', padding: '10px 12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {overdue.map((b) => (
                <tr key={b.id || b.invoiceNumber} style={{ borderTop: '1px solid var(--border, #e2e8f0)' }}>
                  <td style={{ padding: '10px 12px' }}><strong>{b.invoiceNumber}</strong></td>
                  <td style={{ padding: '10px 12px' }}>{b.clientName || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{b.dueDate || b.invoiceDate || '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: b._days > 30 ? '#dc2626' : '#b45309', fontWeight: 600 }}>{b._days}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(b._rem)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'center' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEmail(b)} title="Email"
                        style={{ width: 34, height: 34, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Mail size={15} />
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openWhatsApp(b)} title="WhatsApp"
                        style={{ width: 34, height: 34, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MessageCircle size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
