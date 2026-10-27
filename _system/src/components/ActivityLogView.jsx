import { useState, useEffect, useMemo, useCallback } from 'react';
import PageHeader from './PageHeader';
import { toast } from './Toast';

const panelStyle = {
  background: 'var(--surface, var(--card-bg, #fff))',
  border: '1px solid var(--border-color, rgba(100,116,139,.18))',
  borderRadius: 14,
  boxShadow: '0 4px 18px rgba(15, 23, 42, 0.035)',
};

const mutedStyle = { color: 'var(--text-muted, #64748b)' };

function relativeTime(iso) {
  if (!iso) return 'Time unavailable';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return String(iso);
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 45) return 'Just now';
  if (sec < 90) return '1 minute ago';
  if (sec < 3600) return `${Math.floor(sec / 60)} minutes ago`;
  if (sec < 5400) return '1 hour ago';
  if (sec < 86400) return `${Math.floor(sec / 3600)} hours ago`;
  if (sec < 172800) return 'Yesterday';
  if (sec < 86400 * 30) return `${Math.floor(sec / 86400)} days ago`;
  return new Date(iso).toLocaleString('en-IN');
}

function absoluteTime(iso) {
  if (!iso) return 'Timestamp unavailable';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? String(iso) : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
    : String(value ?? '');
}

function normalizedAction(row) {
  const action = String(row?.action || '').toLowerCase();
  const diffStatus = String(row?.diff?.status || '').toLowerCase();
  if (['cancel', 'delete', 'soft_delete'].includes(action)) return 'cancel';
  if (['payment', 'payment_partial', 'record_payment', 'payment_paid', 'mark_paid', 'status_paid'].includes(action)) return 'payment';
  if (action === 'status_partial' || action === 'status_unpaid') return 'status';
  if (action === 'create') return 'create';
  if (['update', 'save'].includes(action)) {
    if (row?.diff?.paidAmount != null || row?.diff?.payments != null || ['paid', 'partial'].includes(diffStatus)) return 'payment';
    return 'update';
  }
  if (['open', 'view'].includes(action)) return 'view';
  return action || 'other';
}

