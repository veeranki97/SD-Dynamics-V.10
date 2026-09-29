import { useState, useEffect, useMemo } from 'react';
import { getAllBills, getAllReceipts, saveBill } from '../store';
import { formatCurrency } from '../utils';
import { toast } from './Toast';

/**
 * Real payment reconciliation: unapplied advances / overpayments vs open invoices.
 * Match allocates advance onto an open bill (oldest first optional).
 */
export default function PaymentReconView() {
  const [bills, setBills] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [client, setClient] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    Promise.all([getAllBills(), getAllReceipts()]).then(([b, r]) => {
      setBills(b || []);
      setReceipts(r || []);
    }).catch(() => toast('Load failed', 'error'));
  };
  useEffect(() => { load(); }, []);

  const names = useMemo(() => [...new Set(bills.map(b => b.clientName).filter(Boolean))].sort(), [bills]);
  const mine = useMemo(() => bills.filter(b => !client || b.clientName === client), [bills, client]);

  const advances = useMemo(() => {
    // Overpaid tax invoices + advance receipts not fully applied
    const fromBills = mine.filter(b => (b.paidAmount || 0) > (b.totalAmount || 0) + 0.01)
      .map(b => ({
        id: b.id,
        kind: 'overpay',
        clientName: b.clientName,
        label: b.invoiceNumber,
        credit: (b.paidAmount || 0) - (b.totalAmount || 0),
        bill: b,
      }));
    const fromReceipts = (receipts || [])
      .filter(r => (r.paymentType === 'advance' || !r.againstInvoice) && (!client || r.clientName === client))
      .filter(r => !(r.appliedAmount >= (r.amount || 0) - 0.01))
      .map(r => ({
        id: r.id,
        kind: 'advance',
        clientName: r.clientName,
        label: r.receiptNo || r.id,
        credit: (Number(r.amount) || 0) - (Number(r.appliedAmount) || 0),
        receipt: r,
      }));
    return [...fromBills, ...fromReceipts].filter(x => x.credit > 0.01);
  }, [mine, receipts, client]);

  const open = useMemo(() => mine.filter(b => {
    const t = (b.invoiceType || '').toLowerCase();
    if (t.includes('proforma') || t.includes('quotation')) return false;
    const due = (b.totalAmount || 0) - (b.paidAmount || 0);
    return due > 0.01 && (b.status === 'unpaid' || b.status === 'partial' || b.status === 'overdue');
  }).sort((a, b) => String(a.data?.details?.invoiceDate || '').localeCompare(String(b.data?.details?.invoiceDate || ''))), [mine]);

  const applyCredit = async (creditRow, openBill) => {
    const due = (openBill.totalAmount || 0) - (openBill.paidAmount || 0);
    const use = Math.min(creditRow.credit, due);
    if (use <= 0) return;
    setBusy(true);
    try {
      const entry = {
        amount: use,
        date: new Date().toISOString().slice(0, 10),
        mode: 'adjustment',
        note: `Recon from ${creditRow.label}`,
        recordedAt: new Date().toISOString(),
      };
      const nextPayments = [...(openBill.payments || []), entry];
      const newPaid = (openBill.paidAmount || 0) + use;
      const nextStatus = newPaid >= (openBill.totalAmount || 0) - 0.01 ? 'paid' : 'partial';
      await saveBill({ ...openBill, paidAmount: newPaid, status: nextStatus, payments: nextPayments }, { overwrite: true });

      if (creditRow.kind === 'overpay' && creditRow.bill) {
        const src = creditRow.bill;
        const srcPaid = Math.max(0, (src.paidAmount || 0) - use);
        await saveBill({ ...src, paidAmount: srcPaid, status: srcPaid >= (src.totalAmount || 0) - 0.01 ? 'paid' : 'partial' }, { overwrite: true });
      }
      toast(`Applied ${formatCurrency(use)} to ${openBill.invoiceNumber}`, 'success');
      load();
    } catch (e) {
      toast(e.message || 'Apply failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <h2>Payment Reconciliation</h2>
      <p className="page-subtitle">Match unapplied advances & overpayments to open invoices (not a dashboard bug-fix).</p>
      <select className="form-input" style={{ maxWidth: 320, marginBottom: 16 }} value={client} onChange={e => setClient(e.target.value)}>
        <option value="">All clients</option>
        {names.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="glass-panel p-4">
          <h3>Unapplied credit</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {advances.map(a => (
              <li key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                <strong>{a.label}</strong> · {a.clientName}
                <div style={{ color: '#059669' }}>{formatCurrency(a.credit)}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{a.kind}</div>
              </li>
            ))}
            {advances.length === 0 && <li style={{ color: '#94a3b8' }}>None</li>}
          </ul>
        </div>
        <div className="glass-panel p-4">
          <h3>Open invoices</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {open.map(b => {
              const due = (b.totalAmount || 0) - (b.paidAmount || 0);
              return (
                <li key={b.id} style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                  <strong>{b.invoiceNumber}</strong> · due {formatCurrency(due)}
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {advances.filter(a => a.clientName === b.clientName).map(a => (
                      <button key={a.id} type="button" className="btn btn-sm btn-secondary" disabled={busy}
                        onClick={() => applyCredit(a, b)}>
                        Apply from {a.label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
            {open.length === 0 && <li style={{ color: '#94a3b8' }}>None</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
