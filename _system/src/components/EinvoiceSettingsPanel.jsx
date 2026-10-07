import { buildEinvoiceJson, validateEinvoiceBill } from '../utils/einvoiceBuild';
import { useState, useEffect, useMemo } from 'react';
import { toast } from './Toast';
import { Save, Lock, Shield, Wifi, FileKey2, ExternalLink } from 'lucide-react';

const KEY = 'sd_gsp_settings';

const empty = () => ({
  enabled: false,
  gspName: '',
  apiBaseUrl: '',
  clientId: '',
  clientSecret: '',
  gstin: '',
  environment: 'sandbox',
  username: '',
  password: '',
  autoIrnOnSave: false,
  notes: '',
});

/**
 * E-Invoice / GSP (IRN) settings — stored on this PC only.
 * Generate IRN stays disabled until credentials are complete AND enabled is on
 * AND a live GSP adapter is wired (partner IP whitelist required).
 */
export default function EinvoiceSettingsPanel() {
  const [cfg, setCfg] = useState(empty);
  const [savedSnap, setSavedSnap] = useState(null);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = { ...empty(), ...JSON.parse(raw) };
        setCfg(p);
        setSavedSnap(JSON.stringify(p));
      } else {
        setSavedSnap(JSON.stringify(empty()));
      }
    } catch {
      setSavedSnap(JSON.stringify(empty()));
    }
  }, []);

  const ready = useMemo(
    () =>
      !!(
        cfg.apiBaseUrl?.trim() &&
        cfg.clientId?.trim() &&
        (cfg.gstin || '').trim().length >= 15
      ),
    [cfg]
  );

  const dirty = savedSnap !== null && JSON.stringify(cfg) !== savedSnap;

  const patch = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  const save = () => {
    const gst = (cfg.gstin || '').toUpperCase().trim();
    if (gst && gst.length !== 15) {
      toast('GSTIN must be 15 characters', 'warning');
      return;
    }
    const next = { ...cfg, gstin: gst };
    localStorage.setItem(KEY, JSON.stringify(next));
    setCfg(next);
    setSavedSnap(JSON.stringify(next));
    toast('GSP settings saved on this PC', 'success');
  };

  const tryIrn = () => {
    if (!ready) {
      toast('Fill API base URL, Client ID and 15-digit GSTIN first', 'warning');
      return;
    }
    if (!cfg.enabled) {
      toast('Enable e-Invoice after your GSP whitelists this machine’s public IP', 'info');
      return;
    }
    toast(
      'IRN API not connected yet. After GSP onboarding, Generate IRN will run on Tax Invoice save.',
      'info',
      9000
    );
  };

  const testPing = () => {
    if (!cfg.apiBaseUrl?.trim()) {
      toast('Enter API base URL first', 'warning');
      return;
    }
    toast(
      'Connectivity test is a stub — open your GSP portal to verify sandbox credentials.',
      'info',
      7000
    );
  };

  return (
    <div className="page" style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileKey2 size={22} /> E-Invoice / GSP
        </h2>
        <p className="page-subtitle" style={{ margin: '6px 0 0' }}>
          Indian e-invoicing (IRN + signed QR) via a GSP partner. Keys stay on this PC until a live adapter is enabled.
        </p>
      </div>

      <div className="glass-panel p-6 mb-4" id="section-einvoice">
        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={18} /> Credentials
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>
          Turnover thresholds and NIC schema change over time — confirm with your CA whether e-invoice is mandatory for your GSTIN.
          Most GSPs require <strong>public IP whitelisting</strong> before production IRN works.
        </p>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!cfg.enabled}
            onChange={(e) => patch('enabled', e.target.checked)}
          />
          <span>Enable e-Invoice (IRN) when GSP is live</span>
        </label>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 14,
          }}
        >
          <div className="form-group">
            <label className="form-label">GSP / Partner name</label>
            <input
              className="form-input"
              value={cfg.gspName}
              onChange={(e) => patch('gspName', e.target.value)}
              placeholder="e.g. ClearTax, Masters India, your CA GSP"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Environment</label>
            <select
              className="form-input"
              value={cfg.environment}
              onChange={(e) => patch('environment', e.target.value)}
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">API base URL *</label>
            <input
              className="form-input"
              value={cfg.apiBaseUrl}
              onChange={(e) => patch('apiBaseUrl', e.target.value)}
              placeholder="https://…"
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Client ID *</label>
            <input
              className="form-input"
              value={cfg.clientId}
              onChange={(e) => patch('clientId', e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Client secret</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                type={showSecret ? 'text' : 'password'}
                value={cfg.clientSecret}
                onChange={(e) => patch('clientSecret', e.target.value)}
                autoComplete="new-password"
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowSecret((s) => !s)}>
                {showSecret ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Seller GSTIN *</label>
            <input
              className="form-input"
              value={cfg.gstin}
              onChange={(e) => patch('gstin', e.target.value.toUpperCase())}
              maxLength={15}
              placeholder="15 characters"
            />
          </div>
          <div className="form-group">
            <label className="form-label">GSP username (if required)</label>
            <input
              className="form-input"
              value={cfg.username}
              onChange={(e) => patch('username', e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label className="form-label">GSP password (if required)</label>
            <input
              className="form-input"
              type="password"
              value={cfg.password}
              onChange={(e) => patch('password', e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Internal notes</label>
            <textarea
              className="form-input"
              rows={2}
              value={cfg.notes}
              onChange={(e) => patch('notes', e.target.value)}
              placeholder="Partner ticket #, whitelist IP, go-live date…"
            />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!cfg.autoIrnOnSave}
            onChange={(e) => patch('autoIrnOnSave', e.target.checked)}
            disabled={!cfg.enabled}
          />
          <span style={{ opacity: cfg.enabled ? 1 : 0.6 }}>
            Auto-request IRN when saving a Tax Invoice (after live GSP wiring)
          </span>
        </label>

        <div
          style={{
            marginTop: 20,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty && savedSnap !== null}>
            <Save size={16} /> Save GSP settings
          </button>
          <button type="button" className="btn btn-secondary" onClick={testPing}>
            <Wifi size={16} /> Test connectivity (stub)
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={tryIrn}
            disabled={!ready}
            title={ready ? 'Stub until GSP API is wired' : 'Fill required fields'}
          >
            <Shield size={16} /> Generate IRN (stub)
          </button>
          <span style={{ fontSize: 12, color: ready ? '#059669' : '#b45309' }}>
            {ready
              ? cfg.enabled
                ? 'Credentials complete · Enable is ON · API still stubbed'
                : 'Credentials complete · turn on Enable after whitelist'
              : 'Incomplete — need API URL, Client ID, GSTIN'}
          </span>
        </div>
      </div>

      <div className="glass-panel p-6 mb-4">
        <h3 className="section-title">What works today vs later</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55, color: 'var(--text-muted)' }}>
          <li>
            <strong>Today:</strong> save GSP profile on this PC; status shown on this screen; Tax Invoice PDF can already show a static UPI QR from Settings (not NIC signed QR).
          </li>
          <li>
            <strong>After partner setup:</strong> server calls GSP → IRN + signed QR on Tax Invoice; cancel/amend IRN; store IRN on the bill JSON for GSTR.
          </li>
          <li>
            Optional public docs:{' '}
            <a href="https://einvoice1.gst.gov.in/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
              NIC e-Invoice portal <ExternalLink size={12} style={{ display: 'inline' }} />
            </a>
          </li>
        </ul>
      </div>
    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
          IRN is issued only via a GSP after static IP whitelist. Use buildEinvoiceJson for offline validation + JSON download — never invent an IRN.
        </p>
    </div>
  );
}


/** Read-only helper for other modules (Invoice save path later). */
export function getGspSettings() {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return empty();
  }
}

export function isGspReadyForIrn() {
  const c = getGspSettings();
  return !!(
    c.enabled &&
    c.apiBaseUrl?.trim() &&
    c.clientId?.trim() &&
    (c.gstin || '').trim().length >= 15
  );
}
