import { useState, useEffect, useMemo } from 'react';
import { Bell, RefreshCw, Mail, MessageCircle } from 'lucide-react';
import { getAllBills } from '../store';
import { formatCurrency } from '../utils';
import { isReceivableDocument, isCancelled, isConverted, normalizeInvoiceType } from '../utils/revenueFilter';

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
        // Tax invoices / AR only — never quotation, PI, DC, converted, cancelled
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
      // Show only when due date has passed (days > 0), or due today with balance
      .filter((b) => b._days > 0 || (b._days === 0 && b._rem > 0.5 && b._due && new Date(b._due) <= new Date()))
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
      `Dear ${b.clientName || 'Customer'},\n\nThis is a reminder that invoice ${b.invoiceNumber || ''} has an outstanding balance of ${formatCurrency(b._rem)}.\nDue date: ${b.dueDate || b.invoiceDate || '—'}\n\nPlease arrange payment at the earliest.\n\nThank you.`
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
    <div className="page" style={{ maxWidth: '100%', width: '100%', padding: '0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'linear-gradient(135deg,#dc2626,#f59e0b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0,
        }}>
          <Bell size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0, fontSize: '1.35rem' }}>Payment reminders</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Overdue tax invoices only (proforma, quotation & converted docs excluded)
          </p>
        </div>
        <input
          className="form-input"
          style={{ maxWidth: 260, height: 36, flex: '1 1 180px' }}
          placeholder="Filter client / invoice…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading} title="Refresh"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading && <p className="text-muted">Loading…</p>}
      {!loading && overdue.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 12, background: 'var(--card, #fff)' }}>
          No overdue tax-invoice balances — all clear.
        </div>
      )}

      {!loading && overdue.length > 0 && (
        <div className="table-responsive" style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, overflow: 'auto', background: 'var(--card, #fff)', width: '100%' }}>
          <table className="data-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', minWidth: 720 }}>
            <colgroup>
              <col style={{ width: '16%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--bg-muted, #f8fafc)' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Invoice</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Client</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>Due</th>
                <th style={{ textAlign: 'right', padding: '12px 14px' }}>Days</th>
                <th style={{ textAlign: 'right', padding: '12px 14px' }}>Outstanding</th>
                <th style={{ textAlign: 'center', padding: '12px 14px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {overdue.map((b) => (
                <tr key={b.id || b.invoiceNumber} style={{ borderTop: '1px solid var(--border, #e2e8f0)' }}>
                  <td style={{ padding: '12px 14px' }}><strong>{b.invoiceNumber}</strong></td>
                  <td style={{ padding: '12px 14px' }}>{b.clientName || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>{b.dueDate || b.invoiceDate || '—'}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: b._days > 30 ? '#dc2626' : '#b45309', fontWeight: 600 }}>{b._days}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(b._rem)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        title="Email reminder"
                        onClick={() => openEmail(b)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 8 }}
                      >
                        <Mail size={15} /> Email
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        title="WhatsApp reminder"
                        onClick={() => openWhatsApp(b)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 8, background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' }}
                      >
                        <MessageCircle size={15} /> WA
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
