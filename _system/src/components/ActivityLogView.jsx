import { useState, useEffect, useMemo } from 'react';
import PageHeader from './PageHeader';
import { toast } from './Toast';

function relativeTime(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return String(iso);
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 45) return 'just now';
  if (sec < 90) return '1 minute ago';
  if (sec < 3600) return Math.floor(sec / 60) + ' minutes ago';
  if (sec < 5400) return '1 hour ago';
  if (sec < 86400) return Math.floor(sec / 3600) + ' hours ago';
  if (sec < 172800) return 'yesterday';
  if (sec < 86400 * 30) return Math.floor(sec / 86400) + ' days ago';
  return new Date(iso).toLocaleString('en-IN');
}

function phraseFor(row) {
  const action = String(row.action || '').toLowerCase();
  const type = String(row.entityType || 'record');
  const id = row.entityId || '';
  const who = row.user && row.user !== 'local' && row.user !== 'server' ? row.user : 'You';
  if (action === 'create' || action === 'save' && !row.diff) return `${who} created ${type} ${id}`;
  if (action === 'create') return `${who} created ${type} ${id}`;
  if (action === 'update' || action === 'save') return `${who} last edited ${type} ${id}`;
  if (action === 'delete' || action === 'soft_delete' || action === 'cancel') return `${who} cancelled ${type} ${id}`;
  if (action === 'open' || action === 'view') return `${who} opened ${type} ${id}`;
  return `${who} ${action || 'updated'} ${type} ${id}`.trim();
}

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
    const cols = ['at', 'phrase', 'action', 'entityType', 'entityId', 'file'];
    const lines = [cols.join(',')].concat(
      rows.map(r => {
        const phrase = phraseFor(r) + ' · ' + relativeTime(r.at);
        return cols.map(c => {
          const s = c === 'phrase' ? phrase : (r[c] == null ? '' : String(r[c]));
          return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(',');
      })
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'activity-log.csv';
    a.click();
  };

  return (
    <div>
      <PageHeader title="Activity log" subtitle="Recent changes across invoices, expenses, WO/PO">
        <button type="button" className="btn btn-secondary" onClick={load}>Refresh</button>
        <button type="button" className="btn btn-primary" onClick={exportCsv} disabled={!rows.length}>Export CSV</button>
      </PageHeader>
      {loading && <p className="text-muted">Loading...</p>}
      {!loading && !rows.length && (
        <p className="text-muted">No entries yet. Save or edit an invoice, then click Refresh.</p>
      )}
      {!!rows.length && (
        <div className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {rows.map((r, i) => (
              <li key={r.file || i} style={{
                display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline',
                padding: '0.65rem 0', borderBottom: i === rows.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.06)',
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{phraseFor(r)}</div>
                  <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {r.entityType || 'record'} · {r.action || 'event'}
                    {r.diff?.totalAmount != null ? ` · ₹${r.diff.totalAmount}` : ''}
                    {r.diff?.status ? ` · ${r.diff.status}` : ''}
                  </div>
                </div>
                <div className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }} title={r.at || ''}>
                  {relativeTime(r.at)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
