import { useState, useEffect } from 'react';
import { toast } from './Toast';

const KEY = 'sd_tasks_v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function save(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

/** Lightweight internal task board (Bizzhub-inspired, offline localStorage). */
export default function TasksView() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');

  useEffect(() => { setTasks(load()); }, []);

  const add = () => {
    const t = title.trim();
    if (!t) { toast('Enter a task title', 'warning'); return; }
    const next = [{ id: 'task_' + Date.now(), title: t, due: due || '', done: false, createdAt: new Date().toISOString() }, ...tasks];
    setTasks(next);
    save(next);
    setTitle('');
    setDue('');
  };

  const toggle = (id) => {
    const next = tasks.map((x) => (x.id === id ? { ...x, done: !x.done } : x));
    setTasks(next);
    save(next);
  };

  const remove = (id) => {
    const next = tasks.filter((x) => x.id !== id);
    setTasks(next);
    save(next);
  };

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">Simple offline checklist (not a full project suite)</p>
        </div>
      </div>
      <div className="glass-panel" style={{ padding: 16, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="form-input" style={{ flex: 1, minWidth: 180 }} placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="form-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <button type="button" className="btn btn-primary" onClick={add}>Add</button>
      </div>
      <div className="glass-panel" style={{ padding: 0 }}>
        <table className="data-table" style={{ width: '100%' }}>
          <thead><tr><th></th><th>Task</th><th>Due</th><th></th></tr></thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} style={t.done ? { opacity: 0.55 } : undefined}>
                <td><input type="checkbox" checked={!!t.done} onChange={() => toggle(t.id)} /></td>
                <td>{t.title}</td>
                <td>{t.due || '—'}</td>
                <td><button type="button" className="btn btn-sm btn-secondary" onClick={() => remove(t.id)}>Delete</button></td>
              </tr>
            ))}
            {!tasks.length && <tr><td colSpan={4} style={{ color: '#64748b', textAlign: 'center' }}>No tasks yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
