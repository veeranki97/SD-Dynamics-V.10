import { useState } from 'react';
import { Download, FileText, BookOpen } from 'lucide-react';
import { getAllBills, getAllPurchases } from '../store';
import { toast } from './Toast';
import { formatCurrency } from '../utils';
import { isRevenueDocument, revenueSignedAmount } from '../utils/revenueFilter';

function downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function DataExportView() {
  const [busy, setBusy] = useState('');

  const run = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast(e.message || 'Export failed', 'error');
    } finally {
      setBusy('');
    }
  };

  const exportSalesCsv = async () => {
    const bills = await getAllBills();
    const rows = [['Invoice Number', 'Date', 'Type', 'Client', 'Status', 'Total', 'Paid', 'Tax']];
    for (const b of bills || []) {
      rows.push([
        b.invoiceNumber || b.id,
        b.data?.details?.invoiceDate || b.invoiceDate || '',
        b.invoiceType || '',
        b.clientName || b.data?.client?.name || '',
        b.status || '',
        b.totalAmount ?? '',
        b.paidAmount ?? '',
        b.totalTaxAmount ?? '',
      ].map(csvEscape));
    }
    downloadText('sales-export.csv', rows.map(r => r.join(',')).join('\n'));
    toast('Sales CSV downloaded', 'success');
  };

  const exportPurchasesCsv = async () => {
    const list = await getAllPurchases();
    const rows = [['Bill No', 'Date', 'Vendor', 'Status', 'Total', 'GSTIN']];
    for (const p of list || []) {
      rows.push([
        p.billNumber || p.invoiceNumber || p.id,
        p.date || p.billDate || '',
        p.vendorName || p.supplierName || '',
        p.status || '',
        p.totalAmount ?? p.grandTotal ?? '',
        p.vendorGstin || p.gstin || '',
      ].map(csvEscape));
    }
    downloadText('purchases-export.csv', rows.map(r => r.join(',')).join('\n'));
    toast('Purchases CSV downloaded', 'success');
  };

  const openGst = (hint) => {
    try {
      sessionStorage.setItem('sd_gstr_export_hint', hint || '');
      sessionStorage.setItem('gst_currentView', 'filing');
      window.dispatchEvent(new CustomEvent('sd-navigate', { detail: 'filing' }));
      toast(`Open GST Returns → use ${hint || 'export'} (same files as Compliance → GST Returns)`, 'info');
    } catch (_) {
      toast('Open Compliance → GST Returns to download GSTR files', 'info');
    }
  };

  const Card = ({ title, desc, action, k }) => (
    <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
      <h3 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem' }}>{title}</h3>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{desc}</p>
      <button type="button" className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => run(k, action)}>
        <Download size={14} /> {busy === k ? 'Working…' : 'Download / Open'}
      </button>
    </div>
  );

  return (
    <div className="page-content" style={{ padding: '1rem 1.25rem' }}>
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Data export</h1>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          One door for compliance and list exports. GSTR files use the same builders as GST Returns (no separate formula).
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.85rem' }}>
        <Card k="gstr1" title="GSTR-1" desc="JSON / tables — same as GST Returns → GSTR-1 exports." action={() => openGst('GSTR-1 JSON / CSV')} />
        <Card k="gstr3b" title="GSTR-3B" desc="Summary CSV / JSON — same as GST Returns → GSTR-3B." action={() => openGst('GSTR-3B')} />
        <Card k="hsn" title="HSN summary" desc="Table 12 style — open GST Returns → HSN export." action={() => openGst('HSN summary')} />
        <Card k="sales" title="Sales CSV" desc="All invoices list (number, date, type, totals)." action={exportSalesCsv} />
        <Card k="purch" title="Purchases CSV" desc="Purchase bills list for the active data store." action={exportPurchasesCsv} />
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', opacity: 0.85 }}>
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem' }}>Tally XML</h3>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Not available yet.</p>
          <button type="button" className="btn btn-secondary btn-sm" disabled>Not available yet</button>
        </div>
      </div>
    </div>
  );
}
