import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from './Toast';

const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12];
const emptyEmp = () => ({
  id: '', name: '', employeeCode: '', fatherName: '', dob: '', gender: '',
  doj: '', dol: '', department: '', designation: '', uan: '', esicNumber: '',
  aadhar: '', pan: '', bankName: '', accountNumber: '', ifsc: '',
  mobile: '', email: '', pfApplicable: true, esiApplicable: true, isActive: true,
  basic: 0, hra: 0, da: 0, allowances: 0, site: '',
});

async function api(path, opts) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error((data && data.error) || text || res.statusText);
  return data;
}

export default function HrmView() {
  const now = new Date();
  const [tab, setTab] = useState('dashboard');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [employees, setEmployees] = useState([]);
  const [dash, setDash] = useState(null);
  const [config, setConfig] = useState({ pfCap: 15000, esiCap: 21000, proration: 'ACTUAL', pfBase: 'BASIC_DA' });
  const [form, setForm] = useState(null);
  const [attRows, setAttRows] = useState([]);
  const [payroll, setPayroll] = useState(null);
  const [minWages, setMinWages] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [month, year]);

  const loadEmployees = useCallback(async () => {
    try { setEmployees(await api('/hrm/employees')); } catch (e) { toast(e.message, 'error'); }
  }, []);
  const loadDash = useCallback(async () => {
    try { setDash(await api(`/hrm/dashboard?month=${month}&year=${year}`)); } catch (e) { /* ignore */ }
  }, [month, year]);
  const loadConfig = useCallback(async () => {
    try { setConfig(await api('/hrm/config')); } catch { /* ignore */ }
  }, []);
  const loadAtt = useCallback(async () => {
    try {
      const data = await api(`/hrm/attendance?month=${month}&year=${year}`);
      setAttRows(data.rows || []);
    } catch (e) { toast(e.message, 'error'); }
  }, [month, year]);
  const loadPayroll = useCallback(async () => {
    try { setPayroll(await api(`/hrm/payroll?month=${month}&year=${year}`)); } catch { setPayroll(null); }
  }, [month, year]);
  const loadMinWages = useCallback(async () => {
    try { setMinWages(await api('/hrm/minwages')); } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadEmployees(); loadConfig(); }, [loadEmployees, loadConfig]);
  useEffect(() => {
    if (tab === 'dashboard') loadDash();
    if (tab === 'attendance') loadAtt();
    if (tab === 'payroll') loadPayroll();
    if (tab === 'minwages') loadMinWages();
  }, [tab, month, year, loadDash, loadAtt, loadPayroll, loadMinWages]);

  const saveEmp = async () => {
    if (!form?.name?.trim()) { toast('Name required', 'warning'); return; }
    setBusy(true);
    try {
      await api('/hrm/employees', { method: 'POST', body: JSON.stringify(form) });
      toast('Employee saved', 'success');
      setForm(null);
      loadEmployees();
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const buildAttGrid = () => {
    const map = {};
    attRows.forEach(r => { map[r.empId] = r; });
    const rows = employees.filter(e => e.isActive !== false).map(e => {
      const existing = map[e.id];
      if (existing) return existing;
      const days = {};
      for (let d = 1; d <= daysInMonth; d++) days['D' + d] = '';
      return { empId: e.id, empName: e.name, employeeCode: e.employeeCode, days, payableDays: 0 };
    });
    setAttRows(rows);
  };

  const setDay = (empId, dayKey, val) => {
    setAttRows(prev => prev.map(r => {
      if (r.empId !== empId) return r;
      const days = { ...r.days, [dayKey]: String(val || '').toUpperCase() };
      let p = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const v = days['D' + d] || '';
        if (v === 'P') p += 1;
        else if (v === 'W' || v === 'PL') p += 1;
        else if (v === 'H') p += 0.5;
      }
      return { ...r, days, payableDays: p };
    }));
  };

  const fillAll = (code) => {
    setAttRows(prev => prev.map(r => {
      const days = { ...r.days };
      for (let d = 1; d <= daysInMonth; d++) days['D' + d] = code;
      let p = code === 'P' || code === 'W' || code === 'PL' ? daysInMonth : code === 'H' ? daysInMonth * 0.5 : 0;
      return { ...r, days, payableDays: p };
    }));
  };

  const saveAtt = async () => {
    setBusy(true);
    try {
      await api('/hrm/attendance', { method: 'POST', body: JSON.stringify({ month, year, rows: attRows }) });
      toast('Attendance saved', 'success');
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const processPayroll = async () => {
    setBusy(true);
    try {
      const data = await api('/hrm/payroll/process', { method: 'POST', body: JSON.stringify({ month, year }) });
      setPayroll(data);
      if (data.warnings?.length) toast(data.warnings.slice(0, 3).join('; '), 'warning');
      else toast(`Processed ${data.rows?.length || 0} employees`, 'success');
      loadDash();
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const lockPayroll = async () => {
    if (!confirm('Lock this month? Attendance and payroll become read-only.')) return;
    setBusy(true);
    try {
      const data = await api('/hrm/payroll/lock', { method: 'POST', body: JSON.stringify({ month, year }) });
      setPayroll(data);
      toast('Payroll locked', 'success');
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const saveConfig = async () => {
    try {
      await api('/hrm/config', { method: 'POST', body: JSON.stringify(config) });
      toast('HR config saved', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  const filtered = employees.filter(e =>
    !q || [e.name, e.employeeCode, e.department, e.uan, e.mobile].join(' ').toLowerCase().includes(q.toLowerCase())
  );

  const tabs = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'directory', label: 'Directory' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'minwages', label: 'Min Wages' },
    { id: 'exports', label: 'Exports' },
    { id: 'settings', label: 'HR Settings' },
  ];

  const periodBar = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <select className="form-input" style={{ width: 70 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <input className="form-input" style={{ width: 90 }} type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
    </div>
  );

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">HRMS</h1>
          <p className="page-subtitle">Directory · Attendance · Payroll · PF / ESI · ECR / ESIC exports</p>
        </div>
        {periodBar}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.id} type="button"
            className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              ['Active workforce', dash?.activeEmployees ?? '—'],
              ['Gross payroll', dash ? `₹${Number(dash.monthlyCost).toLocaleString('en-IN')}` : '—'],
              ['Missing salary runs', dash?.missingSal ?? '—'],
              ['PF eligible / liability', dash ? `${dash.pfEligible} / ₹${Number(dash.pfLiability).toLocaleString('en-IN')}` : '—'],
            ].map(([label, val]) => (
              <div key={label} className="stat-card glass-panel" style={{ padding: 16 }}>
                <p className="stat-label" style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</p>
                <h2 className="stat-value" style={{ margin: 0, fontSize: 22 }}>{val}</h2>
              </div>
            ))}
          </div>
          <div className="glass-panel" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 14 }}>Site / department distribution</h3>
            <table className="data-table" style={{ width: '100%' }}>
              <thead><tr><th>Site</th><th className="text-end">Headcount</th></tr></thead>
              <tbody>
                {(dash?.siteDistribution || []).map(s => (
                  <tr key={s.name}><td>{s.name}</td><td className="text-end">{s.count}</td></tr>
                ))}
                {!dash?.siteDistribution?.length && <tr><td colSpan={2} className="text-muted">No employees yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'directory' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input className="form-input" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 280 }} />
            <button type="button" className="btn btn-primary" onClick={() => setForm(emptyEmp())}>+ Employee</button>
          </div>
          <div className="glass-panel" style={{ overflow: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>Dept / Site</th><th>Designation</th>
                  <th>UAN</th><th>Basic</th><th>PF</th><th>ESI</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id}>
                    <td>{e.employeeCode}</td>
                    <td className="font-medium">{e.name}</td>
                    <td>{e.department || e.site || '—'}</td>
                    <td>{e.designation || '—'}</td>
                    <td>{e.uan || '—'}</td>
                    <td className="text-end">{Number(e.basic || 0).toLocaleString('en-IN')}</td>
                    <td>{e.pfApplicable ? 'Y' : 'N'}</td>
                    <td>{e.esiApplicable ? 'Y' : 'N'}</td>
                    <td>{e.isActive === false ? 'Inactive' : 'Active'}</td>
                    <td><button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm({ ...e })}>Edit</button></td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={10} className="text-muted" style={{ textAlign: 'center' }}>No employees</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={buildAttGrid}>Load grid</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fillAll('P')}>Fill P</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fillAll('A')}>Fill A</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={saveAtt}>Save attendance</button>
            <span className="text-muted" style={{ fontSize: 12, alignSelf: 'center' }}>Codes: P present · A absent · W weekly off · PL paid leave · H half</span>
          </div>
          <div className="glass-panel" style={{ overflow: 'auto', maxHeight: '60vh' }}>
            <table className="data-table" style={{ width: 'max-content', minWidth: '100%', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--card, #fff)', zIndex: 2 }}>Employee</th>
                  {Array.from({ length: daysInMonth }, (_, i) => <th key={i} style={{ width: 28, textAlign: 'center' }}>{i + 1}</th>)}
                  <th>Pay days</th>
                </tr>
              </thead>
              <tbody>
                {attRows.map(r => (
                  <tr key={r.empId}>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--card, #fff)', fontWeight: 600 }}>{r.empName || r.employeeCode}</td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const k = 'D' + (i + 1);
                      return (
                        <td key={k} style={{ padding: 2 }}>
                          <input
                            value={r.days?.[k] || ''}
                            onChange={e => setDay(r.empId, k, e.target.value.slice(0, 2))}
                            style={{ width: 26, height: 26, textAlign: 'center', textTransform: 'uppercase', border: '1px solid var(--border)', borderRadius: 4 }}
                          />
                        </td>
                      );
                    })}
                    <td className="text-end font-medium">{r.payableDays}</td>
                  </tr>
                ))}
                {!attRows.length && <tr><td colSpan={daysInMonth + 2} className="text-muted">Click Load grid</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'payroll' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || payroll?.locked} onClick={processPayroll}>
              Process payroll
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy || !payroll?.rows?.length || payroll?.locked} onClick={lockPayroll}>
              Lock month
            </button>
            {payroll?.locked && <span style={{ color: '#dc2626', fontWeight: 600, alignSelf: 'center' }}>LOCKED</span>}
          </div>
          <div className="glass-panel" style={{ overflow: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th className="text-end">Days</th>
                  <th className="text-end">Gross</th><th className="text-end">PF EE</th>
                  <th className="text-end">ESI EE</th><th className="text-end">Net</th>
                </tr>
              </thead>
              <tbody>
                {(payroll?.rows || []).map(r => (
                  <tr key={r.empId}>
                    <td>{r.employeeCode}</td>
                    <td className="font-medium">{r.name}</td>
                    <td className="text-end">{r.payableDays}</td>
                    <td className="text-end">₹{Number(r.grossEarnings).toLocaleString('en-IN')}</td>
                    <td className="text-end">₹{Number(r.pfEE).toLocaleString('en-IN')}</td>
                    <td className="text-end">₹{Number(r.esiEE).toLocaleString('en-IN')}</td>
                    <td className="text-end font-medium">₹{Number(r.netSalary).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
                {!payroll?.rows?.length && <tr><td colSpan={7} className="text-muted">No payroll — save attendance then Process</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'minwages' && (
        <div className="glass-panel" style={{ padding: 16 }}>
          <p className="text-muted">Minimum wages master (state × skill). Used as reference during payroll warnings.</p>
          <button type="button" className="btn btn-primary btn-sm" style={{ marginBottom: 12 }} onClick={async () => {
            const state = prompt('State'); if (!state) return;
            const skill = prompt('Skill category (UNSKILLED/SEMI/SKILLED)') || 'UNSKILLED';
            const basic = Number(prompt('Basic per day') || 0);
            const da = Number(prompt('DA per day') || 0);
            try {
              await api('/hrm/minwages', { method: 'POST', body: JSON.stringify({ state, skillCategory: skill, basicPerDay: basic, daComponent: da, effectiveFrom: new Date().toISOString().slice(0, 10) }) });
              loadMinWages();
              toast('Saved', 'success');
            } catch (e) { toast(e.message, 'error'); }
          }}>+ Min wage</button>
          <table className="data-table" style={{ width: '100%' }}>
            <thead><tr><th>State</th><th>Skill</th><th className="text-end">Basic/day</th><th className="text-end">DA</th><th>From</th></tr></thead>
            <tbody>
              {minWages.map(m => (
                <tr key={m.id}><td>{m.state}</td><td>{m.skillCategory}</td>
                  <td className="text-end">{m.basicPerDay}</td><td className="text-end">{m.daComponent}</td>
                  <td>{m.effectiveFrom}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'exports' && (
        <div className="glass-panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
          <p className="text-muted">Uses payroll for selected month / year above.</p>
          <a className="btn btn-primary" href={`/api/hrm/reports/ecr?month=${month}&year=${year}`} target="_blank" rel="noreferrer">Download EPFO ECR (.txt)</a>
          <a className="btn btn-secondary" href={`/api/hrm/reports/esic?month=${month}&year=${year}`} target="_blank" rel="noreferrer">Download ESIC CSV</a>
        </div>
      )}

      {tab === 'settings' && (
        <div className="glass-panel" style={{ padding: 16, maxWidth: 480 }}>
          <div className="form-group"><label className="form-label">PF wage cap (₹)</label>
            <input className="form-input" type="number" value={config.pfCap} onChange={e => setConfig({ ...config, pfCap: Number(e.target.value) })} /></div>
          <div className="form-group"><label className="form-label">ESI gross cap (₹)</label>
            <input className="form-input" type="number" value={config.esiCap} onChange={e => setConfig({ ...config, esiCap: Number(e.target.value) })} /></div>
          <div className="form-group"><label className="form-label">Proration days</label>
            <select className="form-input" value={config.proration} onChange={e => setConfig({ ...config, proration: e.target.value })}>
              <option value="ACTUAL">Actual month days</option>
              <option value="26">26 days</option>
              <option value="30">30 days</option>
            </select></div>
          <div className="form-group"><label className="form-label">PF base</label>
            <select className="form-input" value={config.pfBase} onChange={e => setConfig({ ...config, pfBase: e.target.value })}>
              <option value="BASIC_DA">Basic + DA</option>
              <option value="BASIC">Basic only</option>
            </select></div>
          <button type="button" className="btn btn-primary" onClick={saveConfig}>Save config</button>
        </div>
      )}

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', overflow: 'auto' }}>
            <h3 className="section-title">{form.id ? 'Edit employee' : 'New employee'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['name', 'Full name *'], ['employeeCode', 'Emp code'], ['designation', 'Designation'],
                ['department', 'Department / Site'], ['doj', 'DOJ', 'date'], ['mobile', 'Mobile'],
                ['uan', 'UAN'], ['esicNumber', 'ESIC number'], ['pan', 'PAN'], ['aadhar', 'Aadhaar'],
                ['bankName', 'Bank'], ['accountNumber', 'Account'], ['ifsc', 'IFSC'],
                ['basic', 'Basic', 'number'], ['hra', 'HRA', 'number'], ['da', 'DA', 'number'], ['allowances', 'Allowances', 'number'],
              ].map(([key, label, type]) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{label}</label>
                  <input className="form-input" type={type || 'text'} value={form[key] ?? ''}
                    onChange={e => setForm({ ...form, [key]: type === 'number' ? Number(e.target.value) : e.target.value })} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, margin: '12px 0' }}>
              <label><input type="checkbox" checked={!!form.pfApplicable} onChange={e => setForm({ ...form, pfApplicable: e.target.checked })} /> PF</label>
              <label><input type="checkbox" checked={!!form.esiApplicable} onChange={e => setForm({ ...form, esiApplicable: e.target.checked })} /> ESI</label>
              <label><input type="checkbox" checked={form.isActive !== false} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={saveEmp}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
