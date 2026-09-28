import { useState, useEffect } from 'react';
import PageHeader from './PageHeader';
import { toast } from './Toast';

export default function ActivityLogView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/activity-logs');
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      toast('Could not load activity logs', 'error');
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const exportCsv = () => {
    const cols = ['at', 'action', 'entityType', 'entityId', 'file'];
    const lines = [cols.join(',')].concat(
      (rows || []).map(r => cols.map(c => {
        const s = r[c] == null ? '' : String(r[c]);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','))
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'activity-log.csv';
    a.click();
    toast('Activity log exported', 'success');
  };

  return (
    <div>
      <PageHeader
        title="Activity log"
        subtitle="Invoice create / update / delete audit trail (stored in data/activity-logs on the server)"
      >
        <button type="button" className="btn btn-secondary" onClick={load}>Refresh</button>
        <button type="button" className="btn btn-primary" onClick={exportCsv} disabled={!rows.length}>Export CSV</button>
      </PageHeader>
      {loading && <p className="text-muted">Loading…</p>}
      {!loading && rows.length === 0 && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <p style={{ margin: 0 }}>No activity logged yet.</p>
          <p className="text-muted" style={{ marginTop: 8, fontSize: '0.9rem' }}>
            Create or save an invoice, then click <strong>Refresh</strong>. Logs are written under the app folder
            <code style={{ marginLeft: 4 }}>_system/data/activity-logs/</code>.
            If this stays empty after saves, restart the server after applying the latest server.js fix.
          </p>
        </div>
      )}
      {rows.length > 0 && (
        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Type</th>
                <th>Id</th>
                <th>File</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.file || i}>
                  <td className="text-muted" style={{ fontSize: '0.8rem' }}>{r.at || '—'}</td>
                  <td>{r.action || '—'}</td>
                  <td>{r.entityType || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.entityId || '—'}</td>
                  <td className="text-muted" style={{ fontSize: '0.75rem' }}>{r.file || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
