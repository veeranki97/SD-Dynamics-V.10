import { useState, useEffect, useMemo } from 'react';
import { Target, Plus, Trash2, Edit3, Save, X, AlertTriangle } from 'lucide-react';
import { getAllBudgets, saveBudget, deleteBudget, getAllCostCenters, getAllJournals, getAllExpenses, getAllPurchases } from '../store';
import { formatCurrency, getFYOptions, getFinancialYearLabel } from '../utils';
import { ACCOUNTS } from '../utils/ledger';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';

const ACTIONS = [
  { id: 'Warn', label: 'Warn (Show alert, allow override)' },
  { id: 'Stop', label: 'Stop (Block transaction if exceeded)' },
  { id: 'Ignore', label: 'Ignore (Allow without warning)' },
];

const STANDARD_ACCOUNTS = [
  ACCOUNTS.DIRECT,
  ACCOUNTS.INDIRECT,
  'Site Consumables',
  'Subcontractor Charges',
  'Labor Charges',
  'Equipment Rental',
  'Fuel & Transportation',
];

export default function BudgetSettingsView() {
  const [budgets, setBudgets] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [journals, setJournals] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const fyOptions = getFYOptions();
  const currentFY = getFinancialYearLabel();

  const [form, setForm] = useState({
    costCenterId: '',
    accountCode: ACCOUNTS.DIRECT,
    fiscalYear: currentFY,
    amount: '',
    action: 'Warn',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [bgts, ccs, jnls, exps, purs] = await Promise.all([
        getAllBudgets().catch(() => []),
        getAllCostCenters().catch(() => []),
        getAllJournals().catch(() => []),
        getAllExpenses().catch(() => []),
        getAllPurchases().catch(() => []),
      ]);
      setBudgets(bgts || []);
      setCostCenters(ccs || []);
      setJournals(jnls || []);
      setExpenses(exps || []);
      setPurchases(purs || []);
    } catch {
      toast('Failed to load budget data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAdd = () => {
    setForm({
      costCenterId: costCenters[0]?.id || costCenters[0]?.name || '',
      accountCode: ACCOUNTS.DIRECT,
      fiscalYear: currentFY,
      amount: '',
      action: 'Warn',
    });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (b) => {
    setForm({
      costCenterId: b.costCenterId || '',
      accountCode: b.accountCode || ACCOUNTS.DIRECT,
      fiscalYear: b.fiscalYear || currentFY,
      amount: b.amount || '',
      action: b.action || 'Warn',
    });
    setEditingId(b.id);
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.costCenterId) { toast('Please select a Cost Center', 'error'); return; }
    if (!form.accountCode) { toast('Please select an Account', 'error'); return; }
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { toast('Please enter a valid budget amount', 'error'); return; }

    try {
      await saveBudget({
        ...(editingId ? { id: editingId } : {}),
        costCenterId: form.costCenterId,
        accountCode: form.accountCode,
        fiscalYear: form.fiscalYear,
        amount: amt,
        action: form.action,
        updatedAt: new Date().toISOString(),
      });
      toast(editingId ? 'Budget updated' : 'Budget created', 'success');
      setShowModal(false);
      loadData();
    } catch (err) {
      toast(err?.message || 'Failed to save budget', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (await confirmAction({
      title: 'Delete Budget Rule?',
      message: 'This budget limit will no longer be enforced on purchases or expenses.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })) {
      try {
        await deleteBudget(id);
        toast('Budget rule deleted', 'success');
        loadData();
      } catch {
        toast('Failed to delete budget', 'error');
      }
    }
  };

  // Actual spend: journals (expense-side) + expenses + purchase bills by cost center
  const actualsMap = useMemo(() => {
    const map = {};
    const add = (cc, acc, amt) => {
      if (!cc || !(amt > 0)) return;
      const a = String(acc || 'Direct Costs');
      const key = `${cc}_${a}`.toLowerCase();
      map[key] = (map[key] || 0) + amt;
      // also key by cost-center only for loose match
      map[`${cc}__any`] = (map[`${cc}__any`] || 0) + amt;
    };
    const ccList = costCenters || [];
    const resolveCc = (raw) => {
      if (!raw) return '';
      const s = String(raw);
      const hit = ccList.find(c => c.id === s || c.name === s || String(c.name || '').toLowerCase() === s.toLowerCase());
      return hit ? (hit.id || hit.name) : s;
    };
    (journals || []).forEach(j => {
      if (j.IsReversed || j.isReversed || j.reversed) return;
      const cc0 = resolveCc(j.costCenterId);
      (j.entries || []).forEach(e => {
        const acc = e.account || '';
        // only expense-like debits
        const isExp = /expense|direct|indirect|cost|labor|subcontract|consumable|fuel|equipment/i.test(acc);
        const dr = Number(e.debit) || 0;
        if (!isExp || dr <= 0) return;
        add(resolveCc(e.costCenterId || cc0), acc, dr);
      });
    });
    (expenses || []).forEach(ex => {
      if (ex.deleted || ex.isDeleted || String(ex.status || '').toLowerCase() === 'cancelled') return;
      const amt = Number(ex.amount || ex.total || ex.totalAmount || 0) || 0;
      add(resolveCc(ex.costCenterId || ex.costCenter), ex.category || ex.account || 'Indirect Expenses', amt);
    });
    (purchases || []).forEach(p => {
      if (p.deleted || p.isDeleted) return;
      const amt = Number(p.totalAmount || p.total || 0) || 0;
      add(resolveCc(p.costCenterId || p.costCenter), p.category || 'Direct Costs', amt);
    });
    return map;
  }, [journals, expenses, purchases, costCenters]);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={22} color="var(--primary)" /> Budget vs Actual & Control
          </h2>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Set spending limits per Cost Center × Account × FY. Enforce with Stop or Warn alerts.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> New Budget
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Cost Center</th>
              <th>Account / Cost Head</th>
              <th>Fiscal Year</th>
              <th className="text-end">Budget Amount</th>
              <th className="text-end">Actual Spend</th>
              <th className="text-end">Variance / Utilization</th>
              <th>Control Action</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {budgets.map(b => {
              const ccId = b.costCenterId;
              const ccName = (costCenters.find(c => c.id === ccId || c.name === ccId)?.name) || ccId;
              const acc = String(b.accountCode || '');
              let actual = 0;
              const tryKeys = [
                `${ccId}_${acc}`,
                `${ccName}_${acc}`,
                `${ccId}__any`,
                `${ccName}__any`,
              ].map(k => k.toLowerCase());
              for (const k of tryKeys) {
                if (actualsMap[k]) { actual = actualsMap[k]; break; }
              }
              // fuzzy account match on this CC
              if (!actual) {
                const accWord = acc.toLowerCase().split(/\s+/)[0] || '';
                Object.entries(actualsMap).forEach(([k, v]) => {
                  if ((k.includes(String(ccId).toLowerCase()) || k.includes(String(ccName).toLowerCase())) && (!accWord || k.includes(accWord))) {
                    actual = Math.max(actual, v);
                  }
                });
              }
              actual = Math.max(0, actual);
              const bAmt = Number(b.amount) || 0;
              const pct = bAmt > 0 ? Math.round((actual / bAmt) * 100) : 0;
              const isOver = actual > bAmt && bAmt > 0;

              return (
                <tr key={b.id}>
                  <td><strong>{ccName}</strong></td>
                  <td>{b.accountCode}</td>
                  <td><span className="badge">{b.fiscalYear}</span></td>
                  <td className="text-end"><strong>{formatCurrency(bAmt)}</strong></td>
                  <td className="text-end" style={{ color: isOver ? '#ef4444' : '#059669', fontWeight: 600 }}>
                    {formatCurrency(actual)}
                  </td>
                  <td className="text-end">
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
                      background: isOver ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      color: isOver ? '#ef4444' : '#059669',
                    }}>
                      {pct}% {isOver ? 'Exceeded' : 'Used'}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontSize: '0.75rem', padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                      background: b.action === 'Stop' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: b.action === 'Stop' ? '#dc2626' : '#d97706',
                    }}>
                      {b.action || 'Warn'}
                    </span>
                  </td>
                  <td className="text-end">
                    <button type="button" className="btn-icon" onClick={() => openEdit(b)} title="Edit">
                      <Edit3 size={15} />
                    </button>
                    <button type="button" className="btn-icon" onClick={() => handleDelete(b.id)} title="Delete" style={{ color: '#ef4444', marginLeft: 8 }}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {budgets.length === 0 && !loading && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8' }}>
                  No budget rules defined yet. Click "New Budget" to create your first spending limit.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Budget Rule' : 'New Budget Limit'}</h3>
              <button type="button" className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Cost Center *</label>
                  <select className="form-input" value={form.costCenterId} onChange={e => setForm({ ...form, costCenterId: e.target.value })}>
                    <option value="">— Select Cost Center —</option>
                    {costCenters.map(cc => (
                      <option key={cc.id || cc.name} value={cc.id || cc.name}>{cc.name || cc.id}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Account / Cost Head *</label>
                  <select className="form-input" value={form.accountCode} onChange={e => setForm({ ...form, accountCode: e.target.value })}>
                    {STANDARD_ACCOUNTS.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fiscal Year</label>
                  <select className="form-input" value={form.fiscalYear} onChange={e => setForm({ ...form, fiscalYear: e.target.value })}>
                    {fyOptions.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Budget Amount (₹) *</label>
                  <input type="number" className="form-input" value={form.amount} min="0" step="any" placeholder="e.g. 500000"
                    onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Enforcement Action</label>
                  <select className="form-input" value={form.action} onChange={e => setForm({ ...form, action: e.target.value })}>
                    {ACTIONS.map(a => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Save size={15} /> Save Budget</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