function actionLabel(row) {
  const category = normalizedAction(row);
  const labels = {
    create: 'Created', update: 'Edited', payment: 'Payment', status: 'Status change',
    cancel: 'Cancelled', view: 'Viewed', other: 'Activity',
  };
  return labels[category] || category.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function actionTone(row) {
  const category = normalizedAction(row);
  if (category === 'create') return { color: '#047857', background: 'rgba(16,185,129,.12)', icon: '+' };
  if (category === 'payment') return { color: '#0369a1', background: 'rgba(14,165,233,.12)', icon: '₹' };
  if (category === 'cancel') return { color: '#b91c1c', background: 'rgba(239,68,68,.11)', icon: '!' };
  if (category === 'update') return { color: '#6d28d9', background: 'rgba(139,92,246,.12)', icon: '✎' };
  if (category === 'status') return { color: '#a16207', background: 'rgba(234,179,8,.15)', icon: '↻' };
  return { color: '#475569', background: 'rgba(100,116,139,.12)', icon: '•' };
}

function phraseFor(row) {
  const action = String(row.action || '').toLowerCase();
  const type = String(row.entityType || 'record').replace(/^bill$/i, 'invoice');
  const id = row.entityId || '';
  const who = row.user && row.user !== 'local' && row.user !== 'server' ? row.user : 'You';
  const diff = row.diff || {};
  const amt = diff.amount != null ? Number(diff.amount) : null;
  const amtStr = amt != null && Number.isFinite(amt) ? ` ${formatMoney(amt)}` : '';
  const reference = `${type}${id ? ` ${id}` : ''}`;

  if (action === 'create') return `${who} created ${reference}`;
  if (action === 'payment_paid' || action === 'mark_paid' || (action === 'payment' && String(diff.status || '').toLowerCase() === 'paid')) {
    return `${who} recorded payment${amtStr} and marked ${reference} paid`;
  }
  if (action === 'payment' || action === 'payment_partial' || action === 'record_payment') return `${who} recorded payment${amtStr} on ${reference}`;
  if (action === 'status_paid') return `${who} marked ${reference} paid`;
  if (action === 'status_partial') return `${who} marked ${reference} partially paid`;
  if (action === 'status_unpaid') return `${who} marked ${reference} unpaid`;
  if (action === 'cancel' || action === 'delete' || action === 'soft_delete') return `${who} cancelled ${reference}`;
  if (action === 'open' || action === 'view') return `${who} opened ${reference}`;
  if ((action === 'update' || action === 'save') && (diff.paidAmount != null || diff.payments != null) && diff.status) {
    const status = String(diff.status).toLowerCase();
    if (status === 'paid') return `${who} recorded payment${amtStr} and marked ${reference} paid`;
    if (status === 'partial') return `${who} recorded payment${amtStr} on ${reference}`;
  }
  if (action === 'update' || action === 'save') return `${who} edited ${reference}`;
  return `${who} ${action.replace(/[_-]+/g, ' ') || 'updated'} ${reference}`.trim();
}

/** Collapse closely spaced duplicate writes for the same entity, retaining distinct events. */
function dedupeRows(rows) {
  const sorted = [...rows].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
  const out = [];
  const seen = new Map();
  for (const row of sorted) {
    const id = String(row.entityId || row.file || '');
    const time = new Date(row.at || 0).getTime();
    const entityKey = id.replace(/^bill:/, '');
    const action = String(row.action || '').toLowerCase();
    const key = `${entityKey}|${action}`;
    const previous = seen.get(key);
    if (entityKey && previous != null && Number.isFinite(time) && Math.abs(time - previous) < 2000) continue;
    if (entityKey && Number.isFinite(time)) seen.set(key, time);
    out.push(row);
  }
  return out;
}

function csvCell(value) {
  let text = String(value ?? '');
  // Prevent spreadsheet formula execution in exported text cells.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function SummaryCard({ label, value, hint, accent, symbol }) {
  return (
    <div style={{ ...panelStyle, padding: '16px 18px', minWidth: 0, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...mutedStyle, fontSize: 12, fontWeight: 650, letterSpacing: '.035em', textTransform: 'uppercase' }}>{label}</div>
          <div style={{ fontSize: 27, lineHeight: 1.2, fontWeight: 750, letterSpacing: '-.04em', marginTop: 7, color: 'var(--text-primary, inherit)' }}>{value}</div>
          <div style={{ ...mutedStyle, fontSize: 12, marginTop: 5 }}>{hint}</div>
        </div>
        <div aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 12, color: accent, background: `${accent}18`, fontSize: 20, fontWeight: 750, flexShrink: 0 }}>{symbol}</div>
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', height: 3, left: 0, right: 0, bottom: 0, background: accent, opacity: .75 }} />
    </div>
  );
}

