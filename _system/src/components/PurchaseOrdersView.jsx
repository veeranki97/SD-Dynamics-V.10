import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, FileText, Printer } from 'lucide-react';
import {
  getAllPurchaseOrders,
  savePurchaseOrder,
  deletePurchaseOrder,
  getAllClients,
  getProfile,
  getAllCostCenters,
  getNextInvoiceNumber,
} from '../store';
import { emptyWOItem, calcItemAmount } from '../utils/workOrder';
import { formatCurrency } from '../utils';
import { toast } from './Toast';
import ActionMenu from './ActionMenu';
import { getHsnMaster, getUnitMaster } from '../utils/masterData';
import { getPrintSettings } from '../utils/printSettings';
function downloadRowsCsv(filename, rows, cols) {
  const esc = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const headers = cols.map(c => c.label);
  const body = rows.map(r => cols.map(c => esc(c.get ? c.get(r) : r[c.key])).join(','));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([[headers.join(',')].concat(body).join('\n')], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

function fyLabel(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth();
  return m >= 3 ? `${String(y).slice(-2)}-${String(y + 1).slice(-2)}` : `${String(y - 1).slice(-2)}-${String(y).slice(-2)}`;
}

async function nextPONumber() {
  try {
    return await getNextInvoiceNumber('PO', { explicitPrefix: true });
  } catch {
    return 'PO/0001';
  }
}

/** GST split like SD Dynamics: same state → CGST+SGST else IGST */
function calcPOTotals(items, taxRate, vendorState, hostState) {
  const sub = (items || []).reduce((s, it) => s + calcItemAmount(it), 0);
  const rate = Number(taxRate) || 0;
  const gst = +(sub * rate / 100).toFixed(2);
  const same =
    (vendorState || '').trim().toLowerCase() === (hostState || '').trim().toLowerCase() &&
    !!(vendorState || '').trim();
  let cgst = 0, sgst = 0, igst = 0;
  if (same) {
    cgst = +(gst / 2).toFixed(2);
    sgst = +(gst - cgst).toFixed(2);
  } else {
    igst = gst;
  }
  return { sub, gst, cgst, sgst, igst, total: +(sub + gst).toFixed(2), isInterstate: !same };
}

async function sha256Hex(text) {
  try {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = ((h << 5) - h) + text.charCodeAt(i) | 0;
    return 'local-' + Math.abs(h).toString(16);
  }
}

function printPO(po, profile, fingerprint) {
  let sigSrc = '';
  try {
    const ps = (typeof getPrintSettings === 'function' ? getPrintSettings() : {}) || {};
    sigSrc = (profile && (profile.signature || profile.signatureImage))
      || ps.signatureImage || ps.signature || '';
  } catch { sigSrc = (profile && (profile.signature || profile.signatureImage)) || ''; }
  const t = calcPOTotals(po.items, po.taxRate, po.vendorState, profile?.state);
  const terms = (po.terms || po.notes || profile?.defaultTerms ||
    '1. Please quote PO number on all invoices and delivery challans.\n2. Goods/services subject to inspection and approval.\n3. Payment as per agreed terms.').replace(/\n/g, '<br/>');
  const rows = (po.items || []).map((it, i) => {
    const amt = calcItemAmount(it);
    return `<tr>
      <td style="border:1px solid #000;padding:4px 6px;text-align:center">${i + 1}</td>
      <td style="border:1px solid #000;padding:4px 6px">${String(it.description || '').replace(/</g,'&lt;')}</td>
      <td style="border:1px solid #000;padding:4px 6px;text-align:center">${it.hsn || ''}</td>
      <td style="border:1px solid #000;padding:4px 6px;text-align:center">${it.qty || 0}</td>
      <td style="border:1px solid #000;padding:4px 6px;text-align:center">${it.unit || ''}</td>
      <td style="border:1px solid #000;padding:4px 6px;text-align:right">${Number(it.rate || 0).toFixed(2)}</td>
      <td style="border:1px solid #000;padding:4px 6px;text-align:right">${amt.toFixed(2)}</td>
    </tr>`;
  }).join('');
  const taxBlock = t.isInterstate
    ? `<tr><td colspan="5" style="border:1px solid #000;padding:4px"></td>
        <td style="border:1px solid #000;padding:4px;text-align:right;font-weight:700">IGST @ ${po.taxRate || 0}%</td>
        <td style="border:1px solid #000;padding:4px;text-align:right;font-weight:700">${t.igst.toFixed(2)}</td></tr>`
    : `<tr><td colspan="5" style="border:1px solid #000;padding:4px"></td>
        <td style="border:1px solid #000;padding:4px;text-align:right;font-weight:700">CGST</td>
        <td style="border:1px solid #000;padding:4px;text-align:right;font-weight:700">${t.cgst.toFixed(2)}</td></tr>
      <tr><td colspan="5" style="border:1px solid #000;padding:4px"></td>
        <td style="border:1px solid #000;padding:4px;text-align:right;font-weight:700">SGST</td>
        <td style="border:1px solid #000;padding:4px;text-align:right;font-weight:700">${t.sgst.toFixed(2)}</td></tr>`;
  const addr = [profile?.address, [profile?.city, profile?.pin].filter(Boolean).join(' - '), profile?.state].filter(Boolean).join('<br/>');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${po.poNumber || 'PO'}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; margin: 0; }
  table { border-collapse: collapse; width: 100%; }
  .wrap { border: 1.5px solid #000; }
  .hdr td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; }
  .title { font-size: 16px; font-weight: 800; letter-spacing: 0.04em; text-align: center; }
  th { background: #f3f4f6; font-weight: 700; border: 1px solid #000; padding: 5px 6px; }
  .sig img { max-height: 52px; max-width: 140px; }
  .foot { font-size: 9px; color: #444; margin-top: 6px; text-align: center; }
</style></head><body>
<div class="wrap">
<table class="hdr">
  <tr>
    <td style="width:55%">
      <div style="font-weight:800;font-size:14px">${(profile?.businessName || 'Company').replace(/</g,'&lt;')}</div>
      <div>${addr}</div>
      ${profile?.gstin ? `<div>GSTIN: <b>${profile.gstin}</b></div>` : ''}
      ${profile?.pan ? `<div>PAN: ${profile.pan}</div>` : ''}
      ${profile?.phone || profile?.email ? `<div>${[profile.phone && 'Phone: '+profile.phone, profile.email && 'Email: '+profile.email].filter(Boolean).join(' · ')}</div>` : ''}
    </td>
    <td style="width:45%">
      <div class="title">PURCHASE ORDER</div>
      <div style="margin-top:6px"><b>PO No</b> &nbsp; ${po.poNumber || ''}</div>
      <div><b>Date</b> &nbsp; ${po.date || ''}</div>
      <div><b>Status</b> &nbsp; ${po.status || 'Issued'}</div>
      ${po.costCenterId || po.costCenter ? `<div><b>Cost Center</b> &nbsp; ${po.costCenterId || po.costCenter}</div>` : ''}
    </td>
  </tr>
  <tr>
    <td>
      <div style="font-weight:700;margin-bottom:2px">Vendor (Bill From)</div>
      <div style="font-weight:700">${(po.vendorName || '').replace(/</g,'&lt;')}</div>
      <div>${(po.vendorAddress || '').replace(/</g,'&lt;').replace(/\n/g,'<br/>')}</div>
      ${po.vendorGstin ? `<div>GSTIN: ${po.vendorGstin}</div>` : ''}
      ${po.vendorState ? `<div>State: ${po.vendorState}</div>` : ''}
    </td>
    <td>
      <div style="font-weight:700;margin-bottom:2px">Ship To (Site)</div>
      <div>${(po.shipToName || po.site || profile?.businessName || '').replace(/</g,'&lt;')}</div>
      <div>${(po.shipToAddress || '').replace(/</g,'&lt;').replace(/\n/g,'<br/>')}</div>
    </td>
  </tr>
</table>
<table>
  <thead>
    <tr>
      <th style="width:28px">#</th><th>Description</th><th style="width:70px">HSN</th>
      <th style="width:48px">Qty</th><th style="width:48px">Unit</th>
      <th style="width:72px">Rate</th><th style="width:88px">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr>
      <td colspan="5" style="border:1px solid #000;padding:4px"></td>
      <td style="border:1px solid #000;padding:4px;text-align:right;font-weight:700">Taxable</td>
      <td style="border:1px solid #000;padding:4px;text-align:right;font-weight:700">${t.taxable.toFixed(2)}</td>
    </tr>
    ${taxBlock}
    <tr>
      <td colspan="5" style="border:1px solid #000;padding:4px"></td>
      <td style="border:1px solid #000;padding:4px;text-align:right">Round Off</td>
      <td style="border:1px solid #000;padding:4px;text-align:right">${(t.roundOff || 0).toFixed(2)}</td>
    </tr>
    <tr>
      <td colspan="5" style="border:1px solid #000;padding:4px"></td>
      <td style="border:1px solid #000;padding:4px;text-align:right;font-weight:800;font-size:12px">Grand Total</td>
      <td style="border:1px solid #000;padding:4px;text-align:right;font-weight:800;font-size:12px">${t.total.toFixed(2)}</td>
    </tr>
  </tbody>
</table>
<table>
  <tr>
    <td style="border:1px solid #000;padding:8px;width:58%;vertical-align:top">
      <div style="font-weight:700;margin-bottom:4px">Terms &amp; Conditions</div>
      <div style="font-size:10px;line-height:1.4">${terms}</div>
    </td>
    <td style="border:1px solid #000;padding:8px;width:42%;vertical-align:top;text-align:right">
      <div style="font-weight:700">For ${(profile?.businessName || '').replace(/</g,'&lt;')}</div>
      <div class="sig" style="min-height:56px;margin:8px 0">
        ${sigSrc ? `<img src="${sigSrc}" alt="Signature"/>` : '<div style="height:48px"></div>'}
      </div>
      <div style="border-top:1px solid #000;padding-top:4px;font-size:10px">Authorised Signatory</div>
    </td>
  </tr>
</table>
</div>
<div class="foot">SHA-256: ${fingerprint || '—'} · Computer generated PO — ${new Date().toLocaleString('en-IN')}</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}


export default function PurchaseOrdersView() {
  const [list, setList] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [clients, setClients] = useState([]);
  const [shipSites, setShipSites] = useState(['Main Site']);

  // Master HSN/SAC + units (same keys as InvoiceGenerator)
  const [hsnMaster, setHsnMaster] = useState([]);
  const [unitMaster, setUnitMaster] = useState(['Nos', 'Hrs', 'Days', 'Kg', 'Ltr', 'Mtr', 'Sqft', 'Job']);
  useEffect(() => {
    try {
      const custom = getHsnMaster();
      setHsnMaster(Array.isArray(custom) ? custom.filter(Boolean) : []);
    } catch { /* */ }
    try {
      const u = JSON.parse(localStorage.getItem('freegstbill_custom_units') || '[]');
      if (Array.isArray(u) && u.length) setUnitMaster(prev => [...new Set([...prev, ...u])]);
    } catch { /* */ }
  }, []);

  const [vendors, setVendors] = useState([]);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [pos, clients, prof] = await Promise.all([
        getAllPurchaseOrders(),
        getAllClients(), // filtered to vendors below
        getProfile().catch(() => null),
      ]);
      setList(pos || []);
      setVendors((clients || []).filter(c => c.isVendor || c.type === 'vendor'));
      setProfile(prof);
    } catch {
      toast('Failed to load Purchase Orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getAllCostCenters().then(setCostCenters);
      getAllClients().then(cs => {
        setClients(cs || []);
        const sites = new Set(['Main Site']);
        (cs || []).forEach(c => {
          if (c.site) sites.add(c.site);
          (c.sites || []).forEach(s => sites.add(s));
        });
        setShipSites([...sites]);
      }).catch(() => {}).catch(() => {});
  }, []);
  useEffect(() => { load(); }, []);

  const openNew = () =>
    setForm({
      id: 'po_' + Date.now().toString(36),
      poNumber: '',
      vendorName: '',
      vendorGstin: '',
      vendorState: '',
      site: 'Main Site',
      date: new Date().toISOString().split('T')[0],
      status: 'draft',
      taxRate: 18,
      notes: '',
      items: [emptyWOItem()],
      createdAt: new Date().toISOString(),
    });

  const updateItem = (idx, field, value) => {
    setForm(prev => {
      const items = [...(prev.items || [])];
      const row = { ...items[idx], [field]: value };
      if (field === 'qty' || field === 'rate') row.amount = calcItemAmount(row);
      items[idx] = row;
      return { ...prev, items };
    });
  };

  const t = useMemo(
    () => (form ? calcPOTotals(form.items, form.taxRate, form.vendorState, profile?.state) : null),
    [form, profile]
  );

  const save = async () => {
    if (!form.vendorName?.trim()) return toast('Vendor required', 'error');
    if (!(form.costCenterId || '').trim()) return toast('Cost Center is required', 'error');
    if (!form.poNumber?.trim()) form.poNumber = await nextPONumber();
    const items = (form.items || []).map(it => ({ ...it, amount: calcItemAmount(it) }));
    const totals = calcPOTotals(items, form.taxRate, form.vendorState, profile?.state);
    const payload = {
      ...form,
      items,
      ...totals,
      fingerprint: await sha256Hex(JSON.stringify({
        po: form.poNumber, vendor: form.vendorName, items, totals, date: form.date,
      })),
      updatedAt: new Date().toISOString(),
    };
    try {
      await savePurchaseOrder(payload, { overwrite: true });
      toast(`PO ${payload.poNumber} saved`, 'success');
      setForm(null);
      load();
    } catch (e) {
      toast(e?.message || 'Save failed', 'error');
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this Purchase Order?')) return;
    await deletePurchaseOrder(id);
    toast('Deleted', 'success');
    load();
  };

  if (loading) return <div className="page"><p>Loading…</p></div>;

  if (form) {
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2>{form.poNumber ? `Edit ${form.poNumber}` : 'New Purchase Order'}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={save}>Save PO</button>
          </div>
        </div>
        <div className="glass-panel p-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">PO Number</label>
            <input className="form-input" value={form.poNumber} placeholder="Auto on save"
              onChange={e => setForm({ ...form, poNumber: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Vendor</label>
            <input className="form-input" list="po-vendors" value={form.vendorName}
              onChange={e => {
                const name = e.target.value;
                const v = vendors.find(x => x.name === name);
                setForm({
                  ...form,
                  vendorName: name,
                  vendorGstin: v?.gstin || form.vendorGstin,
                  vendorState: v?.state || form.vendorState,
                  site: v?.site || (Array.isArray(v?.sites) && v.sites[0]) || form.site || '',
                });
              }} />
            <datalist id="po-vendors">{vendors.map(v => <option key={v.id || v.name} value={v.name} />)}</datalist>
          </div>
          <div className="form-group">
            <label className="form-label">Vendor GSTIN</label>
            <input className="form-input" value={form.vendorGstin || ''}
              onChange={e => setForm({ ...form, vendorGstin: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Vendor State</label>
            <input className="form-input" value={form.vendorState || ''}
              onChange={e => setForm({ ...form, vendorState: e.target.value })}
              placeholder="For CGST/SGST vs IGST" />
          </div>
          <div className="form-group">
            <label className="form-label">Ship To (Site)</label>
            <select className="form-input" value={form.site || 'Main Site'}
              onChange={e => setForm({ ...form, site: e.target.value })}>
              {(typeof shipSites !== 'undefined' ? shipSites : ['Main Site']).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <datalist id="po-sites">
              {(form.site ? [form.site] : []).map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div className="form-group">
            <label className="form-label">PO Status</label>
            <select className="form-input" value={form.status || 'issued'}
              onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="partially-received">Partially Received</option>
              <option value="fully-received">Fully Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Cost Center *</label>
            <select className="form-input" value={form.costCenterId || ''}
              onChange={e => setForm({ ...form, costCenterId: e.target.value })}>
              <option value="">Select cost center…</option>
              {(costCenters || []).map(cc => (
                <option key={cc.id || cc.name} value={cc.id || cc.name}>{cc.name || cc.id}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">GST %</label>
            <input type="number" className="form-input" value={form.taxRate}
              onChange={e => setForm({ ...form, taxRate: e.target.value })} />
          </div>
        </div>

        <div className="glass-panel p-4 mt-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Line items</h3>
            <button type="button" className="btn btn-sm btn-secondary"
              onClick={() => setForm({ ...form, items: [...(form.items || []), emptyWOItem()] })}>
              <Plus size={14} /> Add row
            </button>
          </div>
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Description</th><th>HSN</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th><th></th>
                </tr>
              </thead>
              <tbody>
                {(form.items || []).map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td><input className="form-input" value={it.description || ''}
                      onChange={e => updateItem(idx, 'description', e.target.value)} /></td>
                    <td>
                      <input className="form-input" style={{ width: 100 }} list={`po-hsn-${idx}`}
                        value={it.hsn || ''} placeholder="Type 3+ chars"
                        onChange={e => updateItem(idx, 'hsn', e.target.value)} />
                      <datalist id={`po-hsn-${idx}`}>
                        {hsnMaster.map(h => <option key={h} value={h} />)}
                      </datalist>
                    </td>
                    <td><input type="number" className="form-input" style={{ width: 70 }} value={it.qty}
                      onChange={e => updateItem(idx, 'qty', e.target.value)} /></td>
                    <td>
                      <input className="form-input" style={{ width: 80 }} list={`po-unit-${idx}`}
                        value={it.unit || ''} onChange={e => updateItem(idx, 'unit', e.target.value)} />
                      <datalist id={`po-unit-${idx}`}>
                        {unitMaster.map(u => <option key={u} value={u} />)}
                      </datalist>
                    </td>
                    <td><input type="number" className="form-input" style={{ width: 90 }} value={it.rate}
                      onChange={e => updateItem(idx, 'rate', e.target.value)} /></td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(calcItemAmount(it))}</td>
                    <td>
                      <button type="button" className="btn-icon" onClick={() =>
                        setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {t && (
            <div style={{ marginTop: 12, textAlign: 'right', lineHeight: 1.7 }}>
              <div>Taxable: <b>{formatCurrency(t.sub)}</b></div>
              {t.isInterstate
                ? <div>IGST: <b>{formatCurrency(t.igst)}</b></div>
                : <><div>CGST: <b>{formatCurrency(t.cgst)}</b></div><div>SGST: <b>{formatCurrency(t.sgst)}</b></div></>}
              <div style={{ fontSize: '1.1rem' }}>Total: <b>{formatCurrency(t.total)}</b></div>
            </div>
          )}
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} value={form.notes || ''}
              onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Purchase Orders</h2>
          <p className="page-subtitle" style={{ margin: 0 }}>SD-style PO with GST bifurcation & digitally fingerprinted print</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={16} /> New PO</button>
      </div>
      <table className="data-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>PO #</th><th>Date</th><th>Vendor</th><th>Site</th><th>Status</th>
            <th className="text-end">Taxable</th><th className="text-end">GST</th><th className="text-end">Total</th><th></th>
          </tr>
        </thead>
        <tbody>
          {list.map(po => (
            <tr key={po.id}>
              <td>{po.poNumber}</td>
              <td>{po.date}</td>
              <td>{po.vendorName}</td>
              <td>{po.site}</td>
              <td>{po.status}</td>
              <td className="text-end">{formatCurrency(po.sub || 0)}</td>
              <td className="text-end">{formatCurrency(po.gst || 0)}</td>
              <td className="text-end">{formatCurrency(po.total || 0)}</td>
              <td>
                <ActionMenu items={[
                  { label: 'Edit', onClick: () => setForm({ ...po }) },
                  { label: 'Copy', onClick: () => setForm({ ...po, id: undefined, poNumber: '' }) },
                  { label: 'Print / PDF', onClick: () => printPO(po, profile || {}, po.fingerprint) },
                  { label: 'Export CSV', onClick: () => downloadRowsCsv(`PO-${po.poNumber || po.id}.csv`, [po], [
                    { key: 'poNumber', label: 'PO No' }, { key: 'date', label: 'Date' },
                    { key: 'vendorName', label: 'Vendor' }, { key: 'site', label: 'Site' },
                    { key: 'status', label: 'Status' }, { key: 'total', label: 'Total' },
                  ]) },
                  { label: 'Delete', danger: true, onClick: () => remove(po.id) },
                ]} />
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8' }}>No purchase orders yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
