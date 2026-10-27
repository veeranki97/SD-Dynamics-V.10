import { useState, useEffect } from 'react';
import { Plus, Trash2, ClipboardList, Search, X, Target, IndianRupee, TrendingUp, Mail, FolderKanban, FileText, ShoppingCart, Receipt, Wallet, CalendarDays, Building2 } from 'lucide-react';
import {
  getAllWorkOrders, getAllExpenses, getAllPurchases, getAllPurchaseOrders, saveWorkOrder, deleteWorkOrder,
  getAllBills, getAllClients, getAllCostCenters, getAllProducts,
} from '../store';
import { calcWOUsage, emptyWOItem, calcItemAmount, deriveWOStatus, resolveWoCostCenter, resolveWoSite } from '../utils/workOrder';
import { formatCurrency, getFYOptions } from '../utils';
import { toast } from './Toast';
import { downloadCsv } from '../utils/exportData';
import { confirmAction } from './ConfirmModal';
import ActionMenu from './ActionMenu';
import { sendMailSmart } from '../utils/openMail';
import { getHsnMaster, getUnitMaster } from '../utils/masterData';

function calcWOTotals(items, taxRate, clientState, hostState) {
  const sub = (items || []).reduce((s, it) => s + calcItemAmount(it), 0);
  const rate = Number(taxRate) || 0;
  const gst = +(sub * rate / 100).toFixed(2);
  const same =
    (clientState || '').trim().toLowerCase() === (hostState || '').trim().toLowerCase()
    && !!(clientState || '').trim();
  let cgst = 0, sgst = 0, igst = 0;
  if (rate > 0) {
    if (same) {
      cgst = +(gst / 2).toFixed(2);
      sgst = +(gst - cgst).toFixed(2);
    } else {
      igst = gst;
    }
  }
  return { sub, gst, cgst, sgst, igst, total: +(sub + gst).toFixed(2), isInterstate: !same };
}


/** Prefill New PO from Work Order (session + navigate). */
function navigateCreatePoFromWo(wo) {
  if (!wo) return;
  try {
    // Always call imported helper (header OR first line cost centre)
    let cc = '';
    let site = wo.site || '';
    try { cc = resolveWoCostCenter(wo) || ''; } catch (_) {}
    try { site = resolveWoSite(wo) || wo.site || ''; } catch (_) { site = wo.site || ''; }
    // Client delivery address — never company profile
    const clientAddr = [
      wo.clientAddress || wo.billingAddress || wo.address || '',
      wo.city || '',
      wo.state || wo.clientState || '',
      wo.pincode || wo.pin || '',
    ].filter(Boolean).join(', ');
    const items = (Array.isArray(wo.items) ? wo.items : []).map((it, i) => ({
      id: 'poi_wo_' + Date.now() + '_' + i,
      description: it.description || it.name || '',
      hsn: it.hsn || it.sac || '',
      qty: it.qty ?? it.quantity ?? 1,
      unit: it.unit || 'Nos',
      rate: Number(it.rate) || 0,
      amount: Number(it.amount) || ((Number(it.qty ?? it.quantity) || 0) * (Number(it.rate) || 0)),
      costCenterId: it.costCenterId || it.costCentreId || it.costHead || cc || '',
    }));
    sessionStorage.setItem('sd_po_from_wo', JSON.stringify({
      workOrderId: wo.id,
      workOrderNumber: wo.woNumber || '',
      clientName: wo.clientName || '',
      clientId: wo.clientId || '',
      site: site || 'Main Site',
      shipToName: wo.clientName || '',
      shipToSite: site || 'Main Site',
      shipToAddress: clientAddr,
      shipToState: wo.state || wo.clientState || '',
      costCenterId: cc,
      taxRate: wo.taxRate ?? wo.gstPercent ?? 18,
      title: wo.title || '',
      subject: wo.title || '',
      notes: wo.notes || '',
      isSubcontract: true,
      items,
    }));
  } catch { /* */ }
  sessionStorage.setItem('gst_currentView', 'purchaseorders');
  window.dispatchEvent(new CustomEvent('sd-navigate', { detail: 'purchaseorders' }));
  // If PO view is already mounted, force prefill re-read
  setTimeout(() => {
    try { window.dispatchEvent(new CustomEvent('sd-po-prefill')); } catch (_) {}
  }, 50);
}

/** Prefill New Expense from Work Order. */
function navigateCreateExpenseFromWo(wo) {
  if (!wo) return;
  try {
    sessionStorage.setItem('sd_expense_from_wo', JSON.stringify({
      workOrderId: wo.id,
      workOrderNumber: wo.woNumber || '',
      site: typeof wo.site === 'object' ? (wo.site?.name || '') : (wo.site || ''),
      costCenterId: wo.costCenterId || '',
      clientName: wo.clientName || '',
      description: wo.title ? `Job cost — ${wo.title}` : (wo.woNumber ? `Job cost — ${wo.woNumber}` : 'Job cost'),
      jobCost: true,
      openForm: true,
    }));
  } catch { /* */ }
  sessionStorage.setItem('gst_currentView', 'expenses');
  window.dispatchEvent(new CustomEvent('sd-navigate', { detail: 'expenses' }));
  setTimeout(() => {
    try { window.dispatchEvent(new CustomEvent('sd-expense-prefill')); } catch (_) {}
  }, 80);
}

/** Hint Financial Books / journals filtered by WO. */
function navigateLedgerForWo(wo) {
  if (!wo) return;
  try {
    sessionStorage.setItem('sd_ledger_wo_filter', JSON.stringify({
      workOrderId: wo.id,
      woNumber: wo.woNumber || '',
    }));
  } catch { /* */ }
  sessionStorage.setItem('gst_currentView', 'generalledger');
  window.dispatchEvent(new CustomEvent('sd-navigate', { detail: 'generalledger' }));
}

/** True if this WO already has at least one non-cancelled Purchase Order (one WO → one PO policy, like invoice convert). */
function woHasLinkedPo(wo, purchaseOrders) {
  if (!wo) return false;
  const wid = String(wo.id || '');
  const wno = String(wo.woNumber || wo.number || '').trim();
  return (purchaseOrders || []).some(p => {
    if (!p) return false;
    const st = String(p.status || '').toLowerCase();
    if (st === 'cancelled' || p.is_deleted || p.deleted) return false;
    const pid = String(p.workOrderId || '');
    const pno = String(p.workOrderNumber || p.workOrderNo || '').trim();
    if (wid && pid && (pid === wid || pid === wno)) return true;
    if (wno && pno && pno === wno) return true;
    if (wno && pid && pid === wno) return true;
    return false;
  });
}


