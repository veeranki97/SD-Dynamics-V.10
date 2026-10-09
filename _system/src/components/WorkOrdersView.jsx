import { useState, useEffect } from 'react';
import { Plus, Trash2, ClipboardList } from 'lucide-react';
import {
  getAllWorkOrders, getAllExpenses, getAllPurchases, getAllPurchaseOrders, saveWorkOrder, deleteWorkOrder,
  getAllBills, getAllClients, getAllCostCenters,
} from '../store';
import { calcWOUsage, emptyWOItem, calcItemAmount, deriveWOStatus, resolveWoCostCenter, resolveWoSite } from '../utils/workOrder';
import { formatCurrency } from '../utils';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';
import ActionMenu from './ActionMenu';
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
    const cc = resolveWoCostCenter(wo) || '';
    const site = resolveWoSite(wo) || wo.site || '';
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
      notes: wo.notes || wo.title || '',
      isSubcontract: true,
      items,
    }));
  } catch { /* */ }
  sessionStorage.setItem('gst_currentView', 'purchaseorders');
  window.dispatchEvent(new CustomEvent('sd-navigate', { detail: 'purchaseorders' }));
}

/** Prefill New Expense from Work Order. */
function navigateCreateExpenseFromWo(wo) {
  if (!wo) return;
  try {
    sessionStorage.setItem('sd_expense_from_wo', JSON.stringify({
      workOrderId: wo.id,
      workOrderNumber: wo.woNumber || '',
      site: wo.site || '',
      costCenterId: wo.costCenterId || '',
      clientName: wo.clientName || '',
      jobCost: true,
    }));
  } catch { /* */ }
  sessionStorage.setItem('gst_currentView', 'expenses');
  window.dispatchEvent(new CustomEvent('sd-navigate', { detail: 'expenses' }));
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

export default function WorkOrdersView({ onConvertToInvoice, onOpenInvoice }) {
  const [list, setList] = useState([]);
  const [bills, setBills] = useState([]);
  const [clients, setClients] = useState([]);
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
      }, { overwrite: true });
      toast('Work Order saved', 'success');
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

  if (loading) return <div className="page"><p>Loading…</p></div>;

  if (form) {
    const t = calcWOTotals(form.items, form.taxRate ?? 18, form.clientState, form.hostState);
    return (
      <div className="page" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0 }}>{form.woNumber ? `Edit ${form.woNumber}` : 'New Work Order'}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
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
                      <input className="form-input" value={it.description || ''}
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
    
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={22} /> Work Orders
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Project budgets — invoices cannot exceed remaining qty / budget
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>
          <Plus size={16} /> New Work Order
        </button>
      </div>
      <div className="table-responsive">
        <table className="data-table" style={{ width: '100%' }}>
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
              <th>Margin</th>
              <th>Remaining</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={13} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                No work orders yet. Click <strong>New Work Order</strong> to create one.
                If you saved one and it is missing, open <code>/api/workorders</code> in this browser to verify the API.
              </td></tr>
            )}
            {list.map(woRow => {
              const usage = calcWOUsage(woRow, bills, purchaseOrders, purchases, expenses);
              const { billedAmount, remaining, committedCost = 0, actualCost = 0, projectedProfit = 0, costOverrun } = usage;
              return (
                <tr key={woRow.id}>
                  <td><strong>{woRow.woNumber || woRow.id}</strong></td>
                  <td>{woRow.clientName}</td>
                  <td>{woRow.site}</td>
                  <td>{woRow.title}</td>
                  <td>{formatCurrency(woRow.approvedBudget)}</td>
                  <td>{formatCurrency(billedAmount)}</td>
                  <td className="text-end" style={{ fontSize: '0.78rem' }}>{formatCurrency(usage.openPO || 0)}</td>
                  <td className="text-end" style={{ fontSize: '0.78rem' }}>{formatCurrency(usage.purchases || usage.purchaseCost || 0)}</td>
                  <td className="text-end" style={{ fontSize: '0.78rem' }}>{formatCurrency(usage.expenses || usage.expenseCost || 0)}</td>
                  <td className="text-end" style={{ fontSize: '0.78rem', fontWeight: 600, color: (usage.margin ?? projectedProfit) < 0 ? '#dc2626' : '#059669' }}>
                    {formatCurrency(usage.margin ?? projectedProfit)}
                    {usage.marginPct != null ? <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> ({usage.marginPct}%)</span> : null}
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
                  <td>
                    <ActionMenu items={[
                      { label: 'Create PO', onClick: () => navigateCreatePoFromWo(woRow) },
                      { label: 'Create Expense', onClick: () => navigateCreateExpenseFromWo(woRow) },
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
            {!list.length && (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No work orders yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

      {dossierWo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setDossierWo(null)}>
          <div className="glass-panel" style={{ width: 'min(920px, 96vw)', maxHeight: '90vh', overflow: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Project Dossier — {dossierWo.woNumber || dossierWo.id}</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDossierWo(null)}>Close</button>
            </div>
            <p className="text-muted" style={{ fontSize: 13 }}>{dossierWo.clientName} · {dossierWo.site || ''} · {dossierWo.title || ''}</p>
            {(() => {
              const u = calcWOUsage(dossierWo, bills, purchaseOrders, purchases, expenses);
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8, margin: '10px 0 14px' }}>
                  {[
                    ['Billed', u.billedAmount],
                    ['Open PO', u.openPO || 0],
                    ['Purchases', u.purchases || u.purchaseCost || 0],
                    ['Expenses', u.expenses || u.expenseCost || 0],
                    ['Margin', u.margin ?? u.projectedProfit],
                  ].map(([lab, val]) => (
                    <div key={lab} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface, var(--card))' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{lab}</div>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: lab === 'Margin' && val < 0 ? '#dc2626' : undefined }}>
                        {formatCurrency(val)}
                        {lab === 'Margin' && u.marginPct != null ? <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}> {u.marginPct}%</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigateCreatePoFromWo(dossierWo)}>Create PO</button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigateCreateExpenseFromWo(dossierWo)}>Create Expense</button>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => onConvertToInvoice?.(dossierWo, 'tax-invoice')}>Create Invoice</button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => navigateLedgerForWo(dossierWo)}>View ledger</button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {[['invoices', 'Client Invoices'], ['pos', 'Subcontract POs'], ['purchases', 'Vendor Purchases'], ['expenses', 'Site Expenses']].map(([id, lab]) => (
                <button key={id} type="button" className={`btn btn-sm ${dossierTab === id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDossierTab(id)}>{lab}</button>
              ))}
            </div>
            {dossierTab === 'invoices' && (
              <table className="data-table dossier-dense-table" style={{ width: '100%', tableLayout: 'fixed', fontSize: '0.78rem' }}>
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
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.invoiceNumber}</td>
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
              </table>
            )}
            {dossierTab === 'pos' && (
              <table className="data-table dossier-dense-table" style={{ width: '100%', tableLayout: 'fixed', fontSize: '0.78rem' }}>
                <thead><tr><th>PO</th><th>Vendor</th><th>Date</th><th>Status</th><th>Value</th></tr></thead>
                <tbody>
                  {(purchaseOrders || []).filter(p => p.workOrderId === dossierWo.id || p.workOrderId === dossierWo.woNumber).map(p => (
                    <tr key={p.id}>
                      <td>{p.poNumber}</td><td>{p.vendorName}</td><td>{p.date}</td><td>{p.status}{p.isSubcontract ? ' · Sub' : ''}</td>
                      <td className="text-end">{formatCurrency(p.total || p.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {dossierTab === 'purchases' && (
              <table className="data-table dossier-dense-table" style={{ width: '100%', tableLayout: 'fixed', fontSize: '0.78rem' }}>
                <thead><tr><th>Bill</th><th>Vendor</th><th>GSTIN</th><th>Taxable</th><th>Total</th></tr></thead>
                <tbody>
                  {(purchases || []).filter(p => p.workOrderId === dossierWo.id || p.workOrderId === dossierWo.woNumber).map(p => (
                    <tr key={p.id}>
                      <td>{p.invoiceNumber}</td><td>{p.supplierName}</td><td>{p.supplierGstin}</td>
                      <td className="text-end">{formatCurrency(p.totals?.taxable)}</td>
                      <td className="text-end">{formatCurrency(p.totalAmount || p.totals?.finalTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {dossierTab === 'expenses' && (
              <table className="data-table dossier-dense-table" style={{ width: '100%', tableLayout: 'fixed', fontSize: '0.78rem' }}>
                <thead><tr><th>Date</th><th>Payee</th><th>Category</th><th>Amount</th></tr></thead>
                <tbody>
                  {(expenses || []).filter(e => e.workOrderId === dossierWo.id || e.workOrderId === dossierWo.woNumber).map(e => (
                    <tr key={e.id}>
                      <td>{e.date}</td><td>{e.vendorName || e.payee || e.description}</td><td>{e.category}</td>
                      <td className="text-end">{formatCurrency(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}

