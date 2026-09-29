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
  const type = String(row.entityType || 'record').replace(/^bill$/, 'invoice');
  const id = row.entityId || '';
  const who = row.user && row.user !== 'local' && row.user !== 'server' ? row.user : 'You';
  if (action === 'create') return `${who} created ${type} ${id}`;
  if (action === 'update' || action === 'save') return `${who} last edited ${type} ${id}`;
  if (action === 'delete' || action === 'soft_delete' || action === 'cancel') return `${who} cancelled ${type} ${id}`;
  if (action === 'open' || action === 'view') return `${who} opened ${type} ${id}`;
  return `${who} ${action || 'updated'} ${type} ${id}`.trim();
}

/** Collapse triple writes (invoice + bill + update) within 2s for same id */
function dedupeRows(rows) {
  const out = [];
  const seen = new Map();
  for (const r of rows) {
    const id = String(r.entityId || r.file || '');
    const t = new Date(r.at || 0).getTime();
    const key = id.replace(/^bill:/, '');
    const prev = seen.get(key);
    if (prev != null && Math.abs(t - prev) < 2000) {
      // Prefer update/edit phrase over duplicate create
      const last = out[out.length - 1];
      if (last && String(last.entityId) === id || String(last.entityId) === key) {
        if (String(r.action).toLowerCase() === 'update') out[out.length - 1] = r;
        continue;
      }
      continue;
    }
    seen.set(key, t);
    out.push(r);
  }
  return out;
}

export default function ActivityLogView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/activity-logs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast(e?.message || 'Could not load activity logs', 'error');
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = dedupeRows(rows);
    if (typeFilter !== 'all') {
      list = list.filter(r => String(r.entityType || '').toLowerCase().includes(typeFilter));
    }
    if (actionFilter !== 'all') {
      list = list.filter(r => String(r.action || '').toLowerCase() === actionFilter);
    }
    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      list = list.filter(r =>
        String(r.entityId || '').toLowerCase().includes(qq)
        || String(r.entityType || '').toLowerCase().includes(qq)
        || String(r.action || '').toLowerCase().includes(qq)
        || phraseFor(r).toLowerCase().includes(qq)
      );
    }
    return list;
  }, [rows, q, typeFilter, actionFilter]);

  const exportCsv = () => {
    const cols = ['at', 'phrase', 'action', 'entityType', 'entityId'];
    const lines = [cols.join(',')].concat(
      filtered.map(r => {
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
      <PageHeader title="Activity log" subtitle={`${filtered.length} events · files kept under data/activity-logs (last 500 loaded)`}>
        <button type="button" className="btn btn-secondary" onClick={load}>Refresh</button>
        <button type="button" className="btn btn-primary" onClick={exportCsv} disabled={!filtered.length}>Export CSV</button>
      </PageHeader>

      <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input className="search-input" style={{ minWidth: 200, flex: 1 }} placeholder="Search invoice #, type, action…"
          value={q} onChange={e => setQ(e.target.value)} />
        <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          <option value="invoice">Invoice</option>
          <option value="bill">Bill</option>
          <option value="expense">Expense</option>
          <option value="workorder">Work order</option>
          <option value="purchase">Purchase / PO</option>
        </select>
        <select className="filter-select" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          <option value="all">All actions</option>
          <option value="create">Created</option>
          <option value="update">Edited</option>
          <option value="save">Saved</option>
          <option value="soft_delete">Cancelled</option>
        </select>
      </div>

      {loading && <p className="text-muted">Loading...</p>}
      {!loading && !filtered.length && (
        <p className="text-muted">No matching activity. Save an invoice, then Refresh.</p>
      )}
      {!!filtered.length && (
        <div className="glass-panel" style={{ padding: '0.25rem 0.5rem' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {filtered.map((r, i) => (
              <li key={r.file || i} style={{
                display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start',
                padding: '0.7rem 0.5rem',
                borderBottom: i === filtered.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.06)',
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                    background: String(r.action).includes('delete') || r.action === 'cancel' ? '#dc2626'
                      : r.action === 'create' ? '#059669' : '#3b82f6',
                  }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{phraseFor(r)}</div>
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                      <span style={{
                        display: 'inline-block', padding: '1px 6px', borderRadius: 4, marginRight: 6,
                        background: 'rgba(59,130,246,0.1)', fontSize: 11,
                      }}>{r.entityType || 'record'}</span>
                      {r.diff?.status ? `Status: ${r.diff.status}` : ''}
                      {r.diff?.totalAmount != null ? ` · ₹${r.diff.totalAmount}` : ''}
                    </div>
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
