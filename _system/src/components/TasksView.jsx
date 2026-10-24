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

  const refresh = () => setTasks(loadTasks());

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener('sd-tasks-changed', onChange);
    window.addEventListener('storage', onChange);
    const onCreate = (ev) => {
      const bill = ev.detail;
      const { skipped, task } = createSesFollowUpFromBill(bill);
      if (skipped) toast('Open Ariba follow-up already exists for this invoice', 'info');
      else toast('Ariba SES reminder set for ' + (task?.invoiceNo || 'invoice') + ' · due ' + (task?.due || ''), 'success');
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
    else if (filter === 'ariba') list = list.filter((t) => t.type === 'ariba_ses' && !t.done);
    else if (filter === 'overdue')
      list = list.filter((t) => {
        if (t.done) return false;
        const rel = daysRelativeToDue(t.due);
        return rel != null && rel > 0;
      });
    return list;
  }, [tasks, filter]);

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
    bumpRemindCount(t.id);
    const rel = daysRelativeToDue(t.due);
    const status =
      rel > 0 ? rel + ' day(s) OVERDUE' : rel === 0 ? 'DUE TODAY' : 'due ' + (t.due || '');
    toast(
      'Reminder: upload invoice ' + (t.invoiceNo || '') + ' in Ariba (' + status + ')',
      rel > 0 ? 'error' : 'warning',
      8000
    );
    refresh();
  };

  const openCount = tasks.filter((t) => !t.done).length;
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

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">
            Reminders · {openCount} open
            {aribaOpen ? ' · ' + aribaOpen + ' Ariba SES' : ''}
            {buckets.overdue.length
              ? ' · ' + buckets.overdue.length + ' overdue'
              : ''}
          </p>
        </div>
      </div>

      {(buckets.overdue.length > 0 || buckets.dueToday.length > 0) && (
        <div
          className="glass-panel"
          style={{
            padding: 12,
            marginBottom: 12,
            borderLeft: '4px solid #dc2626',
            background: 'rgba(254, 242, 242, 0.6)',
            fontSize: 13,
          }}
        >
          <strong>Ariba SES action needed</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {buckets.overdue.map((t) => (
              <li key={t.id} style={{ marginBottom: 4 }}>
                <strong>{t.invoiceNo}</strong> ({t.clientName || '—'}) —{' '}
                {t._daysLate}d overdue · due {t.due}
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  style={{ marginLeft: 8 }}
                  onClick={() => onRemindNow(t)}
                >
                  Remind
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  style={{ marginLeft: 4 }}
                  onClick={() => onSnooze(t.id)}
                >
                  +3d
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  style={{ marginLeft: 4 }}
                  onClick={() => toggle(t.id)}
                >
                  Done
                </button>
              </li>
            ))}
            {buckets.dueToday.map((t) => (
              <li key={t.id} style={{ marginBottom: 4 }}>
                <strong>{t.invoiceNo}</strong> ({t.clientName || '—'}) — due today
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  style={{ marginLeft: 8 }}
                  onClick={() => onRemindNow(t)}
                >
                  Remind
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  style={{ marginLeft: 4 }}
                  onClick={() => toggle(t.id)}
                >
                  Done
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="glass-panel" style={{ padding: 12, marginBottom: 12, fontSize: 13 }}>
        <strong>How it works:</strong> Invoices → ⋮ → <em>Ariba SES follow-up</em> creates a
        dated reminder (default +3 days). Overdue items appear in the red banner above, in the
        app <strong>Notifications</strong> bell, and once per day as a toast. Mark <strong>Done</strong> after
        the invoice is uploaded in Ariba, or <strong>+3d</strong> to snooze.
      </div>

      <div className="glass-panel" style={{ padding: 16, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          className="form-input"
          style={{ flex: 1, minWidth: 180 }}
          placeholder="General task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <input className="form-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <button type="button" className="btn btn-primary" onClick={add}>
          Add
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {[
          { id: 'open', label: 'Open' },
          { id: 'overdue', label: 'Overdue' },
          { id: 'ariba', label: 'Ariba SES' },
          { id: 'all', label: 'All' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            className={'btn btn-sm ' + (filter === f.id ? 'btn-primary' : 'btn-secondary')}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            {f.id === 'overdue' && buckets.overdue.length
              ? ' (' + buckets.overdue.length + ')'
              : ''}
          </button>
        ))}
      </div>

      <div className="glass-panel" style={{ padding: 0 }}>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Task</th>
              <th style={{ width: 120 }}>Due</th>
              <th style={{ width: 90 }}>Type</th>
              <th style={{ width: 200 }}></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr
                key={t.id}
                style={
                  t.done
                    ? { opacity: 0.55 }
                    : daysRelativeToDue(t.due) > 0
                      ? { background: 'rgba(254, 226, 226, 0.35)' }
                      : undefined
                }
              >
                <td>
                  <input
                    type="checkbox"
                    checked={!!t.done}
                    onChange={() => toggle(t.id)}
                    title="Mark done when completed in Ariba"
                  />
                </td>
                <td>
                  {t.title}
                  {t.invoiceNo && t.type === 'ariba_ses' ? (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Invoice {t.invoiceNo}
                      {t.sesRef ? ' · SES ' + t.sesRef : ''}
                      {t.remindCount ? ' · reminded ×' + t.remindCount : ''}
                    </div>
                  ) : null}
                </td>
                <td>
                  <div>{t.due || '—'}</div>
                  {!t.done && dueBadge(t)}
                </td>
                <td>
                  {t.type === 'ariba_ses' ? (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        background: '#e0f2fe',
                        color: '#0369a1',
                        borderRadius: 4,
                      }}
                    >
                      Ariba
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>general</span>
                  )}
                </td>
                <td>
                  {!t.done && t.type === 'ariba_ses' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => onRemindNow(t)}
                        title="Show reminder toast"
                      >
                        Remind
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => onSnooze(t.id)}
                        title="Push due date +3 days"
                      >
                        +3d
                      </button>{' '}
                    </>
                  )}
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => remove(t.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={5} style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>
                  {filter === 'ariba' || filter === 'overdue'
                    ? 'No matching Ariba reminders — use ⋮ on an invoice → Ariba SES follow-up'
                    : 'No tasks yet'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
