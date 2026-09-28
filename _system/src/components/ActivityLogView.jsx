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

  return (
    <div>
      <PageHeader title="Activity log" subtitle="Audit trail of invoice create/update/delete and other recorded changes (data/activity-logs)">
        <button type="button" className="btn btn-secondary" onClick={load}>Refresh</button>
      </PageHeader>
      {loading ? <p className="text-muted">Loading…</p> : null}
      {!loading && rows.length === 0 && (
        <p className="text-muted">No activity logged yet. Saving or deleting invoices writes entries here.</p>
      )}
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
    </div>
  );
}
