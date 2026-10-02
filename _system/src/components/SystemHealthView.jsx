import { useState, useEffect } from 'react';
import { Activity, RefreshCw, Server } from 'lucide-react';
import { toast } from './Toast';

export default function SystemHealthView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const uptime = data?.uptimeSec != null
    ? `${Math.floor(data.uptimeSec / 3600)}h ${Math.floor((data.uptimeSec % 3600) / 60)}m ${data.uptimeSec % 60}s`
    : '—';

  return (
    <div className="page" style={{ maxWidth: 900 }}>
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
            Live status from <code>/api/health</code>
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

      <div style={{
        border: '1px solid var(--border, #e2e8f0)', borderRadius: 10,
        background: '#0f172a', color: '#e2e8f0', padding: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: '#94a3b8' }}>
          <Activity size={14} /> Error log tail (last ~4KB)
        </div>
        <pre style={{
          margin: 0, fontSize: 11, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 360, overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}>
          {(data?.errorsTail || '').trim() || '(no errors recorded)'}
        </pre>
      </div>
    </div>
  );
}
