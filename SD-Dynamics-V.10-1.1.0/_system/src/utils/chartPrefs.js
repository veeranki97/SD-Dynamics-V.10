const KEY = 'fgsb_chart_prefs';
const DEFAULTS = { salesChart: 'line', agingChart: 'doughnut', clientsChart: 'bar', theme: 'blue' };
export function getChartPrefs() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}
export function setChartPrefs(patch) {
  const next = { ...getChartPrefs(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
export const THEME_COLORS = {
  blue: ['#3b82f6', '#1d4ed8', '#93c5fd'],
  green: ['#22c55e', '#15803d', '#86efac'],
  purple: ['#8b5cf6', '#6d28d9', '#c4b5fd'],
  slate: ['#64748b', '#334155', '#cbd5e1'],
};
