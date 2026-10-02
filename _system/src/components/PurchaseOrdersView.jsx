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
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inr = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const company = esc(profile?.businessName || profile?.name || 'SAI DURGA');
  const cAddr = esc([profile?.address, profile?.city, profile?.state, profile?.pincode].filter(Boolean).join(', '));
  const cGst = esc(profile?.gstin || '');
  const cPhone = esc(profile?.phone || profile?.mobile || '');
  const cEmail = esc(profile?.email || '');
  const vendorName = esc(po.vendorName || po.vendor || '');
  const vendorGst = esc(po.vendorGstin || po.vendorGSTIN || '');
  const vendorAddr = esc(po.vendorAddress || po.vendorAddr || '');
  const vendorPhone = esc(po.vendorPhone || '');
  const shipSite = esc(po.shipToSite || po.site || po.deliverySite || '');
  const shipAddr = esc(po.shipToAddress || po.deliveryAddress || '');
  const shipState = esc(po.shipToState || po.deliveryState || '');
  const subject = esc(po.subject || po.title || (po.items && po.items[0] && po.items[0].description) || '');
  const terms = esc(po.terms || po.notes || profile?.defaultTerms ||
    '1. Please quote PO number on all invoices and delivery challans.\n2. Goods/services subject to inspection and approval.\n3. Payment as per agreed terms.')
    .replace(/\n/g, '<br/>');
  const notes = esc(po.deliveryNotes || po.instructions || '');
  const rows = (po.items || []).map((it, i) => {
    const amt = calcItemAmount(it);
    return `<tr>
      <td style="border:1px solid #1e293b;padding:6px 8px;text-align:center">${i + 1}</td>
      <td style="border:1px solid #1e293b;padding:6px 8px">${esc(it.description)}</td>
      <td style="border:1px solid #1e293b;padding:6px 8px;text-align:center">${esc(it.hsn)}</td>
      <td style="border:1px solid #1e293b;padding:6px 8px;text-align:center">${esc(it.unit || 'EA')}</td>
      <td style="border:1px solid #1e293b;padding:6px 8px;text-align:right">${Number(it.qty || 0)}</td>
      <td style="border:1px solid #1e293b;padding:6px 8px;text-align:right">${inr(it.rate)}</td>
      <td style="border:1px solid #1e293b;padding:6px 8px;text-align:right">${inr(amt)}</td>
    </tr>`;
  }).join('');
  const taxLines = t.isInterstate
    ? `<div class="tot-row"><span>IGST (${Number(po.taxRate || 0).toFixed(2)}%)</span><span>₹${inr(t.igst)}</span></div>`
    : `<div class="tot-row"><span>CGST (${(Number(po.taxRate || 0) / 2).toFixed(2)}%)</span><span>₹${inr(t.cgst)}</span></div>
       <div class="tot-row"><span>SGST (${(Number(po.taxRate || 0) / 2).toFixed(2)}%)</span><span>₹${inr(t.sgst)}</span></div>`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(po.poNumber || 'PO')}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #0f172a; font-size: 11px; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
  .top .co h1 { margin: 0; font-size: 18px; letter-spacing: 0.08em; color: #0f172a; }
  .top .co .muted { color: #475569; font-size: 10px; line-height: 1.45; margin-top: 4px; }
  .top .meta { text-align: right; }
  .top .meta .doc { font-size: 16px; font-weight: 700; letter-spacing: 0.06em; }
  .top .meta div { margin-top: 3px; font-size: 11px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 2px solid #0f172a; margin-bottom: 10px; }
  .grid2 .box { padding: 10px 12px; }
  .grid2 .box + .box { border-left: 2px solid #0f172a; }
  .grid2 .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; font-weight: 600; margin-bottom: 6px; }
  .grid2 .name { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
  .subject { border: 2px solid #0f172a; border-top: none; padding: 8px 12px; margin-bottom: 10px; font-size: 11px; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  table.items th { background: #f1f5f9; border: 1px solid #1e293b; padding: 7px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; }
  .bottom { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 12px; margin-top: 4px; }
  .notes { font-size: 10px; line-height: 1.45; color: #334155; }
  .notes b { display: block; margin-bottom: 4px; color: #0f172a; }
  .totals { border: 2px solid #0f172a; padding: 10px 12px; }
  .tot-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; }
  .tot-row.grand { border-top: 1.5px solid #0f172a; margin-top: 6px; padding-top: 8px; font-size: 13px; font-weight: 700; }
  .terms { margin-top: 12px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 10px; color: #475569; }
  .sign { margin-top: 12px; text-align: right; }
  .sign img { max-height: 64px; max-width: 180px; object-fit: contain; display: block; margin: 0 0 6px auto; }
  .sign .for { font-size: 11px; }
  .sign .line { margin-top: 8px; border-top: 1px solid #0f172a; display: inline-block; min-width: 160px; padding-top: 4px; font-size: 10px; }
  .fp { margin-top: 14px; font-size: 8px; color: #94a3b8; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 6px; }
</style></head><body>
  <div class="top">
    <div class="co">
      <h1>${company.toUpperCase()}</h1>
      <div class="muted">${cAddr}${cGst ? '<br/>GSTIN: ' + cGst : ''}${(cPhone || cEmail) ? '<br/>' + [cPhone, cEmail].filter(Boolean).join(' · ') : ''}</div>
    </div>
    <div class="meta">
      <div class="doc">PURCHASE ORDER</div>
      <div><b>PO No:</b> ${esc(po.poNumber)}</div>
      <div><b>Date:</b> ${esc(po.date || po.poDate)}</div>
      <div><b>Status:</b> ${esc(po.status || 'Issued')}</div>
    </div>
  </div>
  <div class="grid2">
    <div class="box">
      <div class="lbl">Supplier Details (To)</div>
      <div class="name">${vendorName || '—'}</div>
      <div>${vendorGst ? 'GSTIN: ' + vendorGst + '<br/>' : ''}${vendorPhone ? 'Phone: ' + vendorPhone + '<br/>' : ''}${vendorAddr || ''}</div>
    </div>
    <div class="box">
      <div class="lbl">Delivery Details (Ship To)</div>
      <div class="name">${shipSite || '—'}</div>
      <div>${shipAddr || ''}${shipState ? (shipAddr ? '<br/>' : '') + 'State: ' + shipState : ''}</div>
    </div>
  </div>
  ${subject ? `<div class="subject"><b>Subject:</b> ${subject}</div>` : ''}
  <table class="items">
    <thead>
      <tr>
        <th style="width:5%">Sl</th>
        <th>Description / Material</th>
        <th style="width:10%">HSN/SAC</th>
        <th style="width:8%">Unit</th>
        <th style="width:8%">Qty</th>
        <th style="width:12%">Unit Rate</th>
        <th style="width:14%">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7" style="border:1px solid #1e293b;padding:12px;text-align:center">No items</td></tr>'}
    </tbody>
  </table>
  <div class="bottom">
    <div class="notes">
      ${notes ? `<b>Notes / Instructions</b>${notes.replace(/\n/g, '<br/>')}` : ''}
      <div class="terms"><b>Terms &amp; Conditions</b><br/>${terms}</div>
    </div>
    <div class="totals">
      <div class="tot-row"><span>Subtotal</span><span>₹${inr(t.sub)}</span></div>
      ${taxLines}
      <div class="tot-row"><span>Round Off</span><span>₹0.00</span></div>
      <div class="tot-row grand"><span>Grand Total</span><span>₹${inr(t.total)}</span></div>
    </div>
  </div>
  <div class="sign">
    ${sigSrc ? `<img src="${sigSrc}" alt="Signature"/>` : ''}
    <div class="for">For <b>${company}</b></div>
    <div class="line">Authorized Signatory</div>
  </div>
  <div class="fp">SHA-256: ${esc(fingerprint) || '—'} · Generated securely by SD Dynamics · ${new Date().toLocaleString('en-IN')}</div>
</body></html>`;

  try {
    let iframe = document.getElementById('sd-po-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'sd-po-print-frame';
      iframe.setAttribute('title', 'PO Print');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      document.body.appendChild(iframe);
    }
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument || win.document;
    doc.open();
    doc.write(html);
    doc.close();
    const doPrint = () => {
      try {
        win.focus();
        win.print();
      } catch (e) {
        console.error('Print failed', e);
        try {
          const w = window.open('', '_blank');
          if (!w) { alert('Pop-up blocked. Please allow pop-ups to print Purchase Orders.'); return; }
          w.document.write(html);
          w.document.close();
          setTimeout(() => { try { w.focus(); w.print(); } catch (_) {} }, 300);
        } catch (e2) { console.error(e2); }
      }
    };
    setTimeout(doPrint, sigSrc ? 450 : 180);
  } catch (e) {
    console.error('printPO failed', e);
    alert('Failed to generate PO print. Check browser console.');
  }
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
