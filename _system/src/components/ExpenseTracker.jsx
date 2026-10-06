import { useState, useEffect } from 'react';
import { Wallet, Plus, Edit3, Trash2, Search, X, Save, Download, Calendar } from 'lucide-react';
import { getAllExpenses, saveExpense, deleteExpense, getProfile, getAllWorkOrders, getAllBills, getAllCostCenters, getAllClients, saveJournal, logActivity, getAllBudgets } from '../store';
import { resolveWoCostCenter, resolveWoSite } from '../utils/workOrder';
import { formatCurrency, getFYOptions, belongsToProfile, isUnassignedToBusiness, toCsvLine, getFinancialYearLabel } from '../utils';
import { journalFromExpense, expensePlAccount } from '../utils/ledger';
import { checkBudgetLimit } from '../utils/budget';
import UnassignedBanner from './UnassignedBanner';
import { toast } from './Toast';
import { getExpenseCategories } from '../utils/masterData';
import { confirmAction } from './ConfirmModal';

const PAYMENT_MODES = ['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Other'];

const emptyForm = {
  workOrderId: '',
  againstInvoice: '',
  receiptData: '',
  receiptName: '',
  claimStatus: 'Draft',
  costCenterId: '',
  site: '',
  costSplits: [],
  submittedBy: '',
  date: (function(){const d=new Date();const z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());})(),
  description: '',
  category: 'Other',
  amount: '',
  gstAmount: '',
  gstPercent: '',
  interstate: false,
  vendorName: '',
  vendorGstin: '',
  invoiceNo: '',
  paymentMode: 'Bank Transfer',
  note: '',
};

