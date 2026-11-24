/**
 * Operations dashboard snapshot — KPI row + sales/purchases/receipts trend + receivables donut.
 * No stock / catalogue (out of scope). Uses live bills + purchases only.
 */
import { useEffect, useMemo, useRef } from 'react';
import { formatCurrency } from '../utils';
import { isRevenueDocument } from '../utils/revenueFilter';

function compactInr(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e7) return sign + '₹' + (abs / 1e7).toFixed(abs >= 1e8 ? 1 : 2).replace(/\.0$/, '') + 'Cr';
  if (abs >= 1e5) return sign + '₹' + (abs / 1e5).toFixed(abs >= 1e6 ? 1 : 1).replace(/\.0$/, '') + 'L';
  if (abs >= 1e3) return sign + '₹' + (abs / 1e3).toFixed(abs >= 1e4 ? 1 : 1).replace(/\.0$/, '') + 'K';
  return sign + '₹' + Math.round(abs).toLocaleString('en-IN');
}

function monthLabel(ym) {
  if (!ym || ym.length < 7) return ym || '';
  const [y, m] = ym.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return (names[(m || 1) - 1] || m) + ' ' + String(y).slice(2);
}

/**
 * @param {{ bills: any[], purchases?: any[], onFilterInvoices?: (f: object) => void }} props
 */
