import { useEffect, useRef } from 'react';
import { getChartPrefs, chartColor } from '../utils/chartPrefs';

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
          charts.current.push(new Chart(canvas, cfg));
        };
        const baseOpts = { responsive: true, maintainAspectRatio: false };

        // Sales trend from byMonth (always present when bills exist)
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
            options: { ...baseOpts, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
          });
        }

        if (prefs.showGstBreakdown !== false) {
          const gst = s.gstBreakdown || {};
          const gdata = [Number(gst.cgst) || 0, Number(gst.sgst) || 0, Number(gst.igst) || 0];
          mk(gstRef.current, {
            type: 'bar',
            data: {
              labels: ['CGST', 'SGST', 'IGST'],
              datasets: [{
                label: 'GST',
                data: gdata,
                backgroundColor: [chartColor('blue'), chartColor('green'), chartColor('purple')],
              }],
            },
            options: { ...baseOpts, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
          });
        }

        if (prefs.showTopClients !== false) {
          const tc = (s.topClients || []).map(x => Array.isArray(x) ? { name: x[0], amount: x[1] } : x);
          mk(clientsRef.current, {
            type: prefs.clientsChart === 'pie' ? 'pie' : 'bar',
            data: {
              labels: tc.length ? tc.map(x => x.name || '—') : ['No data'],
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
              plugins: { legend: { display: prefs.clientsChart === 'pie', position: 'bottom' } },
              scales: prefs.clientsChart === 'pie' ? undefined : { y: { beginAtZero: true } },
            },
          });
        }

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
            options: { ...baseOpts, plugins: { legend: { position: 'bottom' } } },
          });
        }

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
            options: { ...baseOpts, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
          });
        }

        if (prefs.showAging !== false) {
          const ag = s.aging || {};
          mk(agingRef.current, {
            type: prefs.agingChart === 'doughnut' ? 'doughnut' : 'bar',
            data: {
              labels: ['0–30', '31–60', '61–90', '90+'],
              datasets: [{
                label: 'Outstanding',
                data: [
                  Number(ag.d0_30) || 0,
                  Number(ag.d31_60) || 0,
                  Number(ag.d61_90) || 0,
                  Number(ag.d90p || ag.d90) || 0,
                ],
                backgroundColor: [
                  chartColor('green'), chartColor('blue'), chartColor('amber'), chartColor('red'),
                ],
              }],
            },
            options: {
              ...baseOpts,
              plugins: { legend: { display: prefs.agingChart === 'doughnut', position: 'bottom' } },
              scales: prefs.agingChart === 'doughnut' ? undefined : { y: { beginAtZero: true } },
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
    };
  }, [stats]);

  const prefs = getChartPrefs() || {};
  const card = {
    background: 'var(--card, #fff)',
    borderRadius: 12,
    padding: '12px 14px',
    border: '1px solid var(--border, #e2e8f0)',
    minHeight: 240,
  };
  const title = { margin: '0 0 8px', fontSize: 14, fontWeight: 600 };
  const wrap = { position: 'relative', height: 170 };

  const Cell = ({ show, label, cref }) => {
    if (show === false) return null;
    return (
      <div style={card}>
        <h3 style={title}>{label}</h3>
        <div style={wrap}><canvas ref={cref} /></div>
      </div>
    );
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: 12,
      marginTop: 12,
    }}>
      <Cell show={prefs.showSalesTrend !== false} label="Sales trend" cref={salesRef} />
      <Cell show={prefs.showGstBreakdown !== false} label="GST breakdown" cref={gstRef} />
      <Cell show={prefs.showTopClients !== false} label="Top clients" cref={clientsRef} />
      <Cell show={prefs.showTopSites !== false} label="Top sites" cref={sitesRef} />
      <Cell show={prefs.showSalesByState !== false} label="Sales by state" cref={stateRef} />
      <Cell show={prefs.showAging !== false} label="Aging" cref={agingRef} />
    </div>
  );
}
