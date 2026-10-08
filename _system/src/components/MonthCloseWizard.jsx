import { useState, useEffect } from 'react';
import { Lock, CheckCircle2, FileText, Shield } from 'lucide-react';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';
import { markBackupDone } from '../utils/backupNag';

/**
 * Month-close wizard: pick month → GSTR reminder → checklist → lock via /api/period-lock.
 * Reuses existing periodLock + backup; does not rewrite GST engine.
 */
export default function MonthCloseWizard() {
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [locked, setLocked] = useState([]);
  const [checks, setChecks] = useState({ gstr: false, bank: false, invoices: false });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const r = await fetch('/api/period-lock');
      if (r.ok) {
        const j = await r.json();
        setLocked(j.lockedMonths || []);
      }
    } catch { /* */ }
  };

  useEffect(() => { load(); }, []);

  const isLocked = locked.includes(month);

  const runLock = async () => {
    if (!checks.gstr || !checks.invoices) {
      toast('Complete the checklist before locking the month', 'error');
      return;
    }
    const ok = await confirmAction({
      title: `Lock ${month}?`,
      message: 'Edits to invoices in this month will be blocked until an admin unlocks. Continue?',
      confirmLabel: 'Lock month',
      tone: 'warning',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await fetch('/api/period-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, action: 'lock' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast(j.error || 'Could not lock month', 'error');
        return;
      }
      setLocked(j.lockedMonths || [...locked, month]);
      try { markBackupDone(); } catch { /* */ }
      toast(`Month ${month} locked. Take a backup from Settings if you have not already.`, 'success');
    } catch (e) {
      toast(e.message || 'Lock failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const runUnlock = async () => {
    const ok = await confirmAction({
      title: `Unlock ${month}?`,
      message: 'Allow edits again for this month.',
      confirmLabel: 'Unlock',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await fetch('/api/period-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, action: 'unlock' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast(j.error || 'Unlock failed', 'error');
        return;
      }
      setLocked(j.lockedMonths || locked.filter(m => m !== month));
      toast(`Month ${month} unlocked`, 'success');
    } catch (e) {
      toast(e.message || 'Unlock failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Lock size={18} /> Month close
      </h3>
      <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        Select a month, export GSTR from GST Returns, confirm the checklist, then lock the period.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Month</label>
          <input type="month" className="form-input" value={month} onChange={e => setMonth(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            sessionStorage.setItem('gst_currentView', 'gst-returns');
            window.dispatchEvent(new CustomEvent('sd-navigate', { detail: 'gst-returns' }));
            toast('Open GST Returns → export GSTR-1 / GSTR-3B for this month', 'info');
          }}
        >
          <FileText size={14} /> GSTR export
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, fontSize: '0.85rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={checks.gstr} onChange={e => setChecks(c => ({ ...c, gstr: e.target.checked }))} />
          GSTR-1 / GSTR-3B reviewed or exported for this month
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={checks.invoices} onChange={e => setChecks(c => ({ ...c, invoices: e.target.checked }))} />
          All tax invoices for the month are final (no draft gaps)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={checks.bank} onChange={e => setChecks(c => ({ ...c, bank: e.target.checked }))} />
          Bank / cash book reconciled (optional)
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {isLocked ? (
          <>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: '0.85rem' }}>
              <CheckCircle2 size={16} /> {month} is locked
            </span>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={runUnlock}>Unlock</button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={runLock}>
            <Shield size={14} /> Lock {month}
          </button>
        )}
      </div>
      {locked.length > 0 && (
        <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Locked months: {locked.join(', ')}
        </p>
      )}
    </div>
  );
}
