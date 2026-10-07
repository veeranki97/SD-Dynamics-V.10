import { useEffect, useRef } from 'react';
import { getChartPrefs, chartColor } from '../utils/chartPrefs';

/**
 * Home dashboard charts — layout aligned to SD GAS dashboard:
 * Sales Trend (line) | GST Breakdown (stacked by month)
 * Top Clients (horizontal bar) | Top Sites (pie)
 * Sales by State (horizontal bar) | Aging Summary (bar buckets)
 * KPI numbers stay in Dashboard.jsx (unchanged).
 */
export default function DashboardCharts({ stats }) {
  const salesRef = useRef(null);
  const gstRef = useRef(null);
  const clientsRef = useRef(null);
  const sitesRef = useRef(null);
  const stateRef = useRef(null);
  const agingRef = useRef(null);
  const charts = useRef([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Chart, registerables } = await import('chart.js');
        if (cancelled) return;
        Chart.register(...registerables);

        charts.current.forEach(c => { try { c.destroy(); } catch {} });
        charts.current = [];

        const prefs = getChartPrefs() || {};
        const s = stats || {};

        const mk = (canvas, cfg) => {
          if (!canvas) return;
          const existing = Chart.getChart(canvas);
          if (existing) existing.destroy();
          charts.current.push(new Chart(canvas, cfg));
        };

        const baseOpts = { responsive: true, maintainAspectRatio: false };
        const inrTick = (v) => {
          const n = Number(v) || 0;
          if (Math.abs(n) >= 1e7) return (n / 1e7).toFixed(1) + ' Cr';
          if (Math.abs(n) >= 1e5) return (n / 1e5).toFixed(1) + ' L';
          if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + ' K';
          return String(n);
        };

        // 1) Sales Trend — line (or bar from prefs), months on X
        if (prefs.showSalesTrend !== false) {
          let labels = [];
          let data = [];
          if (s.monthKeys?.length && s.byMonth) {
            labels = s.monthKeys;
            data = s.monthKeys.map(k => Number(s.byMonth[k]) || 0);
          } else if (s.salesTrend?.length) {
            labels = s.salesTrend.map(x => x.label || x.month || '');
            data = s.salesTrend.map(x => x.value || x.amount || 0);
          }
          if (!labels.length) { labels = ['No data']; data = [0]; }
          mk(salesRef.current, {
            type: prefs.salesChart === 'bar' ? 'bar' : 'line',
            data: {
              labels,
              datasets: [{
                label: 'Sales',
                data,
                borderColor: chartColor(prefs.theme || 'blue'),
                backgroundColor: chartColor(prefs.theme || 'blue') + '66',
                tension: 0.3,
                fill: prefs.salesChart !== 'bar',
              }],
            },
            options: {
              ...baseOpts,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true, ticks: { callback: inrTick } },
                x: { ticks: { maxRotation: 0 } },
              },
            },
          });
        }

        // 2) GST Breakdown — stacked bar by month (IGST / CGST / SGST) like GAS
        if (prefs.showGstBreakdown !== false) {
          const gbm = s.gstByMonth || {};
          let months = (s.monthKeys && s.monthKeys.length)
            ? s.monthKeys
            : Object.keys(gbm).sort().slice(-6);
          if (!months.length) months = ['No data'];
          const hasMonthly = months.some(m => gbm[m] && (gbm[m].cgst || gbm[m].sgst || gbm[m].igst));
          if (hasMonthly) {
            mk(gstRef.current, {
              type: 'bar',
              data: {
                labels: months,
                datasets: [
                  { label: 'IGST', data: months.map(m => Number(gbm[m]?.igst) || 0), backgroundColor: chartColor('purple'), stack: 'gst' },
                  { label: 'CGST', data: months.map(m => Number(gbm[m]?.cgst) || 0), backgroundColor: chartColor('blue'), stack: 'gst' },
                  { label: 'SGST', data: months.map(m => Number(gbm[m]?.sgst) || 0), backgroundColor: chartColor('green'), stack: 'gst' },
                ],
              },
              options: {
                ...baseOpts,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } },
                scales: {
                  x: { stacked: true, ticks: { maxRotation: 0 } },
                  y: { stacked: true, beginAtZero: true, ticks: { callback: inrTick } },
                },
              },
            });
          } else {
            // Fallback: single totals bar (legacy)
            const gst = s.gstBreakdown || {};
            mk(gstRef.current, {
              type: 'bar',
              data: {
                labels: ['CGST', 'SGST', 'IGST'],
                datasets: [{
                  label: 'GST',
                  data: [Number(gst.cgst) || 0, Number(gst.sgst) || 0, Number(gst.igst) || 0],
                  backgroundColor: [chartColor('blue'), chartColor('green'), chartColor('purple')],
                }],
              },
              options: {
                ...baseOpts,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { callback: inrTick } } },
              },
            });
          }
        }

        // 3) Top Clients — horizontal bar (GAS style)
        if (prefs.showTopClients !== false) {
          const tc = (s.topClients || []).map(x => Array.isArray(x) ? { name: x[0], amount: x[1] } : x);
          const horiz = prefs.clientsChart !== 'pie';
          mk(clientsRef.current, {
            type: prefs.clientsChart === 'pie' ? 'pie' : 'bar',
            data: {
              labels: tc.length ? tc.map(x => {
                const n = x.name || '—';
                return n.length > 18 ? n.slice(0, 16) + '…' : n;
              }) : ['No data'],
              datasets: [{
                label: 'Revenue',
                data: tc.length ? tc.map(x => Number(x.amount) || 0) : [0],
                backgroundColor: tc.length
                  ? tc.map((_, i) => chartColor(['purple', 'blue', 'green', 'amber', 'cyan'][i % 5]))
                  : [chartColor('purple')],
              }],
            },
            options: {
              ...baseOpts,
              indexAxis: horiz && prefs.clientsChart !== 'pie' ? 'y' : 'x',
              plugins: { legend: { display: prefs.clientsChart === 'pie', position: 'bottom' } },
              scales: prefs.clientsChart === 'pie' ? undefined : {
                x: { beginAtZero: true, ticks: { callback: inrTick } },
                y: { ticks: { font: { size: 10 } } },
              },
            },
          });
        }

        // 4) Top Sites — pie
        if (prefs.showTopSites !== false) {
          const ts = s.topSites || [];
          mk(sitesRef.current, {
            type: 'pie',
            data: {
              labels: ts.length ? ts.map(x => x.name || '—') : ['No site data'],
              datasets: [{
                data: ts.length ? ts.map(x => Number(x.amount) || 0) : [1],
                backgroundColor: ts.length
                  ? ts.map((_, i) => chartColor(['green', 'blue', 'purple', 'amber', 'cyan', 'red'][i % 6]))
                  : ['#e2e8f0'],
              }],
            },
            options: { ...baseOpts, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } },
          });
        }

        // 5) Sales by State — horizontal bar (GAS style)
        if (prefs.showSalesByState !== false) {
          const ss = s.salesByState || [];
          mk(stateRef.current, {
            type: 'bar',
            data: {
              labels: ss.length ? ss.map(x => x.name || '—') : ['No state data'],
              datasets: [{
                label: 'Sales',
                data: ss.length ? ss.map(x => Number(x.amount) || 0) : [0],
                backgroundColor: chartColor(prefs.theme || 'blue'),
              }],
            },
            options: {
              ...baseOpts,
              indexAxis: 'y',
              plugins: { legend: { display: false } },
              scales: {
                x: { beginAtZero: true, ticks: { callback: inrTick } },
                y: { ticks: { font: { size: 10 } } },
              },
            },
          });
        }

        // 6) Aging Summary — Not Due / 0-30 / 31-60 / 61-90 / 90+
        if (prefs.showAging !== false) {
          const a = s.aging || {};
          mk(agingRef.current, {
            type: 'bar',
            data: {
              labels: ['Not Due', '0-30d', '31-60d', '61-90d', '90d+'],
              datasets: [{
                label: 'Outstanding (₹)',
                data: [
                  Number(a.notDue) || 0,
                  Number(a.d0_30) || 0,
                  Number(a.d31_60) || 0,
                  Number(a.d61_90) || 0,
                  Number(a.d90p) || 0,
                ],
                backgroundColor: [
                  chartColor('blue') || '#3b82f6',
                  chartColor('green') || '#10b981',
                  chartColor('amber') || '#f59e0b',
                  chartColor('purple') || '#8b5cf6',
                  chartColor('red') || '#ef4444',
                ],
              }],
            },
            options: {
              ...baseOpts,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => `Outstanding: ₹${(ctx.raw || 0).toLocaleString('en-IN')}`,
                  },
                },
              },
              scales: { y: { beginAtZero: true, ticks: { callback: inrTick } } },
            },
          });
        }
      } catch (e) {
        console.warn('[DashboardCharts]', e);
      }
    })();
    return () => {
      cancelled = true;
      charts.current.forEach(c => { try { c.destroy(); } catch {} });
      charts.current = [];
    };
  }, [stats]);

  const prefs = getChartPrefs() || {};
  const card = (title, show, ref) => (
    show === false ? null : (
      <div className="glass-panel" style={{ padding: '0.75rem 1rem', minHeight: 260 }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 600, opacity: 0.85 }}>{title}</h3>
        <div style={{ height: 200, position: 'relative' }}>
          <canvas ref={ref} />
        </div>
      </div>
    )
  );

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '1rem',
      marginBottom: '1.25rem',
    }}>
      {card('Sales Trend', prefs.showSalesTrend, salesRef)}
      {card('GST Breakdown', prefs.showGstBreakdown, gstRef)}
      {card('Top Clients', prefs.showTopClients, clientsRef)}
      {card('Top Sites', prefs.showTopSites, sitesRef)}
      {card('Sales by State', prefs.showSalesByState, stateRef)}
      {card('Aging Summary', prefs.showAging, agingRef)}
    </div>
  );
}
