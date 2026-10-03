import { useState, useEffect } from 'react';
import { getAllBills, getAllExpenses, getProfile } from '../store';
import { formatCurrency, belongsToProfile, getFYOptions } from '../utils';
import { toast } from './Toast';
import { FileText, Download } from 'lucide-react';

/** CA-ready offline Audit Summary (print/PDF). No GSP/API required. */
export default function AuditReportView() {
  const [bills, setBills] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [profile, setProfile] = useState(null);
  const [fy, setFy] = useState('');
  const fyOptions = (() => {
    try {
      const o = getFYOptions() || [];
      return Array.isArray(o) ? o : [];
    } catch { return []; }
  })();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [b, e, p] = await Promise.all([
          getAllBills().catch(() => []),
          getAllExpenses().catch(() => []),
          getProfile().catch(() => null),
        ]);
        if (cancelled) return;
        setProfile(p);
        setBills((b || []).filter((x) => {
          try { return belongsToProfile(x, p); } catch { return true; }
        }));
        setExpenses((e || []).filter((x) => {
          try { return belongsToProfile(x, p); } catch { return true; }
        }));
        const first = fyOptions[0];
        const val = first?.value || first?.label || (typeof first === 'string' ? first : '');
        if (val) setFy(val);
      } catch (err) {
        console.error(err);
        toast('Failed to load audit data', 'error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const inFy = (dateStr) => {
    if (!fy || !dateStr) return true;
    const y1 = parseInt(String(fy).slice(0, 4), 10);
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    return d >= new Date(y1, 3, 1) && d <= new Date(y1 + 1, 2, 31, 23, 59, 59);
  };

  const sales = bills.filter((b) => {
    const t = String(b.invoiceType || 'tax-invoice').toLowerCase();
    if (/quotation|proforma|challan|delivery|estimate/.test(t)) return false;
    if ((b.status || '') === 'cancelled') return false;
    return inFy(b.invoiceDate || b.data?.details?.invoiceDate);
  });

  const taxable = sales.reduce((s, b) => s + (Number(b.taxableAmount) || Number(b.subTotal) || ((Number(b.totalAmount) || 0) - (Number(b.totalTaxAmount) || 0))), 0);
  const tax = sales.reduce((s, b) => s + (Number(b.totalTaxAmount) || 0), 0);
  const gross = sales.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
  const received = sales.reduce((s, b) => s + (Number(b.paidAmount) || 0), 0);
  const outstanding = sales.reduce((s, b) => {
    const due = (Number(b.totalAmount) || 0) - (Number(b.paidAmount) || 0);
    return s + (due > 0 ? due : 0);
  }, 0);
  const expTotal = expenses.filter((e) => inFy(e.date || e.expenseDate)).reduce((s, e) => s + (Number(e.amount) || Number(e.total) || 0), 0);

  const printReport = () => {
    const w = window.open('', '_blank');
    if (!w) { toast('Pop-up blocked', 'warning'); return; }
    const name = profile?.businessName || 'Business';
    const gstin = profile?.gstin || '—';
    const rows = sales.slice().sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0)).slice(0, 50)
      .map((b) => `<tr><td>${b.invoiceNumber || ''}</td><td>${b.invoiceDate || ''}</td><td>${String(b.clientName || '').replace(/</g, '')}</td><td>${b.status || ''}</td><td class="r">${(Number(b.totalAmount) || 0).toFixed(2)}</td><td class="r">${(Number(b.paidAmount) || 0).toFixed(2)}</td></tr>`).join('');
    w.document.write(`<!DOCTYPE html><html><head><title>Audit Summary ${fy}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;font-size:13px}h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:20px 0 8px;border-bottom:1px solid #cbd5e1;padding-bottom:4px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #334155;padding:6px 8px}th{background:#f1f5f9}.r{text-align:right}.muted{color:#64748b;font-size:11px}@page{margin:12mm}</style></head><body>
<h1>Audit / Management Summary</h1>
<p class="muted">${name} · GSTIN ${gstin} · FY ${fy || 'All'} · ${new Date().toLocaleString('en-IN')}</p>
<h2>Turnover &amp; tax</h2>
<table><tr><th>Metric</th><th class="r">Amount</th></tr>
<tr><td>Taxable value</td><td class="r">${taxable.toFixed(2)}</td></tr>
<tr><td>Output GST</td><td class="r">${tax.toFixed(2)}</td></tr>
<tr><td>Gross invoiced</td><td class="r">${gross.toFixed(2)}</td></tr>
<tr><td>Total received</td><td class="r">${received.toFixed(2)}</td></tr>
<tr><td>Outstanding</td><td class="r">${outstanding.toFixed(2)}</td></tr>
<tr><td>Expenses</td><td class="r">${expTotal.toFixed(2)}</td></tr>
<tr><td>Invoice count</td><td class="r">${sales.length}</td></tr></table>
<h2>Top invoices</h2>
<table><thead><tr><th>No.</th><th>Date</th><th>Client</th><th>Status</th><th class="r">Total</th><th class="r">Paid</th></tr></thead><tbody>${rows}</tbody></table>
<p class="muted" style="margin-top:24px">Management summary from local books — not a statutory audit opinion. Verify vs GSTR and bank statements.</p>
<script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="glass-panel p-4">
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={18} /> Audit Report</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Offline CA-style summary for lenders / ITR discussion.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="form-input" style={{ width: 160 }} value={fy} onChange={(e) => setFy(e.target.value)}>
            {fyOptions.length === 0 && <option value="">All periods</option>}
            {fyOptions.map((o, i) => {
              const val = o?.value || o?.label || String(o);
              const lab = o?.label || o?.value || String(o);
              return <option key={val + i} value={val}>{lab}</option>;
            })}
          </select>
          <button type="button" className="btn btn-primary" onClick={printReport}><Download size={16} /> Print / PDF</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
        {[['Taxable', taxable], ['Output GST', tax], ['Gross', gross], ['Received', received], ['Outstanding', outstanding], ['Expenses', expTotal]].map(([label, val]) => (
          <div key={label} style={{ padding: 12, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{formatCurrency(val, 'INR')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
