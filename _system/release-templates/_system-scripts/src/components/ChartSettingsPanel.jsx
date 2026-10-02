import { useState } from 'react';
import { getChartPrefs, setChartPrefs } from '../utils/chartPrefs';
import { toast } from './Toast';

const CHARTS = [
  { showKey: 'showSalesTrend', typeKey: 'salesChart', label: 'Sales trend', types: ['line', 'bar'] },
  { showKey: 'showGstBreakdown', typeKey: null, label: 'GST breakdown', types: ['bar', 'pie'] },
  { showKey: 'showTopClients', typeKey: 'clientsChart', label: 'Top clients', types: ['bar', 'pie'] },
  { showKey: 'showTopSites', typeKey: null, label: 'Top sites', types: ['pie', 'doughnut', 'bar'] },
  { showKey: 'showSalesByState', typeKey: null, label: 'Sales by state', types: ['bar', 'pie'] },
  { showKey: 'showAging', typeKey: 'agingChart', label: 'Aging', types: ['bar', 'doughnut'] },
];

export default function ChartSettingsPanel() {
  const [prefs, setPrefs] = useState(() => getChartPrefs());

  const update = (patch) => {
    const next = setChartPrefs(patch);
    setPrefs({ ...next });
    toast('Chart preferences saved', 'success');
  };

  return (
    <div className="glass-panel p-4" style={{ marginTop: 0, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }} className="section-title">Dashboard Chart Aesthetics</h3>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
        Show/hide each chart and pick type/theme. Applied on the home Dashboard immediately after save (refresh Dashboard if needed).
      </p>
      <div style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
        {CHARTS.map(c => (
          <div key={c.showKey} style={{
            display: 'grid', gridTemplateColumns: '28px 1fr 120px', gap: 10, alignItems: 'center',
            padding: '6px 0', borderBottom: '1px solid var(--border, #e5e7eb)',
          }}>
            <input
              type="checkbox"
              checked={prefs[c.showKey] !== false}
              onChange={e => update({ [c.showKey]: e.target.checked })}
              title="Show on dashboard"
            />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</span>
            <select
              className="form-input"
              value={
                c.typeKey ? (prefs[c.typeKey] || c.types[0])
                  : (prefs[c.showKey.replace('show', '').replace(/^./, m => m.toLowerCase())]?.type
                    || (c.showKey === 'showGstBreakdown' ? (prefs.gstBreakdown?.type || 'bar')
                      : c.showKey === 'showTopSites' ? (prefs.topSites?.type || 'pie')
                      : c.showKey === 'showSalesByState' ? (prefs.salesByState?.type || 'bar')
                      : c.types[0]))
              }
              onChange={e => {
                const v = e.target.value;
                if (c.typeKey) update({ [c.typeKey]: v });
                else if (c.showKey === 'showGstBreakdown') update({ gstBreakdown: { ...(prefs.gstBreakdown || {}), type: v } });
                else if (c.showKey === 'showTopSites') update({ topSites: { ...(prefs.topSites || {}), type: v } });
                else if (c.showKey === 'showSalesByState') update({ salesByState: { ...(prefs.salesByState || {}), type: v } });
                else if (c.showKey === 'showSalesTrend') update({ salesTrend: { ...(prefs.salesTrend || {}), type: v }, salesChart: v });
                else if (c.showKey === 'showTopClients') update({ topClients: { ...(prefs.topClients || {}), type: v }, clientsChart: v });
                else if (c.showKey === 'showAging') update({ aging: { ...(prefs.aging || {}), type: v }, agingChart: v });
              }}
            >
              {c.types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        ))}
        <div className="form-group" style={{ marginTop: 8 }}>
          <label className="form-label">Color theme</label>
          <select className="form-input" value={prefs.theme || 'blue'}
            onChange={e => update({ theme: e.target.value })}>
            <option value="blue">Blue</option>
            <option value="green">Green</option>
            <option value="purple">Purple</option>
            <option value="slate">Slate</option>
          </select>
        </div>
      </div>
    </div>
  );
}
