import { useState, useEffect, useMemo } from 'react';
import { Bell, Mail, MessageCircle, RefreshCw } from 'lucide-react';
import { getAllBills, getAllClients, getProfile } from '../store';
import { formatCurrency, belongsToProfile } from '../utils';
import { toast } from './Toast';

function daysOverdue(bill) {
  const due = bill.dueDate || bill.invoiceDate;
  if (!due) return 0;
  const d = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - d) / 86400000);
  return diff > 0 ? diff : 0;
}

function remaining(bill) {
  return Math.max(0, (Number(bill.totalAmount) || 0) - (Number(bill.paidAmount) || 0));
}

export default function PaymentRemindersView() {
  const [bills, setBills] = useState([]);
  const [clients, setClients] = useState([]);
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [bls, cls, prof] = await Promise.all([getAllBills(), getAllClients(), getProfile()]);
      setProfile(prof || {});
      setClients(cls || []);
      setBills((bls || []).filter(b => belongsToProfile(b, prof)));
    } catch {
      toast('Failed to load invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const overdue = useMemo(() => {
    return bills
      .filter(b => {
        const t = String(b.invoiceType || 'tax-invoice').toLowerCase();
        if (/quotation|delivery|challan|cancelled/.test(t)) return false;
        if ((b.status || '') === 'cancelled' || (b.status || '') === 'paid') return false;
        return remaining(b) > 0.5 && daysOverdue(b) > 0;
      })
      .map(b => ({ ...b, _days: daysOverdue(b), _rem: remaining(b) }))
      .sort((a, b) => b._days - a._days);
  }, [bills]);

  const clientEmail = (bill) => {
    const name = bill.clientName || bill.data?.clientName;
    const c = clients.find(x => x.name === name || x.companyName === name);
    return c?.email || bill.clientEmail || bill.data?.clientEmail || '';
  };

  const clientPhone = (bill) => {
    const name = bill.clientName || bill.data?.clientName;
    const c = clients.find(x => x.name === name || x.companyName === name);
    return c?.phone || bill.clientPhone || '';
  };

  const openEmail = (bill) => {
    const to = clientEmail(bill);
    const inv = bill.invoiceNumber || bill.id;
    const subj = encodeURIComponent(`Payment reminder — ${inv} overdue`);
    const body = encodeURIComponent(
      `Dear ${bill.clientName || 'Customer'},\n\n` +
      `This is a friendly reminder that invoice ${inv} dated ${bill.invoiceDate || ''} ` +
      `has an outstanding balance of ${formatCurrency(bill._rem)}.\n` +
      `Days overdue: ${bill._days}.\n\n` +
      `Please arrange payment at the earliest.\n\n` +
      `Regards,\n${profile.businessName || 'Accounts'}`
    );
    if (!to) {
      toast('No email on file for this client — copy the body from the toast or add email in Clients', 'warning');
    }
    window.open(`mailto:${to || ''}?subject=${subj}&body=${body}`, '_blank');
  };

  const openWhatsApp = (bill) => {
    const phone = String(clientPhone(bill) || '').replace(/\D/g, '');
    const inv = bill.invoiceNumber || bill.id;
    const text = encodeURIComponent(
      `Reminder: Invoice ${inv} has ₹${bill._rem.toFixed(2)} outstanding (${bill._days} days overdue). Please pay at the earliest. — ${profile.businessName || ''}`
    );
    if (!phone) {
      toast('No phone on file for this client', 'warning');
      return;
    }
    window.open(`https://wa.me/91${phone.slice(-10)}?text=${text}`, '_blank');
  };

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg,#dc2626,#f59e0b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        }}>
          <Bell size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.35rem' }}>Payment reminders</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Overdue tax / proforma invoices — open email or WhatsApp reminder
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={14} style={{ marginRight: 6 }} /> Refresh
        </button>
      </div>

      {loading && <p className="text-muted">Loading…</p>}
      {!loading && overdue.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 12 }}>
          No overdue balances — all clear.
        </div>
      )}

      {overdue.length > 0 && (
        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Due</th>
                <th>Days</th>
                <th>Outstanding</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {overdue.map(b => (
                <tr key={b.id || b.invoiceNumber}>
                  <td><strong>{b.invoiceNumber}</strong></td>
                  <td>{b.clientName || '—'}</td>
                  <td>{b.dueDate || b.invoiceDate || '—'}</td>
                  <td style={{ color: b._days > 30 ? '#dc2626' : '#b45309', fontWeight: 600 }}>{b._days}</td>
                  <td>{formatCurrency(b._rem)}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEmail(b)} title="Email">
                      <Mail size={14} /> Email
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openWhatsApp(b)} title="WhatsApp">
                      <MessageCircle size={14} /> WA
                    </button>
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