export default function DashboardOpsSnapshot({ bills = [], purchases = [], onFilterInvoices, chartsOnly = false }) {
  const trendRef = useRef(null);
  const donutRef = useRef(null);
  const chartsRef = useRef([]);

  const snap = useMemo(() => {
    const list = Array.isArray(bills) ? bills : [];
    let netSales = 0;
    let outstanding = 0;
    let overdueAmt = 0;
    let overdueCount = 0;
    let activeSales = 0;
    let awaiting = 0;
    let monthSales = 0;
    let monthReceived = 0;
    let paidC = 0, partialC = 0, unpaidC = 0;
    const byMonthSales = {};
    const byMonthPurch = {};
    const byMonthRecv = {};
    const ymNow = new Date().toISOString().slice(0, 7);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    for (const b of list) {
      if (!b || b.isDeleted || b.deleted) continue;
      const st = String(b.status || '').toLowerCase();
      if (st === 'cancelled') continue;
      if (!isRevenueDocument(b) && String(b.invoiceType || '').toLowerCase() !== 'tax-invoice') {
        // still count tax invoices via isRevenueDocument mostly
      }
      if (!isRevenueDocument(b)) continue;

      const total = Number(b.totalAmount) || 0;
      const paid = Number(b.paidAmount) || 0;
      const bal = Math.max(0, total - paid);
      netSales += total;
      outstanding += bal;
      activeSales += 1;
      if (bal > 0.5) awaiting += 1;

      if (st === 'paid' || bal <= 0.5) paidC += 1;
      else if (paid > 0.5) partialC += 1;
      else unpaidC += 1;

      const due = b.data?.details?.dueDate || b.dueDate;
      const dueD = due ? new Date(due) : null;
      if (dueD && !Number.isNaN(dueD.getTime())) {
        dueD.setHours(0, 0, 0, 0);
        if (bal > 0.5 && dueD < today) {
          overdueAmt += bal;
          overdueCount += 1;
        }
      } else if (st === 'overdue' && bal > 0.5) {
        overdueAmt += bal;
        overdueCount += 1;
      }

      const idate = String(b.data?.details?.invoiceDate || b.invoiceDate || '').slice(0, 7);
      if (idate) byMonthSales[idate] = (byMonthSales[idate] || 0) + total;
      if (idate === ymNow) monthSales += total;

      const pays = Array.isArray(b.payments) ? b.payments : [];
      if (pays.length) {
        for (const p of pays) {
          const pm = String(p.date || p.paidAt || p.recordedAt || '').slice(0, 7);
          const amt = Number(p.amount) || 0;
          if (pm) byMonthRecv[pm] = (byMonthRecv[pm] || 0) + amt;
          if (pm === ymNow) monthReceived += amt;
        }
      } else if (paid > 0 && idate) {
        // legacy: no payment lines — attribute paid to invoice month
        byMonthRecv[idate] = (byMonthRecv[idate] || 0) + paid;
        if (idate === ymNow) monthReceived += paid;
      }
    }

    for (const p of purchases || []) {
      if (!p || String(p.status || '').toLowerCase() === 'cancelled') continue;
      const d = String(p.date || p.billDate || p.invoiceDate || '').slice(0, 7);
      const amt = Number(p.totalAmount ?? p.grandTotal ?? p.amount ?? 0) || 0;
      if (d) byMonthPurch[d] = (byMonthPurch[d] || 0) + amt;
    }

    const keys = Array.from(new Set([
      ...Object.keys(byMonthSales),
      ...Object.keys(byMonthPurch),
      ...Object.keys(byMonthRecv),
    ])).sort().slice(-12);

    return {
      netSales, outstanding, overdueAmt, overdueCount, activeSales, awaiting,
      monthSales, monthReceived, paidC, partialC, unpaidC,
      keys,
      sales: keys.map((k) => byMonthSales[k] || 0),
      purch: keys.map((k) => byMonthPurch[k] || 0),
      recv: keys.map((k) => byMonthRecv[k] || 0),
      labels: keys.map(monthLabel),
    };
  }, [bills, purchases]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Chart, registerables } = await import('chart.js');
        if (cancelled) return;
        Chart.register(...registerables);
        chartsRef.current.forEach((c) => { try { c.destroy(); } catch { /* */ } });
        chartsRef.current = [];

        if (trendRef.current) {
          const existing = Chart.getChart(trendRef.current);
          if (existing) existing.destroy();
          chartsRef.current.push(new Chart(trendRef.current, {
            type: 'bar',
            data: {
              labels: snap.labels,
              datasets: [
                {
                  type: 'bar',
                  label: 'Sales',
                  data: snap.sales,
                  backgroundColor: 'rgba(15, 118, 110, 0.85)',
                  borderRadius: 4,
                  order: 2,
                },
                {
                  type: 'bar',
                  label: 'Purchases',
                  data: snap.purch,
                  backgroundColor: 'rgba(59, 130, 246, 0.55)',
                  borderRadius: 4,
                  order: 3,
                },
                {
                  type: 'line',
                  label: 'Receipts',
                  data: snap.recv,
                  borderColor: '#b45309',
                  backgroundColor: 'rgba(180, 83, 9, 0.15)',
                  tension: 0.35,
                  pointRadius: 3,
                  order: 1,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: {
                legend: { position: 'top', labels: { boxWidth: 10, font: { size: 11 } } },
                tooltip: {
                  callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ${compactInr(ctx.raw)}`,
                  },
                },
              },
              scales: {
                x: { grid: { display: false } },
                y: {
                  ticks: { callback: (v) => compactInr(v) },
                  grid: { color: 'rgba(148,163,184,0.25)' },
                },
              },
            },
          }));
        }

        if (donutRef.current) {
          const existing = Chart.getChart(donutRef.current);
          if (existing) existing.destroy();
          chartsRef.current.push(new Chart(donutRef.current, {
            type: 'doughnut',
            data: {
              labels: ['Paid', 'Partial', 'Unpaid'],
              datasets: [{
                data: [snap.paidC, snap.partialC, snap.unpaidC],
                backgroundColor: ['#0f766e', '#b45309', '#e11d48'],
                borderWidth: 0,
                hoverOffset: 4,
              }],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              cutout: '68%',
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => `${ctx.label}: ${ctx.raw}`,
                  },
                },
              },
            },
          }));
        }
      } catch (e) {
        console.warn('DashboardOpsSnapshot charts', e);
      }
    })();
    return () => {
      cancelled = true;
      chartsRef.current.forEach((c) => { try { c.destroy(); } catch { /* */ } });
    };
  }, [snap]);

  const go = (statusFilter) => {
    if (typeof onFilterInvoices === 'function') onFilterInvoices({ typeFilter: 'tax-invoice', statusFilter });
    else {
      try {
        sessionStorage.setItem('sd_invoice_list_filters', JSON.stringify({ typeFilter: 'tax-invoice', statusFilter }));
        sessionStorage.setItem('gst_currentView', 'invoices');
        window.dispatchEvent(new CustomEvent('sd-navigate', { detail: 'invoices' }));
      } catch { /* */ }
    }
  };

  const totalInv = snap.paidC + snap.partialC + snap.unpaidC;

  return (
    <div className="sd-ops-charts-only" style={{ marginBottom: '1.25rem' }}>
      <style>{`
        .sd-ops-charts-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(240px, 0.9fr);
          gap: 12px;
        }
        @media (max-width: 900px) {
          .sd-ops-charts-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div className="sd-ops-charts-grid">
        <div className="glass-panel" style={{ padding: '14px 16px', borderRadius: 16, border: '1px solid var(--border, #e2e8f0)', minHeight: 280 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Trend</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Sales, purchases & receipts</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '4px 10px', borderRadius: 999 }}>Last 12 months</span>
          </div>
          <div style={{ height: 220, position: 'relative' }}>
            <canvas ref={trendRef} />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '14px 16px', borderRadius: 16, border: '1px solid var(--border, #e2e8f0)', minHeight: 280 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Receivables</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Payment status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 140, height: 140, position: 'relative', flexShrink: 0 }}>
              <canvas ref={donutRef} />
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{totalInv}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>INVOICES</div>
              </div>
            </div>
            <div style={{ flex: 1, fontSize: 13 }}>
              {[
                { label: 'Paid', n: snap.paidC, color: '#0f766e' },
                { label: 'Partial', n: snap.partialC, color: '#b45309' },
                { label: 'Unpaid', n: snap.unpaidC, color: '#e11d48' },
              ].map((r) => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: r.color }} />
                    {r.label}
                  </span>
                  <strong>{r.n}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
