import { useMemo } from 'react';
import { formatCurrency } from '../utils';

/** Rule-based insight strip (TriVista/Bizzhub style — no external AI). */
export default function DashboardInsights({ bills = [], onFilterOverdue }) {
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let overdueCount = 0;
    let overdueAmt = 0;
    const byClient = {};
    const thisM = today.slice(0, 7);
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    const prevM = prev.toISOString().slice(0, 7);
    let thisSales = 0;
    let prevSales = 0;

    const isRev = (b) => {
      const t = String(b.invoiceType || b.type || '').toLowerCase();
      if (t.includes('quotation') || t.includes('proforma') || t.includes('challan') || t.includes('delivery')) return false;
      if (String(b.status || '').toLowerCase() === 'cancelled') return false;
      return true;
    };

    for (const b of bills || []) {
      if (!isRev(b)) continue;
      const amt = Number(b.totalAmount || b.data?.totals?.grandTotal || 0) || 0;
      const st = String(b.status || '').toLowerCase();
      const due = b.dueDate || b.data?.details?.dueDate || '';
      if (st === 'overdue' || (due && due < today && st !== 'paid' && st !== 'cancelled')) {
        overdueCount += 1;
        overdueAmt += Math.max(0, amt - (Number(b.paidAmount) || 0));
      }
      const name = b.clientName || 'Unknown';
      byClient[name] = (byClient[name] || 0) + amt;
      const d = String(b.invoiceDate || b.data?.details?.invoiceDate || '').slice(0, 7);
      if (d === thisM) thisSales += amt;
      if (d === prevM) prevSales += amt;
    }
    const top = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const mom = prevSales > 0 ? ((thisSales - prevSales) / prevSales) * 100 : (thisSales > 0 ? 100 : 0);
    return { overdueCount, overdueAmt, top, thisSales, prevSales, mom };
  }, [bills]);

  return (
    <div className="glass-panel" style={{ padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <button type="button" className="btn btn-secondary" style={{ textAlign: 'left', height: 'auto', padding: 10 }} onClick={onFilterOverdue}>
          <div style={{ fontSize: 11, color: '#64748b' }}>Overdue</div>
          <div style={{ fontWeight: 700 }}>{stats.overdueCount}</div>
          <div style={{ fontSize: 12 }}>{formatCurrency(stats.overdueAmt)}</div>
        </button>
        <div style={{ padding: 10 }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>This month sales</div>
          <div style={{ fontWeight: 700 }}>{formatCurrency(stats.thisSales)}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>MoM {stats.mom >= 0 ? '+' : ''}{stats.mom.toFixed(0)}%</div>
        </div>
        <div style={{ padding: 10, gridColumn: 'span 2' }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Top clients (all time loaded)</div>
          {stats.top.map(([n, a]) => (
            <div key={n} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>{n}</span>
              <span>{formatCurrency(a)}</span>
            </div>
          ))}
          {!stats.top.length && <span style={{ color: '#94a3b8', fontSize: 12 }}>No sales yet</span>}
        </div>
      </div>
    </div>
  );
}
