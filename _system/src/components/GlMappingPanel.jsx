/**
 * Settings sub-panel: default GL account mapping (Phase E).
 * Embed under Settings → Invoice / Books section without removing other tabs.
 */
import { useState, useEffect } from 'react';
import { toast } from './Toast';
import { getAllAccounts } from '../store';
import { DEFAULT_GL_MAP } from '../utils/coaSeed';

const KEYS = [
  { key: 'revenue', label: 'Sales / revenue' },
  { key: 'receivables', label: 'Receivables (Debtors)' },
  { key: 'payables', label: 'Payables (Creditors)' },
  { key: 'operatingBank', label: 'Operating bank' },
  { key: 'cash', label: 'Cash' },
  { key: 'projectExpense', label: 'Default project expense' },
  { key: 'outputCgst', label: 'Output CGST' },
  { key: 'outputSgst', label: 'Output SGST' },
  { key: 'outputIgst', label: 'Output IGST' },
  { key: 'inputCgst', label: 'Input CGST' },
  { key: 'inputSgst', label: 'Input SGST' },
  { key: 'inputIgst', label: 'Input IGST' },
  { key: 'advancesFromCustomers', label: 'Advances from customers' },
  { key: 'roundOff', label: 'Round-off' },
  { key: 'retainedEarnings', label: 'Retained earnings' },
];

export default function GlMappingPanel() {
  const [map, setMap] = useState({ ...DEFAULT_GL_MAP });
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    getAllAccounts().then((a) => setAccounts(Array.isArray(a) ? a : [])).catch(() => {});
    fetch('/api/meta/glMap', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.value) setMap({ ...DEFAULT_GL_MAP, ...d.value });
      })
      .catch(() => {});
  }, []);

  const leaves = (accounts || []).filter((a) => !a.isGroup && a.isActive !== false);

  const save = async () => {
    try {
      const res = await fetch('/api/meta/glMap', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: map }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast('GL mapping saved', 'success');
    } catch (e) {
      toast(e.message || 'Save failed — install server GL bridge', 'error');
    }
  };

  return (
    <div className="glass-panel" style={{ padding: 12 }} id="settings-gl-mapping">
      <h3 className="section-title" style={{ marginTop: 0 }}>Default GL account mapping</h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        Used when GL Engine is ON. Missing keys fall back to system seed accounts. Does not block invoice save.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {KEYS.map((k) => (
          <div key={k.key} className="form-group">
            <label className="form-label">{k.label}</label>
            <select
              className="form-input"
              value={map[k.key] || DEFAULT_GL_MAP[k.key] || ''}
              onChange={(e) => setMap((prev) => ({ ...prev, [k.key]: e.target.value }))}
            >
              {leaves.map((a) => (
                <option key={a.id} value={a.id}>
                  {(a.code ? a.code + ' — ' : '') + a.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={save}>
        Save GL mapping
      </button>
    </div>
  );
}
