import { useState, useEffect, useMemo } from 'react';
import { getAllBills, getProfile } from '../store';
import { formatCurrency, belongsToProfile } from '../utils';
import { toast } from './Toast';
import { downloadCsv } from '../utils/exportData';

/**
 * Top services by billed amount (line-item description / HSN aggregation).
 */
export default function ServiceRevenueReport() {
  const [bills, setBills] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [all, prof] = await Promise.all([getAllBills(), getProfile().catch(() => null)]);
        setBills((all || []).filter(b => belongsToProfile(b, prof)));
      } catch {
        toast('Failed to load invoices', 'error');
      }
    })();
  }, []);

  const rows = useMemo(() => {
    const map = {};
    for (const b of bills) {
      const t = String(b.invoiceType || b.data?.invoiceType || '').toLowerCase();
      if (t.includes('proforma') || t.includes('quotation') || t.includes('credit')) continue;
      if (b.status === 'cancelled') continue;
      const items = b.data?.items || b.items || [];
      for (const it of items) {
        const name = (it.name || it.description || 'Unnamed service').trim();
        const hsn = (it.hsn || it.sac || '').trim();
        const key = name.toLowerCase() + '|' + hsn;
        if (!map[key]) map[key] = { name, hsn, qty: 0, amount: 0, invoices: 0 };
        const qty = Number(it.qty) || 0;
        const rate = Number(it.rate) || 0;
        const line = Number(it.amount) || qty * rate;
        map[key].qty += qty;
        map[key].amount += line;
        map[key].invoices += 1;
      }
    }
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [bills]);

  const filtered = search.trim()
    ? rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.hsn.includes(search))
    : rows;

  const maxAmt = filtered[0]?.amount || 1;
  const total = filtered.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Service Revenue</h2>
          <p className="page-subtitle" style={{ margin: 0 }}>Top services by billed amount (from tax invoice line items)</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" style={{ width: 200 }} placeholder="Search service / SAC"
            value={search} onChange={e => setSearch(e.target.value)} />
          <button type="button" className="btn btn-secondary btn-sm"
            onClick={() => downloadCsv('service-revenue.csv', filtered, [
              { key: 'name', label: 'Service' }, { key: 'hsn', label: 'SAC/HSN' },
              { key: 'qty', label: 'Qty' }, { key: 'amount', label: 'Amount' }, { key: 'invoices', label: 'Lines' },
            ])}>Export CSV</button>
        </div>
      </div>
      <div className="glass-panel p-3 mb-3" style={{ maxWidth: 280 }}>
        <div style={{ fontSize: 12, color: '#64748b' }}>Total service revenue</div>
        <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{formatCurrency(total)}</div>
      </div>
      <table className="data-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>#</th><th>Service / Description</th><th>SAC/HSN</th>
            <th className="text-end">Qty</th><th className="text-end">Billed</th><th style={{ width: '28%' }}>Share</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r, i) => (
            <tr key={r.name + r.hsn}>
              <td>{i + 1}</td>
              <td><strong>{r.name}</strong></td>
              <td>{r.hsn || '—'}</td>
              <td className="text-end">{r.qty}</td>
              <td className="text-end">{formatCurrency(r.amount)}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4 }}>
                    <div style={{
                      width: `${Math.round((r.amount / maxAmt) * 100)}%`,
                      height: 8, borderRadius: 4,
                      background: 'linear-gradient(90deg,#3b82f6,#1d4ed8)',
                    }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#64748b', width: 36 }}>
                    {total ? Math.round((r.amount / total) * 100) : 0}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>No service lines yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
