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
        const prefs = getChartPrefs();
        const s = stats || {};
        const mk = (canvas, cfg) => {
          if (!canvas) return;
          charts.current.push(new Chart(canvas, cfg));
        };

        const salesType = prefs.salesTrend?.type || prefs.salesChart || 'line';
        const salesLabels = (s.salesTrend || s.monthlySales || s.monthKeys || []).map(x =>
          typeof x === 'string' ? x : (x.label || x.month || '')
        );
        const salesData = (s.salesTrend || s.monthlySales || []).map(x => x.value || x.amount || 0);
        // Fallback from byMonth if needed
        let labels = salesLabels;
        let data = salesData;
        if ((!labels.length || !data.length) && s.byMonth && s.monthKeys) {
          labels = s.monthKeys;
          data = s.monthKeys.map(k => s.byMonth[k] || 0);
        }
        mk(salesRef.current, {
          type: salesType === 'doughnut' ? 'doughnut' : salesType,
          data: {
            labels: labels.length ? labels : ['—'],
            datasets: [{
              label: 'Sales',
              data: data.length ? data : [0],
              borderColor: chartColor(prefs.salesTrend?.color || prefs.theme),
              backgroundColor: chartColor(prefs.salesTrend?.color || prefs.theme) + '99',
              tension: 0.3,
              fill: salesType === 'line',
            }],
          },
          options: { responsive: true, plugins: { legend: { display: false } }, scales: salesType === 'pie' || salesType === 'doughnut' ? undefined : { y: { beginAtZero: true } } },
        });

        const gst = s.gstBreakdown || {};
        mk(gstRef.current, {
          type: prefs.gstBreakdown?.type || 'bar',
          data: {
            labels: ['CGST', 'SGST', 'IGST'],
            datasets: [{
              label: 'GST',
              data: [gst.cgst || 0, gst.sgst || 0, gst.igst || 0],
              backgroundColor: [chartColor('blue'), chartColor('green'), chartColor('purple')],
            }],
          },
          options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
        });

        const tc = (s.topClients || []).map(x => Array.isArray(x) ? { name: x[0], amount: x[1] } : x);
        mk(clientsRef.current, {
          type: prefs.topClients?.type || prefs.clientsChart || 'bar',
          data: {
            labels: tc.length ? tc.map(x => x.name || x.client || '—') : ['—'],
            datasets: [{
              label: 'Revenue',
              data: tc.length ? tc.map(x => x.amount || x.value || 0) : [0],
              backgroundColor: chartColor(prefs.topClients?.color || prefs.theme),
            }],
          },
          options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
        });

        const ts = s.topSites || [];
        mk(sitesRef.current, {
          type: prefs.topSites?.type || 'pie',
          data: {
            labels: ts.length ? ts.map(x => x.name || x.site || '—') : ['No site data'],
            datasets: [{
              data: ts.length ? ts.map(x => x.amount || x.value || 0) : [1],
              backgroundColor: ts.length
                ? ts.map((_, i) => chartColor(['green', 'blue', 'purple', 'amber', 'cyan', 'red'][i % 6]))
                : ['#e2e8f0'],
            }],
          },
          options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
        });

        const ss = s.salesByState || [];
        mk(stateRef.current, {
          type: prefs.salesByState?.type || 'bar',
          data: {
            labels: ss.length ? ss.map(x => x.name || x.state || '—') : ['No state data'],
            datasets: [{
              label: 'Sales',
              data: ss.length ? ss.map(x => x.amount || x.value || 0) : [0],
              backgroundColor: chartColor(prefs.salesByState?.color || prefs.theme),
            }],
          },
          options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
        });

        const ag = s.aging || {};
        mk(agingRef.current, {
          type: prefs.aging?.type || prefs.agingChart || 'bar',
          data: {
            labels: ['0–30', '31–60', '61–90', '90+'],
            datasets: [{
              label: 'Outstanding',
              data: [
                ag.d0_30 || ag['0-30'] || 0,
                ag.d31_60 || ag['31-60'] || 0,
                ag.d61_90 || ag['61-90'] || 0,
                ag.d90 || ag['90+'] || 0,
              ],
              backgroundColor: chartColor(prefs.aging?.color || prefs.theme),
            }],
          },
          options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
        });
      } catch (e) {
        console.warn('[DashboardCharts]', e);
      }
    })();
    return () => {
      cancelled = true;
      charts.current.forEach(c => { try { c.destroy(); } catch {} });
    };
  }, [stats]);

  const card = {
    background: 'var(--card, #fff)',
    borderRadius: 12,
    padding: '12px 14px',
    border: '1px solid var(--border, #e2e8f0)',
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
      <div style={card}><h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Sales trend</h3><canvas ref={salesRef} height={160} /></div>
      <div style={card}><h3 style={{ margin: '0 0 8px', fontSize: 14 }}>GST breakdown</h3><canvas ref={gstRef} height={160} /></div>
      <div style={card}><h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Top clients</h3><canvas ref={clientsRef} height={160} /></div>
      <div style={card}><h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Top sites</h3><canvas ref={sitesRef} height={160} /></div>
      <div style={card}><h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Sales by state</h3><canvas ref={stateRef} height={160} /></div>
      <div style={card}><h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Aging</h3><canvas ref={agingRef} height={160} /></div>
    </div>
  );
}
