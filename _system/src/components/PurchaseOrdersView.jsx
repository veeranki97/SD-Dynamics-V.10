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
  getAllWorkOrders,
  getAllPurchases,
} from '../store';
import { emptyWOItem, calcItemAmount, resolveWoCostCenter, resolveWoSite } from '../utils/workOrder';
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

const DEFAULT_PO_TERMS = '1. Please quote PO number on all invoices and delivery challans.\n2. Goods/services subject to inspection and approval.\n3. Payment as per agreed terms.';

function printPO(po, profile, fingerprint, clientsList) {
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

  // --- Vendor (supplier): enrich from master list if PO fields thin ---
  let vendorNameRaw = po.vendorName || po.vendor || '';
  let vendorGstRaw = po.vendorGstin || po.vendorGSTIN || '';
  let vendorAddrRaw = po.vendorAddress || po.vendorAddr || '';
  let vendorPhoneRaw = po.vendorPhone || '';
  try {
    const list = Array.isArray(clientsList) ? clientsList : [];
    const vKey = String(po.vendorId || vendorNameRaw || '').toLowerCase().trim();
    const vMatch = list.find(c =>
      String(c.id || '').toLowerCase() === vKey
      || String(c.name || c.businessName || '').toLowerCase() === vKey
    );
    if (vMatch) {
      if (!vendorNameRaw) vendorNameRaw = vMatch.name || vMatch.businessName || '';
      if (!vendorGstRaw) vendorGstRaw = vMatch.gstin || vMatch.GSTIN || '';
      if (!vendorPhoneRaw) vendorPhoneRaw = vMatch.phone || vMatch.mobile || '';
      if (!vendorAddrRaw) {
        vendorAddrRaw = [vMatch.address || vMatch.billingAddress || '', vMatch.city || '', vMatch.state || '', vMatch.pincode || vMatch.pin || '']
          .filter(Boolean).join(', ');
      }
    }
  } catch (_) { /* */ }
  const vendorName = esc(vendorNameRaw);
  const vendorGst = esc(vendorGstRaw);
  const vendorAddr = esc(vendorAddrRaw);
  const vendorPhone = esc(vendorPhoneRaw);

  // --- Ship To: client site delivery (NOT seller address). No separate Bill-To on PO —
  // the company header is the buyer. Match professional Indian PO layout (Supplier | Ship To).
  let shipNameRaw = po.shipToName || po.clientName || po.billToName || '';
  const shipSiteRaw = po.shipToSite || po.site || po.deliverySite || '';
  let shipStreetRaw = '';
  let shipCityLineRaw = '';
  try {
    const list = Array.isArray(clientsList) ? clientsList : [];
    const idKey = String(po.clientId || '').toLowerCase().trim();
    const nameKey = String(po.clientName || shipNameRaw || '').toLowerCase().trim();
    let match = null;
    if (idKey) match = list.find(c => String(c.id || '').toLowerCase() === idKey);
    if (!match && nameKey) {
      match = list.find(c => String(c.name || c.businessName || '').toLowerCase() === nameKey);
    }
    if (match) {
      if (!shipNameRaw) shipNameRaw = match.name || match.businessName || '';
      shipStreetRaw = String(match.address || match.billingAddress || '').trim();
      shipCityLineRaw = [match.city || '', match.state || '', match.pincode || match.pin || '']
        .filter(Boolean).join(', ');
    }
  } catch (_) { /* */ }
  if (!shipStreetRaw) {
    const fromPo = String(po.shipToAddress || po.deliveryAddress || po.clientAddress || po.address || '').trim();
    if (fromPo && fromPo.toLowerCase() !== String(shipSiteRaw || '').toLowerCase()) {
      shipStreetRaw = fromPo;
    }
  }
  if (!shipCityLineRaw) {
    shipCityLineRaw = [po.city || '', po.shipToState || po.deliveryState || po.state || po.clientState || '', po.pincode || po.pin || '']
      .filter(Boolean).join(', ');
  }
  const shipName = esc(shipNameRaw);
  const shipSite = esc(shipSiteRaw || '');
  const shipStreet = esc(shipStreetRaw);
  const shipCityLine = esc(shipCityLineRaw);

  const subjectRaw = po.subject || po.title || (po.items && po.items[0] && po.items[0].description) || '';
  const subject = esc(subjectRaw);
  let termsRaw = (po.terms && String(po.terms).trim() && String(po.terms).trim() !== String(subjectRaw).trim())
    ? po.terms
    : (profile?.defaultTerms || DEFAULT_PO_TERMS);
  const terms = esc(termsRaw).replace(/\n/g, '<br/>');
  const notes = esc(po.deliveryNotes || po.instructions || '');
  const poTitle = String(po.poNumber || 'PO').replace(/[\\/:*?"<>|]/g, '-');

  const rows = (po.items || []).map((it, i) => {
    const amt = calcItemAmount ? calcItemAmount(it) : (Number(it.qty || it.quantity || 0) * Number(it.rate || 0));
    return `<tr>
      <td class="c">${i + 1}</td>
      <td>${esc(it.description || it.name || '')}</td>
      <td class="c">${esc(it.hsn || it.sac || '')}</td>
      <td class="c">${esc(it.unit || '')}</td>
      <td class="c">${esc(it.qty ?? it.quantity ?? '')}</td>
      <td class="r">${inr(it.rate)}</td>
      <td class="r">${inr(amt)}</td>
    </tr>`;
  }).join('');

  const rate = Number(po.taxRate) || 0;
  let taxLines = '';
  if (t.igst > 0) taxLines += `<tr><td class="lab">IGST (${rate}%)</td><td class="r">₹${inr(t.igst)}</td></tr>`;
  else if (t.cgst > 0 || t.sgst > 0) {
    taxLines += `<tr><td class="lab">CGST (${rate / 2}%)</td><td class="r">₹${inr(t.cgst)}</td></tr>`;
    taxLines += `<tr><td class="lab">SGST (${rate / 2}%)</td><td class="r">₹${inr(t.sgst)}</td></tr>`;
  } else {
    taxLines = `<tr><td class="lab">GST (${rate}%)</td><td class="r">₹${inr(t.gst || 0)}</td></tr>`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${poTitle}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #0f172a;
    font-size: 10px;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* Single outer frame — continuous borders like SD invoice / professional PO */
  .sheet {
    border: 1.5pt solid #000;
    width: 100%;
    max-width: 100%;
    display: block;
    overflow: hidden;
  }
  /* Word-style: content height only — no giant gap before signature */
  .party .sec { padding: 8px 10px; min-height: 78px; }
  .subject { padding: 7px 10px; }
  .sign-block { padding: 14px 12px 10px; }
  .hdr {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    padding: 8px 10px;
    border-bottom: 1.5px solid #0f172a;
    align-items: start;
  }
  .hdr h1 { margin: 0 0 2px; font-size: 16px; font-weight: 800; letter-spacing: 0.03em; }
  .hdr .muted { font-size: 8.5px; color: #334155; line-height: 1.4; }
  .hdr .meta { text-align: right; font-size: 9px; }
  .hdr .doc {
    display: inline-block;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.06em;
    border: 1.5px solid #0f172a;
    padding: 4px 10px;
    margin-bottom: 4px;
  }
  .party {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1.5px solid #0f172a;
  }
  .party .sec { padding: 8px 10px; min-height: 78px; }
  .party .sec + .sec { border-left: 1.5px solid #0f172a; }
  .party .lbl {
    font-size: 8pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.04em; color: #333; margin-bottom: 4px;
    border-bottom: 0.75pt solid #999; padding-bottom: 2px;
  }
  .party .name { font-size: 11px; font-weight: 700; margin-bottom: 2px; }
  .party .det { font-size: 9px; color: #1e293b; line-height: 1.4; }
  .subject {
    padding: 7px 10px;
    border-bottom: 1.5pt solid #000;
    font-size: 9.5pt;
    background: #f3f4f6;
  }
  table.items {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  table.items th, table.items td {
    border: 1px solid #0f172a;
    padding: 4px 5px;
    vertical-align: top;
    font-size: 9px;
  }
  table.items th {
    background: #f1f5f9;
    font-size: 8px;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  table.items th:first-child, table.items td:first-child { border-left: none; }
  table.items th:last-child, table.items td:last-child { border-right: none; }
  table.items thead tr:first-child th { border-top: none; }
  td.c { text-align: center; }
  td.r { text-align: right; white-space: nowrap; }
  .foot {
    display: grid;
    grid-template-columns: 1.25fr 0.75fr;
    border-top: 1.5px solid #0f172a;
  }
  .foot .notes {
    padding: 8px 10px;
    border-right: 1.5pt solid #000;
    font-size: 8.5pt;
    line-height: 1.45;
  }
  .foot .notes b { display: block; margin: 0 0 2px; font-size: 9px; }
  .foot .totals { padding: 0; }
  .foot .totals table { width: 100%; border-collapse: collapse; }
  .foot .totals td {
    padding: 3px 8px;
    font-size: 9.5px;
    border-bottom: 1px solid #e2e8f0;
  }
  .foot .totals td.lab { color: #475569; }
  .foot .totals td.r { text-align: right; font-weight: 600; }
  .foot .totals tr.grand td {
    border-bottom: none;
    border-top: 1.5px solid #0f172a;
    font-size: 11px;
    font-weight: 800;
    padding: 5px 8px;
    background: #f8fafc;
  }
  .sign-block {
    display: flex;
    justify-content: flex-end;
    padding: 12px 12px 10px;
    border-top: 0.75pt solid #999;
  }
  .sign { text-align: right; font-size: 9px; }
  .sign img { max-height: 42px; max-width: 130px; object-fit: contain; display: block; margin: 0 0 2px auto; }
  .sign .line {
    margin-top: 4px;
    border-top: 1.2px solid #0f172a;
    display: inline-block;
    min-width: 140px;
    padding-top: 2px;
    font-weight: 600;
  }
  .fp {
    font-size: 6.5px;
    color: #94a3b8;
    text-align: center;
    padding: 3px 8px 5px;
    border-top: 1px dashed #cbd5e1;
  }
</style></head><body>
  <div class="sheet">
    <div class="hdr">
      <div>
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
    <div class="party">
      <div class="sec">
        <div class="lbl">Supplier Details (To)</div>
        <div class="name">${vendorName || '—'}</div>
        <div class="det">${vendorGst ? 'GSTIN: ' + vendorGst + '<br/>' : ''}${vendorPhone ? 'Phone: ' + vendorPhone + '<br/>' : ''}${vendorAddr || ''}</div>
      </div>
      <div class="sec">
        <div class="lbl">Delivery Details (Ship To)</div>
        ${shipName ? `<div class="name">${shipName}</div>` : ''}
        ${shipSite ? `<div class="det"><b>Site: ${shipSite}</b></div>` : ''}
        ${shipStreet ? `<div class="det">${shipStreet}</div>` : ''}
        ${shipCityLine ? `<div class="det">${shipCityLine}</div>` : ''}
        ${!shipName && !shipSite && !shipStreet && !shipCityLine ? '<div class="det">—</div>' : ''}
      </div>
    </div>
    <div class="subject"><b>Subject:</b> ${subject || '—'}</div>
    <table class="items">
      <thead>
        <tr>
          <th style="width:5%">Sl</th>
          <th>Description / Material</th>
          <th style="width:11%">HSN/SAC</th>
          <th style="width:8%">Unit</th>
          <th style="width:8%">Qty</th>
          <th style="width:13%">Unit Rate</th>
          <th style="width:14%">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="7" class="c">No items</td></tr>'}
      </tbody>
    </table>
    <div class="foot">
      <div class="notes">
        ${notes ? `<b>Notes / Instructions</b>${notes.replace(/\n/g, '<br/>')}<br/><br/>` : ''}
        <b>Terms &amp; Conditions</b>
        ${terms}
      </div>
      <div class="totals">
        <table>
          <tr><td class="lab">Subtotal</td><td class="r">₹${inr(t.sub)}</td></tr>
          ${taxLines}
          <tr><td class="lab">Round Off</td><td class="r">₹0.00</td></tr>
          <tr class="grand"><td>Grand Total</td><td class="r">₹${inr(t.total)}</td></tr>
        </table>
      </div>
    <div class="sign-block">
      <div class="sign">
        ${sigSrc ? `<img src="${sigSrc}" alt="Signature"/>` : '<div style="height:36px"></div>'}
        <div>For <b>${company}</b></div>
        <div class="line">Authorized Signatory</div>
      </div>
    </div>
    <div class="fp">SHA-256: ${esc(fingerprint) || '—'} · Generated by SD Dynamics · ${new Date().toLocaleString('en-IN')}</div>
  </div>
</body></html>`;

  try {
    let iframe = document.getElementById('sd-po-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'sd-po-print-frame';
      document.body.appendChild(iframe);
    }
    iframe.style.cssText = 'position:fixed;left:0;top:0;width:210mm;height:297mm;opacity:0;z-index:-1;pointer-events:none;border:0';
    iframe.setAttribute('title', poTitle);
    const prevTitle = document.title;
    try { document.title = poTitle; } catch (_) {}

    let printed = false;
    const restoreTitle = () => { try { document.title = prevTitle; } catch (_) {} };
    const runPrint = () => {
      if (printed) return;
      printed = true;
      const win = iframe.contentWindow;
      if (!win) {
        restoreTitle();
        alert('Print failed — iframe not ready. Try again.');
        return;
      }
      try {
        const idoc = iframe.contentDocument || win.document;
        if (idoc) idoc.title = poTitle;
      } catch (_) {}
      try { win.onafterprint = () => { restoreTitle(); }; } catch (_) {}
      try {
        win.focus();
        win.print();
        try { toast('In the print dialog: turn Headers and footers OFF for clean edges', 'info'); } catch (_) {}
      } catch (e) {
        console.error('printPO print()', e);
        restoreTitle();
        alert('Failed to print PO. Check browser console.');
        return;
      }
      setTimeout(restoreTitle, 60000);
    };

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument || (win && win.document);
    if (!doc) throw new Error('iframe document unavailable');
    doc.open();
    doc.write(html);
    doc.close();
    try { doc.title = poTitle; } catch (_) {}

    const imgs = Array.from(doc.images || []);
    const delay = sigSrc || imgs.length ? 500 : 150;
    if (imgs.length) {
      let left = imgs.length;
      const done = () => { left -= 1; if (left <= 0) setTimeout(runPrint, 80); };
      imgs.forEach(img => {
        if (img.complete) done();
        else { img.onload = done; img.onerror = done; }
      });
      setTimeout(runPrint, delay + 800);
    } else {
      setTimeout(runPrint, delay);
    }
  } catch (e) {
    console.error('printPO failed', e);
    alert('Failed to generate PO print. Check browser console.');
  }
}



export default function PurchaseOrdersView() {
  const [list, setList] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [purchases, setPurchases] = useState([]); // for billing-status badge
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
      const [pos, clients, prof, wos, purs] = await Promise.all([
        getAllPurchaseOrders(),
        getAllClients(), // filtered to vendors below
        getProfile().catch(() => null),
        getAllWorkOrders().catch(() => []),
        getAllPurchases().catch(() => []),
      ]);
      setList(Array.isArray(pos) ? pos : (pos?.items || []));
      setVendors((clients || []).filter(c => c.isVendor || c.type === 'vendor'));
      setProfile(prof);
      setWorkOrders(wos || []);
      setPurchases(purs || []);
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

  // Prefill from Work Order "Create PO" action
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('sd_po_from_wo');
      if (!raw) return;
      const p = JSON.parse(raw);
      sessionStorage.removeItem('sd_po_from_wo');
      const mappedItems = (Array.isArray(p.items) && p.items.length)
        ? p.items.map((it, i) => {
            const row = {
              ...emptyWOItem(),
              id: it.id || ('poi_' + Date.now() + '_' + i),
              description: it.description || it.name || '',
              hsn: it.hsn || it.sac || '',
              qty: it.qty ?? it.quantity ?? 1,
              unit: it.unit || 'Nos',
              rate: Number(it.rate) || 0,
              costCenterId: it.costCenterId || p.costCenterId || '',
            };
            row.amount = calcItemAmount(row);
            return row;
          })
        : [emptyWOItem()];
      const headerCc = p.costCenterId || (mappedItems.find(it => it.costCenterId)?.costCenterId) || '';
      const mappedWithCc = mappedItems.map(it => ({
        ...it,
        costCenterId: it.costCenterId || headerCc || '',
      }));
      setForm({
        id: 'po_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        poNumber: '',
        vendorName: '',
        vendorGstin: '',
        vendorState: '',
        workOrderId: p.workOrderId || '',
        workOrderNumber: p.workOrderNumber || '',
        isSubcontract: p.isSubcontract !== false,
        clientName: p.clientName || '',
        clientId: p.clientId || '',
        site: p.site || 'Main Site',
        shipToName: p.shipToName || p.clientName || '',
        shipToSite: p.shipToSite || p.site || 'Main Site',
        shipToAddress: p.shipToAddress || '',
        shipToState: p.shipToState || '',
        costCenterId: headerCc || '',
        date: new Date().toISOString().split('T')[0],
        status: 'draft',
        taxRate: p.taxRate != null ? Number(p.taxRate) : 18,
        notes: p.notes || (p.clientName ? `Subcontract for client: ${p.clientName}` : '') || '',
        subject: p.subject || p.title || '',
        terms: p.terms || DEFAULT_PO_TERMS,
        items: mappedWithCc,
        createdAt: new Date().toISOString(),
      });
    } catch { /* */ }
  }, []);


  const openNew = () =>
    setForm({
      id: 'po_' + Date.now().toString(36),
      poNumber: '',
      vendorName: '',
      vendorGstin: '',
      vendorState: '',
      workOrderId: '',
      isSubcontract: false,
      site: 'Main Site',
      date: new Date().toISOString().split('T')[0],
      status: 'draft',
      taxRate: 18,
      notes: '',
      terms: DEFAULT_PO_TERMS,
      subject: '',
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
      id: form.id || ('po_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      items,
      ...totals,
      fingerprint: await sha256Hex(JSON.stringify({
        po: form.poNumber, vendor: form.vendorName, items, totals, date: form.date,
      })),
      updatedAt: new Date().toISOString(),
    };
    try {
    if (form.isSubcontract && !(form.workOrderId || form.workOrderNumber)) {
      toast('Subcontract PO requires a linked Work Order', 'error');
      return;
    }
    if (false && form.isSubcontract && !(form.workOrderId || form.workOrderNumber)) {
      toast('Subcontract PO must link a client Work Order / Project', 'error');
      return;
    }

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
        <div className="glass-panel" style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
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
            <label className="form-label">Work Order</label>
            <select className="form-input" value={form.workOrderId || ''}
              onChange={e => {
                const wid = e.target.value;
                const wo = (workOrders || []).find(w => w.id === wid || w.woNumber === wid);
                setForm(prev => {
                  if (!wo) return { ...prev, workOrderId: wid, workOrderNumber: '' };
                  const woCc = resolveWoCostCenter(wo) || wo.costCenterId || '';
                  const itemsFromWo = (Array.isArray(wo.items) && wo.items.length)
                    ? wo.items.map((it, i) => ({
                        id: 'poi_' + Date.now() + '_' + i,
                        description: it.description || it.name || '',
                        hsn: it.hsn || it.sac || '',
                        qty: it.qty ?? it.quantity ?? 1,
                        unit: it.unit || 'Nos',
                        rate: Number(it.rate) || 0,
                        costCenterId: it.costCenterId || it.costCentreId || it.costHead || woCc || '',
                      }))
                    : prev.items;
                  return {
                    ...prev,
                    workOrderId: wid,
                    workOrderNumber: wo.woNumber || '',
                    costCenterId: resolveWoCostCenter(wo) || wo.costCenterId || wo.costCenter || prev.costCenterId,
                    site: wo.site || prev.site,
                    shipToSite: wo.site || prev.shipToSite || prev.site,
                    gstPercent: wo.gstPercent != null ? wo.gstPercent : prev.gstPercent,
                    isSubcontract: true,
                    notes: prev.notes || wo.title || wo.notes || '',
                    items: itemsFromWo,
                  };
                });
              }}>
              <option value="">— Link Work Order —</option>
              {workOrders.map(wo => (
                <option key={wo.id} value={wo.id}>{wo.woNumber} — {wo.site || wo.clientName || ''}</option>
              ))}
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
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={!!form.isSubcontract}
                onChange={e => setForm({ ...form, isSubcontract: e.target.checked })} />
              Subcontract PO
            </label>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 12, marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Line items</h3>
            <button type="button" className="btn btn-sm btn-secondary"
              onClick={() => setForm({ ...form, items: [...(form.items || []), emptyWOItem()] })}>
              <Plus size={14} /> Add row
            </button>
          </div>
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '32%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '6%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>HSN</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(form.items || []).map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td><input className="form-input" style={{ width: '100%', boxSizing: 'border-box' }} value={it.description || ''}
                      onChange={e => updateItem(idx, 'description', e.target.value)} /></td>
                    <td>
                      <input className="form-input" style={{ width: '100%', boxSizing: 'border-box' }} list={`po-hsn-${idx}`}
                        value={it.hsn || ''} placeholder="Type 3+ chars"
                        onChange={e => updateItem(idx, 'hsn', e.target.value)} />
                      <datalist id={`po-hsn-${idx}`}>
                        {hsnMaster.map(h => <option key={h} value={h} />)}
                      </datalist>
                    </td>
                    <td><input type="number" className="form-input" style={{ width: '100%', boxSizing: 'border-box' }} value={it.qty}
                      onChange={e => updateItem(idx, 'qty', e.target.value)} /></td>
                    <td>
                      <input className="form-input" style={{ width: 80 }} list={`po-unit-${idx}`}
                        value={it.unit || ''} onChange={e => updateItem(idx, 'unit', e.target.value)} />
                      <datalist id={`po-unit-${idx}`}>
                        {unitMaster.map(u => <option key={u} value={u} />)}
                      </datalist>
                    </td>
                    <td><input type="number" className="form-input" style={{ width: '100%', boxSizing: 'border-box' }} value={it.rate}
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
            <label className="form-label">Subject / Title of work</label>
            <input className="form-input" value={form.subject || form.title || ''}
              onChange={e => setForm({ ...form, subject: e.target.value, title: e.target.value })}
              placeholder="Shown on PO print as Subject" />
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} value={form.notes || ''}
              onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Terms &amp; Conditions</label>
            <textarea className="form-input" rows={4} value={form.terms != null ? form.terms : DEFAULT_PO_TERMS}
              onChange={e => setForm({ ...form, terms: e.target.value })}
              placeholder="Printed on the PO under Terms & Conditions" />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Saved with this PO. Leave blank only if you want profile default terms on print.
            </div>
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
            <th>PO #</th><th>Date</th><th>Vendor</th><th>Site</th><th>PO Status</th><th>Billing Status</th>
            <th className="text-end">Taxable</th><th className="text-end">GST</th><th className="text-end">Total</th><th></th>
          </tr>
        </thead>
        <tbody>
          {list.map(po => {
            // Compute billing status using the same calcWOUsage-style pattern
            const poNum = (po.poNumber || '').trim().toLowerCase();
            const matchingPurchases = (purchases || []).filter(p => {
              const lp = (p.linkedPO || '').trim().toLowerCase();
              return poNum && lp && lp === poNum;
            });
            const billedSum = matchingPurchases.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0);
            const poTotal = Number(po.total) || 0;
            let billingStatus = 'Open';
            let badgeStyle = { background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', border: '1px solid rgba(59, 130, 246, 0.25)' };
            if (billedSum >= poTotal && poTotal > 0) {
              billingStatus = 'Fully Billed';
              badgeStyle = { background: 'rgba(16, 185, 129, 0.1)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.25)' };
            } else if (billedSum > 0) {
              billingStatus = 'Partially Billed';
              badgeStyle = { background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.25)' };
            }

            const handleCreateBill = () => {
              // Map PO items to Purchase Bill items schema: { name, hsn, quantity, rate, taxPercent, cessPercent }
              const billItems = (po.items || []).map(it => ({
                name: it.description || it.name || '',
                hsn: it.hsn || '',
                quantity: Number(it.qty ?? it.quantity) || 1,
                rate: Number(it.rate) || 0,
                taxPercent: Number(po.taxRate) || 18,
                cessPercent: 0,
              }));
              sessionStorage.setItem('sd_purchase_from_po', JSON.stringify({
                fromPO: po.poNumber,
                supplierName: po.vendorName,
                supplierGstin: po.vendorGstin,
                items: billItems,
                workOrderId: po.workOrderId,
                costCenterId: po.costCenterId,
                site: po.site,
              }));
              sessionStorage.setItem('gst_currentView', 'purchases');
              window.dispatchEvent(new CustomEvent('sd-navigate', { detail: 'purchases' }));
            };

            return (
              <tr key={po.id}>
                <td>
                  <span style={{ fontWeight: 600 }}>{po.poNumber}</span>
                  {po.isSubcontract && (
                    <span style={{ marginLeft: 6, fontSize: '0.68rem', padding: '1px 5px', borderRadius: 4, background: 'rgba(139, 92, 246, 0.15)', color: '#7c3aed', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                      Subcontract
                    </span>
                  )}
                </td>
                <td>{po.date}</td>
                <td>{po.vendorName}</td>
                <td>{po.site}</td>
                <td><span className="badge">{po.status}</span></td>
                <td>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, ...badgeStyle }}>
                    {billingStatus}
                  </span>
                </td>
                <td className="text-end">{formatCurrency(po.sub || 0)}</td>
                <td className="text-end">{formatCurrency(po.gst || 0)}</td>
                <td className="text-end">{formatCurrency(po.total || 0)}</td>
                <td>
                  <ActionMenu items={[
                    { label: 'Create Bill', onClick: handleCreateBill },
                    { label: 'Edit', onClick: () => setForm({ ...po, terms: po.terms || DEFAULT_PO_TERMS, subject: po.subject || po.title || '' }) },
                    { label: 'Copy', onClick: () => setForm({ ...po, id: undefined, poNumber: '' }) },
                    { label: 'Print / PDF', onClick: () => { try { printPO(po, profile || {}, po.fingerprint, clients); } catch (err) { console.error(err); try { toast('Print failed', 'error'); } catch (_) {} } } },
                    { label: 'Export CSV', onClick: () => downloadRowsCsv(`PO-${po.poNumber || po.id}.csv`, [po], [
                      { key: 'poNumber', label: 'PO No' }, { key: 'date', label: 'Date' },
                      { key: 'vendorName', label: 'Vendor' }, { key: 'site', label: 'Site' },
                      { key: 'status', label: 'Status' }, { key: 'total', label: 'Total' },
                    ]) },
                    { label: 'Delete', danger: true, onClick: () => remove(po.id) },
                  ]} />
                </td>
              </tr>
            );
          })}
          {list.length === 0 && (
            <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8' }}>No purchase orders yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