export default function ExpenseTracker() {
  const [expenses, setExpenses] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [expenseVendors, setExpenseVendors] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [fyFilter, setFyFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [masterCats, setMasterCats] = useState([]);
  const [woList, setWoList] = useState([]);
  const [billList, setBillList] = useState([]);
  const [budgets, setBudgets] = useState([]);

  useEffect(() => {
    getAllBudgets().then(setBudgets).catch(() => {});
    getAllWorkOrders().then(rows => {
      setWoList(rows || []);
      setWorkOrders(rows || []);
    }).catch(() => {});
    getAllBills().then(setBillList).catch(() => {});
    getAllCostCenters().then(setCostCenters).catch(() => {});
    getAllClients().then(all => {
      setExpenseVendors((all || []).filter(c => c.isVendor || c.type === 'vendor' || c.partyType === 'vendor'));
    }).catch(() => {});
    try { 
      const cats = getExpenseCategories();
      setMasterCats(Array.isArray(cats) ? cats : []);
    } catch { /* ignore */ }
  }, []);

  const fyOptions = getFYOptions();

  const unassignedExpenses = expenses.filter(isUnassignedToBusiness);
  const assignUnassignedExpenses = async () => {
    await Promise.all(unassignedExpenses.map(r => saveExpense({
      ...r,
      ownerGstin: ownerProfile?.gstin || '',
      ownerName: ownerProfile?.businessName || '',
    })));
    loadExpenses();
    getAllWorkOrders().then(setWorkOrders).catch(() => {});
    getAllClients().then(all => setExpenseVendors((all||[]).filter(c => c.isVendor || c.type === 'vendor'))).catch(() => {});
    getAllCostCenters().then(setCostCenters).catch(() => {});
  };

  const loadExpenses = async () => {
    try {
      const [rows, prof] = await Promise.all([getAllExpenses(), getProfile().catch(() => null)]);
      setOwnerProfile(prof);
      setExpenses((rows || []).filter(r => belongsToProfile(r, prof)));
    } catch {
      toast('Failed to load expenses', 'error');
    }
  };

  useEffect(() => {
    if (fyOptions[0]) setFyFilter(fyOptions[0].value);
    loadExpenses();
  }, []);

  const filtered = expenses.filter(exp => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(exp.description || '').toLowerCase().includes(q) &&
          !(exp.vendorName || '').toLowerCase().includes(q) &&
          !(exp.invoiceNo || '').toLowerCase().includes(q)) return false;
    }
    if (categoryFilter !== 'all' && exp.category !== categoryFilter) return false;
    if (fyFilter) {
      const fy = fyOptions.find(f => f.value === fyFilter);
      if (fy && exp.date) {
        if (exp.date < fy.from || exp.date > fy.to) return false;
      }
    }
    return true;
  });

  const totalAmount = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const totalGST = filtered.reduce((s, e) => s + (e.gstAmount || 0), 0);

  const openAdd = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (exp) => {
    setForm({
      date: exp.date || '',
      description: exp.description || '',
      category: exp.category || 'Other',
      amount: exp.amount || '',
      gstAmount: exp.gstAmount || '',
      gstPercent: exp.gstPercent || '',
      vendorName: exp.vendorName || '',
      vendorGstin: exp.vendorGstin || '',
      invoiceNo: exp.invoiceNo || '',
      paymentMode: exp.paymentMode || 'Bank Transfer',
      interstate: !!exp.interstate,
      workOrderId: exp.workOrderId || '',
      againstInvoice: exp.againstInvoice || '',
      receiptData: exp.receiptData || '',
      receiptName: exp.receiptName || '',
      note: exp.note || '',
      costCenterId: exp.costCenterId || '',
      site: exp.site || '',
      claimStatus: exp.claimStatus || 'Draft',
    });
    setEditingId(exp.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    if (!(form.costCenterId || '').trim()) { toast('Cost Center is required on every expense', 'error'); return; }
    if (!form.description.trim()) { toast('Description is required', 'warning'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast('Enter a valid amount', 'warning'); return; }

    // Budget vs Actual enforcement
    const expAmt = parseFloat(form.amount) || 0;
    const accountCode = expensePlAccount({ category: form.category, isDirect: false });
    const currentFY = getFinancialYearLabel(form.date ? new Date(form.date) : new Date());
    
    // Sum prior actual spend for this Cost Center + Account in this FY
    const priorActual = (expenses || []).reduce((acc, e) => {
      if (editingId && e.id === editingId) return acc;
      if (e.costCenterId !== form.costCenterId) return acc;
      const eFY = getFinancialYearLabel(e.date ? new Date(e.date) : new Date());
      if (eFY !== currentFY) return acc;
      const eAcc = expensePlAccount(e);
      if (eAcc !== accountCode) return acc;
      return acc + (Number(e.amount) || 0);
    }, 0);

    const budgetCheck = checkBudgetLimit({
      budgets,
      costCenterId: form.costCenterId,
      accountCode,
      fiscalYear: currentFY,
      newAmount: expAmt,
      currentActual: priorActual,
    });

    if (budgetCheck.exceeded) {
      if (budgetCheck.action === 'Stop') {
        toast(`Budget exceeded! Limit: ₹${budgetCheck.budgetAmount}, Projected: ₹${budgetCheck.projectedTotal}. Save blocked.`, 'error');
        return;
      } else if (budgetCheck.action === 'Warn') {
        const proceed = await confirmAction({
          title: 'Budget Limit Exceeded',
          message: `This expense will push spend to ₹${budgetCheck.projectedTotal}, exceeding budget ₹${budgetCheck.budgetAmount} by ₹${budgetCheck.overAmount}. Proceed anyway?`,
          confirmLabel: 'Proceed & Save',
          tone: 'warning',
        });
        if (!proceed) return;
      }
    }
    try {
      const expense = {
        ...(editingId ? { id: editingId } : {}),
        date: form.date,
        description: form.description.trim(),
        category: form.category,
        amount: parseFloat(form.amount),
        gstAmount: form.gstAmount ? parseFloat(form.gstAmount) : 0,
        gstPercent: form.gstPercent ? parseFloat(form.gstPercent) : 0,
        vendorName: form.vendorName.trim(),
        vendorGstin: form.vendorGstin.trim(),
        invoiceNo: form.invoiceNo.trim(),
        paymentMode: form.paymentMode,
        interstate: !!form.interstate,
        note: form.note.trim(),
        ownerGstin: ownerProfile?.gstin || '',
        ownerName: ownerProfile?.businessName || '',
      };
      expense.workOrderId = form.workOrderId || '';
      expense.againstInvoice = form.againstInvoice || form.invoiceNo || '';
      expense.receiptData = form.receiptData || '';
      expense.receiptName = form.receiptName || '';
      expense.costCenterId = form.costCenterId;
      expense.costSplits = form.costSplits || [];
      expense.site = form.site || '';
      expense.claimStatus = form.claimStatus || 'Draft';
      
      if (!(expense.workOrderId || expense.againstInvoice || expense.receiptData)) {
        toast('Link a Work Order / Invoice OR attach a receipt image/PDF', 'error');
        return;
      }
      const saved = await saveExpense(expense);
      const expId = (saved && saved.id) || expense.id || editingId;
      
      try {
        const jnl = journalFromExpense({ ...expense, id: expId });
        if (jnl) {
          jnl.overwrite = true;
          await saveJournal(jnl);
        }
      } catch (jerr) {
        console.warn('[expense] journal post failed', jerr);
      }
      try {
        await logActivity({
          entityType: 'expense',
          entityId: expId,
          action: editingId ? 'update' : 'create',
          diff: { amount: expense.amount, category: expense.category, description: expense.description },
        });
      } catch { /* ignore */ }
      toast(editingId ? 'Expense updated' : 'Expense added', 'success');
      closeForm();
      loadExpenses();
    } catch {
      toast('Failed to save expense', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (await confirmAction({
      title: 'Delete this expense?',
      message: 'The row is removed from your expense ledger. Matching GL journal is voided. Any GST ITC claimed against this bill in past returns stays as filed.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })) {
      try {
        await deleteExpense(id);
        try {
          const jnl = {
            id: 'jnl_exp_' + id,
            date: new Date().toISOString().split('T')[0],
            narration: 'Expense deleted — voided',
            refType: 'expense',
            refId: id,
            is_deleted: true,
            void: true,
            docstatus: 2,
            entries: [],
            overwrite: true,
          };
          await saveJournal(jnl);
        } catch (jerr) {
          console.warn('[expense] journal void failed', jerr);
        }
        try {
          await logActivity({ entityType: 'expense', entityId: id, action: 'delete' });
        } catch { /* ignore */ }
        toast('Expense deleted', 'success');
        loadExpenses();
      } catch {
        toast('Failed to delete', 'error');
      }
    }
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleGSTCalc = (val) => {
    updateField('gstPercent', val);
    if (val && form.amount) {
      const base = parseFloat(form.amount);
      const gst = (base * parseFloat(val)) / (100 + parseFloat(val));
      updateField('gstAmount', Math.round(gst * 100) / 100);
    }
  };

  const handleVendorSelect = (name) => {
    updateField('vendorName', name);
    const matched = (expenseVendors || []).find(v => v.name.toLowerCase() === name.toLowerCase());
    if (matched?.gstin) {
      updateField('vendorGstin', matched.gstin);
    }
  };

  const exportCSV = () => {
    if (filtered.length === 0) { toast('No expenses to export', 'warning'); return; }
    const headers = ['Date', 'Description', 'Category', 'Amount', 'GST Amount', 'GST %', 'Vendor', 'Vendor GSTIN', 'Invoice No', 'Payment Mode', 'Note'];
    const lines = [toCsvLine(headers)];
    filtered.forEach(e => {
      lines.push(toCsvLine([e.date, e.description, e.category, e.amount, e.gstAmount || 0, e.gstPercent || 0, e.vendorName, e.vendorGstin, e.invoiceNo, e.paymentMode, e.note]));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'expenses.csv'; a.click();
    URL.revokeObjectURL(url);
    toast('Expenses CSV downloaded', 'success');
  };

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track business expenses for P&L and ITC claims</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={exportCSV}><Download size={16} /> Export CSV</button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Expense</button>
        </div>
      </div>

      <UnassignedBanner
        count={unassignedExpenses.length}
        businessName={ownerProfile?.businessName}
        noun="expense"
        onAssign={assignUnassignedExpenses}
      />

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple"><Wallet size={22} /></div>
          <div><p className="stat-label">Total Expenses</p><h2 className="stat-value stat-value-purple">{formatCurrency(totalAmount)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><Calendar size={22} /></div>
          <div><p className="stat-label">GST Paid (ITC)</p><h2 className="stat-value stat-value-green">{formatCurrency(totalGST)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><Wallet size={22} /></div>
          <div><p className="stat-label">Entries</p><h2 className="stat-value">{filtered.length}</h2></div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4 mb-6">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-box" style={{ maxWidth: '350px' }}>
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Search by description, vendor, or invoice..." value={search}
              onChange={e => setSearch(e.target.value)} className="search-input" style={{ width: '100%' }} />
          </div>
          <select className="filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="all">All Categories</option>
            {masterCats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="filter-select" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
            {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
          </select>
          {(search || categoryFilter !== 'all') && (
            <button className="icon-btn icon-btn-red" onClick={() => { setSearch(''); setCategoryFilter('all'); }} title="Clear filters" aria-label="Clear filters"><X size={15} /></button>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '960px', padding: '1rem 1.25rem' }}>
            <h3 className="section-title">{editingId ? 'Edit Expense' : 'Add Expense'}</h3>
            <div className="expense-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem', alignItems: 'start' }}>
              
              {/* Row 1: Number (Disabled/Greyed out), Date, Category */}
              <div className="form-group">
                <label className="form-label">Expense #</label>
                <input 
                  type="text" 
                  className="form-input" 
                  disabled 
                  value={editingId ? `EXP-${editingId}` : `EXP-${expenses.length + 1} (New)`} 
                  style={{ backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', borderColor: '#cbd5e1' }} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={form.date} onChange={e => updateField('date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={form.category} onChange={e => updateField('category', e.target.value)}>
                  <option value="">Select category</option>
                  {masterCats.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  {form.category && !masterCats.includes(form.category) && (
                    <option value={form.category}>{form.category}</option>
                  )}
                </select>
              </div>

              {/* Row 2: Full Width Description */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Description *</label>
                <input type="text" className="form-input" value={form.description}
                  onChange={e => updateField('description', e.target.value)} placeholder="e.g. Site consumable materials / Cabling accessories" />
              </div>

              {/* Row 3: Single Line for Vendor Name, Against Invoice #, and Invoice/Bill No */}
              <div className="form-group">
                <label className="form-label">Vendor Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  list="vendor-datalist" 
                  value={form.vendorName || ''} 
                  placeholder="Type vendor name..." 
                  onChange={e => handleVendorSelect(e.target.value)} 
                />
                <datalist id="vendor-datalist">
                  {(expenseVendors || []).map(v => (
                    <option key={v.id || v.name} value={v.name}>{v.name} {v.gstin ? `(${v.gstin})` : ''}</option>
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Against Invoice #</label>
                <input type="text" className="form-input" value={form.againstInvoice || ''} list="exp-inv-list" placeholder="Select or type invoice"
                  onChange={e => {
                    const inv = e.target.value;
                    const bill = (billList || []).find(b =>
                      String(b.invoiceNumber || b.id || '') === inv ||
                      String(b.invoiceNumber || '').toLowerCase() === inv.toLowerCase()
                    );
                    if (!bill) {
                      updateField('againstInvoice', inv);
                      return;
                    }
                    // Auto-extract logic when invoice is found
                    const rawWo = bill.workOrderId || bill.workOrder || bill.woId || bill.woNumber || '';
                    const wo = (workOrders || []).find(w =>
                      w.id === rawWo ||
                      w.woNumber === rawWo ||
                      String(w.woNumber || '').toLowerCase() === String(rawWo).toLowerCase()
                    );
                    const woId = wo?.id || '';
                    const cc = resolveWoCostCenter(wo) || bill.costCenterId || bill.costCenter || '';
                    setForm(f => ({
                      ...f,
                      againstInvoice: inv,
                      workOrderId: woId || f.workOrderId || '',
                      costCenterId: cc || f.costCenterId || '',
                      site: resolveWoSite(wo) || bill.site || f.site || '',
                    }));
                  }} />
                <datalist id="exp-inv-list">
                  {(billList||[]).slice(0,200).map(b => <option key={b.id} value={b.invoiceNumber}>{b.clientName} ({b.invoiceNumber})</option>)}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Invoice / Bill No</label>
                <input type="text" className="form-input" value={form.invoiceNo}
                  onChange={e => updateField('invoiceNo', e.target.value)} placeholder="Supplier bill no." />
              </div>

              {/* Row 4: Vendor GSTIN, Work Order (Datalist), Cost Center */}
              <div className="form-group">
                <label className="form-label">Vendor GSTIN</label>
                <input type="text" className="form-input" value={form.vendorGstin}
                  onChange={e => updateField('vendorGstin', e.target.value)} placeholder="For ITC claim" maxLength={15} />
              </div>
              <div className="form-group">
  <label className="form-label">Work Order</label>
  <input type="text" className="form-input" list="wo-datalist" 
    value={(() => {
      const v = form.workOrderId || '';
      if (!v) return '';
      // Translate the internal ID into the readable WO Number for display
      const wo = workOrders.find(w => w.id === v);
      return wo ? (wo.woNumber || wo.id) : v;
    })()}
    placeholder="Type or select WO..."
    onChange={e => {
      const val = e.target.value;
      const wo = workOrders.find(w => w.woNumber === val || w.id === val);
      setForm(f => ({
        ...f,
        // Store the database ID internally, even though they see the WO Number
        workOrderId: wo ? wo.id : val,
        costCenterId: wo ? (resolveWoCostCenter(wo) || wo?.costCenterId || f.costCenterId || '') : f.costCenterId,
        site: wo ? (resolveWoSite(wo) || wo?.site || f.site || '') : f.site,
      }));
    }} />
  <datalist id="wo-datalist">
    {workOrders.map(wo => (
      <option key={wo.id} value={wo.woNumber}>{wo.woNumber || wo.id} — {wo.clientName || wo.title || ''}</option>
    ))}
  </datalist>
</div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0 }}>Cost Center *</label>
                  <button type="button" className="btn btn-sm btn-secondary" style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                    onClick={() => {
                      const cur = form.costSplits || [];
                      if (cur.length === 0) {
                        setForm(f => ({
                          ...f,
                          costSplits: [
                            { costCenterId: f.costCenterId || '', percent: 50 },
                            { costCenterId: '', percent: 50 },
                          ]
                        }));
                      } else {
                        setForm(f => ({ ...f, costSplits: [...cur, { costCenterId: '', percent: 0 }] }));
                      }
                    }}>
                    + Split across Cost Centers
                  </button>
                </div>
                {(!form.costSplits || form.costSplits.length === 0) ? (
                  <select className="form-input" value={form.costCenterId || ''}
                    onChange={e => setForm(f => ({ ...f, costCenterId: e.target.value }))}>
                    <option value="">— Select Cost Center —</option>
                    {costCenters.map(cc => (
                      <option key={cc.id || cc.name} value={cc.id || cc.name}>{cc.name || cc.id}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ background: 'rgba(0,0,0,0.03)', padding: 10, borderRadius: 6, border: '1px dashed #cbd5e1' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Allocations must total 100%</span>
                      <button type="button" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}
                        onClick={() => setForm(f => ({ ...f, costSplits: [] }))}>
                        Remove split
                      </button>
                    </div>
                    {form.costSplits.map((sp, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                        <select className="form-input" style={{ flex: 2 }} value={sp.costCenterId || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setForm(f => {
                              const arr = [...(f.costSplits || [])];
                              arr[idx] = { ...arr[idx], costCenterId: val };
                              return { ...f, costSplits: arr, costCenterId: arr[0]?.costCenterId || f.costCenterId };
                            });
                          }}>
                          <option value="">— Select Cost Center —</option>
                          {costCenters.map(cc => (
                            <option key={cc.id || cc.name} value={cc.id || cc.name}>{cc.name || cc.id}</option>
                          ))}
                        </select>
                        <input type="number" className="form-input" style={{ width: 90 }} value={sp.percent}
                          placeholder="%" min="0" max="100"
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setForm(f => {
                              const arr = [...(f.costSplits || [])];
                              arr[idx] = { ...arr[idx], percent: val };
                              return { ...f, costSplits: arr };
                            });
                          }} />
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>%</span>
                        <button type="button" className="btn-icon" onClick={() => {
                          setForm(f => ({ ...f, costSplits: f.costSplits.filter((_, i) => i !== idx) }));
                        }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <div style={{ fontSize: '0.78rem', marginTop: 4, fontWeight: 600, color: (form.costSplits.reduce((s, x) => s + (Number(x.percent) || 0), 0) === 100) ? '#059669' : '#d97706' }}>
                      Total: {form.costSplits.reduce((s, x) => s + (Number(x.percent) || 0), 0)}%
                    </div>
                  </div>
                )}
              </div>

              {/* Row 5: Amount, GST %, Payment Mode */}
              <div className="form-group">
                <label className="form-label">Amount (incl. GST) *</label>
                <input type="number" className="form-input" value={form.amount}
                  onChange={e => { updateField('amount', e.target.value); if (form.gstPercent) handleGSTCalc(form.gstPercent); }}
                  placeholder="0.00" min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">GST % (for ITC)</label>
                <input type="number" className="form-input" value={form.gstPercent}
                  onChange={e => handleGSTCalc(e.target.value)} placeholder="18" min="0" max="28" />
                {form.gstAmount > 0 && <p className="field-hint">GST: {formatCurrency(form.gstAmount)}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="form-input" value={form.paymentMode} onChange={e => updateField('paymentMode', e.target.value)}>
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Row 6: Attach Receipt */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Attach receipt (required if no WO/Invoice linked)</label>
                <input type="file" accept="image/*,application/pdf" className="form-input"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 2_000_000) { toast('Receipt max 2MB', 'warning'); return; }
                    const reader = new FileReader();
                    reader.onload = () => setForm(prev => ({ ...prev, receiptData: reader.result, receiptName: f.name }));
                    reader.readAsDataURL(f);
                  }} />
                {form.receiptName && <small style={{ color: '#059669', display: 'block', marginTop: 4 }}>Attached: {form.receiptName}</small>}
              </div>

              {/* Row 7: Interstate Checkbox */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form.interstate}
                    onChange={e => updateField('interstate', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                  <span>
                    <strong>Inter-state expense</strong> — vendor charged IGST (different state)
                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>
                      Routes ITC to IGST in GSTR-3B. Check vendor GSTIN — first 2 digits are state code.
                    </span>
                  </span>
                </label>
              </div>

              {/* Row 8: Note */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Note (optional)</label>
                <input type="text" className="form-input" value={form.note}
                  onChange={e => updateField('note', e.target.value)} placeholder="Any additional note..." />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}><Save size={16} /> {editingId ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Table */}
      <div className="glass-panel">
        <div className="table-header"><h3>Expense Records</h3></div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Wallet size={48} />
            <p>{expenses.length === 0 ? 'No expenses recorded yet.' : 'No expenses match your filters.'}</p>
            {expenses.length === 0 && <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Expense</button>}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Vendor</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>GST</th>
                  <th>Mode</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(exp => (
                  <tr key={exp.id}>
                    <td className="text-muted">{exp.date ? new Date(exp.date).toLocaleDateString('en-IN') : ''}</td>
                    <td className="font-medium">{exp.description}</td>
                    <td><span className="type-badge">{exp.category}</span></td>
                    <td className="text-muted">{exp.vendorName || '-'}</td>
                    <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(exp.amount)}</td>
                    <td style={{ textAlign: 'right' }} className="text-muted">{exp.gstAmount ? formatCurrency(exp.gstAmount) : '-'}</td>
                    <td className="text-muted">{exp.paymentMode}</td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn icon-btn-blue" onClick={() => openEdit(exp)} title="Edit"><Edit3 size={15} /></button>
                        <button className="icon-btn icon-btn-red" onClick={() => handleDelete(exp.id)} title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={4}>Total</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalAmount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalGST)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}