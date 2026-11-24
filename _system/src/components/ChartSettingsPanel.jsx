import { useEffect, useState } from 'react';
import { getChartPrefs, setChartPrefs } from '../utils/chartPrefs';
import { toast } from './Toast';

const CHARTS = [
  { showKey: 'showSalesTrend', typeKey: 'salesChart', label: 'Sales vs purchases', types: ['combo', 'bar', 'line', 'area'] },
  { showKey: 'showPaymentStatus', typeKey: 'paymentChart', label: 'Payment status', types: ['doughnut', 'pie', 'bar'] },
  { showKey: 'showGstBreakdown', typeKey: null, label: 'GST breakdown', types: ['bar', 'line', 'area', 'pie', 'doughnut'] },
  { showKey: 'showTopClients', typeKey: 'clientsChart', label: 'Top clients', types: ['bar', 'horizontalBar', 'pie', 'doughnut'] },
  { showKey: 'showTopSites', typeKey: null, label: 'Top sites', types: ['doughnut', 'pie', 'bar', 'horizontalBar'] },
  { showKey: 'showSalesByState', typeKey: null, label: 'Sales by state', types: ['horizontalBar', 'bar', 'pie', 'doughnut'] },
  { showKey: 'showAging', typeKey: 'agingChart', label: 'Receivables aging', types: ['doughnut', 'pie', 'bar', 'horizontalBar'] },
];

const APP_THEMES = {
  blue: {
    light: { primary: '#1D4ED8', hover: '#1E40AF', light: '#EFF6FF', rgb: '29, 78, 216', darker: '#172033' },
    dark:  { primary: '#3B82F6', hover: '#60A5FA', light: '#1E3150', rgb: '59, 130, 246', darker: '#1E3A8A' },
  },
  green: {
    light: { primary: '#0F766E', hover: '#115E59', light: '#F0FDFA', rgb: '15, 118, 110', darker: '#134E4A' },
    dark:  { primary: '#14B8A6', hover: '#2DD4BF', light: '#133835', rgb: '20, 184, 166', darker: '#0F766E' },
  },
  purple: {
    light: { primary: '#6D28D9', hover: '#5B21B6', light: '#F5F3FF', rgb: '109, 40, 217', darker: '#4C1D95' },
    dark:  { primary: '#8B5CF6', hover: '#A78BFA', light: '#281E45', rgb: '139, 92, 246', darker: '#5B21B6' },
  },
  slate: {
    light: { primary: '#334155', hover: '#1E293B', light: '#F1F5F9', rgb: '51, 65, 85', darker: '#0F172A' },
    dark:  { primary: '#94A3B8', hover: '#CBD5E1', light: '#1E293B', rgb: '148, 163, 184', darker: '#334155' },
  },
  cyan: {
    light: { primary: '#0E7490', hover: '#155E75', light: '#ECFEFF', rgb: '14, 116, 144', darker: '#164E63' },
    dark:  { primary: '#06B6D4', hover: '#22D3EE', light: '#123640', rgb: '6, 182, 212', darker: '#0E7490' },
  },
  amber: {
    light: { primary: '#B45309', hover: '#92400E', light: '#FFFBEB', rgb: '180, 83, 9', darker: '#78350F' },
    dark:  { primary: '#F59E0B', hover: '#FBBF24', light: '#3B2810', rgb: '245, 158, 11', darker: '#B45309' },
  },
  red: {
    light: { primary: '#B91C1C', hover: '#991B1B', light: '#FEF2F2', rgb: '185, 28, 28', darker: '#7F1D1D' },
    dark:  { primary: '#EF4444', hover: '#F87171', light: '#3D1919', rgb: '239, 68, 68', darker: '#B91C1C' },
  },
};

