import { suggestGstRate } from '../utils/hsnRates';
import {
  getHsnMaster, addHsnCode, removeHsnCode,
  getUnitMaster, addUnit as saveUnitMaster, removeUnit as deleteUnitMaster,
  getExpenseCategories, addExpenseCategory, removeExpenseCategory,
  loadMasterDataFromServer, syncMasterDataToServer,
} from '../utils/masterData';
import { useState, useEffect, lazy, Suspense } from 'react';
const InventoryViewLazy = lazy(() => import('./InventoryView'));
import { getAllCostCenters, saveCostCenter, deleteCostCenter } from '../store';
import { toast } from './Toast';
import { confirmAction, promptAction } from './ConfirmModal';
import ActionMenu from './ActionMenu';

/** Sequential cost-centre ids: CC-001, CC-002… (keeps existing ids unchanged). */
function nextCcId(list) {
  let max = 0;
  for (const c of list || []) {
    const m = String(c.id || '').match(/^(?:cc[_-]?|CC-?)(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  // Also count non-matching rows so new ids stay unique by sequence length
  const n = Math.max(max, (list || []).length);
  return `CC-${String(n + 1).padStart(3, '0')}`;
}

const TABS = [
  { id: 'cc', label: 'Cost Centres' },
  { id: 'hsn', label: 'HSN / SAC' },
  { id: 'units', label: 'Units' },
  { id: 'exp', label: 'Expense categories' },
  { id: 'services', label: 'Services' },
];

const tableWrap = { width: '100%', overflowX: 'auto' };
const tableFull = { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' };

export default function CostCentersView() {
  const [hsnSearch, setHsnSearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [catSearch, setCatSearch] = useState('');
  const [tab, setTab] = useState(() => {
    try {
      const t = sessionStorage.getItem('sd_master_tab');
      if (t && ['cc', 'hsn', 'units', 'exp', 'services'].includes(t)) return t;
    } catch (_) {}
    return 'cc';
  });
  useEffect(() => {
    try { sessionStorage.setItem('sd_master_tab', tab); } catch (_) {}
  }, [tab]);

  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [editing, setEditing] = useState(null);
  const [hsnList, setHsnList] = useState(() => getHsnMaster());
  const [unitList, setUnitList] = useState(() => getUnitMaster());
  const [expList, setExpList] = useState(() => getExpenseCategories());

  useEffect(() => {
    loadMasterDataFromServer().then(() => {
      try {
        setHsnList(getHsnMaster());
        setUnitList(getUnitMaster());
        setExpList(getExpenseCategories());
      } catch (e) { /* ignore */ }
    }).catch(() => {});
  }, []);

  const load = () => getAllCostCenters().then(setList).catch(() => toast('Failed to load cost centres', 'error'));
  useEffect(() => { load(); }, []);

  const addOrSave = async () => {
    if (!name.trim()) { toast('Name required', 'warning'); return; }
    const nm = name.trim().toLowerCase();
    if (list.some(c => (c.name || '').trim().toLowerCase() === nm && c.id !== editing?.id)) {
      toast(`Duplicate cost centre: "${name.trim()}" already exists`, 'error');
      return;
    }
    const id = editing?.id || nextCcId(list);
    await saveCostCenter({ id, name: name.trim(), parentId: parentId || null, active: true });
    setName(''); setParentId(''); setEditing(null);
    load();
    toast(editing ? 'Cost Centre updated' : 'Cost Centre saved', 'success');
  };

  const startEdit = (c) => {
    setEditing(c);
    setName(c.name || '');
    setParentId(c.parentId || '');
  };

  const copyCc = async (c) => {
    const id = nextCcId(list);
    const base = `${c.name || 'Cost centre'} (copy)`;
    let nm = base;
    let n = 2;
    while (list.some(x => (x.name || '').trim().toLowerCase() === nm.toLowerCase())) {
      nm = `${base} ${n++}`;
    }
    await saveCostCenter({ id, name: nm, parentId: c.parentId || null, active: true });
    load();
    toast(`Copied as ${nm}`, 'success');
  };

  const remove = async (id) => {
    const ok = await confirmAction({
      title: 'Delete cost centre?',
      message: 'This cannot be undone. Invoices already using it keep the old name.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteCostCenter(id);
      load();
      toast('Deleted', 'success');
    } catch (e) {
      toast(e.message || 'Delete failed', 'error');
    }
  };

  const addHsn = async () => {
    const v = await promptAction({
      title: 'Add HSN / SAC',
      message: 'Enter 2, 4, 6 or 8 digit code',
      placeholder: 'e.g. 998599',
      confirmLabel: 'Save',
    });
    if (v == null) return;
    const t = String(v).trim();
    if (!/^\d{2}$|^\d{4}$|^\d{6}$|^\d{8}$/.test(t)) {
      toast('HSN/SAC must be 2, 4, 6 or 8 digits', 'error');
      return;
    }
    const res = addHsnCode(t);
    if (!res?.ok) { toast(res?.error || 'Duplicate HSN', 'error'); return; }
    setHsnList(res.list);
    try { syncMasterDataToServer(); } catch (e) {}
    toast(`HSN/SAC ${t} saved — available on Invoice, WO, PO`, 'success');
  };

  const editHsn = async (code) => {
    const v = await promptAction({
      title: 'Edit HSN / SAC',
      message: 'Enter 2, 4, 6 or 8 digit code',
      placeholder: code,
      defaultValue: code,
      confirmLabel: 'Save',
    });
    if (v == null) return;
    const t = String(v).trim();
    if (!/^\d{2}$|^\d{4}$|^\d{6}$|^\d{8}$/.test(t)) {
      toast('HSN/SAC must be 2, 4, 6 or 8 digits', 'error');
      return;
    }
    if (t === code) return;
    removeHsnCode(code);
    const res = addHsnCode(t);
    if (!res?.ok) {
      addHsnCode(code);
      toast(res?.error || 'Duplicate HSN', 'error');
      setHsnList(getHsnMaster());
      return;
    }
    setHsnList(res.list);
    try { syncMasterDataToServer(); } catch (e) {}
    toast(`Updated to ${t}`, 'success');
  };

  const copyHsn = async (code) => {
    await navigator.clipboard?.writeText?.(String(code)).catch(() => {});
    toast(`Copied ${code}`, 'success');
  };

  const removeHsn = async (code) => {
    const ok = await confirmAction({ title: 'Remove HSN/SAC?', message: code, confirmLabel: 'Remove', tone: 'danger' });
    if (!ok) return;
    setHsnList(removeHsnCode(code));
    try { syncMasterDataToServer(); } catch (e) {}
    toast('Removed', 'success');
  };

  const addUnit = async () => {
    const v = await promptAction({
      title: 'Add unit',
      message: 'e.g. Nos, Hrs, Sqft, Job',
      placeholder: 'Unit',
      confirmLabel: 'Save',
    });
    if (v == null) return;
    const t = String(v).trim();
    if (!t) return;
    const res = saveUnitMaster(t);
    if (!res?.ok) { toast(res?.error || 'Duplicate unit', 'error'); return; }
    setUnitList(res.list);
    try { syncMasterDataToServer(); } catch (e) {}
    toast(`Unit "${t}" saved`, 'success');
  };

  const editUnit = async (oldU) => {
    const v = await promptAction({
      title: 'Edit unit',
      message: `Current: ${oldU}`,
      placeholder: 'Unit',
      defaultValue: oldU,
      confirmLabel: 'Save',
    });
    if (v == null) return;
    const t = String(v).trim();
    if (!t) return;
    deleteUnitMaster(oldU);
    const res = saveUnitMaster(t);
    if (!res?.ok) {
      saveUnitMaster(oldU);
      toast(res?.error || 'Duplicate unit', 'error');
      setUnitList(getUnitMaster());
      return;
    }
    setUnitList(res.list);
    try { syncMasterDataToServer(); } catch (e) {}
    toast(`Unit updated to "${t}"`, 'success');
  };

  const copyUnit = async (u) => {
    const base = `${u} (copy)`;
    let nm = base;
    let n = 2;
    const lower = (unitList || []).map(x => String(x).toLowerCase());
    while (lower.includes(nm.toLowerCase())) nm = `${base} ${n++}`;
    const res = saveUnitMaster(nm);
    if (!res?.ok) { toast(res?.error || 'Could not copy', 'error'); return; }
    setUnitList(res.list);
    try { syncMasterDataToServer(); } catch (e) {}
    toast(`Copied as ${nm}`, 'success');
  };

  const removeUnit = async (u) => {
    const ok = await confirmAction({ title: 'Remove unit?', message: u, confirmLabel: 'Remove', tone: 'danger' });
    if (!ok) return;
    setUnitList(deleteUnitMaster(u));
    try { syncMasterDataToServer(); } catch (e) {}
    toast('Removed', 'success');
  };

  const addExp = async () => {
    const v = await promptAction({
      title: 'Add expense category',
      message: 'e.g. Direct Labor, Subcontract, Materials',
      placeholder: 'Category',
      confirmLabel: 'Save',
    });
    if (v == null) return;
    const t = String(v).trim();
    if (!t) return;
    const res = addExpenseCategory(t);
    if (!res?.ok) { toast(res?.error || 'Duplicate category', 'error'); return; }
    setExpList(res.list);
    try { syncMasterDataToServer(); } catch (e) {}
    toast(`Category "${t}" saved`, 'success');
  };

  const editExp = async (oldC) => {
    const v = await promptAction({
      title: 'Edit expense category',
      message: `Current: ${oldC}`,
      placeholder: 'Category',
      defaultValue: oldC,
      confirmLabel: 'Save',
    });
    if (v == null) return;
    const t = String(v).trim();
    if (!t) return;
    removeExpenseCategory(oldC);
    const res = addExpenseCategory(t);
    if (!res?.ok) {
      addExpenseCategory(oldC);
      toast(res?.error || 'Duplicate category', 'error');
      setExpList(getExpenseCategories());
      return;
    }
    setExpList(res.list);
    try { syncMasterDataToServer(); } catch (e) {}
    toast(`Category "${t}" updated`, 'success');
  };

  const copyExp = async (c) => {
    const base = `${c} (copy)`;
    let nm = base;
    let n = 2;
    const lower = (expList || []).map(x => String(x).toLowerCase());
    while (lower.includes(nm.toLowerCase())) nm = `${base} ${n++}`;
    const res = addExpenseCategory(nm);
    if (!res?.ok) { toast(res?.error || 'Could not copy', 'error'); return; }
    setExpList(res.list);
    try { syncMasterDataToServer(); } catch (e) {}
    toast(`Copied as ${nm}`, 'success');
  };

  const removeExp = async (c) => {
    const ok = await confirmAction({ title: 'Remove category?', message: c, confirmLabel: 'Remove', tone: 'danger' });
    if (!ok) return;
    setExpList(removeExpenseCategory(c));
    try { syncMasterDataToServer(); } catch (e) {}
    toast('Removed', 'success');
  };

  const filteredHsn = (hsnList || []).filter(code =>
    !hsnSearch || String(code).toLowerCase().includes(String(hsnSearch).toLowerCase())
  );
  const filteredUnits = (unitList || []).filter(u =>
    !unitSearch || String(u).toLowerCase().includes(String(unitSearch).toLowerCase())
  );
  const filteredExp = (expList || []).filter(c =>
    !catSearch || String(c).toLowerCase().includes(String(catSearch).toLowerCase())
  );

  return (
    <div className="page master-data-page" style={{ width: '100%', maxWidth: 'none', padding: '0 4px' }}>
      <h1 style={{ marginBottom: 12, fontSize: '1.35rem', fontWeight: 700 }}>Master data</h1>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16,
        borderBottom: '1px solid var(--border, #e5e7eb)', paddingBottom: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            style={{
              borderRadius: '8px 8px 0 0',
              borderBottom: tab === t.id ? '2px solid var(--primary, #2563eb)' : '2px solid transparent',
              marginBottom: -1,
            }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cc' && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ flex: '1 1 220px', minWidth: 160 }}
              placeholder="e.g. Chirala Site / Tower A"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <select className="form-input" style={{ flex: '0 1 200px' }} value={parentId} onChange={e => setParentId(e.target.value)}>
              <option value="">— No parent (root) —</option>
              {list.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={addOrSave}>
              {editing ? 'Update' : 'Add'}
            </button>
            {editing && (
              <button type="button" className="btn btn-secondary" onClick={() => { setEditing(null); setName(''); setParentId(''); }}>
                Cancel
              </button>
            )}
          </div>
          <div className="table-responsive" style={tableWrap}>
            <table className="data-table" style={tableFull}>
              <thead>
                <tr>
                  <th style={{ width: '36%' }}>NAME</th>
                  <th style={{ width: '28%' }}>PARENT</th>
                  <th style={{ width: '24%' }}>ID</th>
                  <th style={{ width: '12%' }} />
                </tr>
              </thead>
              <tbody>
                {list.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{list.find(x => x.id === c.parentId)?.name || '—'}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>{c.id}</td>
                    <td style={{ textAlign: 'right' }}>
                      <ActionMenu
                        items={[
                          { label: 'Edit', onClick: () => startEdit(c) },
                          { label: 'Copy', onClick: () => copyCc(c) },
                          { label: 'Delete', onClick: () => remove(c.id), danger: true },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
                {!list.length && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No cost centres yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'hsn' && (
        <>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
            marginBottom: 12, width: '100%',
          }}>
            <input
              className="form-input"
              style={{ flex: '1 1 200px', minWidth: 140 }}
              placeholder="Search HSN…"
              value={hsnSearch || ''}
              onChange={e => setHsnSearch(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-sm" style={{ flex: '0 0 auto' }} onClick={addHsn}>
              ＋ Add HSN / SAC
            </button>
          </div>
          <div className="table-responsive" style={tableWrap}>
            <table className="data-table" style={tableFull}>
              <thead>
                <tr>
                  <th style={{ width: '14%' }}>CODE</th>
                  <th style={{ width: '12%' }}>TYPE</th>
                  <th style={{ width: '48%' }}>DESCRIPTION</th>
                  <th style={{ width: '12%' }}>GST %</th>
                  <th style={{ width: '14%' }} />
                </tr>
              </thead>
              <tbody>
                {filteredHsn.map(code => {
                  const info = (() => {
                    try {
                      const s = suggestGstRate(code);
                      if (s && (s.label || s.rate != null)) return s;
                    } catch { /* */ }
                    const isService = /^99/.test(String(code));
                    return { label: isService ? 'Service (SAC)' : 'Goods (HSN)', rate: null, kind: isService ? 'service' : 'goods' };
                  })();
                  return (
                    <tr key={code}>
                      <td style={{ fontFamily: 'ui-monospace, monospace' }}>{code}</td>
                      <td>{info.kind === 'service' || /^99/.test(String(code)) ? 'Service' : 'Goods'}</td>
                      <td>{info.label || '—'}</td>
                      <td>{info.rate != null ? `${info.rate}%` : '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <ActionMenu
                          items={[
                            { label: 'Edit', onClick: () => editHsn(code) },
                            { label: 'Copy', onClick: () => copyHsn(code) },
                            { label: 'Delete', onClick: () => removeHsn(code), danger: true },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!filteredHsn.length && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No HSN/SAC codes yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'units' && (
        <>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
            marginBottom: 12, width: '100%',
          }}>
            <input
              className="form-input"
              style={{ flex: '1 1 200px', minWidth: 140 }}
              placeholder="Search units…"
              value={unitSearch || ''}
              onChange={e => setUnitSearch(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={addUnit}>＋ Add unit</button>
          </div>
          <div className="table-responsive" style={tableWrap}>
            <table className="data-table" style={tableFull}>
              <thead>
                <tr>
                  <th style={{ width: '80%' }}>UNIT</th>
                  <th style={{ width: '20%' }} />
                </tr>
              </thead>
              <tbody>
                {filteredUnits.map(u => (
                  <tr key={u}>
                    <td>{u}</td>
                    <td style={{ textAlign: 'right' }}>
                      <ActionMenu
                        items={[
                          { label: 'Edit', onClick: () => editUnit(u) },
                          { label: 'Copy', onClick: () => copyUnit(u) },
                          { label: 'Delete', onClick: () => removeUnit(u), danger: true },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
                {!filteredUnits.length && (
                  <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No units yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'exp' && (
        <>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
            marginBottom: 12, width: '100%',
          }}>
            <input
              className="form-input"
              style={{ flex: '1 1 200px', minWidth: 140 }}
              placeholder="Search categories…"
              value={catSearch || ''}
              onChange={e => setCatSearch(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={addExp}>＋ Add category</button>
          </div>
          <div className="table-responsive" style={tableWrap}>
            <table className="data-table" style={tableFull}>
              <thead>
                <tr>
                  <th style={{ width: '80%' }}>CATEGORY</th>
                  <th style={{ width: '20%' }} />
                </tr>
              </thead>
              <tbody>
                {filteredExp.map(c => (
                  <tr key={c}>
                    <td>{c}</td>
                    <td style={{ textAlign: 'right' }}>
                      <ActionMenu
                        items={[
                          { label: 'Edit', onClick: () => editExp(c) },
                          { label: 'Copy', onClick: () => copyExp(c) },
                          { label: 'Delete', onClick: () => removeExp(c), danger: true },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
                {!filteredExp.length && (
                  <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No categories yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'services' && (
        <div className="master-services-tab" style={{ marginTop: 0, width: '100%' }}>
          <Suspense fallback={<div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading services…</div>}>
            <InventoryViewLazy embedded />
          </Suspense>
        </div>
      )}
    </div>
  );
}
