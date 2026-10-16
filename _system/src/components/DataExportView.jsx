import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, ExternalLink } from 'lucide-react';
import { getAllBills, getAllPurchases } from '../store';
import { toast } from './Toast';

function downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try { a.remove(); } catch (_) {}
    URL.revokeObjectURL(url);
  }, 1500);
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function Card({ title, desc, onClick, busy, icon: Icon }) {
  return (
    <div className="glass-panel" style={{ padding: '1.1rem 1.15rem', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {Icon ? <Icon size={18} style={{ color: 'var(--primary, #4f46e5)' }} /> : null}
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{title}</h3>
      </div>
      <p style={{ margin: 0, flex: 1, fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', lineHeight: 1.45 }}>{desc}</p>
      <button type="button" className="btn btn-primary btn-sm" disabled={!!busy} onClick={onClick} style={{ alignSelf: 'flex-start' }}>
        <Download size={14} /> {busy ? 'Working…' : 'Download / Open'}
      </button>
    </div>
  );
}

export default function DataExportView() {
  const [busy, setBusy] = useState('');

  const run = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      toast(e?.message || 'Export failed', 'error');
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
    toast(`Sales CSV: ${Math.max(0, rows.length - 1)} rows`, 'success');
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
    toast(`Purchases CSV: ${Math.max(0, rows.length - 1)} rows`, 'success');
  };

  const openGst = (hint) => {
    try {
      sessionStorage.setItem('sd_gstr_export_hint', hint || '');
      sessionStorage.setItem('gst_currentView', 'filing');
      window.dispatchEvent(new CustomEvent('sd-navigate', { detail: 'filing' }));
    } catch (_) {}
    toast(`GST Returns opened — use ${hint || 'export'} there (same engine)`, 'info');
  };

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem' }}>Data export</h2>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
          One place for common downloads. GSTR-1 / GSTR-3B / HSN use the same GST Returns engine (no duplicate formulas).
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.9rem' }}>
        <Card
          title="GSTR-1"
          desc="B2B / B2C / HSN for the selected period. Opens GST Returns."
          icon={FileText}
          busy={busy === 'g1'}
          onClick={() => run('g1', () => openGst('GSTR-1'))}
        />
        <Card
          title="GSTR-3B"
          desc="Summary return JSON / tables. Opens GST Returns."
          icon={FileText}
          busy={busy === 'g3'}
          onClick={() => run('g3', () => openGst('GSTR-3B'))}
        />
        <Card
          title="HSN summary"
          desc="HSN/SAC taxable and tax totals. Opens GST Returns."
          icon={FileSpreadsheet}
          busy={busy === 'hsn'}
          onClick={() => run('hsn', () => openGst('HSN'))}
        />
        <Card
          title="Sales CSV"
          desc="All invoices (number, date, type, client, totals) for Excel."
          icon={Download}
          busy={busy === 'sales'}
          onClick={() => run('sales', exportSalesCsv)}
        />
        <Card
          title="Purchases CSV"
          desc="Purchase bills list for Excel."
          icon={Download}
          busy={busy === 'purch'}
          onClick={() => run('purch', exportPurchasesCsv)}
        />
        <div className="glass-panel" style={{ padding: '1.1rem', minHeight: 140, opacity: 0.9 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>Tally XML</h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Not available yet.</p>
        </div>
      </div>
      <p style={{ margin: '1rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <ExternalLink size={12} style={{ verticalAlign: 'middle' }} /> Tip: For full GSTR JSON with period filters, always finish export inside <strong>Compliance → GST Returns</strong>.
      </p>
    </div>
  );
}
