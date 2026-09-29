import { useState } from 'react';
import { getChartPrefs, setChartPrefs } from '../utils/chartPrefs';
import { toast } from './Toast';

export default function ChartSettingsPanel() {
  const [prefs, setPrefs] = useState(() => getChartPrefs());

  const update = (patch) => {
    const next = setChartPrefs(patch);
    setPrefs(next);
    toast('Chart preferences saved', 'success');
  };

  return (
    <div className="glass-panel p-4" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Dashboard charts</h3>
      <p style={{ fontSize: 13, color: '#64748b' }}>Theme and chart types for the home dashboard (requires chart.js).</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 480 }}>
        <div className="form-group">
          <label className="form-label">Sales chart</label>
          <select className="form-input" value={prefs.salesChart || 'line'}
            onChange={e => update({ salesChart: e.target.value })}>
            <option value="line">Line</option>
            <option value="bar">Bar</option>
          </select>
        </div>
        <div className="form-group">
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
