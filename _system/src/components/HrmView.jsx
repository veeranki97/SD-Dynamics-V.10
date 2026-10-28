import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from './Toast';
import { confirmAction, promptAction } from './ConfirmModal';
import { INDIAN_STATES, numberToWords } from '../utils';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SKILL_CATS = ['Unskilled', 'Semi-skilled', 'Skilled', 'Highly Skilled'];
const GENDERS = ['Male', 'Female', 'Other'];

/** Mask sensitive IDs in lists (full value on employee edit form). */
function maskId(v, keep = 4) {
  const s = String(v || '').trim();
  if (!s) return '—';
  if (s.length <= keep) return '•'.repeat(s.length);
  return '•'.repeat(Math.max(0, s.length - keep)) + s.slice(-keep);
}

const emptyEmp = () => ({
  id: '',
  name: '',
  employeeCode: '',
  fatherName: '',
  dob: '',
  gender: '',
  doj: '',
  dol: '',
  department: '',
  designation: '',
  uan: '',
  esicNumber: '',
  aadhar: '',
  pan: '',
  bankName: '',
  accountNumber: '',
  ifsc: '',
  mobile: '',
  email: '',
  pfApplicable: true,
  esiApplicable: true,
  isActive: true,
  basic: 0, leaveCL: 12, leaveSL: 6, leaveEL: 15,
  hra: 0,
  da: 0,
  allowances: 0,
  state: '',
  site: '',
  siteId: '',
  skillCategory: 'Unskilled',
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
  const [config, setConfig] = useState({
    pfCap: 15000, esiCap: 21000, proration: 'ACTUAL', pfBase: 'BASIC_DA',
    sites: [], establishmentCode: '', esicCode: '', employerName: '',
    contractorNameAddress: '', natureLocationOfWork: '', contractEstablishmentNameAddress: '', principalEmployerNameAddress: '',
  });
  const [form, setForm] = useState(null);
  const [attRows, setAttRows] = useState([]);
  const [payroll, setPayroll] = useState(null);
  const [minWages, setMinWages] = useState([]);
  const [mwForm, setMwForm] = useState(null);
  const [siteDraft, setSiteDraft] = useState({ name: '', state: '' });
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [leaveRows, setLeaveRows] = useState([]);
  const [leaveForm, setLeaveForm] = useState(null);
  const [statSiteId, setStatSiteId] = useState('');
  const [siteEdit, setSiteEdit] = useState(null);

  const applyMinWageFromMaster = useCallback((nextForm) => {
    const state = (nextForm.state || '').trim();
    const skill = (nextForm.skillCategory || 'Unskilled').trim();
    if (!state || !minWages?.length) return nextForm;
    const rows = minWages.filter((m) =>
      String(m.state || '').toLowerCase() === state.toLowerCase()
      && String(m.skillCategory || '').toLowerCase() === skill.toLowerCase()
    );
    if (!rows.length) {
      // try state-only match (any skill)
      const byState = minWages.filter((m) => String(m.state || '').toLowerCase() === state.toLowerCase());
      if (!byState.length) return nextForm;
      byState.sort((a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')));
      const pick = byState[0];
      const basicDay = Number(pick.basicPerDay) || 0;
      const daDay = Number(pick.daComponent) || 0;
      // monthly approx 26 days for basic suggestion
      const monthly = Math.round((basicDay + daDay) * 26);
      return {
        ...nextForm,
        basic: monthly || nextForm.basic,
        da: Math.round(daDay * 26) || nextForm.da,
        _minWageNote: `Suggested from min wages: ${pick.state} / ${pick.skillCategory} (₹${basicDay}/day basic)`,
      };
    }
    rows.sort((a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')));
    const pick = rows[0];
    const basicDay = Number(pick.basicPerDay) || 0;
    const daDay = Number(pick.daComponent) || 0;
    const monthly = Math.round((basicDay + daDay) * 26);
    return {
      ...nextForm,
      basic: monthly || nextForm.basic,
      da: Math.round(daDay * 26) || nextForm.da,
      _minWageNote: `From min wages: ${pick.state} · ${pick.skillCategory} · ₹${basicDay}/day /mo (from master) · was ₹${monthly}/mo`,
    };
  }, [minWages]);


  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [month, year]);
  const statUrl = useCallback((path) => {
    let u = `/api/hrm/reports/${path}?month=${month}&year=${year}`;
    if (statSiteId) u += `&siteId=${encodeURIComponent(statSiteId)}`;
    return u;
  }, [month, year, statSiteId]);

  const sitesForState = useMemo(() => {
    const sites = config.sites || [];
    if (!form?.state) return sites;
    return sites.filter((s) => !s.state || s.state === form.state);
  }, [config.sites, form?.state]);

  const loadEmployees = useCallback(async () => {
    try {
      setEmployees(await api('/hrm/employees'));
    } catch (e) {
      console.error(e); toast((e && e.message) || 'Failed to load employees — is server running?', 'error');
    }
  }, []);
  const loadDash = useCallback(async () => {
    try { setDash(await api(`/hrm/dashboard?month=${month}&year=${year}`)); } catch { /* ignore */ }
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
  const loadLeave = useCallback(async () => {
    try { setLeaveRows(await api('/hrm/leave')); } catch { setLeaveRows([]); }
  }, []);

  useEffect(() => { loadEmployees(); loadConfig(); }, [loadEmployees, loadConfig]);
  useEffect(() => {
    if (tab === 'dashboard') loadDash();
    if (tab === 'attendance') loadAtt();
    if (tab === 'payroll' || tab === 'filings' || tab === 'registers' || tab === 'statutory') loadPayroll();
    if (tab === 'statutory' || tab === 'registers' || tab === 'attendance') loadAtt();
    if (tab === 'minwages') loadMinWages();
    if (tab === 'leave') loadLeave();
    if (tab === 'settings') { /* config already on mount */ }
    if (tab === 'employees') loadEmployees();
  }, [tab, month, year, loadDash, loadAtt, loadPayroll, loadMinWages, loadEmployees, loadLeave]);

  const saveEmp = async () => {
    if (!form?.name?.trim()) { toast('Employee name is required', 'warning'); return; }
    if (!form?.state?.trim()) { toast('State is required (Indian labour / min-wage rules)', 'warning'); return; }
    setBusy(true);
    const isEdit = !!(form.id && String(form.id).trim());
    try {
      const payload = {
        ...form,
        basic: Number(form.basic) || 0,
        hra: Number(form.hra) || 0,
        da: Number(form.da) || 0,
        allowances: Number(form.allowances) || 0,
        leaveCL: Number(form.leaveCL) || 0,
        leaveSL: Number(form.leaveSL) || 0,
        leaveEL: Number(form.leaveEL) || 0,
      };
      // Empty id → new employee
      if (!payload.id) delete payload.id;
      const saved = await api('/hrm/employees', { method: 'POST', body: JSON.stringify(payload) });
      toast(isEdit ? `Employee updated — ${saved.name || form.name}` : `Employee saved — ${saved.name || form.name}`, 'success');
      setForm(null);
      await loadEmployees();
      if (tab === 'dashboard') loadDash();
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
    setBusy(false);
  };

  const deleteEmp = async (emp) => {
    const ok = await confirmAction({
      title: 'Delete employee?',
      message: `${emp.name} (${emp.employeeCode || 'no code'}) will be marked inactive. Historical attendance & payroll stay for PF/ESI records.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api(`/hrm/employees/${encodeURIComponent(emp.id)}`, { method: 'DELETE' });
      toast(`Employee deleted — ${emp.name}`, 'success');
      if (form?.id === emp.id) setForm(null);
      await loadEmployees();
      loadDash();
    } catch (e) {
      toast(e.message || 'Delete failed', 'error');
    }
  };

  const buildAttGrid = () => {
    const map = {};
    attRows.forEach((r) => { map[r.empId] = r; });
    const rows = employees.filter((e) => e.isActive !== false).map((e) => {
      const existing = map[e.id];
      if (existing) return existing;
      const days = {};
      for (let d = 1; d <= daysInMonth; d++) days['D' + d] = '';
      return { empId: e.id, empName: e.name, employeeCode: e.employeeCode, days, payableDays: 0, otHours: 0 };
    });
    setAttRows(rows);
    if (!rows.length) toast('No active employees — add staff in Directory first', 'warning');
    else toast(`Attendance grid ready for ${rows.length} employee(s)`, 'info');
  };

  const setDay = (empId, dayKey, val) => {
    setAttRows((prev) => prev.map((r) => {
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
    setAttRows((prev) => prev.map((r) => {
      const days = { ...r.days };
      for (let d = 1; d <= daysInMonth; d++) days['D' + d] = code;
      const p = code === 'P' || code === 'W' || code === 'PL' ? daysInMonth : code === 'H' ? daysInMonth * 0.5 : 0;
      return { ...r, days, payableDays: p };
    }));
  };

  const saveAtt = async () => {
    if (!attRows.length) { toast('Load grid first', 'warning'); return; }
    setBusy(true);
    try {
      await api('/hrm/attendance', { method: 'POST', body: JSON.stringify({ month, year, rows: attRows }) });
      toast(`Attendance saved — ${MONTH_NAMES[month - 1]} ${year}`, 'success');
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const processPayroll = async () => {
    setBusy(true);
    try {
      const data = await api('/hrm/payroll/process', { method: 'POST', body: JSON.stringify({ month, year }) });
      setPayroll(data);
      if (data.warnings?.length) toast(data.warnings.slice(0, 3).join('; '), 'warning');
      else toast(`Payroll processed — ${data.rows?.length || 0} employee(s)`, 'success');
      loadDash();
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const lockPayroll = async () => {
    const ok = await confirmAction({
      title: 'Lock payroll month?',
      message: `${MONTH_NAMES[month - 1]} ${year} will become read-only. Attendance and payroll cannot be re-processed until unlocked (admin).`,
      confirmLabel: 'Lock month',
      tone: 'warning',
    });
    if (!ok) return;
    try {
      const data = await api('/hrm/payroll/lock', { method: 'POST', body: JSON.stringify({ month, year }) });
      setPayroll(data);
      toast('Payroll locked', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  const saveConfig = async () => {
    try {
      const next = await api('/hrm/config', { method: 'POST', body: JSON.stringify(config) });
      setConfig(next);
      toast('HR settings saved', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  const addSite = async () => {
    if (!siteDraft.name?.trim()) { toast('Site / location name required', 'warning'); return; }
    const sites = [...(config.sites || []), {
      id: 'site_' + Date.now().toString(36),
      name: siteDraft.name.trim(),
      state: siteDraft.state || '',
    }];
    try {
      const next = await api('/hrm/config', { method: 'POST', body: JSON.stringify({ ...config, sites }) });
      setConfig(next);
      setSiteDraft({ name: '', state: '' });
      toast('Site added', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  const removeSite = async (id) => {
    const ok = await confirmAction({
      title: 'Remove site?',
      message: 'Employees keep their saved site text; this only removes it from the pick list.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    const sites = (config.sites || []).filter((s) => s.id !== id);
    try {
      const next = await api('/hrm/config', { method: 'POST', body: JSON.stringify({ ...config, sites }) });
      setConfig(next);
      toast('Site removed', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  const saveMinWage = async () => {
    if (!mwForm?.state) { toast('State is required', 'warning'); return; }
    if (!(Number(mwForm.basicPerDay) > 0)) { toast('Basic per day must be > 0', 'warning'); return; }
    setBusy(true);
    try {
      await api('/hrm/minwages', {
        method: 'POST',
        body: JSON.stringify({
          ...mwForm,
          basicPerDay: Number(mwForm.basicPerDay) || 0,
          daComponent: Number(mwForm.daComponent) || 0,
          effectiveFrom: mwForm.effectiveFrom || new Date().toISOString().slice(0, 10),
        }),
      });
      toast(`Min wage saved — ${mwForm.state} / ${mwForm.skillCategory}`, 'success');
      setMwForm(null);
      loadMinWages();
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  
  const generatePayslip = (emp, payRow) => {
    const cfg = config || {};
    const pfRate = Number(cfg.pfEmployeePercent ?? 12) / 100;
    const esiRate = Number(cfg.esiEmployeePercent ?? 0.75) / 100;
    const days = Number(payRow?.payableDays ?? payRow?.daysWorked ?? payRow?.workingDays ?? payRow?.presentDays ?? 0) || 0;
    const daily = Number(payRow?.dailyRate ?? emp.dailyRate ?? (Number(emp.basic || 0) / 26)) || 0;
    const basic = Number(payRow?.basicEarned ?? payRow?.basic ?? emp.basic ?? 0) || 0;
    const da = Number(payRow?.daEarned ?? payRow?.da ?? payRow?.dearness ?? emp.da ?? 0) || 0;
    const hra = Number(payRow?.hraEarned ?? payRow?.hra ?? emp.hra ?? 0) || 0;
    const allow = Number(payRow?.allowancesEarned ?? payRow?.allowances ?? emp.allowances ?? 0) || 0;
    const otPay = Number(payRow?.otPay ?? 0) || 0;
    let totalEarn = Number(payRow?.grossEarnings ?? payRow?.gross ?? payRow?.totalEarnings ?? 0) || 0;
    if (!totalEarn) totalEarn = basic + da + hra + allow + otPay;
    if (!totalEarn && daily && days) totalEarn = Math.round(daily * days);
    const pf = Number(payRow?.pfEE ?? payRow?.pfEmployee ?? 0) || 0;
    const esi = Number(payRow?.esiEE ?? payRow?.esiEmployee ?? 0) || 0;
    const totalDed = pf + esi;
    const net = Number(payRow?.netSalary ?? Math.max(0, totalEarn - totalDed)) || 0;
    const biz = cfg.businessName || document.title || 'Business';
    const addr = cfg.businessAddress || '';
    const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`.toUpperCase();
    const from = payRow?.periodFrom || `01/${String(month).padStart(2, '0')}/${year}`;
    const to = payRow?.periodTo || `${new Date(year, month, 0).getDate()}/${String(month).padStart(2, '0')}/${year}`;
    let words = String(net);
    try {
      if (typeof numberToWords === 'function') {
        words = String(numberToWords(net) || '').replace(/\s*Only\s*$/i, '').replace(/^Rupees\s+/i, '') || String(net);
      }
    } catch { /* */ }
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Payslip ${emp.name || ''}</title>
<style>
  body{font-family:Georgia,serif;max-width:720px;margin:24px auto;color:#111;font-size:13px}
  h1{text-align:center;color:#1e3a5f;margin:0 0 4px;font-size:22px}
  .addr{text-align:center;font-size:11px;color:#444;margin-bottom:8px}
  .title{text-align:center;font-weight:700;margin:12px 0 16px;font-size:14px}
  table{width:100%;border-collapse:collapse;margin-bottom:14px}
  td,th{border:1px solid #333;padding:6px 8px;vertical-align:top}
  th{background:#e8eef5;text-align:left}
  .net{font-weight:700;font-size:15px;margin-top:12px}
  .words{font-style:italic;font-size:12px;margin-top:4px}
  @media print{body{margin:12px}}
</style></head><body>
  <h1>${biz}</h1>
  <div class="addr">${addr}</div>
  <div class="title">PAYSLIP FOR THE MONTH OF ${monthLabel} (${from} to ${to})</div>
  <table>
    <tr><td><b>Employee Name:</b></td><td>${emp.name || ''}</td><td><b>Designation:</b></td><td>${emp.designation || emp.category || ''}</td></tr>
    <tr><td><b>UAN:</b></td><td>${emp.uan || ''}</td><td><b>ESI No:</b></td><td>${emp.esiNumber || emp.esic || ''}</td></tr>
    <tr><td><b>Working Days:</b></td><td>${days}</td><td><b>Daily Rate:</b></td><td>₹${daily.toLocaleString('en-IN')}</td></tr>
  </table>
  <table>
    <tr><th>Earnings</th><th>Amount (₹)</th><th>Deductions</th><th>Amount (₹)</th></tr>
    <tr><td>Basic Salary</td><td>${basic.toLocaleString('en-IN')}</td><td>Provident Fund (PF ${(pfRate*100).toFixed(0)}%)</td><td>${pf.toLocaleString('en-IN')}</td></tr>
    <tr><td>Dearness Allowance (DA)</td><td>${da.toLocaleString('en-IN')}</td><td>Employee State Insurance (ESI ${(esiRate*100).toFixed(2)}%)</td><td>${esi.toLocaleString('en-IN')}</td></tr>
    <tr><td><b>Total Earnings</b></td><td><b>${totalEarn.toLocaleString('en-IN')}</b></td><td><b>Total Deductions</b></td><td><b>${totalDed.toLocaleString('en-IN')}</b></td></tr>
  </table>
  <div class="net">Net Amount Paid: ₹${net.toLocaleString('en-IN')}/-</div>
  <div class="words">Amount in Words: Rupees ${words} Only</div>
  <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>
</body></html>`;
    const code = String(emp.employeeCode || emp.id || 'EMP').replace(/[/\\?%*:|"<>]/g, '-');
    const slipName = 'Payslip-' + code + '-' + year + '-' + String(month).padStart(2, '0');
    html = html.replace('<head>', '<head><title>' + slipName + '</title>');
    const prevTitle = document.title;
    try { document.title = slipName; } catch (_) {}
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) {
      try { document.title = prevTitle; } catch (_) {}
      toast('Allow pop-ups to download payslip', 'warning');
      return;
    }
    w.document.write(html);
    w.document.close();
    try { w.document.title = slipName; } catch (_) {}
    setTimeout(() => { try { document.title = prevTitle; } catch (_) {} }, 2000);
  };


  const deleteMinWage = async (m) => {
    const ok = await confirmAction({
      title: 'Delete min-wage row?',
      message: `${m.state} · ${m.skillCategory}`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api(`/hrm/minwages/${encodeURIComponent(m.id)}`, { method: 'DELETE' });
      toast('Min wage deleted', 'success');
      loadMinWages();
    } catch (e) { toast(e.message, 'error'); }
  };

  const hrmPipeline = useMemo(() => {
    const active = employees.filter((e) => e.isActive !== false && !e.deleted);
    const hasAtt = Array.isArray(attRows) && attRows.length > 0;
    const hasPay = Array.isArray(payroll?.rows) && payroll.rows.length > 0;
    const pfRows = (payroll?.rows || []).filter((r) => Number(r.pfEE || 0) > 0 || Number(r.pfER || 0) > 0);
    const esiRows = (payroll?.rows || []).filter((r) => Number(r.esiEE || 0) > 0 || Number(r.esiER || 0) > 0);
    const reasonsEcr = [];
    if (!active.length) reasonsEcr.push('No active employees');
    else if (!hasPay) reasonsEcr.push('Process payroll for ' + MONTH_NAMES[month - 1] + ' ' + year + ' first');
    else if (!pfRows.length) reasonsEcr.push('No PF amounts in payroll (check UAN / PF flag / basic)');
    const reasonsEsic = [];
    if (!active.length) reasonsEsic.push('No active employees');
    else if (!hasPay) reasonsEsic.push('Process payroll for this month first');
    else if (!esiRows.length) reasonsEsic.push('No ESI amounts (gross above ceiling or ESI off)');
    return {
      hasAtt, hasPay, canEcr: pfRows.length > 0, canEsic: esiRows.length > 0,
      reasonsEcr, reasonsEsic,
      steps: [
        { ok: active.length > 0, label: 'Employees', detail: active.length + ' active' },
        { ok: hasAtt, label: 'Attendance', detail: hasAtt ? 'Ready' : 'Load & save' },
        { ok: hasPay, label: 'Payroll', detail: hasPay ? (payroll.rows.length + ' rows') : 'Process' },
        { ok: pfRows.length > 0, label: 'ECR', detail: pfRows.length ? 'Ready' : 'Blocked' },
        { ok: esiRows.length > 0, label: 'ESIC', detail: esiRows.length ? 'Ready' : 'Blocked' },
      ],
    };
  }, [employees, attRows, payroll, month, year]);

  const filtered = employees.filter((e) =>
    !q || [e.name, e.employeeCode, e.department, e.site, e.state, e.uan, e.mobile].join(' ').toLowerCase().includes(q.toLowerCase())
  );

  const tabs = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'directory', label: 'Employees' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'leave', label: 'Leave' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'statutory', label: 'Statutory downloads' },
    { id: 'minwages', label: 'Min Wages' },
    { id: 'settings', label: 'HR Settings' },
  ];

  const periodBar = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <select className="form-input" style={{ width: 90 }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
        {MONTHS.map((m) => <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>)}
      </select>
      <input className="form-input" type="number" style={{ width: 90 }} value={year} onChange={(e) => setYear(Number(e.target.value) || year)} />
    </div>
  );

  return (
    <div className="page-content hrm-page" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">HRMS</h1>
          <p className="page-subtitle">
            India-ready workforce · Attendance · Payroll · EPFO ECR · ESIC · Min wages · Wages register
          </p>
        </div>
        {periodBar}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {tabs.map((t) => (
          <button key={t.id} type="button"
            className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12, marginBottom: 16 }}>
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
          <div className="glass-panel" style={{ padding: 16, marginBottom: 12 }}>
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
              <strong>Indian compliance path:</strong> 1) Add employees with State, Site, UAN / ESIC ·
              2) Mark attendance (P / A / H / W / PL) · 3) Process payroll · 4) Download ECR / ESIC and registers from Statutory downloads.
              PF employee share 12%; EPS capped; ESI 0.75% + 3.25% employer when gross ≤ ESI wage ceiling.
            </p>
          </div>
          <div className="glass-panel" style={{ padding: 16, marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, fontSize: 14 }}>This month pipeline ({MONTH_NAMES[month - 1]} {year})</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {hrmPipeline.steps.map((s) => (
                <span key={s.label} style={{
                  fontSize: 12, padding: '6px 10px', borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: s.ok ? 'var(--success-light, #ecfdf5)' : 'var(--bg-muted, #f8fafc)',
                  color: s.ok ? '#047857' : 'var(--text-muted)',
                }}>{s.ok ? '✓' : '○'} {s.label}: {s.detail}</span>
              ))}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('directory')}>Employees</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('attendance')}>Attendance</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('payroll')}>Payroll</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setTab('statutory')}>Statutory</button>
            </div>
          </div>
          <div className="glass-panel" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 14 }}>Site / department distribution</h3>
            <table className="data-table" style={{ width: '100%' }}>
              <thead><tr><th>Site / Dept</th><th className="text-end">Headcount</th></tr></thead>
              <tbody>
                {(dash?.siteDistribution || []).map((s) => (
                  <tr key={s.name}><td>{s.name}</td><td className="text-end">{s.count}</td></tr>
                ))}
                {!dash?.siteDistribution?.length && <tr><td colSpan={2} className="text-muted">No employees yet — open Employees tab</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'directory' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input className="form-input" placeholder="Search name, code, UAN, site…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
            <button type="button" className="btn btn-primary" onClick={() => setForm(emptyEmp())}>+ Employee</button>
          </div>
          <div className="glass-panel" style={{ overflow: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>State / Site</th><th>Designation</th>
                  <th>UAN</th><th>Basic</th><th>PF</th><th>ESI</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td>{e.employeeCode}</td>
                    <td className="font-medium">{e.name}</td>
                    <td>{[e.state, e.site || e.department].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{e.designation || '—'}</td>
                    <td title={e.uan || ''}>{maskId(e.uan)}</td>
                    <td className="text-end">{Number(e.basic || 0).toLocaleString('en-IN')}</td>
                    <td>{e.pfApplicable ? 'Y' : 'N'}</td>
                    <td>{e.esiApplicable ? 'Y' : 'N'}</td>
                    <td>{e.isActive === false ? 'Inactive' : 'Active'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm({ ...emptyEmp(), ...e })}>Edit</button>{' '}
                      <button type="button" className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }} onClick={() => deleteEmp(e)}>Delete</button>
                    </td>
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center', padding: '12px 14px', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, background: 'var(--surface, #fff)' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={buildAttGrid}>Load grid</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fillAll('P')}>Fill P</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fillAll('A')}>Fill A</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={saveAtt}>Save attendance</button>
            <a className="btn btn-secondary btn-sm" href={`/api/hrm/reports/attendance?month=${month}&year=${year}`} target="_blank" rel="noreferrer">Download attendance CSV</a>
            <span className="text-muted" style={{ fontSize: 12 }}>Codes: P present · A absent · H half · W weekly off · PL paid leave</span>
          </div>
          <div className="glass-panel" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 205px)', minHeight: 'min(520px, calc(100vh - 260px))', borderRadius: 12, width: '100%', maxWidth: '100%' }}>
            <table className="data-table" style={{ width: 'max-content', minWidth: '100%', fontSize: 12, borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--surface, #fff)', zIndex: 3, minWidth: 190, width: 190, boxShadow: '2px 0 4px rgba(15,23,42,0.05)' }}>Employee</th>
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <th key={i} style={{ width: 36, minWidth: 36, textAlign: 'center', padding: '6px 2px', position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface, #fff)' }}>{i + 1}</th>
                  ))}
                  <th style={{ minWidth: 76, whiteSpace: 'nowrap' }}>Pay days</th>
                  <th title="Overtime hours for payroll (× daily rate × OT multiplier)" style={{ minWidth: 84, whiteSpace: 'nowrap' }}>OT hrs</th>
                </tr>
              </thead>
              <tbody>
                {attRows.map((r) => (
                  <tr key={r.empId}>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--surface, #fff)', fontWeight: 600, minWidth: 190, width: 190, zIndex: 1, boxShadow: '2px 0 4px rgba(15,23,42,0.05)', whiteSpace: 'nowrap' }}>{r.empName || r.employeeCode}</td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const k = 'D' + (i + 1);
                      return (
                        <td key={k} style={{ padding: '3px 2px', minWidth: 36, textAlign: 'center' }}>
                          <input
                            value={r.days?.[k] || ''}
                            onChange={(e) => setDay(r.empId, k, e.target.value.slice(0, 2))}
                            style={{ width: 32, minWidth: 32, height: 30, boxSizing: 'border-box', textAlign: 'center', fontSize: 11, fontWeight: 600, padding: '3px 1px', borderRadius: 6, border: '1px solid var(--border, #cbd5e1)', background: 'var(--surface, #fff)' }}
                            maxLength={2}
                          />
                        </td>
                      );
                    })}
                    <td className="text-end" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{r.payableDays}</td>
                    <td>
                      <input
                        className="form-input"
                        type="number"
                        min={0}
                        step={0.5}
                        style={{ width: 68, minWidth: 68, padding: '5px 6px', fontSize: 12, borderRadius: 6 }}
                        value={r.otHours ?? 0}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAttRows((prev) => prev.map((row) => row.empId === r.empId ? { ...row, otHours: v } : row));
                        }}
                      />
                    </td>
                  </tr>
                ))}
                {!attRows.length && (
                  <tr><td colSpan={daysInMonth + 3} className="text-muted" style={{ textAlign: 'center' }}>Click Load grid</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'payroll' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={processPayroll}>Process payroll</button>
            <button type="button" className="btn btn-secondary" onClick={lockPayroll}>Lock month</button>
            <a className="btn btn-secondary" href={`/api/hrm/reports/wages?month=${month}&year=${year}`} target="_blank" rel="noreferrer">Wages register CSV</a>
            {payroll?.locked && <span style={{ color: '#dc2626', fontWeight: 600, alignSelf: 'center' }}>LOCKED</span>}
            <span style={{ width: 1, height: 24, background: 'var(--border, #e2e8f0)', margin: '0 4px' }} />
            <select id="sd-payslip-emp" className="form-input" style={{ maxWidth: 240, height: 36 }}>
              <option value="">Payslip — select employee…</option>
              {(employees || []).filter(e => e.isActive !== false && !e.deleted).map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.employeeCode || e.uan || '—'})</option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary" onClick={() => {
              const id = document.getElementById('sd-payslip-emp')?.value;
              const emp = (employees || []).find(e => String(e.id) === String(id));
              if (!emp) { toast('Select an employee for payslip', 'warning'); return; }
              const rows = payroll?.rows || payroll?.employees || (Array.isArray(payroll) ? payroll : []) || [];
              const row = rows.find(r => String(r.employeeId || r.empId || r.id) === String(emp.id)) || {};
              generatePayslip(emp, row);
            }}>Generate / Download payslip</button>
          </div>
          <div className="glass-panel" style={{ overflow: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th className="text-end">Days</th>
                  <th className="text-end">Gross</th><th className="text-end">PF EE</th>
                  <th className="text-end">ESI EE</th><th className="text-end">OT</th><th className="text-end">Net</th>
                </tr>
              </thead>
              <tbody>
                {(payroll?.rows || []).map((r) => (
                  <tr key={r.empId}>
                    <td>{r.employeeCode}</td>
                    <td>{r.name}</td>
                    <td className="text-end" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{r.payableDays}</td>
                    <td className="text-end">{Number(r.grossEarnings || 0).toLocaleString('en-IN')}</td>
                    <td className="text-end">{Number(r.pfEE || 0).toLocaleString('en-IN')}</td>
                    <td className="text-end">{Number(r.esiEE || 0).toLocaleString('en-IN')}</td>
                    <td className="text-end">{Number(r.otPay || 0).toLocaleString('en-IN')}</td>
                    <td className="text-end" style={{ fontWeight: 600 }}>{Number(r.netSalary || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
                {!payroll?.rows?.length && (
                  <tr><td colSpan={8} className="text-muted">No payroll — save attendance then Process</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'minwages' && (
        <div>
          <p className="text-muted">
            State minimum wages (basic + DA per day) by skill category — used for payroll underpayment warnings under Indian labour rules.
          </p>
          <button type="button" className="btn btn-primary" style={{ marginBottom: 12 }} onClick={() => setMwForm({
            state: '', skillCategory: 'Unskilled', basicPerDay: '', daComponent: '', effectiveFrom: new Date().toISOString().slice(0, 10),
          })}>+ Min wage</button>
          <div className="glass-panel" style={{ overflow: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr><th>State</th><th>Skill</th><th className="text-end">Basic/day</th><th className="text-end">DA</th><th>From</th><th></th></tr>
              </thead>
              <tbody>
                {minWages.map((m) => (
                  <tr key={m.id}>
                    <td>{m.state}</td>
                    <td>{m.skillCategory}</td>
                    <td className="text-end">{m.basicPerDay}</td>
                    <td className="text-end">{m.daComponent}</td>
                    <td>{m.effectiveFrom || '—'}</td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMwForm({ ...m })}>Edit</button>{' '}
                      <button type="button" className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }} onClick={() => deleteMinWage(m)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {!minWages.length && <tr><td colSpan={6} className="text-muted">No rows yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Statutory downloads — portal filings + registers (single surface) */}
      {(tab === 'statutory' || tab === 'filings' || tab === 'registers' || tab === 'exports') && (
        <div className="glass-panel" style={{ padding: 20, width: '100%', maxWidth: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
            <div>
              <h3 style={{ marginTop: 0, marginBottom: 4 }}>Statutory downloads — {MONTH_NAMES[month - 1]} {year}</h3>
              <p className="text-muted" style={{ fontSize: 13, margin: 0, maxWidth: 720 }}>
                Process <strong>Payroll</strong> (and mark attendance) for this month first. Portal files go to EPFO / ESIC;
                registers are for inspection and internal books. API report math is unchanged.
              </p>
            </div>
            {periodBar}
          </div>

          <h4 style={{ margin: '16px 0 8px', fontSize: '0.8rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Portal filings</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface, #fff)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>EPFO — Electronic Challan cum Return</div>
              <p className="text-muted" style={{ fontSize: 12, margin: '0 0 12px', lineHeight: 1.4 }}>
                Text file for the EPFO portal (UAN-wise PF / EPS / EDLI). Use establishment code from HR Settings.
              </p>
              {hrmPipeline.canEcr ? (
                <a className="btn btn-primary" href={`/api/hrm/reports/ecr?month=${month}&year=${year}`} target="_blank" rel="noreferrer">
                  Download EPFO ECR (.txt)
                </a>
              ) : (
                <button type="button" className="btn btn-secondary" disabled title={hrmPipeline.reasonsEcr.join('; ')}>Download EPFO ECR (.txt)</button>
              )}
              {!hrmPipeline.canEcr && (
                <p className="text-muted" style={{ fontSize: 11, margin: '8px 0 0' }}>{hrmPipeline.reasonsEcr[0]}</p>
              )}
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface, #fff)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>ESIC — contribution statement</div>
              <p className="text-muted" style={{ fontSize: 12, margin: '0 0 12px', lineHeight: 1.4 }}>
                CSV of IP-wise ESI for eligible employees (gross within ESI ceiling). Employer code from HR Settings.
              </p>
              {hrmPipeline.canEsic ? (
                <a className="btn btn-secondary" href={`/api/hrm/reports/esic?month=${month}&year=${year}`} target="_blank" rel="noreferrer">
                  Download ESIC CSV
                </a>
              ) : (
                <button type="button" className="btn btn-secondary" disabled title={hrmPipeline.reasonsEsic.join('; ')}>Download ESIC CSV</button>
              )}
              {!hrmPipeline.canEsic && (
                <p className="text-muted" style={{ fontSize: 11, margin: '8px 0 0' }}>{hrmPipeline.reasonsEsic[0]}</p>
              )}
            </div>
          </div>

          <h4 style={{ margin: '20px 0 8px', fontSize: '0.8rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Registers</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface, #fff)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Attendance register</div>
              <p className="text-muted" style={{ fontSize: 12, margin: '0 0 12px', lineHeight: 1.4 }}>
                Day-wise attendance (P / A / H / W / PL) for the selected month. Current download is CSV; the attached statutory workbook requires a formatted XLSX export route.
              </p>
              <a className="btn btn-secondary" href={`/api/hrm/reports/attendance?month=${month}&year=${year}`} target="_blank" rel="noreferrer">
                Download attendance register CSV
              </a>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface, #fff)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>Wages register</div>
              <p className="text-muted" style={{ fontSize: 12, margin: '0 0 12px', lineHeight: 1.4 }}>
                Earnings, deductions and net pay from processed payroll. Current download is CSV; Form XVII layout needs a formatted XLSX export route.
              </p>
              <a className="btn btn-secondary" href={`/api/hrm/reports/wages?month=${month}&year=${year}`} target="_blank" rel="noreferrer">
                Download wages register CSV
              </a>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface, #fff)', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 12, justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>CLRA labour registers (Excel)</div>
                  <p className="text-muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    Form T, XVII, XXII, XX, XXI, XXIII, XIII — headers use contractor / establishment / principal employer (global HR Settings or per-site). Open .xls in Excel → Save As .xlsx if needed.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label className="text-muted" style={{ fontSize: 12 }}>Site filter</label>
                  <select className="form-input" style={{ minWidth: 180 }} value={statSiteId} onChange={(e) => setStatSiteId(e.target.value)}>
                    <option value="">All sites</option>
                    {(config.sites || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <span className="text-muted" style={{ fontSize: 12 }}>{MONTH_NAMES[month - 1]} {year}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {[
                  { path: 'form-t', title: 'Form T — Muster / Attendance', tip: 'Combined muster roll cum attendance' },
                  { path: 'form-xvii', title: 'Form XVII — Wages', tip: 'Register of wages from payroll' },
                  { path: 'form-xxii', title: 'Form XXII — Advances', tip: 'Nil until advances module captures data' },
                  { path: 'form-xx', title: 'Form XX — Damage / Loss', tip: 'Nil deductions template' },
                  { path: 'form-xxi', title: 'Form XXI — Fines', tip: 'Nil fines template' },
                  { path: 'form-xxiii', title: 'Form XXIII — Overtime', tip: 'From attendance OT hrs' },
                  { path: 'form-xiii', title: 'Form XIII — Workmen', tip: 'Register of workmen employed' },
                ].map((r) => (
                  <div key={r.path} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{r.title}</div>
                    <p className="text-muted" style={{ fontSize: 11, margin: '0 0 10px' }}>{r.tip}</p>
                    <a className="btn btn-secondary btn-sm" href={statUrl(r.path)} target="_blank" rel="noreferrer">Download Excel</a>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: 12, marginTop: 16 }}>
            Tip: validate ECR / ESIC row counts against Payroll totals for the same month before portal upload.
          </p>
        </div>
      )}



      {tab === 'leave' && (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
              Leave register (CL / SL / EL). Approve deducts balance on the employee master.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setLeaveForm({
              empId: '', type: 'CL', from: new Date().toISOString().slice(0, 10), to: '', days: 1, note: '',
            })}>+ Leave request</button>
          </div>
          <div className="glass-panel" style={{ overflow: 'auto', width: '100%' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th className="text-end">Days</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {leaveRows.map((lv) => (
                  <tr key={lv.id}>
                    <td>{lv.empName || lv.employeeCode || lv.empId}</td>
                    <td>{lv.type}</td>
                    <td>{lv.from || '—'}</td>
                    <td>{lv.to || '—'}</td>
                    <td className="text-end">{lv.days}</td>
                    <td>{lv.status}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {lv.status === 'pending' && (
                        <>
                          <button type="button" className="btn btn-primary btn-sm" onClick={async () => {
                            try {
                              await api('/hrm/leave/' + encodeURIComponent(lv.id) + '/decide', { method: 'POST', body: JSON.stringify({ status: 'approved' }) });
                              toast('Leave approved', 'success');
                              loadLeave(); loadEmployees();
                            } catch (e) { toast(e.message || 'Approve failed — is server updated with leave API?', 'error'); }
                          }}>Approve</button>{' '}
                          <button type="button" className="btn btn-secondary btn-sm" onClick={async () => {
                            try {
                              await api('/hrm/leave/' + encodeURIComponent(lv.id) + '/decide', { method: 'POST', body: JSON.stringify({ status: 'rejected' }) });
                              toast('Leave rejected', 'info');
                              loadLeave();
                            } catch (e) { toast(e.message, 'error'); }
                          }}>Reject</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {!leaveRows.length && (
                  <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                    No leave requests yet. Click <strong>+ Leave request</strong> to add one.
                    If submit fails, ensure server.js includes <code>/api/hrm/leave</code> routes.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="glass-panel" style={{ padding: 20, width: '100%', maxWidth: '100%' }}>
          <h3 style={{ marginTop: 0 }}>HR Settings</h3>
          <p className="text-muted" style={{ fontSize: 13 }}>
            PF wage ceiling default ₹15,000; ESI eligibility typically when gross ≤ ₹21,000 (update if law changes). Sites below feed the employee form location picker (filter by state).
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Employer / establishment name</label>
              <input className="form-input" value={config.employerName || ''} onChange={(e) => setConfig({ ...config, employerName: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">EPFO establishment code</label>
              <input className="form-input" value={config.establishmentCode || ''} onChange={(e) => setConfig({ ...config, establishmentCode: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">ESIC employer code</label>
              <input className="form-input" value={config.esicCode || ''} onChange={(e) => setConfig({ ...config, esicCode: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Contractor name and address</label>
              <textarea className="form-input" rows={2} value={config.contractorNameAddress || ''} onChange={(e) => setConfig({ ...config, contractorNameAddress: e.target.value })} placeholder="Name and full postal address of contractor" style={{ resize: 'vertical', minHeight: 64 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Nature and location of work</label>
              <textarea className="form-input" rows={2} value={config.natureLocationOfWork || ''} onChange={(e) => setConfig({ ...config, natureLocationOfWork: e.target.value })} placeholder="Nature of work and site/location address" style={{ resize: 'vertical', minHeight: 64 }} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Name and address of establishment where contract work is carried on</label>
              <textarea className="form-input" rows={2} value={config.contractEstablishmentNameAddress || ''} onChange={(e) => setConfig({ ...config, contractEstablishmentNameAddress: e.target.value })} placeholder="Establishment name, site address, village/taluk/district/state/PIN" style={{ resize: 'vertical', minHeight: 64 }} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Name and address of principal employer</label>
              <textarea className="form-input" rows={2} value={config.principalEmployerNameAddress || ''} onChange={(e) => setConfig({ ...config, principalEmployerNameAddress: e.target.value })} placeholder="Principal employer's legal name and full address" style={{ resize: 'vertical', minHeight: 64 }} />
            </div>
            <div className="form-group">
              <label className="form-label">PF wage cap (₹)</label>
              <input className="form-input" type="number" value={config.pfCap ?? 15000} onChange={(e) => setConfig({ ...config, pfCap: Number(e.target.value) || 0 })} />
            </div>
            <div className="form-group">
              <label className="form-label">ESI gross cap (₹)</label>
              <input className="form-input" type="number" value={config.esiCap ?? 21000} onChange={(e) => setConfig({ ...config, esiCap: Number(e.target.value) || 0 })} />
            </div>
            <div className="form-group">
              <label className="form-label">Proration</label>
              <select className="form-input" value={config.proration || 'ACTUAL'} onChange={(e) => setConfig({ ...config, proration: e.target.value })}>
                <option value="ACTUAL">Actual calendar days</option>
                <option value="26">26-day month</option>
                <option value="30">30-day month</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">PF base</label>
              <select className="form-input" value={config.pfBase || 'BASIC_DA'} onChange={(e) => setConfig({ ...config, pfBase: e.target.value })}>
                <option value="BASIC_DA">Basic + DA</option>
                <option value="BASIC">Basic only</option>
              </select>
            </div>
          </div>

          <h4 style={{ marginTop: 20, marginBottom: 8 }}>Sites / locations</h4>
          <p className="text-muted" style={{ fontSize: 12 }}>Optional state link filters the site dropdown when an employee’s state is set.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <input className="form-input" placeholder="Site name" value={siteDraft.name} onChange={(e) => setSiteDraft({ ...siteDraft, name: e.target.value })} style={{ maxWidth: 200 }} />
            <select className="form-input" value={siteDraft.state} onChange={(e) => setSiteDraft({ ...siteDraft, state: e.target.value })} style={{ maxWidth: 200 }}>
              <option value="">Any state</option>
              {(INDIAN_STATES || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" className="btn btn-secondary" onClick={addSite}>Add site</button>
          </div>
          <table className="data-table" style={{ width: '100%', marginBottom: 16 }}>
            <thead><tr><th>Site</th><th>State</th><th></th></tr></thead>
            <tbody>
              {(config.sites || []).map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.state || 'Any'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSiteEdit({ ...s })}>Statutory header</button>{' '}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeSite(s.id)}>Remove</button>
                  </td>
                </tr>
              ))}
              {!(config.sites || []).length && <tr><td colSpan={3} className="text-muted">No sites — add Head Office / sites above</td></tr>}
            </tbody>
          </table>

          <button type="button" className="btn btn-primary" onClick={saveConfig}>Save HR settings</button>
        </div>
      )}

      

      
      {siteEdit && (
        <div className="modal-overlay" onClick={() => setSiteEdit(null)}>
          <div className="modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="section-title">Site statutory header — {siteEdit.name}</h3>
            <p className="text-muted" style={{ fontSize: 12 }}>Used on Form T / XVII / XIII etc. when this site is selected for download. Overrides global HR Settings for that export.</p>
            {[
              ['contractorNameAddress', 'Contractor name and address'],
              ['natureLocationOfWork', 'Nature and location of work'],
              ['contractEstablishmentNameAddress', 'Establishment where contract work is carried on'],
              ['principalEmployerNameAddress', 'Principal employer name and address'],
            ].map(([k, lab]) => (
              <div key={k} className="form-group">
                <label className="form-label">{lab}</label>
                <textarea className="form-input" rows={2} value={siteEdit[k] || ''} onChange={(e) => setSiteEdit({ ...siteEdit, [k]: e.target.value })} style={{ resize: 'vertical', minHeight: 56 }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setSiteEdit(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={async () => {
                const sites = (config.sites || []).map((s) => s.id === siteEdit.id ? { ...s, ...siteEdit } : s);
                try {
                  const next = await api('/hrm/config', { method: 'POST', body: JSON.stringify({ ...config, sites }) });
                  setConfig(next);
                  setSiteEdit(null);
                  toast('Site statutory header saved', 'success');
                } catch (e) { toast(e.message, 'error'); }
              }}>Save</button>
            </div>
          </div>
        </div>
      )}

{leaveForm && (
        <div className="modal-overlay" onClick={() => setLeaveForm(null)}>
          <div className="modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="section-title">Leave request</h3>
            <div className="form-group">
              <label className="form-label">Employee *</label>
              <select className="form-input" value={leaveForm.empId || ''} onChange={(e) => {
                const id = e.target.value;
                const emp = employees.find((x) => x.id === id);
                setLeaveForm({
                  ...leaveForm,
                  empId: id,
                  empName: emp?.name || '',
                  employeeCode: emp?.employeeCode || '',
                });
              }}>
                <option value="">Select</option>
                {employees.filter((e) => e.isActive !== false).map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.employeeCode || '—'}) · CL {e.leaveCL ?? '—'} / SL {e.leaveSL ?? '—'} / EL {e.leaveEL ?? '—'}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-input" value={leaveForm.type || 'CL'} onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}>
                <option value="CL">Casual (CL)</option>
                <option value="SL">Sick (SL)</option>
                <option value="EL">Earned (EL)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">From</label>
              <input className="form-input" type="date" value={leaveForm.from || ''} onChange={(e) => setLeaveForm({ ...leaveForm, from: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">To</label>
              <input className="form-input" type="date" value={leaveForm.to || ''} onChange={(e) => setLeaveForm({ ...leaveForm, to: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Days</label>
              <input className="form-input" type="number" min={0.5} step={0.5} value={leaveForm.days ?? 1} onChange={(e) => setLeaveForm({ ...leaveForm, days: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Note</label>
              <input className="form-input" value={leaveForm.note || ''} onChange={(e) => setLeaveForm({ ...leaveForm, note: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setLeaveForm(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={async () => {
                if (!leaveForm.empId) { toast('Select employee', 'warning'); return; }
                setBusy(true);
                try {
                  await api('/hrm/leave', { method: 'POST', body: JSON.stringify({ ...leaveForm, days: Number(leaveForm.days) || 1 }) });
                  toast('Leave request saved', 'success');
                  setLeaveForm(null);
                  loadLeave();
                } catch (e) { toast(e.message, 'error'); }
                setBusy(false);
              }}>Submit</button>
            </div>
          </div>
        </div>
      )}

{/* Employee modal */}
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal-content" style={{ maxWidth: 1100, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="section-title">{form.id ? 'Edit employee' : 'New employee'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))', gap: '10px 12px', alignItems: 'end' }}>
              {[
                ['name', 'Full name *'], ['employeeCode', 'Emp code (auto if blank)'],
                ['fatherName', "Father's / Husband's name"], ['designation', 'Designation'],
                ['department', 'Department'], ['mobile', 'Mobile'], ['email', 'Email'],
                ['uan', 'UAN (12 digit)'], ['esicNumber', 'ESIC IP number'], ['pan', 'PAN'], ['aadhar', 'Aadhaar'],
                ['bankName', 'Bank'], ['accountNumber', 'A/c number'], ['ifsc', 'IFSC'],
                ['basic', 'Basic (₹/month)', 'number'], ['hra', 'HRA', 'number'], ['da', 'DA', 'number'], ['allowances', 'Other allowances', 'number'],
              ].map(([key, label, type]) => (
                <div key={key} className="form-group">
                  <label className="form-label">{label}</label>
                  <input
                    className="form-input"
                    type={type || 'text'}
                    value={form[key] ?? ''}
                    onChange={(e) => setForm({ ...form, [key]: type === 'number' ? e.target.value : e.target.value })}
                  />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select className="form-input" value={form.gender || ''} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">—</option>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date of birth</label>
                <input className="form-input" type="date" value={form.dob || ''} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Date of joining</label>
                <input className="form-input" type="date" value={form.doj || ''} onChange={(e) => setForm({ ...form, doj: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">State *</label>
                <select
                  className="form-input"
                  value={form.state || ''}
                  onChange={(e) => {
                    const next = applyMinWageFromMaster({ ...form, state: e.target.value, site: '', siteId: '' });
                    setForm(next);
                  }}
                >
                  <option value="">Select state</option>
                  {(INDIAN_STATES || []).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Site / location</label>
                <select
                  className="form-input"
                  value={form.siteId || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    const s = (config.sites || []).find((x) => x.id === id);
                    setForm({ ...form, siteId: id, site: s?.name || form.site || '' });
                  }}
                >
                  <option value="">— Select site —</option>
                  {sitesForState.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{s.state ? ` (${s.state})` : ''}</option>
                  ))}
                </select>
                <input
                  className="form-input"
                  style={{ marginTop: 6 }}
                  placeholder="Or type site / location"
                  value={form.site || ''}
                  onChange={(e) => setForm({ ...form, site: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Skill category</label>
                <select className="form-input" value={form.skillCategory || 'Unskilled'} onChange={(e) => setForm(applyMinWageFromMaster({ ...form, skillCategory: e.target.value }))}>
                  {SKILL_CATS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {form._minWageNote ? (
                <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--primary, #1e40af)', background: 'var(--surface-2, #f1f5f9)', padding: '6px 10px', borderRadius: 6 }}>
                  {form._minWageNote}
                </div>
              ) : null}

            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
              <div className="form-group"><label className="form-label">Leave CL balance</label>
                <input className="form-input" type="number" value={form.leaveCL ?? 12} onChange={(e) => setForm({ ...form, leaveCL: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Leave SL balance</label>
                <input className="form-input" type="number" value={form.leaveSL ?? 6} onChange={(e) => setForm({ ...form, leaveSL: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Leave EL balance</label>
                <input className="form-input" type="number" value={form.leaveEL ?? 15} onChange={(e) => setForm({ ...form, leaveEL: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
              <label><input type="checkbox" checked={!!form.pfApplicable} onChange={(e) => setForm({ ...form, pfApplicable: e.target.checked })} /> PF applicable</label>
              <label><input type="checkbox" checked={!!form.esiApplicable} onChange={(e) => setForm({ ...form, esiApplicable: e.target.checked })} /> ESI applicable</label>
              <label><input type="checkbox" checked={form.isActive !== false} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={saveEmp}>{busy ? 'Saving…' : 'Save employee'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Min wage modal (in-app, not browser prompt) */}
      {mwForm && (
        <div className="modal-overlay" onClick={() => setMwForm(null)}>
          <div className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="section-title">{mwForm.id ? 'Edit min wage' : 'Add min wage'}</h3>
            <div className="form-group">
              <label className="form-label">State *</label>
              <select className="form-input" value={mwForm.state || ''} onChange={(e) => setMwForm({ ...mwForm, state: e.target.value })}>
                <option value="">Select state</option>
                {(INDIAN_STATES || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Skill category</label>
              <select className="form-input" value={mwForm.skillCategory || 'Unskilled'} onChange={(e) => setMwForm({ ...mwForm, skillCategory: e.target.value })}>
                {SKILL_CATS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Basic per day (₹)</label>
              <input className="form-input" type="number" value={mwForm.basicPerDay ?? ''} onChange={(e) => setMwForm({ ...mwForm, basicPerDay: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">DA component (₹)</label>
              <input className="form-input" type="number" value={mwForm.daComponent ?? ''} onChange={(e) => setMwForm({ ...mwForm, daComponent: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Effective from</label>
              <input className="form-input" type="date" value={mwForm.effectiveFrom || ''} onChange={(e) => setMwForm({ ...mwForm, effectiveFrom: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setMwForm(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={saveMinWage}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
