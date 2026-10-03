import { useState, useEffect } from 'react';
import { toast } from './Toast';
import { Save, Lock } from 'lucide-react';

const KEY = 'sd_gsp_settings';

/**
 * GSP / e-Invoice (IRN) stub — offline-safe.
 * IRN generation stays disabled until API base URL + GSTIN + client id are set.
 * Does not call NIC/GSP until you implement a real partner integration.
 */
export default function EinvoiceSettingsPanel() {
  const [cfg, setCfg] = useState({
    enabled: false,
    gspName: '',
    apiBaseUrl: '',
    clientId: '',
    clientSecret: '',
    gstin: '',
    environment: 'sandbox',
  });
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        setCfg((c) => ({ ...c, ...p, clientSecret: p.clientSecret || '' }));
        setSaved(JSON.stringify({ ...p, clientSecret: p.clientSecret || '' }));
      }
    } catch { /* ignore */ }
  }, []);

  const ready = !!(cfg.apiBaseUrl.trim() && cfg.clientId.trim() && cfg.gstin.trim().length >= 15);
  const dirty = saved !== null && JSON.stringify(cfg) !== saved;

  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(cfg));
    setSaved(JSON.stringify(cfg));
    toast('GSP settings saved on this PC (not sent anywhere until IRN is enabled with a live GSP)', 'success');
  };

  const tryIrn = () => {
    if (!ready) {
      toast('Fill API base URL, Client ID and GSTIN first', 'warning');
      return;
    }
    if (!cfg.enabled) {
      toast('Turn on "Enable e-Invoice (IRN)" after your GSP whitelists this PC', 'info');
      return;
    }
    toast('IRN API not connected yet — configure your GSP partner, then we can wire Generate IRN on Save Invoice.', 'info', 8000);
  };

  return (
    <div className="glass-panel p-6 mb-6" id="section-einvoice">
      <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Lock size={18} /> E-Invoice / GSP (IRN)
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Indian e-invoicing needs a <strong>GSP</strong> (or NIC) with IP whitelist. This panel only stores credentials locally.
        <strong> Generate IRN stays disabled</strong> until keys are complete and a live integration is wired.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <label className="form-group" style={{ gridColumn: '1 / -1' }}>
          <span className="form-label">
            <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} /> Enable e-Invoice (IRN) when ready
          </span>
        </label>
        <div className="form-group">
          <label className="form-label">GSP name</label>
          <input className="form-input" value={cfg.gspName} onChange={(e) => setCfg({ ...cfg, gspName: e.target.value })} placeholder="e.g. ClearTax / your GSP" />
        </div>
        <div className="form-group">
          <label className="form-label">Environment</label>
          <select className="form-input" value={cfg.environment} onChange={(e) => setCfg({ ...cfg, environment: e.target.value })}>
            <option value="sandbox">Sandbox</option>
            <option value="production">Production</option>
          </select>
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">API base URL *</label>
          <input className="form-input" value={cfg.apiBaseUrl} onChange={(e) => setCfg({ ...cfg, apiBaseUrl: e.target.value })} placeholder="https://…" />
        </div>
        <div className="form-group">
          <label className="form-label">Client ID *</label>
          <input className="form-input" value={cfg.clientId} onChange={(e) => setCfg({ ...cfg, clientId: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Client secret</label>
          <input className="form-input" type="password" value={cfg.clientSecret} onChange={(e) => setCfg({ ...cfg, clientSecret: e.target.value })} autoComplete="off" />
        </div>
        <div className="form-group">
          <label className="form-label">GSTIN (e-invoice) *</label>
          <input className="form-input" value={cfg.gstin} onChange={(e) => setCfg({ ...cfg, gstin: e.target.value.toUpperCase() })} maxLength={15} placeholder="15 characters" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty && saved !== null}>
          <Save size={16} /> Save GSP settings
        </button>
        <button type="button" className="btn btn-secondary" onClick={tryIrn} disabled={!ready} title={ready ? 'Ready for future API wiring' : 'Fill required fields'}>
          Generate IRN (disabled until GSP live)
        </button>
        <span style={{ fontSize: 12, color: ready ? '#059669' : '#b45309' }}>
          {ready ? 'Credentials look complete — IRN API still stubbed' : 'Incomplete — IRN button stays inactive'}
        </span>
      </div>
    </div>
  );
}
