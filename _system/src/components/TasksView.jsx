import { useState, useEffect, useMemo } from 'react';
import { toast } from './Toast';
import {
  loadTasks,
  saveTasks,
  createSesFollowUpTask,
  createSesFollowUpFromBill,
} from '../utils/sesTasks';

export { createSesFollowUpTask, createSesFollowUpFromBill };

/** Task board + auto Ariba SES follow-ups (no manual prompts when created from invoice). */
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
    // Allow other screens to push a task: window.dispatchEvent(new CustomEvent('sd-create-ses-task', { detail: bill }))
    const onCreate = (ev) => {
      const bill = ev.detail;
      const { skipped, task } = createSesFollowUpFromBill(bill);
      if (skipped) toast('Open Ariba follow-up already exists for this invoice', 'info');
      else toast('Ariba SES follow-up created for ' + (task?.invoiceNo || 'invoice'), 'success');
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

  const visible = useMemo(() => {
    let list = tasks || [];
    if (filter === 'open') list = list.filter((t) => !t.done);
    else if (filter === 'ariba') list = list.filter((t) => t.type === 'ariba_ses' && !t.done);
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

  const openCount = tasks.filter((t) => !t.done).length;
  const aribaOpen = tasks.filter((t) => !t.done && t.type === 'ariba_ses').length;

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">
            Offline checklist · Ariba SES follow-ups ({openCount} open
            {aribaOpen ? ' · ' + aribaOpen + ' Ariba' : ''})
          </p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 12, marginBottom: 12, fontSize: 13 }}>
        <strong>Ariba SES (auto):</strong> On any Tax Invoice row, open the ⋮ menu →{' '}
        <em>Ariba SES follow-up</em>. Invoice number and client are filled automatically — no typing.
        Tick the task done after you upload the invoice in Ariba.
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {[
          { id: 'open', label: 'Open' },
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
          </button>
        ))}
      </div>

      <div className="glass-panel" style={{ padding: 0 }}>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Task</th>
              <th style={{ width: 110 }}>Due</th>
              <th style={{ width: 90 }}>Type</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t.id} style={t.done ? { opacity: 0.55 } : undefined}>
                <td>
                  <input
                    type="checkbox"
                    checked={!!t.done}
                    onChange={() => toggle(t.id)}
                    title="Mark done when SES→invoice uploaded in Ariba"
                  />
                </td>
                <td>
                  {t.title}
                  {t.invoiceNo && t.type === 'ariba_ses' ? (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Invoice {t.invoiceNo}
                      {t.sesRef ? ' · SES ' + t.sesRef : ''}
                    </div>
                  ) : null}
                </td>
                <td>{t.due || '—'}</td>
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
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => remove(t.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={5} style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>
                  {filter === 'ariba'
                    ? 'No open Ariba tasks — use ⋮ on an invoice → Ariba SES follow-up'
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
