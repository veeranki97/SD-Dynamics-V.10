import { useMemo, useState } from 'react';
import { Calendar, Download, CheckCircle, AlertTriangle, Package, Lock } from 'lucide-react';
import { toast } from './Toast';
import {
  getReturnDueDates,
  daysUntil,
  buildPrefileChecklist,
  periodKeyFromDate,
} from '../utils/gstFilingAssist';
import { gspSubmitReturn, isGspFilingReady, loadGspConfig } from '../utils/gspClient';
import MonthCloseWizard from './MonthCloseWizard';

/**
 * Filing assist + Month lock as compact sub-tabs (saves vertical space).
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
  const [subTab, setSubTab] = useState('assist'); // assist | lock
  const gspCfg = loadGspConfig();
  const gspReady =
    isGspFilingReady() ||
    (gspCfg.enabled && gspCfg.environment === 'sandbox' && gspCfg.simulateSandbox);

  const ym =
    periodYm ||
    periodKeyFromDate(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));

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
      toast('Fix checklist errors before downloading the pack (or export from tabs).', 'warning');
    }
    setBusy(true);
    try {
      await onExportPack();
      toast('Period pack downloads started. Upload on gst.gov.in (Prepare Offline).', 'success');
    } catch (e) {
      toast(e?.message || 'Pack export failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const retPeriodMmYyyy = () => {
    const [y, m] = String(ym || '').split('-');
    if (!y || !m) return '';
    return `${m}${y}`;
  };

  const submitGsp = async (returnType) => {
    if (!gspReady) {
      toast('Enable GSP in Settings → E-Invoice / GSP (sandbox simulate OK for dry run)', 'warning');
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
      if (typeof builder !== 'function') throw new Error('Payload builder not wired');
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

  const tabBtn = (id, label, Icon) => (
    <button
      type="button"
      className={`btn btn-sm ${subTab === id ? 'btn-primary' : 'btn-secondary'}`}
      onClick={() => setSubTab(id)}
      style={{ fontSize: '0.78rem', padding: '0.28rem 0.65rem' }}
    >
      <Icon size={13} /> {label}
    </button>
  );

  return (
    <div className="glass-panel" style={{ padding: '0.65rem 0.85rem', marginBottom: '0.75rem' }}>
      {/* Header row: title + sub-tabs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.5rem',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={15} /> Filing assist — {ym}
          <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)' }}>
            offline · no auto GSTN
          </span>
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          {tabBtn('assist', 'Assist', Package)}
          {tabBtn('lock', 'Month lock', Lock)}
        </div>
      </div>

      {subTab === 'assist' && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem', fontSize: '0.78rem' }}>
            <span style={{ padding: '0.15rem 0.45rem', borderRadius: 6, background: b1.bg, color: b1.color }}>
              GSTR-1 due {fmt(dues.gstr1Due)} · {b1.text}
            </span>
            <span style={{ padding: '0.15rem 0.45rem', borderRadius: 6, background: b3.bg, color: b3.color }}>
              GSTR-3B due {fmt(dues.gstr3bDue)} · {b3.text}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '0.5rem', alignItems: 'center' }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={runPack}>
              <Package size={14} /> {busy ? 'Exporting…' : 'Download period pack'}
            </button>
            <input
              className="form-input"
              style={{ width: 88, fontSize: 12, padding: '0.2rem 0.35rem' }}
              placeholder="OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              title="GSP OTP if required"
            />
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy || !gspReady} onClick={() => submitGsp('gstr1')} title="Uses Settings → E-Invoice / GSP">
              GSP: GSTR-1
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy || !gspReady} onClick={() => submitGsp('gstr3b')} title="Uses Settings → E-Invoice / GSP">
              GSP: GSTR-3B
            </button>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Filed status: use <strong>R1 / 3B</strong> pills in the header (single place).
            </span>
          </div>

          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', fontSize: '0.75rem' }}>
            {checklist.items.map((it) => (
              <li
                key={it.id}
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'flex-start',
                  marginBottom: 2,
                  color: it.level === 'error' ? '#b91c1c' : it.level === 'warn' ? '#b45309' : 'var(--text-muted)',
                }}
              >
                {it.level === 'error' || it.level === 'warn' ? (
                  <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <CheckCircle size={12} style={{ flexShrink: 0, marginTop: 2, color: '#059669' }} />
                )}
                <span>{it.msg}</span>
              </li>
            ))}
          </ul>
          {gspLog ? (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#059669' }}>{gspLog}</p>
          ) : null}
        </>
      )}

      {subTab === 'lock' && (
        <MonthCloseWizard compact />
      )}
    </div>
  );
}
