const KEY = 'fgsb_chart_prefs';

/** Legacy defaults (ChartSettingsPanel.jsx) */
const LEGACY_DEFAULTS = {
  salesChart: 'line',
  agingChart: 'doughnut',
  clientsChart: 'bar',
  theme: 'blue',
};

/** Extended defaults (DashboardCharts / DashboardChartSettings) */
const EXTENDED_DEFAULTS = {
  salesTrend: { type: 'line', color: 'blue' },
  gstBreakdown: { type: 'bar', color: 'red' },
  topClients: { type: 'bar', color: 'purple' },
  topSites: { type: 'pie', color: 'green' },
  salesByState: { type: 'bar', color: 'blue' },
  aging: { type: 'bar', color: 'blue' },
};

const DEFAULTS = { ...LEGACY_DEFAULTS, ...EXTENDED_DEFAULTS };

/** Theme palettes (array form for older charts) + single hex map for new charts */
export const THEME_COLORS = {
  blue: ['#3b82f6', '#1d4ed8', '#93c5fd'],
  green: ['#22c55e', '#15803d', '#86efac'],
  purple: ['#8b5cf6', '#6d28d9', '#c4b5fd'],
  slate: ['#64748b', '#334155', '#cbd5e1'],
  red: ['#dc2626', '#b91c1c', '#fca5a5'],
  cyan: ['#0891b2', '#0e7490', '#67e8f9'],
  amber: ['#d97706', '#b45309', '#fcd34d'],
};

export function getChartPrefs() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Used by ChartSettingsPanel.jsx — must remain exported */
export function setChartPrefs(patch) {
  const next = { ...getChartPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* ignore */ }
  return next;
}

/** Alias used by DashboardChartSettings.jsx */
export function saveChartPrefs(prefs) {
  return setChartPrefs(prefs);
}

/** Resolve a single hex colour from theme name or first palette entry */
export function chartColor(nameOrTheme) {
  const key = nameOrTheme || 'blue';
  const v = THEME_COLORS[key];
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string') return v;
  return '#3b82f6';
}