export default function WorkOrdersView({ onConvertToInvoice, onOpenInvoice }) {
  const [list, setList] = useState([]);
  const [bills, setBills] = useState([]);
  const [clients, setClients] = useState([]);
  const [productCatalog, setProductCatalog] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [hsnMaster, setHsnMaster] = useState([]);
  const [unitMaster, setUnitMaster] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [dossierWo, setDossierWo] = useState(null);
  const [dossierTab, setDossierTab] = useState('invoices');
  const [emailPrompt, setEmailPrompt] = useState(null);
  const [emailPromptValue, setEmailPromptValue] = useState('');
  const [woSearch, setWoSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fyFilter, setFyFilter] = useState('');
  const fyOptions = getFYOptions();

  // In-app email prompt: avoids the browser's native window.prompt UI.
  const requestClientEmail = (initialValue = '') => new Promise(resolve => {
    setEmailPromptValue(String(initialValue || ''));
    setEmailPrompt({ resolve });
  });
  const closeEmailPrompt = (value = null) => {
    const resolve = emailPrompt?.resolve;
    setEmailPrompt(null);
    if (typeof resolve === 'function') resolve(value);
  };


  useEffect(() => {
    setHsnMaster(getHsnMaster());
    setUnitMaster(getUnitMaster());
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [wos, bs, cs, pos, pbs, exps] = await Promise.all([
        getAllWorkOrders(), getAllBills(), getAllClients(),
        getAllPurchaseOrders().catch(() => []),
        getAllPurchases().catch(() => []),
        getAllExpenses().catch(() => []),
      ]);
      setList(Array.isArray(wos) ? wos : (wos?.items || []));
      setBills(Array.isArray(bs) ? bs : (bs?.items || []));
      setClients((cs || []).filter(c => !c.isVendor && c.type !== 'vendor'));
      setPurchaseOrders(pos || []);
      setPurchases(pbs || []);
      setExpenses(exps || []);
      try { getAllProducts().then(setProductCatalog).catch(() => setProductCatalog([])); } catch (_) {}
    getAllCostCenters().then(setCostCenters).catch(() => {});
    } catch (e) {
      console.error('[WorkOrdersView.load]', e);
      toast('Failed to load Work Orders: ' + (e?.message || 'network'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    try {
      const opts = getFYOptions();
      if (opts?.[0]?.value && !fyFilter) setFyFilter(opts[0].value);
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('sd_wo_open_new') === '1') {
        sessionStorage.removeItem('sd_wo_open_new');
        setTimeout(() => { try { openNew(); } catch (_) {} }, 0);
      }
    } catch (_) {}
  }, []);


  // Invoice → WO round-trip: open form prefilled from invoice
  useEffect(() => {
    if (loading || form) return;
    try {
      const raw = sessionStorage.getItem('sd_wo_from_invoice');
      if (!raw) return;
      sessionStorage.removeItem('sd_wo_from_invoice');
      const p = JSON.parse(raw);
      setForm({
        id: 'wo_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        costCenterId: p.costCenterId || '',
        woNumber: (p.woNumber || '').trim(),
        clientName: p.clientName || '',
        clientId: p.clientId || '',
        clientState: p.clientState || '',
        hostState: p.hostState || '',
        site: p.site || 'Main Site',
        title: p.title || '',
        approvedBudget: 0,
        taxRate: p.taxRate ?? 18,
        status: 'approved',
        date: new Date().toISOString().split('T')[0],
        periodStart: p.periodStart || '',
        periodEnd: p.periodEnd || '',
        notes: p.notes || '',
        items: (p.items && p.items.length) ? p.items : [emptyWOItem()],
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[WO from invoice]', e);
    }
  }, [loading]);

  useEffect(() => {
    if (!form) return;
    const t = calcWOTotals(form.items, form.taxRate ?? 18, form.clientState, form.hostState);
    if (Math.abs((Number(form.approvedBudget) || 0) - t.total) > 0.009) {
      setForm(prev => (prev ? { ...prev, approvedBudget: t.total } : prev));
    }
  }, [form?.items, form?.taxRate, form?.clientState, form?.hostState]);

  const openNew = () =>
    setForm({
      id: 'wo_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      costCenterId: '',
      woNumber: '',
      clientName: '',
      clientState: '',
      site: 'Main Site',
      title: '',
      approvedBudget: 0,
      taxRate: 18,
      status: 'approved',
      date: new Date().toISOString().split('T')[0],
      periodStart: '',
      periodEnd: '',
      notes: '',
      items: [emptyWOItem()],
      createdAt: new Date().toISOString(),
    });

  
  const applyProductToLine = (idx, productNameOrId) => {
    const q = String(productNameOrId || '').trim().toLowerCase();
    if (!q || !productCatalog?.length) return;
    const p = productCatalog.find((x) => String(x.id) === q || String(x.name || '').toLowerCase() === q || String(x.sku || '').toLowerCase() === q);
    if (!p) return;
    setForm((f) => {
      const items = [...(f.items || [])];
      const row = { ...items[idx] };
      if (p.name) row.description = p.name;
      if (p.hsn || p.sac) row.hsn = p.hsn || p.sac;
      if (p.unit) row.unit = p.unit;
      if (p.rate != null && p.rate !== '') row.rate = p.rate;
      if (p.costHead || p.costCenterId || p.costCentreId) {
        row.costHead = p.costHead || p.costCenterId || p.costCentreId;
        row.costCenterId = p.costCenterId || p.costCentreId || p.costHead;
      }
      items[idx] = row;
      return { ...f, items };
    });
  };

const updateItem = (idx, field, value) => {
    setForm(prev => {
      if (!prev) return prev;
      const items = [...(prev.items || [])];
      const row = { ...items[idx], [field]: value };
      if (field === 'qty' || field === 'rate') row.amount = calcItemAmount(row);
      items[idx] = row;
      const t = calcWOTotals(items, prev.taxRate ?? 18, prev.clientState, prev.hostState);
      return { ...prev, items, approvedBudget: t.total };
    });
  };

  const addItem = () => setForm(prev => prev ? { ...prev, items: [...(prev.items || []), emptyWOItem()] } : prev);
  const removeItem = (idx) =>
    setForm(prev => prev ? { ...prev, items: (prev.items || []).filter((_, i) => i !== idx) } : prev);

  const save = async () => {
    if (!(form.clientName || '').trim()) { toast('Client is required', 'error'); return; }
    if (!(form.title || '').trim()) { toast('Title of work is required', 'error'); return; }

    // New forms can already have a generated ID. Determine create/edit by
    // checking whether that ID exists in the persisted work-order list.
    const isEditing = (list || []).some(
      existing => String(existing?.id || '') === String(form.id || '')
    );

    let woNumber = form.woNumber;
    if (!(woNumber || '').trim()) {
      const n = list.length + 1;
      const y = new Date().getFullYear();
      const fy = new Date().getMonth() >= 3
        ? `${String(y).slice(-2)}-${String(y + 1).slice(-2)}`
        : `${String(y - 1).slice(-2)}-${String(y).slice(-2)}`;
      woNumber = `WO/${fy}/${String(n).padStart(3, '0')}`;
    }
    const items = (form.items || []).map(it => ({ ...it, amount: calcItemAmount(it) }));
    const t = calcWOTotals(items, form.taxRate ?? 18, form.clientState, form.hostState);
    try {
      const woId = form.id || ('wo_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      await saveWorkOrder({
        ...form, id: woId, woNumber, items,
        approvedBudget: t.total,
        taxable: t.sub, cgst: t.cgst, sgst: t.sgst, igst: t.igst, total: t.total,
      }, { overwrite: true, action: isEditing ? 'update' : 'create' });
      toast('Work Order saved', 'success');
      try {
        if (sessionStorage.getItem('sd_return_to_invoice') === '1') {
          sessionStorage.removeItem('sd_return_to_invoice');
          sessionStorage.setItem('sd_convert_wo', JSON.stringify({
            workOrderId: woId,
            woNumber,
            clientName: form.clientName || '',
            clientId: form.clientId || '',
            site: form.site || '',
            title: form.title || '',
            notes: form.notes || '',
            taxRate: form.taxRate ?? 18,
            periodStart: form.periodStart || '',
            periodEnd: form.periodEnd || '',
            items,
          }));
          sessionStorage.setItem('gst_currentView', 'new');
          window.dispatchEvent(new CustomEvent('sd-navigate', { detail: 'new' }));
        }
      } catch (e) { console.warn('[WO return to invoice]', e); }
      setForm(null);
      load();
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  const remove = async (id) => {
    const ok = await confirmAction({
      title: 'Delete Work Order?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteWorkOrder(id);
      toast('Deleted', 'success');
      load();
    } catch (e) {
      toast(e.message || 'Delete failed', 'error');
    }
  };


  const clientNames = Array.from(new Set((list || []).map(w => (w.clientName || '').trim()).filter(Boolean))).sort();

  const filteredList = (list || []).filter(wo => {
    if (woSearch.trim()) {
      const q = woSearch.trim().toLowerCase();
      const hay = [wo.woNumber, wo.id, wo.clientName, wo.site, wo.title, wo.notes].map(x => String(x || '').toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }
    if (clientFilter && String(wo.clientName || '') !== clientFilter) return false;
    if (statusFilter && statusFilter !== 'all') {
      const st = String(deriveWOStatus(wo, bills) || wo.status || '').toLowerCase();
      if (statusFilter === 'open') {
        if (st === 'completed' || st === 'cancelled' || st === 'closed') return false;
      } else if (!st.includes(statusFilter.toLowerCase())) {
        return false;
      }
    }
    if (fyFilter) {
      const fy = fyOptions.find(f => f.value === fyFilter);
      if (fy && wo.date) {
        if (wo.date < fy.from || wo.date > fy.to) return false;
      }
    }
    return true;
  });

  const woKpis = (() => {
    let budget = 0, billed = 0, remaining = 0, margin = 0, openCount = 0;
    for (const wo of filteredList) {
      const u = calcWOUsage(wo, bills, purchaseOrders, purchases, expenses);
      budget += Number(wo.approvedBudget) || 0;
      billed += Number(u.billedAmount) || 0;
      remaining += Number(u.remaining) || 0;
      margin += Number(u.margin ?? u.projectedProfit) || 0;
      const st = String(deriveWOStatus(wo, bills) || '').toLowerCase();
      if (st !== 'completed' && st !== 'cancelled' && st !== 'closed') openCount += 1;
    }
    return { budget, billed, remaining, margin, openCount, total: filteredList.length };
  })();

  if (loading) return <div className="page"><p>Loading…</p></div>;

  if (form) {
    const t = calcWOTotals(form.items, form.taxRate ?? 18, form.clientState, form.hostState);
    return (
      <div className="page" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0 }}>{form.woNumber ? `Edit ${form.woNumber}` : 'New Work Order'}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
          <button type="button" className="btn btn-secondary" onClick={() => downloadCsv('Work-Orders-Export.csv', list || [], [
            { key: 'woNumber', label: 'WO Number', get: w => w.woNumber || w.number || w.id },
            { key: 'clientName', label: 'Client', get: w => w.clientName || w.client || '' },
            { key: 'site', label: 'Site', get: w => w.site || '' },
            { key: 'status', label: 'Status', get: w => w.status || '' },
            { key: 'title', label: 'Title', get: w => w.title || w.workTitle || '' },
            { key: 'budget', label: 'Budget', get: w => w.approvedBudget || w.budget || w.totalAmount || '' },
          ])}>Export CSV</button>
            <button type="button" className="btn btn-primary" onClick={save}>Save Work Order</button>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
          <div className="form-group">
            <label className="form-label">WO NUMBER</label>
            <input className="form-input" value={form.woNumber || ''} placeholder="Auto on save"
              onChange={e => setForm({ ...form, woNumber: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">DATE</label>
            <input type="date" className="form-input" value={form.date || ''}
              onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">CLIENT *</label>
            <input className="form-input" list="wo-clients" value={form.clientName || ''}
              onChange={e => {
                const name = e.target.value;
                const c = clients.find(x => x.name === name);
                setForm({
                  ...form,
                  clientName: name,
                  clientState: c?.state || form.clientState || '',
                  site: c?.site || (Array.isArray(c?.sites) && c.sites[0]) || form.site || '',
                });
              }} />
            <datalist id="wo-clients">
              {clients.map(c => <option key={c.id || c.name} value={c.name} />)}
            </datalist>
          </div>
          <div className="form-group">
            <label className="form-label">SITE</label>
            <input className="form-input" value={form.site || ''}
              onChange={e => setForm({ ...form, site: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">STATUS</label>
            <select className="form-input" value={form.status || 'approved'}
              onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="in-progress">In Progress</option>
              <option value="partial">Partial</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">GST %</label>
            <input type="number" className="form-input" value={form.taxRate ?? 18}
              onChange={e => setForm({ ...form, taxRate: Number(e.target.value) || 0 })} />
          </div>
          <div className="form-group">
            <label className="form-label">PERIOD START</label>
            <input type="date" className="form-input" value={form.periodStart || ''}
              onChange={e => setForm({ ...form, periodStart: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">PERIOD END</label>
            <input type="date" className="form-input" value={form.periodEnd || ''}
              onChange={e => setForm({ ...form, periodEnd: e.target.value })} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">TITLE OF WORK *</label>
            <input className="form-input" value={form.title || ''}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Fills invoice Work Description" />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 12, marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong>Line items</strong>
              <datalist id="wo-products-master">{(productCatalog || []).map((p) => (
                <option key={p.id || p.name} value={p.name || ''} />
              ))}</datalist>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
              <Plus size={14} /> Add row
            </button>
          </div>
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>HSN/SAC</th>
                  <th>Unit</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th>Cost centre</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(form.items || []).map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td>
                      <input className="form-input" list="wo-products-master" onBlur={(e) => applyProductToLine(idx, e.target.value)} value={it.description || ''}
                        onChange={e => updateItem(idx, 'description', e.target.value)} />
                    </td>
                    <td>
                      <input className="form-input" style={{ width: 100 }} list={`wo-hsn-${idx}`}
                        value={it.hsn || ''} placeholder="Type…"
                        onChange={e => updateItem(idx, 'hsn', e.target.value)} />
                      <datalist id={`wo-hsn-${idx}`}>
                        {hsnMaster.map(h => <option key={h} value={h} />)}
                      </datalist>
                    </td>
                    <td>
                      <input className="form-input" style={{ width: 80 }} list={`wo-unit-${idx}`}
                        value={it.unit || ''}
                        onChange={e => updateItem(idx, 'unit', e.target.value)} />
                      <datalist id={`wo-unit-${idx}`}>
                        {unitMaster.map(u => <option key={u} value={u} />)}
                      </datalist>
                    </td>
                    <td>
                      <input type="number" className="form-input" style={{ width: 70 }} value={it.qty ?? ''}
                        onChange={e => updateItem(idx, 'qty', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" className="form-input" style={{ width: 90 }} value={it.rate ?? ''}
                        onChange={e => updateItem(idx, 'rate', e.target.value)} />
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(calcItemAmount(it))}</td>
                    <td>
                      <select className="form-input" style={{ width: 130 }}
                        value={it.costCenterId || it.costHead || ''}
                        onChange={e => {
                          updateItem(idx, 'costCenterId', e.target.value);
                          updateItem(idx, 'costHead', e.target.value);
                        }}>
                        <option value="">—</option>
                        {(costCenters || []).map(cc => (
                          <option key={cc.id || cc.name} value={cc.id || cc.name}>{cc.name || cc.id}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button type="button" className="btn-icon" onClick={() => removeItem(idx)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ textAlign: 'right', marginTop: 12, lineHeight: 1.7, fontSize: '0.95rem' }}>
            <div>Taxable: <b>{formatCurrency(t.sub)}</b></div>
            {t.isInterstate
              ? <div>IGST: <b>{formatCurrency(t.igst)}</b></div>
              : (
                <>
                  <div>CGST: <b>{formatCurrency(t.cgst)}</b></div>
                  <div>SGST: <b>{formatCurrency(t.sgst)}</b></div>
                </>
              )}
            <div style={{ fontSize: '1.05rem' }}>
              Total (Approved Budget incl. GST): <b>{formatCurrency(t.total)}</b>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">NOTES</label>
            <textarea className="form-input" rows={2} value={form.notes || ''}
              onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .wo-premium-module .wo-table-scroll::-webkit-scrollbar { height: 7px; }
        .wo-premium-module .wo-table-scroll::-webkit-scrollbar-thumb { background: var(--border, #cbd5e1); border-radius: 20px; }
        .wo-premium-module .wo-main-table th { white-space: nowrap; font-size: .72rem; letter-spacing: .035em; text-transform: uppercase; }
        .wo-premium-module .wo-main-table tbody tr:hover { background: var(--surface-hover, rgba(37,99,235,.035)); }
        .wo-premium-module .wo-actions-col { white-space: nowrap; }
        .wo-dossier-modal { width: min(1080px, 96vw); max-height: 90vh; overflow: auto; padding: 0; border: 1px solid var(--border, #e2e8f0); box-shadow: 0 24px 80px rgba(15,23,42,.28); }
        .wo-dossier-hero { padding: 22px 24px; color: white; background: linear-gradient(120deg, #10213f 0%, #1d4ed8 58%, #4f46e5 100%); }
        .wo-dossier-kpi { min-width: 0; padding: 12px 14px; border: 1px solid var(--border, #e2e8f0); border-radius: 12px; background: var(--surface, var(--card, #fff)); }
        .wo-dossier-kpi-label { color: var(--text-muted, #64748b); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
        .wo-dossier-kpi-value { margin-top: 5px; font-size: .94rem; font-weight: 750; overflow-wrap: anywhere; }
        .wo-dossier-content { padding: 18px 24px 24px; }
        .wo-dossier-tab { display: inline-flex; align-items: center; gap: 7px; border-radius: 999px !important; }
        .wo-dossier-table-wrap { width: 100%; overflow-x: auto; }
        .wo-dossier-table-wrap table { min-width: 600px; }
        .wo-email-backdrop { position: fixed; inset: 0; z-index: 120000; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(15,23,42,.52); backdrop-filter: blur(4px); }
        .wo-email-dialog { width: min(440px, 100%); padding: 24px; border: 1px solid var(--border, #e2e8f0); border-radius: 18px; background: var(--card, #fff); color: var(--text, #0f172a); box-shadow: 0 24px 80px rgba(15,23,42,.28); }
        @media (max-width: 760px) { .wo-dossier-hero { padding: 18px; } .wo-dossier-content { padding: 14px; } .wo-premium-module .stats-grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } .wo-premium-module .list-module-toolbar > div { flex-wrap: wrap !important; } .wo-premium-module .list-module-toolbar select { max-width: 100%; } }
      `}</style>
          <div className="page dashboard-container wo-premium-module" style={{ width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'clip' }}>
      <div className="page-header" style={{ marginBottom: 8 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={22} /> Work Orders
          </h1>
          <p className="page-subtitle" style={{ margin: '2px 0 0' }}>
            Project budgets · search & filter · invoices cannot exceed remaining
          </p>
        </div>
        <div className="flex gap-2" style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => downloadCsv('Work-Orders-Export.csv', filteredList || [], [
            { key: 'woNumber', label: 'WO Number', get: w => w.woNumber || w.number || w.id },
            { key: 'clientName', label: 'Client', get: w => w.clientName || w.client || '' },
            { key: 'site', label: 'Site', get: w => w.site || '' },
            { key: 'status', label: 'Status', get: w => w.status || '' },
            { key: 'title', label: 'Title', get: w => w.title || w.workTitle || '' },
            { key: 'budget', label: 'Budget', get: w => w.approvedBudget || w.budget || w.totalAmount || '' },
          ])}>Export CSV</button>
          <button type="button" className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> New Work Order
          </button>
        </div>
      </div>

      <div className="stats-grid stats-grid-dense" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div className="stat-card" style={{ padding: '0.55rem 0.75rem' }}>
          <div className="stat-icon stat-icon-blue" style={{ width: 36, height: 36 }}><ClipboardList size={18} /></div>
          <div>
            <p className="stat-label" style={{ margin: 0, fontSize: '0.7rem' }}>Open / Total</p>
            <h2 className="stat-value" style={{ margin: 0, fontSize: '1.05rem' }}>{woKpis.openCount} / {woKpis.total}</h2>
          </div>
        </div>
        <div className="stat-card" style={{ padding: '0.55rem 0.75rem' }}>
          <div className="stat-icon stat-icon-purple" style={{ width: 36, height: 36 }}><Target size={18} /></div>
          <div>
            <p className="stat-label" style={{ margin: 0, fontSize: '0.7rem' }}>Budget</p>
            <h2 className="stat-value stat-value-purple" style={{ margin: 0, fontSize: '1.05rem' }}>{formatCurrency(woKpis.budget)}</h2>
          </div>
        </div>
        <div className="stat-card" style={{ padding: '0.55rem 0.75rem' }}>
          <div className="stat-icon stat-icon-green" style={{ width: 36, height: 36 }}><IndianRupee size={18} /></div>
          <div>
            <p className="stat-label" style={{ margin: 0, fontSize: '0.7rem' }}>Billed</p>
            <h2 className="stat-value stat-value-green" style={{ margin: 0, fontSize: '1.05rem' }}>{formatCurrency(woKpis.billed)}</h2>
          </div>
        </div>
        <div className="stat-card" style={{ padding: '0.55rem 0.75rem' }}>
          <div className="stat-icon" style={{ width: 36, height: 36 }}><TrendingUp size={18} /></div>
          <div>
            <p className="stat-label" style={{ margin: 0, fontSize: '0.7rem' }}>Remaining · Margin</p>
            <h2 className="stat-value" style={{ margin: 0, fontSize: '0.95rem' }}>
              {formatCurrency(woKpis.remaining)}
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: woKpis.margin < 0 ? '#dc2626' : '#059669', marginLeft: 6 }}>
                M {formatCurrency(woKpis.margin)}
              </span>
            </h2>
          </div>
        </div>
      </div>

      <div className="list-module-toolbar glass-panel" style={{ marginBottom: '0.5rem', padding: '0.45rem 0.65rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap', alignItems: 'center', width: '100%' }}>
          <div className="search-box" style={{ flex: '1 1 auto', minWidth: 120, maxWidth: 'none', width: 'auto' }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              style={{ width: '100%' }}
              placeholder="Search WO #, client, site, title..."
              value={woSearch}
              onChange={e => setWoSearch(e.target.value)}
            />
          </div>
          <div style={{ flex: '0 0 auto', display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
            <select className="filter-select" value={clientFilter} onChange={e => setClientFilter(e.target.value)} style={{ width: 150 }} title="Client">
              <option value="">All clients</option>
              {clientNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 130 }} title="Status">
              <option value="all">All status</option>
              <option value="open">Open only</option>
              <option value="approved">Approved</option>
              <option value="in-progress">In progress</option>
              <option value="partial">Partial</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select className="filter-select" value={fyFilter} onChange={e => setFyFilter(e.target.value)} style={{ width: 120 }} title="Financial year">
              {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
            </select>
            {(woSearch || clientFilter || (statusFilter && statusFilter !== 'all') || (fyFilter && fyFilter !== fyOptions?.[0]?.value)) && (
              <button type="button" className="icon-btn icon-btn-red" title="Clear filters"
                onClick={() => { setWoSearch(''); setClientFilter(''); setStatusFilter('all'); setFyFilter(fyOptions?.[0]?.value || ''); }}>
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="list-module wo-list-module glass-panel" style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                <div className="table-responsive wo-table-scroll" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'visible', WebkitOverflowScrolling: 'touch' }}>
        <table className="data-table wo-main-table" style={{ width: '100%', minWidth: 1120, borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th>WO #</th>
              <th>Client</th>
              <th>Site</th>
              <th>Title</th>
              <th>Budget</th>
              <th>Billed</th>
              <th>Open PO</th>
              <th>Purchases</th>
              <th>Expenses</th>
              <th style={{ maxWidth: 100, width: 100 }}>Margin</th>
              <th style={{ maxWidth: 96, width: 96 }}>Remaining</th>
              <th style={{ maxWidth: 120, width: 120 }}>Status</th>
              <th className="wo-actions-col" scope="col" style={{ position: 'sticky', right: 0, zIndex: 3, background: 'var(--surface, #fff)', width: 88, minWidth: 88, textAlign: 'center', boxShadow: '-4px 0 8px rgba(0,0,0,0.04)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.length === 0 && (
              <tr><td colSpan={13} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                {list.length === 0
                  ? <>No work orders yet. Click <strong>New Work Order</strong> to create one.</>
                  : <>No work orders match your search / filters.</>}
              </td></tr>
            )}
            {filteredList.map(woRow => {
              const usage = calcWOUsage(woRow, bills, purchaseOrders, purchases, expenses);
              const { billedAmount, remaining, committedCost = 0, actualCost = 0, projectedProfit = 0, costOverrun } = usage;
              return (
                <tr key={woRow.id}>
                  <td style={{ whiteSpace: 'nowrap' }}><strong>{woRow.woNumber || woRow.id}</strong></td>
                  <td title={woRow.clientName || ''} style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{woRow.clientName}</td>
                  <td style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={woRow.site || ''}>{woRow.site}</td>
                  <td title={woRow.title || ''} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{woRow.title}</td>
                  <td>{formatCurrency(woRow.approvedBudget)}</td>
                  <td>{formatCurrency(billedAmount)}</td>
                  <td className="text-end" style={{ fontSize: '0.78rem' }}>{formatCurrency(usage.openPO || 0)}</td>
                  <td className="text-end" style={{ fontSize: '0.78rem' }}>{formatCurrency(usage.purchases || usage.purchaseCost || 0)}</td>
                  <td className="text-end" style={{ fontSize: '0.78rem' }}>{formatCurrency(usage.expenses || usage.expenseCost || 0)}</td>
                  <td className="text-end" title={usage.marginPct != null ? `${usage.marginPct}%` : ''} style={{ maxWidth: 100, width: 100, fontSize: '0.78rem', fontWeight: 600, color: (usage.margin ?? projectedProfit) < 0 ? '#dc2626' : '#059669', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {formatCurrency(usage.margin ?? projectedProfit)}
                    {usage.marginPct != null ? <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.7rem' }}> ({Number(usage.marginPct).toFixed(0)}%)</span> : null}
                  </td>
                  <td style={{ color: remaining < 1 ? '#dc2626' : remaining < 5000 ? '#d97706' : undefined }}>
                    {formatCurrency(remaining)}
                  </td>
                  <td>
                    <div>{deriveWOStatus(woRow, bills)}</div>
                    {(() => {
                      const linked = (bills || []).filter(b => {
                        if (b.deleted || b.isDeleted) return false;
                        const st = String(b.status || '').toLowerCase();
                        if (st === 'cancelled' || st === 'converted') return false;
                        const typ = String(b.invoiceType || b.data?.invoiceType || '').toLowerCase();
                        if (/proforma|quotation|estimate|delivery|challan/.test(typ)) return false;
                        const wid = b.workOrderId || b.data?.workOrderId || b.data?.details?.workOrderId || '';
                        const wno = b.data?.details?.workOrderNo || b.data?.workOrderNo || b.workOrderNo || '';
                        if (wid && (wid === woRow.id || wid === woRow.woNumber)) return true;
                        if (wno && woRow.woNumber && String(wno) === String(woRow.woNumber)) return true;
                        // Inherit from converted source (QUO/PI had WO, TI did not copy)
                        const src = b.convertedFromId || b.convertedFrom || b.data?.convertedFromId || b.data?.convertedFrom || b.data?.sourceInvoiceNumber || '';
                        if (src) {
                          const s = (bills || []).find(x => x.id === src || x.invoiceNumber === src);
                          if (s) {
                            const sid = s.workOrderId || s.data?.workOrderId || s.data?.details?.workOrderId || '';
                            const sno = s.data?.details?.workOrderNo || s.workOrderNo || '';
                            if (sid && (sid === woRow.id || sid === woRow.woNumber)) return true;
                            if (sno && woRow.woNumber && String(sno) === String(woRow.woNumber)) return true;
                          }
                        }
                        return false;
                      });
                      if (!linked.length) return <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>No invoices</div>;
                      return (
                        <div style={{ fontSize: 11, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {linked.slice(0, 5).map(b => (
                            <button
                              key={b.id || b.invoiceNumber}
                              type="button"
                              onClick={() => {
                                if (typeof onOpenInvoice === 'function') onOpenInvoice(b);
                                else if (typeof onConvertToInvoice === 'function' && onConvertToInvoice.length >= 0) {
                                  try { window.dispatchEvent(new CustomEvent('sd-open-invoice', { detail: b })); } catch { /* */ }
                                }
                              }}
                              style={{
                                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                textAlign: 'left', color: '#2563eb', fontSize: 11,
                              }}
                              title={`${b.invoiceDate || ''} · ${b.status || ''} · ${b.totalAmount ?? ''}`}
                            >
                              {b.invoiceNumber || b.id}
                              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                                {b.status || ''} · {Number(b.totalAmount || 0).toLocaleString('en-IN')}
                              </span>
                            </button>
                          ))}
                          {linked.length > 5 && <span style={{ color: 'var(--text-muted)' }}>+{linked.length - 5} more</span>}
                        </div>
                      );
                    })()}
                    {costOverrun ? <div style={{ color: '#dc2626', fontSize: 11 }}>Cost Overrun Risk</div> : null}
                  </td>
                  <td className="wo-actions-col" style={{ position: 'sticky', right: 0, zIndex: 2, background: 'var(--surface, var(--card, #fff))', boxShadow: '-4px 0 8px rgba(0,0,0,0.04)', width: 88, minWidth: 88, textAlign: 'center' }}>
                    <ActionMenu items={[
                      { label: 'Email client', onClick: async () => {
                        const row = woRow;
                        const cli = (clients || []).find(c =>
                          (row.clientId && c.id === row.clientId) ||
                          (row.clientName && String(c.name || '').toLowerCase() === String(row.clientName).toLowerCase())
                        ) || {};
                        let to = String(cli.email || cli.Email || cli.mail || row.clientEmail || row.email || '').trim();
                        if (!to || !to.includes('@')) {
                          to = await requestClientEmail(to);
                          to = String(to || '').trim();
                        }
                        if (!to || !to.includes('@')) {
                          toast('No client email — add on Client master or enter when prompted', 'warning');
                          return;
                        }
                        const r = await sendMailSmart({
                          to,
                          subject: `Work Order ${row.woNumber || row.number || row.id || ''}`,
                          body: `Dear ${cli.name || row.clientName || 'Client'},

Regarding work order ${row.woNumber || row.number || ''}.

Regards`,
                          allowGmailFallback: true,
                        });
                        if (r?.ok) toast(r.via === 'smtp' ? 'Email sent' : 'Mail client opened', 'success');
                        else if (!r?.cancelled) toast(r?.error || 'Email failed', 'error');
                      } },
                      ...((() => {
                        const st = String(deriveWOStatus(woRow, bills)).toLowerCase();
                        const closed = st === 'cancelled' || st === 'closed';
                        if (closed) return [];
                        const items = [];
                        // One active PO per WO (same idea as convert once) — hide Create PO if linked
                        if (!woHasLinkedPo(woRow, purchaseOrders)) {
                          items.push({ label: 'Create PO', onClick: () => navigateCreatePoFromWo(woRow) });
                        } else {
                          items.push({
                            label: 'Create PO (already linked)',
                            disabled: true,
                            onClick: () => toast('This work order already has a Purchase Order. Open it from the PO list or dossier → Subcontract POs.', 'info'),
                          });
                        }
                        items.push({ label: 'Create Expense', onClick: () => navigateCreateExpenseFromWo(woRow) });
                        return items;
                      })()),
                      { label: 'View ledger', onClick: () => navigateLedgerForWo(woRow) },

                      ...((() => {
                        const st = String(deriveWOStatus(woRow, bills)).toLowerCase();
                        const done = st === 'completed' || st === 'cancelled' || st === 'closed';
                        if (done) return [];
                        const go = (targetType) => {
                          if (typeof onConvertToInvoice === 'function') {
                            onConvertToInvoice(woRow, targetType);
                          } else {
                            try {
                              sessionStorage.setItem('sd_convert_wo', JSON.stringify({
                                workOrderId: woRow.id,
                                woNumber: woRow.woNumber,
                                clientName: woRow.clientName,
                                site: woRow.site,
                                title: woRow.title || woRow.workDetails,
                                costCenterId: woRow.costCenterId,
                                targetType,
                                items: Array.isArray(woRow.items) ? woRow.items : [],
                                periodStart: woRow.periodStart || '',
                                periodEnd: woRow.periodEnd || '',
                              }));
                            } catch {}
                            toast('Open New Invoice — Work Order will pre-fill if conversion is wired in App', 'info');
                          }
                        };
                        return [
                          { label: 'Convert to Tax Invoice', onClick: () => go('tax-invoice') },
                          { label: 'Convert to Proforma', onClick: () => go('proforma') },
                          { label: 'Convert to Delivery Challan', onClick: () => go('delivery-challan') },
                        ];
                      })()),
                      { label: 'View Project Dossier', onClick: () => { setDossierTab('invoices'); setDossierWo(woRow); } },
                      { label: 'Edit', onClick: () => setForm({ ...woRow, items: (woRow.items && woRow.items.length) ? woRow.items : [emptyWOItem()] }) },
                      { label: 'Copy', onClick: () => setForm({ ...woRow, id: 'wo_' + Date.now().toString(36), woNumber: '', items: (woRow.items || []).map(it => ({ ...it })) }) },
                      { label: 'Delete', danger: true, onClick: () => remove(woRow.id) },
                    ]} />
                  </td>
                </tr>
              );
            })}
            
          </tbody>
        </table>
      </div>
      </div>
    </div>

      {dossierWo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setDossierWo(null)}>
          <div className="glass-panel wo-dossier-modal" onClick={e => e.stopPropagation()}>
            <div className="wo-dossier-hero">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '.12em', opacity: .82 }}><FolderKanban size={15} /> Project overview</div>
                  <h2 style={{ margin: '8px 0 5px', fontSize: 'clamp(1.2rem, 2.5vw, 1.7rem)', lineHeight: 1.2, overflowWrap: 'anywhere' }}>{dossierWo.woNumber || dossierWo.id}</h2>
                  <div style={{ fontSize: 14, fontWeight: 650 }}>{dossierWo.title || 'Untitled project'}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 12, fontSize: 12, opacity: .9 }}>
                    <span><Building2 size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />{dossierWo.clientName || 'No client'}</span>
                    <span>{dossierWo.site || 'No site specified'}</span>
                    <span><CalendarDays size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />{dossierWo.date || 'Date not set'}</span>
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDossierWo(null)} aria-label="Close Project Dossier" style={{ flexShrink: 0 }}> <X size={15} /> Close</button>
              </div>
            </div>
            <div className="wo-dossier-content">
            {(() => {
              const u = calcWOUsage(dossierWo, bills, purchaseOrders, purchases, expenses);
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10, margin: '0 0 16px' }}>
                  {[
                    ['Budget', Number(dossierWo.approvedBudget || dossierWo.budget || 0)],
                    ['Billed', u.billedAmount],
                    ['Open PO', u.openPO || 0],
                    ['Purchases', u.purchaseCost || u.purchases || 0],
                    ['Expenses', u.expenseCost || u.expenses || 0],
                    ['Margin', u.margin ?? u.projectedProfit],
                  ].map(([lab, val]) => (
                    <div key={lab} className="wo-dossier-kpi">
                      <div className="wo-dossier-kpi-label">{lab}</div>
                      <div className="wo-dossier-kpi-value" style={{ color: lab === 'Margin' && val < 0 ? '#dc2626' : undefined }}>
                        {formatCurrency(val)}
                        {lab === 'Margin' && u.marginPct != null ? <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}> {u.marginPct}%</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {woHasLinkedPo(dossierWo, purchaseOrders) ? (
                <button type="button" className="btn btn-sm btn-secondary" disabled title="A Purchase Order is already linked to this work order">Create PO (linked)</button>
              ) : (
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigateCreatePoFromWo(dossierWo)}>Create PO</button>
              )}
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigateCreateExpenseFromWo(dossierWo)}>Create Expense</button>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => onConvertToInvoice?.(dossierWo, 'tax-invoice')}>Create Invoice</button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigateLedgerForWo(dossierWo)}>View ledger</button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {[['invoices', 'Client Invoices', FileText], ['pos', 'Subcontract POs', ShoppingCart], ['purchases', 'Vendor Purchases', Receipt], ['expenses', 'Site Expenses', Wallet]].map(([id, lab, Icon]) => (
                <button key={id} type="button" className={`btn btn-sm wo-dossier-tab ${dossierTab === id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDossierTab(id)}><Icon size={14} />{lab}</button>
              ))}
            </div>
            {dossierTab === 'invoices' && (
              <div className="wo-dossier-table-wrap"><table className="data-table dossier-dense-table" style={{ width: '100%', tableLayout: 'fixed', fontSize: '0.78rem' }}>
                <thead><tr>
                  <th style={{ width: '28%' }}>Invoice</th>
                  <th style={{ width: '14%' }}>Date</th>
                  <th style={{ width: '14%' }}>Status</th>
                  <th style={{ width: '22%', textAlign: 'right' }}>Total</th>
                  <th style={{ width: '22%', textAlign: 'right' }}>Paid</th>
                </tr></thead>
                <tbody>
                  {(bills || []).filter(b => b.workOrderId === dossierWo.id || (dossierWo.woNumber && (b.data?.details?.workOrderNo || b.workOrderNo) === dossierWo.woNumber)).map(b => (
                    <tr key={b.id}>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {onOpenInvoice ? (
                          <button type="button" className="btn-link" style={{ background: 'none', border: 'none', color: 'var(--primary, #2563eb)', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                            onClick={() => { setDossierWo(null); onOpenInvoice(b); }}
                            title="Open invoice">
                            {b.invoiceNumber || b.id}
                          </button>
                        ) : (b.invoiceNumber || b.id)}
                      </td>
                      <td>{b.invoiceDate}</td>
                      <td>{b.status}</td>
                      <td className="text-end">{formatCurrency(b.totalAmount)}</td>
                      <td className="text-end">{formatCurrency(b.paidAmount)}</td>
                    </tr>
                  ))}
                  {(bills || []).filter(b => b.workOrderId === dossierWo.id || (dossierWo.woNumber && (b.data?.details?.workOrderNo || b.workOrderNo) === dossierWo.woNumber)).length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 8 }}>No invoices linked</td></tr>
                  )}
                </tbody>
              </table></div>
            )}
            {dossierTab === 'pos' && (
              <div className="wo-dossier-table-wrap"><table className="data-table dossier-dense-table" style={{ width: '100%', tableLayout: 'fixed', fontSize: '0.78rem' }}>
                <thead><tr><th>PO</th><th>Vendor</th><th>Date</th><th>Status</th><th>Value</th></tr></thead>
                <tbody>
                  {(purchaseOrders || []).filter(p => p.workOrderId === dossierWo.id || p.workOrderId === dossierWo.woNumber).map(p => (
                    <tr key={p.id}>
                      <td>{p.poNumber}</td><td>{p.vendorName}</td><td>{p.date}</td><td>{p.status}{p.isSubcontract ? ' · Sub' : ''}</td>
                      <td className="text-end">{formatCurrency(p.total || p.totalAmount)}</td>
                    </tr>
                  ))}
                  {(purchaseOrders || []).filter(p => p.workOrderId === dossierWo.id || p.workOrderId === dossierWo.woNumber).length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 18 }}>No purchase orders linked to this work order</td></tr>}
                </tbody>
              </table></div>
            )}
            {dossierTab === 'purchases' && (
              <div className="wo-dossier-table-wrap"><table className="data-table dossier-dense-table" style={{ width: '100%', tableLayout: 'fixed', fontSize: '0.78rem' }}>
                <thead><tr><th>Bill</th><th>Vendor</th><th>GSTIN</th><th>Taxable</th><th>Total</th></tr></thead>
                <tbody>
                  {(purchases || []).filter(p => p.workOrderId === dossierWo.id || p.workOrderId === dossierWo.woNumber).map(p => (
                    <tr key={p.id}>
                      <td>{p.invoiceNumber}</td><td>{p.supplierName}</td><td>{p.supplierGstin}</td>
                      <td className="text-end">{formatCurrency(p.totals?.taxable)}</td>
                      <td className="text-end">{formatCurrency(p.totalAmount || p.totals?.finalTotal)}</td>
                    </tr>
                  ))}
                  {(purchases || []).filter(p => p.workOrderId === dossierWo.id || p.workOrderId === dossierWo.woNumber).length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 18 }}>No vendor purchases linked to this work order</td></tr>}
                </tbody>
              </table></div>
            )}
            {dossierTab === 'expenses' && (
              <div className="wo-dossier-table-wrap"><table className="data-table dossier-dense-table" style={{ width: '100%', tableLayout: 'fixed', fontSize: '0.78rem' }}>
                <thead><tr><th>Date</th><th>Payee</th><th>Category</th><th>Amount</th></tr></thead>
                <tbody>
                  {(expenses || []).filter(e => e.workOrderId === dossierWo.id || e.workOrderId === dossierWo.woNumber).map(e => (
                    <tr key={e.id}>
                      <td>{e.date}</td><td>{e.vendorName || e.payee || e.description}</td><td>{e.category}</td>
                      <td className="text-end">{formatCurrency(e.amount)}</td>
                    </tr>
                  ))}
                  {(expenses || []).filter(e => e.workOrderId === dossierWo.id || e.workOrderId === dossierWo.woNumber).length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 18 }}>No site expenses linked to this work order</td></tr>}
                </tbody>
              </table></div>
            )}
            </div>
          </div>
        </div>
      )}
      {emailPrompt && (
        <div className="wo-email-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeEmailPrompt(null); }}>
          <form className="wo-email-dialog" onSubmit={e => {
            e.preventDefault();
            const value = String(emailPromptValue || '').trim();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              toast('Enter a valid client email address', 'warning');
              return;
            }
            closeEmailPrompt(value);
          }}>
            <div style={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 12, background: 'rgba(37,99,235,.1)', color: 'var(--primary, #2563eb)', marginBottom: 14 }}><Mail size={20} /></div>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem' }}>Client email required</h3>
            <p style={{ margin: '0 0 16px', color: 'var(--text-muted, #64748b)', fontSize: 13, lineHeight: 1.5 }}>Add an email address to prepare the Work Order message. You can save it to the Client master for next time.</p>
            <label htmlFor="wo-client-email" className="form-label">CLIENT EMAIL</label>
            <input id="wo-client-email" type="email" required autoFocus className="form-input" placeholder="client@company.com" value={emailPromptValue} onChange={e => setEmailPromptValue(e.target.value)} style={{ width: '100%', marginTop: 6, marginBottom: 18 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => closeEmailPrompt(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary"><Mail size={14} /> Continue</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

