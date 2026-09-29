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
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${t || ''}`.trim());
      }
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast(e?.message || 'Could not load activity logs — is node server.js running?', 'error');
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const exportCsv = () => {
    const cols = ['at', 'action', 'entityType', 'entityId', 'file'];
    const lines = [cols.join(',')].concat(
      rows.map(r => cols.map(c => {
        const s = r[c] == null ? '' : String(r[c]);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(','))
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'activity-log.csv';
    a.click();
  };

  return (
    <div>
      <PageHeader title="Activity log" subtitle="Server folder: data/activity-logs">
        <button type="button" className="btn btn-secondary" onClick={load}>Refresh</button>
        <button type="button" className="btn btn-primary" onClick={exportCsv} disabled={!rows.length}>Export CSV</button>
      </PageHeader>
      {loading && <p className="text-muted">Loading...</p>}
      {!loading && !rows.length && (
        <p className="text-muted">No entries yet. Save or edit an invoice, then click Refresh.</p>
      )}
      {!!rows.length && (
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr><th>When</th><th>Action</th><th>Type</th><th>Id</th><th>File</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.file || i}>
                <td>{r.at || '—'}</td>
                <td>{r.action || '—'}</td>
                <td>{r.entityType || '—'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.entityId || '—'}</td>
                <td className="text-muted" style={{ fontSize: 11 }}>{r.file || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
