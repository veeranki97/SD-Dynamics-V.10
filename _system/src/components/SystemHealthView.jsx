import { useState, useEffect } from 'react';
import { Activity, RefreshCw, Server, Database } from 'lucide-react';
import { toast } from './Toast';

export default function SystemHealthView() {
  const [data, setData] = useState(null);
  const [sqlite, setSqlite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reimporting, setReimporting] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setErr(e.message || 'Failed to reach /api/health — is the API server running?');
      setData(null);
    }
    try {
      const sr = await fetch('/api/sqlite-status');
      if (sr.ok) setSqlite(await sr.json());
      else setSqlite({ ready: false, error: `HTTP ${sr.status}` });
    } catch (e) {
      setSqlite({ ready: false, error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const reimport = async () => {
    if (!window.confirm('Re-import all JSON files from data/ into SQLite?\n\nExisting SQLite rows for the same ids will be overwritten. JSON files are not deleted.')) return;
    setReimporting(true);
    try {
      const res = await fetch('/api/sqlite-reimport', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      toast?.success?.(`SQLite re-import done${body.migrated != null ? ` (${body.migrated} records)` : ''}`)
        || alert(`Re-import OK${body.migrated != null ? `: ${body.migrated} records` : ''}`);
      await load();
    } catch (e) {
      toast?.error?.(e.message) || alert(e.message);
    } finally {
      setReimporting(false);
    }
  };

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const uptime = data?.uptimeSec != null
    ? `${Math.floor(data.uptimeSec / 3600)}h ${Math.floor((data.uptimeSec % 3600) / 60)}m ${data.uptimeSec % 60}s`
    : '—';

  const counts = sqlite?.counts || {};
  const countEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: data?.ok ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#dc2626,#f87171)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        }}>
          <Server size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.35rem' }}>System health</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Live status · SQLite primary store
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={14} style={{ marginRight: 6 }} /> Refresh
        </button>
      </div>

      {err && (
        <div style={{ padding: 12, borderRadius: 8, background: '#fef2f2', color: '#b91c1c', marginBottom: 16 }}>
          {err}
        </div>
      )}

      {loading && !data && <p className="text-muted">Checking…</p>}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Status', value: data.ok ? 'OK' : 'DEGRADED', color: data.ok ? '#059669' : '#dc2626' },
            { label: 'Version', value: data.version || '—' },
            { label: 'Uptime', value: uptime },
            { label: 'PID', value: String(data.pid || '—') },
            { label: 'Recent errors', value: data.hasRecentErrors ? 'Yes' : 'None' },
          ].map(k => (
            <div key={k.label} style={{
              padding: '12px 14px', borderRadius: 10,
              border: '1px solid var(--border, #e2e8f0)',
              background: 'var(--card-bg, #fff)',
            }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.06, color: 'var(--text-muted)' }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color || 'var(--text-primary)', marginTop: 4 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ===== SQLite panel ===== */}
      <div style={{
        border: '1px solid var(--border, #e2e8f0)', borderRadius: 12,
        background: 'var(--card-bg, #fff)', padding: 16, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: sqlite?.ready ? 'linear-gradient(135deg,#1d4ed8,#3b82f6)' : 'linear-gradient(135deg,#64748b,#94a3b8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          }}>
            <Database size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>SQLite store</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {sqlite?.ready
                ? `Primary · ${sqlite.total ?? 0} records · JSON mirror ${sqlite.jsonMirror ? 'ON' : 'OFF'}`
                : (sqlite?.error
                  ? `Unavailable (${sqlite.error}). App still saves to data/*.json — no data loss.`
                  : 'Not ready — using JSON files in data/. Your invoices still save. Open terminal: node server.js from _system; if better-sqlite3 fails, run npm rebuild better-sqlite3.')}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={reimport}
            disabled={reimporting}
            title="Re-scan data/*.json into SQLite (requires SQLite module loaded on server)"
          >
            {reimporting ? 'Importing…' : 'Re-import from JSON'}
          </button>
        </div>

        {sqlite?.path && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, wordBreak: 'break-all' }}>
            {sqlite.path}
          </div>
        )}

        {countEntries.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
            {countEntries.map(([name, n]) => (
              <div key={name} style={{
                padding: '8px 10px', borderRadius: 8,
                background: 'var(--bg-muted, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
              }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{name}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{n}</div>
              </div>
            ))}
          </div>
        )}

        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          <strong>Re-import</strong> loads every <code>data/&lt;collection&gt;/*.json</code> into SQLite (same id overwrites).
          JSON files stay on disk while mirror is ON. For SQLite-only later, start the server with{' '}
          <code>SD_JSON_MIRROR=0</code>.
        </p>
      </div>

      <details style={{
        border: '1px solid var(--border, #e2e8f0)', borderRadius: 10,
        background: '#0f172a', color: '#e2e8f0', padding: 14,
      }}>
        <summary style={{ cursor: 'pointer', fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={14} /> Error log tail (optional — expand if debugging)
        </summary>
        <pre style={{
          margin: '10px 0 0', fontSize: 11, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 280, overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}>
          {(data?.errorsTail || '').trim() || '(no errors recorded)'}
        </pre>
      </details>
    </div>
  );
}
