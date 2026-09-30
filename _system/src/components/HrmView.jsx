import { useState, useEffect } from 'react';
import { toast } from './Toast';

/**
 * Lightweight HRM scaffold (service companies):
 * Employees linked to Site / Cost Center for WO labour tracking.
 * Not a full payroll — use for headcount & WO assignment.
 */
const STORAGE_KEY = 'sd_hrm_employees';

function loadEmployees() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveEmployees(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export default function HrmView() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => { setList(loadEmployees()); }, []);

  const openNew = () => setForm({
    id: 'emp_' + Date.now().toString(36),
    name: '', role: '', phone: '', site: '', costCenter: '', status: 'active', notes: '',
  });

  const save = () => {
    if (!form?.name?.trim()) { toast('Name required', 'warning'); return; }
    const next = list.some(e => e.id === form.id)
      ? list.map(e => e.id === form.id ? form : e)
      : [...list, form];
    setList(next);
    saveEmployees(next);
    setForm(null);
    toast('Employee saved', 'success');
  };

  const remove = (id) => {
    if (!confirm('Remove employee?')) return;
    const next = list.filter(e => e.id !== id);
    setList(next);
    saveEmployees(next);
  };

  const filtered = list.filter(e =>
    !q || [e.name, e.role, e.site, e.phone].join(' ').toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 className="page-title">HRM · Employees</h1>
          <p className="page-subtitle">Light roster for sites / WO labour (not full payroll)</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>+ Employee</button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input className="form-input" placeholder="Search name, role, site…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 320 }} />
      </div>

      <div className="glass-panel" style={{ overflow: 'auto' }}>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Name</th><th>Role</th><th>Phone</th><th>Site</th><th>Cost Center</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id}>
                <td className="font-medium">{e.name}</td>
                <td>{e.role || '—'}</td>
                <td>{e.phone || '—'}</td>
                <td>{e.site || '—'}</td>
                <td>{e.costCenter || '—'}</td>
                <td>{e.status || 'active'}</td>
                <td>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm({ ...e })}>Edit</button>
                  {' '}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => remove(e.id)}>Del</button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center' }}>No employees yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 className="section-title">{form.name ? 'Edit employee' : 'New employee'}</h3>
            <div className="form-group"><label className="form-label">Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Role</label>
              <input className="form-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="Supervisor, Technician…" /></div>
            <div className="form-group"><label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Site</label>
              <input className="form-input" value={form.site} onChange={e => setForm({ ...form, site: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Cost Center</label>
              <input className="form-input" value={form.costCenter} onChange={e => setForm({ ...form, costCenter: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
