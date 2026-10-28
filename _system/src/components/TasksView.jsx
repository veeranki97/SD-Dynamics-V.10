import { useState, useEffect, useMemo } from 'react';
import { toast } from './Toast';
import {
  loadTasks,
  saveTasks,
  createSesFollowUpTask,
  createSesFollowUpFromBill,
  getSesReminderBuckets,
  daysRelativeToDue,
  snoozeSesTask,
  markSesDone,
  bumpRemindCount,
} from '../utils/sesTasks';

export { createSesFollowUpTask, createSesFollowUpFromBill };

/** Real Ariba SES reminders (due / overdue / snooze) + general tasks. */
export default function TasksView() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('priority');

  const refresh = () => setTasks(loadTasks());

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener('sd-tasks-changed', onChange);
    window.addEventListener('storage', onChange);
    const onCreate = (ev) => {
      const detail = ev.detail;
      // Already a saved task object (dispatched after create) — only refresh UI
      if (detail && (detail.type === 'ariba_ses' || String(detail.id || '').startsWith('task_ses_'))) {
        refresh();
        setFilter('ariba');
        toast('Ariba SES reminder: ' + (detail.invoiceNo || 'invoice') + (detail.due ? ' · due ' + detail.due : ''), 'success');
        return;
      }
      // Bill from action menu — force create (user clicked SES follow-up)
      const { skipped, task, reason } = createSesFollowUpFromBill(detail, { fromActionMenu: true, force: true });
      if (skipped && reason === 'duplicate') {
        toast('Open Ariba follow-up already exists for ' + (task?.invoiceNo || detail?.invoiceNumber || 'this invoice') + ' — shown under Ariba SES', 'info');
      } else if (skipped) {
        toast('Could not create SES follow-up' + (reason ? ' (' + reason + ')' : ''), 'warning');
      } else {
        toast('Ariba SES reminder set for ' + (task?.invoiceNo || 'invoice') + ' · due ' + (task?.due || ''), 'success');
      }
      refresh();
      setFilter('ariba');
    };
    window.addEventListener('sd-create-ses-task', onCreate);
    return () => {
      window.removeEventListener('sd-tasks-changed', onChange);
      window.removeEventListener('storage', onChange);
      window.removeEventListener('sd-create-ses-task', onCreate);
    };
  }, []);

  const buckets = useMemo(() => getSesReminderBuckets(tasks), [tasks]);

  const visible = useMemo(() => {
    let list = tasks || [];
    if (filter === 'open') list = list.filter((t) => !t.done);
    else if (filter === 'ariba') list = list.filter((t) => !t.done && (t.type === 'ariba_ses' || String(t.title || '').startsWith('Ariba:')));
    else if (filter === 'due-soon') list = list.filter((t) => !t.done && daysRelativeToDue(t.due) != null && daysRelativeToDue(t.due) >= -3 && daysRelativeToDue(t.due) <= 0);
    else if (filter === 'completed') list = list.filter((t) => !!t.done);
    else if (filter === 'overdue')
      list = list.filter((t) => {
        if (t.done) return false;
        const rel = daysRelativeToDue(t.due);
        return rel != null && rel > 0;
      });
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((t) => [t.title, t.invoiceNo, t.clientName, t.sesRef, t.type].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
    const urgency = (t) => { if (t.done) return 999999; const rel = daysRelativeToDue(t.due); return rel == null ? 99999 : rel > 0 ? -1000 - rel : rel === 0 ? -500 : Math.abs(rel); };
    return [...list].sort((a, b) => sortBy === 'newest' ? String(b.createdAt || '').localeCompare(String(a.createdAt || '')) : urgency(a) - urgency(b));
  }, [tasks, filter, search, sortBy]);

  const setDueOffset = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    setDue(local);
  };

  const add = () => {
    const t = title.trim();
    if (!t) {
      toast('Enter a task title', 'warning');
      return;
    }
    const next = [
      {
        id: 'task_' + Date.now(),
        title: t,
        due: due || '',
        done: false,
        type: 'general',
        createdAt: new Date().toISOString(),
      },
      ...tasks,
    ];
    setTasks(next);
    saveTasks(next);
    setTitle('');
    setDue('');
    toast('Task added', 'success');
  };

  const toggle = (id) => {
    const row = tasks.find((x) => x.id === id);
    if (row && row.type === 'ariba_ses' && !row.done) {
      markSesDone(id);
      toast('Marked done — SES→invoice uploaded in Ariba', 'success');
      refresh();
      return;
    }
    const next = tasks.map((x) =>
      x.id === id
        ? { ...x, done: !x.done, completedAt: !x.done ? new Date().toISOString() : undefined }
        : x
    );
    setTasks(next);
    saveTasks(next);
  };

  const remove = (id) => {
    const next = tasks.filter((x) => x.id !== id);
    setTasks(next);
    saveTasks(next);
  };

  const onSnooze = (id) => {
    snoozeSesTask(id, 3);
    toast('Snoozed +3 days', 'info');
    refresh();
  };

  const onRemindNow = (t) => {
    if (t.type === 'ariba_ses') bumpRemindCount(t.id);
    const rel = daysRelativeToDue(t.due);
    const status = rel == null ? (t.due ? 'due ' + t.due : 'no due date set') : rel > 0 ? rel + ' day(s) overdue' : rel === 0 ? 'due today' : 'due in ' + Math.abs(rel) + ' day(s)';
    const message = t.type === 'ariba_ses'
      ? 'Ariba SES: upload invoice ' + (t.invoiceNo || '') + ' (' + status + ')'
      : 'Task reminder: ' + t.title + ' (' + status + ')';
    toast(message, rel > 0 ? 'error' : 'warning', 8000);
    refresh();
  };

  const openCount = tasks.filter((t) => !t.done).length;
  const generalOpen = tasks.filter((t) => !t.done && t.type !== 'ariba_ses').length;
  const dueTodayCount = tasks.filter((t) => !t.done && daysRelativeToDue(t.due) === 0).length;
  const smartFocus = [...tasks].filter((t) => !t.done).sort((a, b) => {
    const rank = (t) => { const rel = daysRelativeToDue(t.due); return rel == null ? 99999 : rel > 0 ? -1000 - rel : rel === 0 ? -500 : Math.abs(rel); };
    return rank(a) - rank(b);
  })[0];
  const smartFocusReason = smartFocus ? (daysRelativeToDue(smartFocus.due) > 0 ? `${daysRelativeToDue(smartFocus.due)} day(s) overdue — prioritize this first.` : daysRelativeToDue(smartFocus.due) === 0 ? 'Due today — a good next action to clear.' : daysRelativeToDue(smartFocus.due) < 0 ? `Due in ${Math.abs(daysRelativeToDue(smartFocus.due))} day(s) — plan ahead.` : 'No due date — consider scheduling a follow-up.') : 'No open tasks. You are all caught up.';
  const aribaOpen = buckets.open.length;

  const dueBadge = (t) => {
    const rel = daysRelativeToDue(t.due);
    if (rel == null) return null;
    if (rel > 0)
      return (
        <span
          style={{
            fontSize: 11,
            padding: '2px 6px',
            background: '#fef2f2',
            color: '#b91c1c',
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          {rel}d overdue
        </span>
      );
    if (rel === 0)
      return (
        <span
          style={{
            fontSize: 11,
            padding: '2px 6px',
            background: '#fffbeb',
            color: '#b45309',
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          Due today
        </span>
      );
    return (
      <span style={{ fontSize: 11, color: '#64748b' }}>
        in {-rel}d
      </span>
    );
  };

  const dueSoonCount = tasks.filter((t) => !t.done && daysRelativeToDue(t.due) != null && daysRelativeToDue(t.due) <= 0 && daysRelativeToDue(t.due) >= -3).length;
  const completedCount = tasks.filter((t) => t.done).length;
  const completionRate = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="dashboard-container tasks-premium" style={{ width: '100%', maxWidth: 'none', boxSizing: 'border-box', padding: '0 4px 24px' }}>
      <style>{`
        .tasks-premium { --task-border: var(--border-color, #e5e7eb); --task-muted: var(--text-secondary, #64748b); }
        .tasks-premium .task-hero { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:18px; }
        .tasks-premium .task-kicker { color:var(--task-muted); font-size:12px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; margin-bottom:5px; }
        .tasks-premium .task-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:16px; }
        .tasks-premium .task-smart { display:flex; align-items:center; gap:14px; border:1px solid rgba(59,130,246,.2); border-radius:14px; padding:14px 16px; margin-bottom:14px; background:linear-gradient(115deg,rgba(59,130,246,.075),rgba(99,102,241,.035)); }
        .tasks-premium .task-smart-icon { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:rgba(59,130,246,.12); color:#2563eb; font-size:20px; flex:0 0 auto; }
        .tasks-premium .task-quickdates { display:flex; align-items:center; gap:5px; flex-wrap:nowrap; margin-top:8px; min-width:0; }
        .tasks-premium .task-quickdates .task-sub { flex:0 0 auto; white-space:nowrap; font-size:11px; }
        .tasks-premium .task-quickdates button { flex:0 0 auto; padding:5px 7px; }
        .tasks-premium .task-date-field { min-width:0; }
        .tasks-premium .task-date-field input { min-width:0; }
        .tasks-premium .task-quickdates button { border:1px solid var(--task-border); background:var(--card-bg,#fff); color:inherit; border-radius:7px; padding:5px 9px; font-size:11px; cursor:pointer; }
        .tasks-premium .task-quickdates button:hover { border-color:#60a5fa; background:rgba(59,130,246,.06); }
        .tasks-premium .task-sort { min-height:38px; border:1px solid var(--task-border); border-radius:9px; background:var(--card-bg,#fff); color:inherit; padding:0 9px; }
        .tasks-premium .task-metric { border:1px solid var(--task-border); border-radius:14px; padding:16px; background:var(--card-bg, var(--surface, #fff)); min-width:0; box-shadow:0 2px 8px rgba(15,23,42,.035); }
        .tasks-premium .task-metric-label { color:var(--task-muted); font-size:12px; font-weight:600; }
        .tasks-premium .task-metric-value { font-size:26px; font-weight:750; letter-spacing:-.04em; line-height:1.25; margin-top:7px; }
        .tasks-premium .task-toolbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .tasks-premium .task-search { flex:1 1 240px; min-width:180px; position:relative; }
        .tasks-premium .task-search input { width:100%; box-sizing:border-box; min-height:40px; padding:9px 12px 9px 36px; border:1px solid var(--task-border); border-radius:10px; background:var(--input-bg, var(--card-bg, #fff)); color:inherit; }
        .tasks-premium .task-search-icon { position:absolute; left:12px; top:10px; color:var(--task-muted); pointer-events:none; }
        .tasks-premium .task-create { display:grid; grid-template-columns:minmax(0,1fr) minmax(150px,170px) auto; gap:8px; align-items:center; min-width:0; }
        .tasks-premium .task-create > * { min-width:0; }
        .tasks-premium .task-create input { min-height:34px; box-sizing:border-box; width:100%; font-size:0.85rem; }
        .tasks-premium .task-create-panel { padding:10px 12px !important; margin-bottom:10px !important; }
        .tasks-premium .task-create-panel .task-create-head { margin-bottom:8px !important; }
        .tasks-premium .task-create-panel .task-create-head strong { font-size:13px; }
        .tasks-premium .task-quickdates { margin-top:4px !important; gap:3px !important; }
        .tasks-premium .task-quickdates button { padding:3px 6px !important; font-size:10px !important; border-radius:6px !important; }
        .tasks-premium .task-filter .btn { padding:4px 9px !important; font-size:11px !important; min-height:28px; line-height:1.2; border-radius:999px !important; }
        .tasks-premium .task-metrics { gap:8px !important; margin-bottom:10px !important; }
        .tasks-premium .task-metric { padding:10px 12px !important; border-radius:12px !important; }
        .tasks-premium .task-metric-value { font-size:20px !important; margin-top:4px !important; }
        .tasks-premium .task-metric-label { font-size:11px !important; }
        .tasks-premium .task-smart { padding:10px 12px !important; margin-bottom:10px !important; gap:10px !important; }
        .tasks-premium .task-smart-icon { width:32px !important; height:32px !important; font-size:16px !important; border-radius:10px !important; }
        .tasks-premium .task-hero { margin-bottom:10px !important; }
        .tasks-premium .task-toolbar { gap:8px !important; margin-bottom:8px !important; }
        .tasks-premium .task-search input { min-height:34px !important; padding:6px 10px 6px 32px !important; font-size:0.85rem; }
        .tasks-premium .task-sort { min-height:34px !important; font-size:12px; }
        .tasks-premium .task-table thead th { padding:8px 12px !important; }
        .tasks-premium .task-table tbody td { padding:9px 12px !important; }
        .tasks-premium .task-empty { padding:28px 12px !important; }
        .tasks-premium .task-filter { display:flex; gap:6px; flex-wrap:wrap; }
        .tasks-premium .task-filter .btn { border-radius:9px; }
        .tasks-premium .task-table-wrap { width:100%; overflow-x:auto; border:1px solid var(--task-border); border-radius:14px; background:var(--card-bg, var(--surface, #fff)); }
        .tasks-premium .task-table { min-width:760px; border-collapse:separate; border-spacing:0; }
        .tasks-premium .task-table thead th { position:sticky; top:0; z-index:1; background:var(--table-head-bg, #f8fafc); color:var(--task-muted); text-transform:uppercase; font-size:11px; letter-spacing:.055em; font-weight:700; padding:13px 14px; border-bottom:1px solid var(--task-border); }
        .tasks-premium .task-table tbody td { padding:13px 14px; border-bottom:1px solid var(--task-border); vertical-align:middle; }
        .tasks-premium .task-table tbody tr:last-child td { border-bottom:0; }
        .tasks-premium .task-table tbody tr:hover { background:var(--hover-bg, rgba(148,163,184,.07)); }
        .tasks-premium .task-name { font-weight:650; }
        .tasks-premium .task-sub { font-size:12px; color:var(--task-muted); margin-top:4px; }
        .tasks-premium .task-pill { display:inline-flex; align-items:center; gap:5px; padding:4px 8px; border-radius:999px; font-size:11px; font-weight:700; white-space:nowrap; }
        .tasks-premium .task-actions { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
        .tasks-premium .task-empty { padding:44px 16px; text-align:center; color:var(--task-muted); }
        .tasks-premium .task-empty strong { display:block; color:inherit; font-size:15px; margin-bottom:5px; }
        @media (max-width:1000px) { .tasks-premium .task-create { grid-template-columns:minmax(0,1fr) minmax(140px,160px) auto; } .tasks-premium .task-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media (max-width:600px) { .tasks-premium .task-create { grid-template-columns:minmax(0,1fr); } .tasks-premium .task-create > input { grid-column:auto; } .tasks-premium .task-create > button { width:100%; justify-self:stretch; } .tasks-premium .task-quickdates { flex-wrap:wrap; } .tasks-premium .task-metric { padding:12px; } .tasks-premium .task-metric-value { font-size:22px; } }
      `}</style>

      <div className="task-hero">
        <div>
          <div className="task-kicker">Work management</div>
          <h1 className="page-title" style={{ margin: '0 0 5px' }}>Tasks & reminders</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>One workspace for follow-ups, due dates and Ariba SES actions.</p>
        </div>
        <div className="task-toolbar" style={{ color: 'var(--task-muted, #64748b)', fontSize: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: '#16a34a' }} /> {openCount} active tasks</span>
          <span>·</span><span>{completionRate}% completed</span>
        </div>
      </div>

      <div className="task-smart">
        <div className="task-smart-icon">✦</div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 750, marginBottom: 3 }}>Smart focus <span className="task-pill" style={{ background: 'rgba(59,130,246,.12)', color: '#2563eb', marginLeft: 5 }}>Priority suggestion</span></div><div className="task-sub">{smartFocus ? <><strong style={{ color: 'inherit' }}>{smartFocus.title}</strong> — {smartFocusReason}</> : smartFocusReason}</div></div>
        {smartFocus && <button type="button" className="btn btn-sm btn-primary" onClick={() => { setFilter('open'); setSearch(smartFocus.invoiceNo || smartFocus.title); }}>Focus task</button>}
      </div>

      <div className="task-metrics">
        <div className="task-metric"><div className="task-metric-label">Open tasks</div><div className="task-metric-value">{openCount}</div><div className="task-sub">Items requiring action</div></div>
        <div className="task-metric"><div className="task-metric-label">Overdue</div><div className="task-metric-value" style={{ color: buckets.overdue.length ? '#dc2626' : 'inherit' }}>{buckets.overdue.length}</div><div className="task-sub">Past their due date</div></div>
        <div className="task-metric"><div className="task-metric-label">Due in 3 days</div><div className="task-metric-value" style={{ color: dueSoonCount ? '#b45309' : 'inherit' }}>{dueSoonCount}</div><div className="task-sub">Plan ahead before they slip</div></div>
        <div className="task-metric"><div className="task-metric-label">Ariba SES</div><div className="task-metric-value">{aribaOpen}</div><div className="task-sub">Invoice upload follow-ups</div></div>
      </div>

      {(buckets.overdue.length > 0 || buckets.dueToday.length > 0) && (
        <div className="glass-panel" style={{ padding: 16, marginBottom: 14, border: '1px solid rgba(220,38,38,.22)', borderLeft: '4px solid #dc2626', background: 'var(--card-bg, #fff)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}><span style={{ fontSize: 18 }}>⚠</span><div><strong>Needs attention</strong><div className="task-sub">Review overdue and due-today Ariba SES reminders.</div></div></div>
          <div style={{ display: 'grid', gap: 8 }}>
            {[...buckets.overdue, ...buckets.dueToday].map((t) => {
              const late = daysRelativeToDue(t.due) > 0;
              return <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', border: '1px solid var(--task-border, #e5e7eb)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ minWidth: 180, flex: '1 1 240px' }}><div className="task-name">{t.invoiceNo || t.title} <span className="task-pill" style={{ marginLeft: 5, background: late ? '#fef2f2' : '#fffbeb', color: late ? '#b91c1c' : '#92400e' }}>{late ? `${t._daysLate}d overdue` : 'Due today'}</span></div><div className="task-sub">{t.clientName || 'Ariba SES follow-up'} · Due {t.due || '—'}</div></div>
                <div className="task-actions"><button type="button" className="btn btn-sm btn-secondary" onClick={() => onRemindNow(t)}>Remind now</button>{late && <button type="button" className="btn btn-sm btn-secondary" onClick={() => onSnooze(t.id)}>Snooze 3d</button>}<button type="button" className="btn btn-sm btn-primary" onClick={() => toggle(t.id)}>Done</button></div>
              </div>;
            })}
          </div>
        </div>
      )}

      <div className="glass-panel task-create-panel">
        <div className="task-create-head" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 15 }}>＋</span><div><strong>Create a task</strong><div className="task-sub" style={{ marginTop: 1 }}>Optional due date · Enter to add</div></div></div>
        <div className="task-create">
          <input className="form-input" aria-label="Task title" placeholder="What needs to get done?" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <div className="task-date-field">
            <input className="form-input" aria-label="Task due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            <div className="task-quickdates">
              <button type="button" onClick={() => setDueOffset(0)}>Today</button>
              <button type="button" onClick={() => setDueOffset(1)}>Tomorrow</button>
              <button type="button" onClick={() => setDueOffset(3)}>+3d</button>
              <button type="button" onClick={() => setDue('')}>Clear</button>
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={add} style={{ minHeight: 34, padding: '0 14px', whiteSpace: 'nowrap' }}>＋ Add</button>
        </div>
      </div>

      <div className="task-toolbar" style={{ marginBottom: 10 }}>
        <div className="task-search"><span className="task-search-icon">⌕</span><input aria-label="Search tasks" placeholder="Search task, invoice, client or SES reference…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select className="task-sort" aria-label="Sort tasks" value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="priority">Sort: Priority</option><option value="newest">Sort: Newest</option></select>
        <div className="task-filter">
          {[
            { id: 'open', label: 'Open', count: openCount },
            { id: 'overdue', label: 'Overdue', count: buckets.overdue.length },
            { id: 'due-soon', label: 'Due soon', count: dueSoonCount },
            { id: 'ariba', label: 'Ariba SES', count: aribaOpen },
            { id: 'completed', label: 'Completed', count: completedCount },
            { id: 'all', label: 'All', count: tasks.length },
          ].map((f) => <button key={f.id} type="button" className={'btn btn-sm ' + (filter === f.id ? 'btn-primary' : 'btn-secondary')} onClick={() => setFilter(f.id)}>{f.label} <span style={{ opacity: .75, marginLeft: 3 }}>{f.count}</span></button>)}
        </div>
      </div>

      <div className="task-table-wrap">
        <table className="data-table task-table" style={{ width: '100%' }}>
          <thead><tr><th style={{ width: 48 }}>Done</th><th>Task / reference</th><th style={{ width: 145 }}>Due date</th><th style={{ width: 115 }}>Category</th><th style={{ width: 220, textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {visible.map((t) => {
              const rel = daysRelativeToDue(t.due);
              const isLate = !t.done && rel != null && rel > 0;
              return <tr key={t.id} style={t.done ? { opacity: .62 } : isLate ? { background: 'rgba(254,226,226,.25)' } : undefined}>
                <td><input type="checkbox" checked={!!t.done} onChange={() => toggle(t.id)} aria-label={`Mark ${t.title} complete`} title={t.type === 'ariba_ses' ? 'Mark done after uploading the invoice in Ariba' : 'Mark task complete'} /></td>
                <td><div className="task-name" style={t.done ? { textDecoration: 'line-through' } : undefined}>{t.title}</div>{(t.invoiceNo || t.sesRef || t.clientName) && <div className="task-sub">{t.invoiceNo ? `Invoice ${t.invoiceNo}` : ''}{t.clientName ? ` · ${t.clientName}` : ''}{t.sesRef ? ` · SES ${t.sesRef}` : ''}{t.remindCount ? ` · reminded ${t.remindCount}×` : ''}</div>}</td>
                <td><div style={{ fontWeight: 600 }}>{t.due || 'No due date'}</div>{!t.done && dueBadge(t)}</td>
                <td><span className="task-pill" style={t.type === 'ariba_ses' ? { background: '#e0f2fe', color: '#0369a1' } : { background: '#f1f5f9', color: '#475569' }}>{t.type === 'ariba_ses' ? 'Ariba SES' : 'General'}</span></td>
                <td><div className="task-actions">{!t.done && <button type="button" className="btn btn-sm btn-secondary" onClick={() => onRemindNow(t)} title="Show a reminder toast">Remind</button>}{!t.done && <button type="button" className="btn btn-sm btn-secondary" onClick={() => onSnooze(t.id)} title="Move this task due date by three days">Snooze +3d</button>}<button type="button" className="btn btn-sm btn-secondary" onClick={() => remove(t.id)} title="Delete task">Delete</button></div></td>
              </tr>;
            })}
            {!visible.length && <tr><td colSpan={5}><div className="task-empty"><strong>{search ? 'No tasks match your search' : filter === 'ariba' || filter === 'overdue' || filter === 'due-soon' ? 'You’re all caught up' : 'Your task workspace is clear'}</strong><span>{search ? 'Try a different keyword or clear the search.' : 'Tasks created from invoices and your own follow-ups will appear here.'}</span>{search && <button type="button" className="btn btn-sm btn-secondary" style={{ marginTop: 12 }} onClick={() => setSearch('')}>Clear search</button>}</div></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="task-sub" style={{ marginTop: 10 }}>Smart focus uses due dates to suggest a next action; it is a local rule-based helper, not an external AI model. Remind now shows an in-app toast. For persistent background notifications while the app is closed, a notification service or scheduler is still required.</div>
    </div>
  );
}
