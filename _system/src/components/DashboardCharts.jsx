import { useEffect, useRef, useState } from 'react';
import { getChartPrefs, chartColor } from '../utils/chartPrefs';

/**
 * Secondary chart grid for non-home contexts.
 * Home dashboard uses DashboardHomeLayout (single owner) to avoid duplicates.
 * When hideAll is true, renders nothing.
 */
function resolveType(prefs, candidates, fallback = 'bar') {
  for (const c of candidates) {
    if (c == null || c === '') continue;
    const t = String(c).toLowerCase();
    if (['line', 'bar', 'area', 'pie', 'doughnut', 'horizontalbar', 'stacked'].includes(t)) {
      return t === 'horizontalbar' ? 'horizontalBar' : t;
    }
  }
  return fallback;
}

function chartJsType(t) {
  if (t === 'area') return 'line';
  if (t === 'horizontalBar' || t === 'stacked') return 'bar';
  if (t === 'pie' || t === 'doughnut') return t;
  if (t === 'line' || t === 'bar') return t;
  return 'bar';
}

export default function DashboardCharts({
  stats,
  hideSalesTrend = true,
  hideTopClients = false,
  hideAll = false,
}) {
  const salesRef = useRef(null);
  const gstRef = useRef(null);
  const clientsRef = useRef(null);
  const sitesRef = useRef(null);
  const stateRef = useRef(null);
  const agingRef = useRef(null);
  const charts = useRef([]);
  const [prefsTick, setPrefsTick] = useState(0);

  useEffect(() => {
    const bump = () => setPrefsTick((n) => n + 1);
    window.addEventListener('sd-chart-prefs-changed', bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener('sd-chart-prefs-changed', bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  useEffect(() => {
    if (hideAll) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const { Chart, registerables } = await import('chart.js');
        if (cancelled) return;
        Chart.register(...registerables);

        charts.current.forEach((c) => { try { c.destroy(); } catch { /* */ } });
        charts.current = [];

        const prefs = getChartPrefs() || {};
        const s = stats || {};
        const baseOpts = { responsive: true, maintainAspectRatio: false };
        const inrTick = (v) => {
          const n = Number(v) || 0;
          if (Math.abs(n) >= 1e7) return (n / 1e7).toFixed(1) + ' Cr';
          if (Math.abs(n) >= 1e5) return (n / 1e5).toFixed(1) + ' L';
          if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + ' K';
          return String(n);
        };
        const theme = prefs.theme || 'blue';

        const mk = (canvas, cfg) => {
          if (!canvas) return;
          const existing = Chart.getChart(canvas);
          if (existing) existing.destroy();
          charts.current.push(new Chart(canvas, cfg));
        };

        if (!hideSalesTrend && prefs.showSalesTrend !== false) {
          let labels = [];
          let data = [];
          if (s.monthKeys?.length && s.byMonth) {
            labels = s.monthKeys;
            data = s.monthKeys.map((k) => Number(s.byMonth[k]) || 0);
          } else if (s.salesTrend?.length) {
            labels = s.salesTrend.map((x) => x.label || x.month || '');
            data = s.salesTrend.map((x) => x.value || x.amount || 0);
          }
          if (!labels.length) {
            labels = ['No revenue data'];
            data = [0];
          }
          const purchMap = s.byMonthPurchases || {};
          const purchData = labels.map((k) => Number(purchMap[k]) || 0);
          const salesType = resolveType(prefs, [prefs.salesChart, prefs.salesTrend?.type], 'line');
          const jsType = chartJsType(salesType);
          const isArea = salesType === 'area';
          const isHoriz = salesType === 'horizontalBar';

          mk(salesRef.current, {
            type: jsType,
            data: {
              labels,
              datasets: [
                {
                  label: 'Sales',
                  data,
                  borderColor: chartColor(theme) || '#3b82f6',
                  backgroundColor: isArea || jsType === 'bar' ? 'rgba(59,130,246,0.35)' : 'rgba(59,130,246,0.15)',
                  tension: 0.3,
                  fill: isArea || salesType === 'line',
                },
                {
                  label: 'Purchases',
                  data: purchData,
                  borderColor: chartColor('amber') || '#f59e0b',
                  backgroundColor: isArea || jsType === 'bar' ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.12)',
                  tension: 0.3,
                  fill: isArea,
                },
              ],
            },
            options: {
              ...baseOpts,
              indexAxis: isHoriz ? 'y' : 'x',
              plugins: {
                legend: { display: true, position: 'bottom' },
                tooltip: {
                  callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ₹${(ctx.raw || 0).toLocaleString('en-IN')}`,
                  },
                },
              },
              scales: (jsType === 'pie' || jsType === 'doughnut') ? undefined : {
                [isHoriz ? 'x' : 'y']: { beginAtZero: true, ticks: { callback: inrTick } },
              },
            },
          });
        }

        if (prefs.showGstBreakdown !== false) {
          const gbm = s.gstByMonth || {};
          let months = (s.monthKeys && s.monthKeys.length)
            ? s.monthKeys
            : Object.keys(gbm).sort().slice(-6);
          if (!months.length) months = ['No data'];
          const hasMonthly = months.some((m) => gbm[m] && (gbm[m].cgst || gbm[m].sgst || gbm[m].igst));
          const gstType = resolveType(prefs, [prefs.gstBreakdown?.type, prefs.gstChart], 'bar');
          const jsType = chartJsType(gstType);
          const stacked = gstType === 'stacked' || gstType === 'bar';

          if (hasMonthly && (jsType === 'bar' || jsType === 'line')) {
            mk(gstRef.current, {
              type: jsType,
              data: {
                labels: months,
                datasets: [
                  { label: 'IGST', data: months.map((m) => Number(gbm[m]?.igst) || 0), backgroundColor: chartColor('purple'), borderColor: chartColor('purple'), stack: stacked ? 'gst' : undefined, fill: gstType === 'area' },
                  { label: 'CGST', data: months.map((m) => Number(gbm[m]?.cgst) || 0), backgroundColor: chartColor('blue'), borderColor: chartColor('blue'), stack: stacked ? 'gst' : undefined, fill: gstType === 'area' },
                  { label: 'SGST', data: months.map((m) => Number(gbm[m]?.sgst) || 0), backgroundColor: chartColor('green'), borderColor: chartColor('green'), stack: stacked ? 'gst' : undefined, fill: gstType === 'area' },
                ],
              },
              options: {
                ...baseOpts,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
                scales: {
                  x: { stacked },
                  y: { stacked, beginAtZero: true, ticks: { callback: inrTick } },
                },
              },
            });
          } else {
            const gb = s.gstBreakdown || {};
            mk(gstRef.current, {
              type: (jsType === 'pie' || jsType === 'doughnut') ? jsType : 'doughnut',
              data: {
                labels: ['IGST', 'CGST', 'SGST'],
                datasets: [{
                  data: [Number(gb.igst) || 0, Number(gb.cgst) || 0, Number(gb.sgst) || 0],
                  backgroundColor: [chartColor('purple'), chartColor('blue'), chartColor('green')],
                }],
              },
              options: {
                ...baseOpts,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
              },
            });
          }
        }

        if (!hideTopClients && prefs.showTopClients !== false) {
          const tc = s.topClients || [];
          const labels = tc.length ? tc.map((x) => x.name || '—') : ['No client data'];
          const values = tc.length ? tc.map((x) => Number(x.amount) || 0) : [0];
          mk(clientsRef.current, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Billed', data: values, backgroundColor: chartColor(theme) }] },
            options: {
              ...baseOpts,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { callback: inrTick } } },
            },
          });
        }

        if (prefs.showTopSites !== false) {
          const ts = s.topSites || [];
          const labels = ts.length ? ts.map((x) => x.name || '—') : ['No site data'];
          const values = ts.length ? ts.map((x) => Number(x.amount) || 0) : [1];
          const colors = ts.length
            ? ts.map((_, i) => chartColor(['green', 'blue', 'purple', 'amber', 'cyan', 'red'][i % 6]))
            : ['#e2e8f0'];
          mk(sitesRef.current, {
            type: 'doughnut',
            data: { labels, datasets: [{ data: values, backgroundColor: colors }] },
            options: {
              ...baseOpts,
              plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } },
            },
          });
        }

        if (prefs.showSalesByState !== false) {
          const ss = s.salesByState || [];
          const labels = ss.length ? ss.map((x) => x.name || '—') : ['No state data'];
          const values = ss.length ? ss.map((x) => Number(x.amount) || 0) : [0];
          mk(stateRef.current, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Sales', data: values, backgroundColor: chartColor(theme) }] },
            options: {
              ...baseOpts,
              indexAxis: 'y',
              plugins: { legend: { display: false } },
              scales: { x: { beginAtZero: true, ticks: { callback: inrTick } } },
            },
          });
        }

        if (prefs.showAging !== false) {
          const a = s.aging || {};
          const labels = ['Not Due', '0-30d', '31-60d', '61-90d', '90d+'];
          const values = [
            Number(a.notDue) || 0,
            Number(a.d0_30) || 0,
            Number(a.d31_60) || 0,
            Number(a.d61_90) || 0,
            Number(a.d90p) || 0,
          ];
          const colors = [
            chartColor('blue') || '#3b82f6',
            chartColor('green') || '#10b981',
            chartColor('amber') || '#f59e0b',
            chartColor('purple') || '#8b5cf6',
            chartColor('red') || '#ef4444',
          ];
          mk(agingRef.current, {
            type: 'doughnut',
            data: { labels, datasets: [{ data: values, backgroundColor: colors }] },
            options: {
              ...baseOpts,
              plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                tooltip: {
                  callbacks: {
                    label: (ctx) => `Outstanding: ₹${(ctx.raw || 0).toLocaleString('en-IN')}`,
                  },
                },
              },
            },
          });
        }
      } catch (e) {
        console.warn('[DashboardCharts]', e);
      }
    })();

    return () => {
      cancelled = true;
      charts.current.forEach((c) => { try { c.destroy(); } catch { /* */ } });
      charts.current = [];
    };
  }, [stats, prefsTick, hideAll, hideSalesTrend, hideTopClients]);

  if (hideAll) return null;

  const prefs = getChartPrefs() || {};
  const card = (title, subtitle, show, ref) => (
    show === false ? null : (
      <div className="glass-panel chart-card" style={{ padding: '0.75rem 1rem', minHeight: 260 }}>
        <h3 style={{ margin: '0 0 0.15rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{title}</h3>
        {subtitle ? (
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>{subtitle}</p>
        ) : (
          <div style={{ height: '0.5rem' }} />
        )}
        <div style={{ height: 200, position: 'relative' }}>
          <canvas ref={ref} />
        </div>
      </div>
    )
  );

  return (
    <div
      className="dashboard-charts-inner"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '14px',
        marginBottom: '1.25rem',
      }}
    >
      {card('Sales vs purchases', 'Tax invoices vs purchases.', hideSalesTrend ? false : prefs.showSalesTrend !== false, salesRef)}
      {card('GST breakdown', 'CGST / SGST / IGST.', prefs.showGstBreakdown !== false, gstRef)}
      {card('Top clients', 'By billed amount.', hideTopClients ? false : prefs.showTopClients !== false, clientsRef)}
      {card('Top sites', 'By site / location.', prefs.showTopSites !== false, sitesRef)}
      {card('Sales by state', 'Place of supply.', prefs.showSalesByState !== false, stateRef)}
      {card('Receivables aging', 'Open balances by due date.', prefs.showAging !== false, agingRef)}
    </div>
  );
}
