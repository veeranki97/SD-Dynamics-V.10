import { useState, useEffect } from 'react';
import { getChartPrefs, saveChartPrefs, THEME_COLORS } from '../utils/chartPrefs';
import { toast } from './Toast';

const CHARTS = [
  { key: 'salesTrend', label: 'Sales Trend' },
  { key: 'gstBreakdown', label: 'GST Breakdown' },
  { key: 'topClients', label: 'Top Clients' },
  { key: 'topSites', label: 'Top Sites' },
  { key: 'salesByState', label: 'Sales by State' },
  { key: 'aging', label: 'Aging' },
];

const TYPES = ['line', 'bar', 'pie', 'doughnut'];

export default function DashboardChartSettings() {
  const [prefs, setPrefs] = useState(() => getChartPrefs());

  const set = (key, field, value) => {
    setPrefs(p => ({ ...p, [key]: { ...p[key], [field]: value } }));
  };

  const apply = () => {
    saveChartPrefs(prefs);
    toast('Chart styles saved — reload Dashboard to apply', 'success');
  };

  return (
    <div className="glass-panel" style={{ padding: '1rem 1.25rem', maxWidth: 520 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Dashboard Chart Aesthetics</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CHARTS.map(c => (
          <div key={c.key} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 36px', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13 }}>{c.label}</span>
            <select className="form-input" value={prefs[c.key]?.type || 'bar'}
              onChange={e => set(c.key, 'type', e.target.value)}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="color"
              value={THEME_COLORS[prefs[c.key]?.color] || '#2563eb'}
              onChange={e => {
                const hex = e.target.value;
                const name = Object.entries(THEME_COLORS).find(([, v]) => v === hex)?.[0] || 'blue';
                // map nearest
                set(c.key, 'color', name);
              }}
              title="Color"
              style={{ width: 36, height: 32, border: 'none', padding: 0, cursor: 'pointer' }}
            />
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-primary" style={{ marginTop: 14, width: '100%' }} onClick={apply}>
        Apply visual styles
      </button>
    </div>
  );
}
