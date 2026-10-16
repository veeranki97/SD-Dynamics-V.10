import { useMemo, useState } from 'react';
import { Calendar, Download, CheckCircle, AlertTriangle, Package, ExternalLink } from 'lucide-react';
import { toast } from './Toast';
import {
  getReturnDueDates,
  daysUntil,
  buildPrefileChecklist,
  periodKeyFromDate,
} from '../utils/gstFilingAssist';
import { gspSubmitReturn, isGspFilingReady, loadGspConfig } from '../utils/gspClient';

/**
 * Level-1 filing assist — due dates, checklist, sequential period pack, mark-filed shortcuts.
 * Props:
 *  periodYm: 'YYYY-MM'
 *  bills: period-filtered bills
 *  profile
 *  periodFiling: { gstr1?, gstr3b? }
 *  onMarkFiled(type)
 *  onExportPack: async () => void  // parent runs JSON/CSV exports
 *  qrmp?: boolean
 */
export default function GstFilingAssistPanel({
  periodYm,
  bills = [],
  profile = {},
  periodFiling = {},
  onMarkFiled,
  onExportPack,
  onBuildGstr1Payload,
  onBuildGstr3bPayload,
  qrmp = false,
}) {
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState('');
  const [gspLog, setGspLog] = useState('');
  const gspCfg = loadGspConfig();
  const gspReady = isGspFilingReady() || (gspCfg.enabled && gspCfg.environment === 'sandbox' && gspCfg.simulateSandbox);

  const ym = periodYm || periodKeyFromDate(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));

  const dues = useMemo(() => getReturnDueDates(ym, { qrmp }), [ym, qrmp]);
  const checklist = useMemo(() => buildPrefileChecklist(bills, profile), [bills, profile]);

  if (!dues) return null;

  const d1 = daysUntil(dues.gstr1Due);
  const d3 = daysUntil(dues.gstr3bDue);
  const fmt = (d) =>
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const badge = (days, filed) => {
    if (filed) return { text: 'Filed (local mark)', color: '#059669', bg: '#ecfdf5' };
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: '#b91c1c', bg: '#fef2f2' };
    if (days <= 5) return { text: `${days}d left`, color: '#b45309', bg: '#fffbeb' };
    return { text: `${days}d left`, color: '#1e40af', bg: '#eff6ff' };
  };

  const b1 = badge(d1, !!periodFiling.gstr1);
  const b3 = badge(d3, !!periodFiling.gstr3b);

  const runPack = async () => {
    if (!onExportPack) {
      toast('Export handlers not wired', 'error');
      return;
    }
    if (!checklist.ok) {
      toast('Fix checklist errors before downloading the pack (or export individual files from tabs).', 'warning');
    }
    setBusy(true);
    try {
      await onExportPack();
      toast('Period pack: downloads started (GSTR-1 JSON, GSTR-3B JSON, HSN/CSV). Save each file, then upload on gst.gov.in.', 'success');
    } catch (e) {
      toast(e?.message || 'Pack export failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const retPeriodMmYyyy = () => {
    // GSTN often wants MMYYYY
    const [y, m] = String(ym || '').split('-');
    if (!y || !m) return '';
    return `${m}${y}`;
  };

  const submitGsp = async (returnType) => {
    if (!gspReady) {
      toast('Enable GSP in Settings → E-Invoice / GSP (sandbox simulate is OK for a dry run)', 'warning');
      return;
    }
    if (!checklist.ok) {
      toast('Fix checklist errors first', 'warning');
      return;
    }
    setBusy(true);
    setGspLog('');
    try {
      const builder = returnType === 'gstr3b' ? onBuildGstr3bPayload : onBuildGstr1Payload;
      if (typeof builder !== 'function') {
        throw new Error('Payload builder not wired — update GSTReturns');
      }
      const payload = builder();
      if (!payload) throw new Error('Empty return payload — check period filters');
      const result = await gspSubmitReturn({
        returnType,
        retPeriod: retPeriodMmYyyy(),
        payload,
        otp: otp.trim(),
      });
      const msg = result.arn
        ? `${returnType.toUpperCase()} ${result.simulated ? 'simulated' : 'submitted'}. ARN: ${result.arn}`
        : `${returnType.toUpperCase()} ${result.status}. ${result.message || ''}`;
      setGspLog(msg);
      toast(msg, 'success');
      if (result.arn || result.simulated) {
        onMarkFiled?.(returnType === 'gstr3b' ? 'gstr3b' : 'gstr1');
      }
    } catch (e) {
      setGspLog(e.message || 'GSP submit failed');
      toast(e.message || 'GSP submit failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '0.9rem 1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} /> Filing assist — {ym}
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
              (offline pack · no auto-submit to GSTN)
            </span>
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem' }}>
            <span style={{ padding: '0.2rem 0.5rem', borderRadius: 6, background: b1.bg, color: b1.color }}>
              GSTR-1 due {fmt(dues.gstr1Due)} · {b1.text}
            </span>
            <span style={{ padding: '0.2rem 0.5rem', borderRadius: 6, background: b3.bg, color: b3.color }}>
              GSTR-3B due {fmt(dues.gstr3bDue)} · {b3.text}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={runPack}>
            <Package size={14} /> {busy ? 'Exporting…' : 'Download period pack'}
          </button>
          <input
            className="form-input"
            style={{ width: 100, fontSize: 12, padding: '0.25rem 0.4rem' }}
            placeholder="OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            title="GSTN/GSP OTP if required"
          />
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy || !gspReady} onClick={() => submitGsp('gstr1')} title="Level-2 GSP">
            GSP: GSTR-1
          </button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy || !gspReady} onClick={() => submitGsp('gstr3b')} title="Level-2 GSP">
            GSP: GSTR-3B
          </button>
          <a href="https://www.gst.gov.in/" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
            <ExternalLink size={14} /> Portal
          </a>
          {!periodFiling.gstr1 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onMarkFiled?.('gstr1')}>
              <CheckCircle size={14} /> Mark GSTR-1 filed
            </button>
          )}
          {!periodFiling.gstr3b && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onMarkFiled?.('gstr3b')}>
              <CheckCircle size={14} /> Mark GSTR-3B filed
            </button>
          )}
        </div>
      </div>

      <ul style={{ margin: '0.75rem 0 0', paddingLeft: 0, listStyle: 'none', fontSize: '0.8rem' }}>
        {checklist.items.map((it) => (
          <li
            key={it.id}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              marginBottom: 4,
              color: it.level === 'error' ? '#b91c1c' : it.level === 'warn' ? '#b45309' : 'var(--text-muted)',
            }}
          >
            {it.level === 'error' || it.level === 'warn' ? (
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            ) : (
              <CheckCircle size={14} style={{ flexShrink: 0, marginTop: 2, color: '#059669' }} />
            )}
            <span>{it.msg}</span>
          </li>
        ))}
      </ul>
      {gspLog ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#059669' }}>{gspLog}</p>
      ) : null}
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        Level-1: period pack + portal upload. Level-2: GSP buttons use Settings credentials
        {gspCfg.simulateSandbox ? ' (sandbox simulate ON — mock ARN, no GSTN).' : '.'}
        Production needs GSP whitelist + simulate OFF.
      </p>
    </div>
  );
}