export function applyAppAccentTheme(themeKey) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const key = APP_THEMES[themeKey] ? themeKey : 'blue';
  const isDark = root.getAttribute('data-theme') === 'dark';
  const palette = APP_THEMES[key][isDark ? 'dark' : 'light'];
  root.setAttribute('data-accent', key);
  root.style.setProperty('--primary', palette.primary);
  root.style.setProperty('--primary-hover', palette.hover);
  root.style.setProperty('--primary-light', palette.light);
  root.style.setProperty('--primary-rgb', palette.rgb);
  root.style.setProperty('--primary-darker', palette.darker);
}

export default function ChartSettingsPanel() {
  const [prefs, setPrefs] = useState(() => getChartPrefs());

  useEffect(() => {
    applyAppAccentTheme(prefs.theme || 'blue');
    const observer = new MutationObserver(() => {
      applyAppAccentTheme((getChartPrefs() || {}).theme || 'blue');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [prefs.theme]);

  const update = (patch) => {
    const next = setChartPrefs(patch);
    if (patch.theme) applyAppAccentTheme(patch.theme);
    setPrefs({ ...next });
    toast('Preferences saved', 'success');
  };

  const resetDefaults = () => {
    update({
      showSalesTrend: true,
      salesChart: 'combo',
      salesTrend: { type: 'combo' },
      showPaymentStatus: true,
      paymentChart: 'doughnut',
      showGstBreakdown: true,
      gstBreakdown: { type: 'bar' },
      showTopClients: true,
      clientsChart: 'bar',
      topClients: { type: 'bar' },
      showTopSites: true,
      topSites: { type: 'doughnut' },
      showSalesByState: true,
      salesByState: { type: 'horizontalBar' },
      showAging: true,
      agingChart: 'doughnut',
      aging: { type: 'doughnut' },
      dateRange: '12M',
      legendPosition: 'right',
      theme: 'blue',
    });
  };

  return (
    <div className="glass-panel p-4" style={{ marginTop: 0, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ marginTop: 0, marginBottom: 4 }} className="section-title">Dashboard & App Theme Aesthetics</h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={resetDefaults}>
          Reset Defaults
        </button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', marginBottom: 12 }}>
        Configure all 7 dashboard charts, time window, legend placement, and the accent color theme for charts and the entire app.
      </p>
      <div style={{ display: 'grid', gap: 10, maxWidth: 580 }}>
        {CHARTS.map(c => (
          <div key={c.showKey} style={{
            display: 'grid', gridTemplateColumns: '28px 1fr 145px', gap: 10, alignItems: 'center',
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
                      : c.showKey === 'showTopSites' ? (prefs.topSites?.type || 'doughnut')
                      : c.showKey === 'showSalesByState' ? (prefs.salesByState?.type || 'horizontalBar')
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

        <div className="grid grid-cols-2 gap-3" style={{ marginTop: 8 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Chart Period Range</label>
            <select className="form-input" value={prefs.dateRange || '12M'}
              onChange={e => update({ dateRange: e.target.value })}>
              <option value="3M">Last 3 Months (3M)</option>
              <option value="6M">Last 6 Months (6M)</option>
              <option value="12M">Last 12 Months (12M)</option>
              <option value="FY">Current Financial Year (FY)</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Pie / Doughnut Legend</label>
            <select className="form-input" value={prefs.legendPosition || 'right'}
              onChange={e => update({ legendPosition: e.target.value })}>
              <option value="right">Right Side (fills card)</option>
              <option value="bottom">Bottom</option>
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 4 }}>
          <label className="form-label">App & Chart Color Theme</label>
          <select className="form-input" value={prefs.theme || 'blue'}
            onChange={e => update({ theme: e.target.value })}>
            <option value="blue">Blue (default)</option>
            <option value="green">Green (Teal)</option>
            <option value="purple">Purple</option>
            <option value="slate">Slate</option>
            <option value="cyan">Cyan</option>
            <option value="amber">Amber</option>
            <option value="red">Red</option>
          </select>
        </div>
      </div>
    </div>
  );
}