export default function ActivityLogView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/activity-logs');
      if (!res.ok) throw new Error(`Unable to load activity logs (HTTP ${res.status})`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Activity log response was not in the expected format');
      setRows(data);
    } catch (error) {
      const message = error?.message || 'Could not load activity logs';
      setLoadError(message);
      toast(message, 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const uniqueUsers = useMemo(() => [...new Set(rows.map(row => row.user).filter(user => user && user !== 'local' && user !== 'server'))].sort((a, b) => String(a).localeCompare(String(b))), [rows]);

  const baseRows = useMemo(() => dedupeRows(rows), [rows]);
  const filtered = useMemo(() => {
    let list = baseRows;
    if (typeFilter !== 'all') {
      list = list.filter(row => {
        const type = String(row.entityType || '').toLowerCase();
        if (typeFilter === 'purchase') return type.includes('purchase') || type.includes('po');
        if (typeFilter === 'invoice') return type.includes('invoice') || type === 'bill';
        return type.includes(typeFilter);
      });
    }
    if (actionFilter !== 'all') list = list.filter(row => normalizedAction(row) === actionFilter);
    if (userFilter !== 'all') list = list.filter(row => String(row.user || 'unknown') === userFilter);
    if (fromDate) {
      const start = new Date(`${fromDate}T00:00:00`).getTime();
      list = list.filter(row => { const time = new Date(row.at || 0).getTime(); return Number.isFinite(time) && time >= start; });
    }
    if (toDate) {
      const end = new Date(`${toDate}T23:59:59.999`).getTime();
      list = list.filter(row => { const time = new Date(row.at || 0).getTime(); return Number.isFinite(time) && time <= end; });
    }
    if (q.trim()) {
      const query = q.trim().toLowerCase();
      list = list.filter(row => [row.entityId, row.file, row.entityType, row.action, row.user, phraseFor(row), row.diff?.status]
        .some(value => String(value ?? '').toLowerCase().includes(query)));
    }
    return [...list].sort((a, b) => {
      const difference = new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime();
      return sortOrder === 'oldest' ? difference : -difference;
    });
  }, [baseRows, q, typeFilter, actionFilter, userFilter, fromDate, toDate, sortOrder]);

  const summary = useMemo(() => ({
    total: filtered.length,
    created: filtered.filter(row => normalizedAction(row) === 'create').length,
    edited: filtered.filter(row => normalizedAction(row) === 'update').length,
    payments: filtered.filter(row => normalizedAction(row) === 'payment').length,
    cancelled: filtered.filter(row => normalizedAction(row) === 'cancel').length,
  }), [filtered]);

  const clearFilters = () => {
    setQ(''); setTypeFilter('all'); setActionFilter('all'); setUserFilter('all');
    setFromDate(''); setToDate(''); setSortOrder('newest');
  };

  const exportCsv = () => {
    if (!filtered.length) return;
    const cols = ['timestamp', 'event', 'user', 'action', 'entityType', 'entityId', 'status', 'amount'];
    const lines = [cols.map(csvCell).join(',')].concat(filtered.map(row => {
      const values = {
        timestamp: absoluteTime(row.at), event: phraseFor(row), user: row.user || 'Not recorded',
        action: actionLabel(row), entityType: row.entityType || 'record', entityId: row.entityId || row.file || '',
        status: row.diff?.status ?? '', amount: row.diff?.amount ?? row.diff?.totalAmount ?? '',
      };
      return cols.map(column => csvCell(values[column])).join(',');
    }));
    const blobUrl = URL.createObjectURL(new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = 'sd-dynamics-activity-log.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  const hasFilters = Boolean(q || typeFilter !== 'all' || actionFilter !== 'all' || userFilter !== 'all' || fromDate || toDate);

  return (
    <div style={{ display: 'grid', gap: 16, paddingBottom: 20 }}>
      <PageHeader title="Activity & Audit Centre" subtitle="A clear timeline of activity across your business records. Review changes, trace financial actions and export the current view.">
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading} title="Reload activity records">
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
        <button type="button" className="btn btn-primary" onClick={exportCsv} disabled={!filtered.length || loading}>
          ↓ Export CSV ({filtered.length})
        </button>
      </PageHeader>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 12 }}>
        <SummaryCard label="Visible events" value={summary.total.toLocaleString('en-IN')} hint="Matches current filters" accent="#2563eb" symbol="≋" />
        <SummaryCard label="Created" value={summary.created.toLocaleString('en-IN')} hint="New records" accent="#059669" symbol="+" />
        <SummaryCard label="Edited" value={summary.edited.toLocaleString('en-IN')} hint="Record changes" accent="#7c3aed" symbol="✎" />
        <SummaryCard label="Payments" value={summary.payments.toLocaleString('en-IN')} hint="Payment-related events" accent="#0284c7" symbol="₹" />
        <SummaryCard label="Cancelled" value={summary.cancelled.toLocaleString('en-IN')} hint="Cancellation/deletion actions" accent="#dc2626" symbol="!" />
      </div>

      <section style={{ ...panelStyle, padding: 16 }} aria-label="Activity filters">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 750 }}>Find an event</div>
            <div style={{ ...mutedStyle, fontSize: 12, marginTop: 3 }}>Search by document, action or user, then narrow the results.</div>
          </div>
          {hasFilters && <button type="button" className="btn btn-secondary" onClick={clearFilters}>Clear filters</button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 10 }}>
          <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 650, ...mutedStyle }}>Search</span>
            <input className="search-input" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} placeholder="Document, user, action…" value={q} onChange={event => setQ(event.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 650, ...mutedStyle }}>Record type</span>
            <select className="filter-select" style={{ width: '100%', minWidth: 0 }} value={typeFilter} onChange={event => setTypeFilter(event.target.value)}>
              <option value="all">All record types</option><option value="invoice">Invoices / bills</option><option value="expense">Expenses</option><option value="workorder">Work orders</option><option value="purchase">Purchases / POs</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 650, ...mutedStyle }}>Action</span>
            <select className="filter-select" style={{ width: '100%', minWidth: 0 }} value={actionFilter} onChange={event => setActionFilter(event.target.value)}>
              <option value="all">All actions</option><option value="create">Created</option><option value="update">Edited</option><option value="payment">Payments</option><option value="status">Status changes</option><option value="cancel">Cancelled / deleted</option><option value="view">Viewed</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 650, ...mutedStyle }}>User</span>
            <select className="filter-select" style={{ width: '100%', minWidth: 0 }} value={userFilter} onChange={event => setUserFilter(event.target.value)}>
              <option value="all">All users</option>{uniqueUsers.map(user => <option key={user} value={user}>{user}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 650, ...mutedStyle }}>From date</span>
            <input type="date" className="filter-select" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} value={fromDate} max={toDate || undefined} onChange={event => setFromDate(event.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 650, ...mutedStyle }}>To date</span>
            <input type="date" className="filter-select" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} value={toDate} min={fromDate || undefined} onChange={event => setToDate(event.target.value)} />
          </label>
        </div>
      </section>

      <section style={{ ...panelStyle, overflow: 'hidden' }} aria-label="Activity timeline">
        <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--border-color, rgba(100,116,139,.16))' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 750 }}>Recent activity</div>
            <div style={{ ...mutedStyle, fontSize: 12, marginTop: 3 }}>{loading ? 'Updating records…' : `${filtered.length.toLocaleString('en-IN')} events shown · ${rows.length.toLocaleString('en-IN')} records loaded`}</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 650, ...mutedStyle }}>
            Sort
            <select className="filter-select" value={sortOrder} onChange={event => setSortOrder(event.target.value)} aria-label="Sort activity">
              <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>

        {loading && !rows.length ? (
          <div role="status" style={{ padding: 40, textAlign: 'center' }}><div style={{ fontSize: 24, marginBottom: 8 }}>◌</div><div style={{ fontWeight: 700 }}>Loading activity</div><div style={{ ...mutedStyle, fontSize: 13, marginTop: 4 }}>Fetching the latest available events…</div></div>
        ) : loadError && !rows.length ? (
          <div role="alert" style={{ padding: 28, textAlign: 'center' }}><div style={{ fontWeight: 750 }}>Activity could not be loaded</div><div style={{ ...mutedStyle, fontSize: 13, margin: '6px 0 14px' }}>{loadError}</div><button type="button" className="btn btn-primary" onClick={load}>Try again</button></div>
        ) : !filtered.length ? (
          <div style={{ padding: '38px 20px', textAlign: 'center' }}>
            <div aria-hidden="true" style={{ margin: '0 auto 12px', display: 'grid', placeItems: 'center', width: 52, height: 52, borderRadius: 16, background: 'rgba(100,116,139,.10)', fontSize: 25 }}>⌕</div>
            <div style={{ fontWeight: 750, fontSize: 15 }}>{rows.length ? 'No matching activity' : 'No activity records yet'}</div>
            <div style={{ ...mutedStyle, fontSize: 13, maxWidth: 420, margin: '6px auto 14px' }}>{rows.length ? 'Try changing your search or filters to see more events.' : 'When supported business actions are recorded, they will appear here.'}</div>
            {hasFilters && <button type="button" className="btn btn-secondary" onClick={clearFilters}>Clear all filters</button>}
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {filtered.map((row, index) => {
              const tone = actionTone(row);
              const isExpanded = Boolean(expanded[row.file || `${row.entityId || 'event'}-${row.at || index}`]);
              const rowKey = row.file || `${row.entityId || 'event'}-${row.at || index}`;
              const details = row.diff && typeof row.diff === 'object' ? Object.entries(row.diff).filter(([, value]) => value != null && typeof value !== 'object') : [];
              return (
                <li key={rowKey} style={{ padding: '15px 18px', borderBottom: index === filtered.length - 1 ? 'none' : '1px solid var(--border-color, rgba(100,116,139,.12))' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, flexShrink: 0, borderRadius: 11, color: tone.color, background: tone.background, fontWeight: 800, fontSize: 16 }}>{tone.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ fontWeight: 650, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{phraseFor(row)}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 7 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 6, color: tone.color, background: tone.background, fontSize: 11, fontWeight: 750 }}>{actionLabel(row)}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 6, color: 'var(--text-muted, #64748b)', background: 'rgba(100,116,139,.09)', fontSize: 11, fontWeight: 650 }}>{row.entityType || 'Record'}</span>
                            {row.diff?.status != null && <span style={{ fontSize: 12, ...mutedStyle }}>Status: <strong style={{ color: 'var(--text-primary, inherit)' }}>{String(row.diff.status)}</strong></span>}
                            {(row.diff?.amount != null || row.diff?.totalAmount != null) && <span style={{ fontSize: 12, fontWeight: 750 }}>{formatMoney(row.diff.amount ?? row.diff.totalAmount)}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 105 }}>
                          <div title={absoluteTime(row.at)} style={{ fontSize: 12, fontWeight: 700 }}>{relativeTime(row.at)}</div>
                          <div style={{ ...mutedStyle, fontSize: 11, marginTop: 3 }}>{row.at ? new Date(row.at).toLocaleDateString('en-IN') : 'Date unavailable'}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 9 }}>
                        <div style={{ ...mutedStyle, fontSize: 12 }}>User: <strong style={{ color: 'var(--text-primary, inherit)', fontWeight: 650 }}>{row.user && row.user !== 'local' && row.user !== 'server' ? row.user : 'Not recorded'}</strong>{row.entityId ? <span> · Ref: <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{row.entityId}</span></span> : null}</div>
                        {(details.length > 0 || row.file) && <button type="button" className="btn btn-secondary" style={{ padding: '4px 9px', fontSize: 11 }} aria-expanded={isExpanded} onClick={() => setExpanded(previous => ({ ...previous, [rowKey]: !previous[rowKey] }))}>{isExpanded ? 'Hide details −' : 'View details +'}</button>}
                      </div>
                      {isExpanded && <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'var(--subtle-bg, rgba(100,116,139,.07))', border: '1px solid var(--border-color, rgba(100,116,139,.15))' }}>
                        <div style={{ fontSize: 12, fontWeight: 750, marginBottom: 8 }}>Event details</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                          <div><div style={{ ...mutedStyle, fontSize: 11 }}>Exact timestamp</div><div style={{ fontSize: 12, marginTop: 3 }}>{absoluteTime(row.at)}</div></div>
                          <div><div style={{ ...mutedStyle, fontSize: 11 }}>Action code</div><div style={{ fontSize: 12, marginTop: 3, overflowWrap: 'anywhere' }}>{row.action || 'Not recorded'}</div></div>
                          {row.file && <div><div style={{ ...mutedStyle, fontSize: 11 }}>Log reference</div><div style={{ fontSize: 12, marginTop: 3, overflowWrap: 'anywhere' }}>{row.file}</div></div>}
                          {details.map(([key, value]) => <div key={key}><div style={{ ...mutedStyle, fontSize: 11 }}>{key.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase())}</div><div style={{ fontSize: 12, marginTop: 3, overflowWrap: 'anywhere' }}>{typeof value === 'number' && /amount|total|paid/i.test(key) ? formatMoney(value) : String(value)}</div></div>)}
                        </div>
                      </div>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border-color, rgba(100,116,139,.12))', ...mutedStyle, fontSize: 11 }}>
          Activity shown is limited to records returned by the current API (up to the server's configured limit). Summary counts reflect the current filtered view; event details are limited to fields actually recorded.
        </div>
      </section>
    </div>
  );
}
