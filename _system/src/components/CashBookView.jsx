import { useState, useEffect, useMemo } from 'react';
import { Banknote } from 'lucide-react';
import { getAllReceipts, getAllBills, getAllExpenses, getProfile, getAllJournals } from '../store';
import { formatCurrency, belongsToProfile } from '../utils';
import { toast } from './Toast';

/**
 * Chronological cash book with opening balance + running balance.
 * Opening balance stored in localStorage key freegstbill_cashbook_ob
 */
function exportCashCsv(rows) {
  const cols = ['date', 'type', 'name', 'ref', 'inflow', 'outflow', 'balance'];
  const lines = [cols.join(',')].concat((rows || []).map(r =>
    cols.map(c => {
      const s = r[c] == null ? '' : String(r[c]);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  ));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  a.download = 'cash-book.csv';
  a.click();
}


function exportCashPdf({ title, subtitle, company, rows, mode, dayDate, closing }) {
  const w = window.open('', '_blank');
  if (!w) return;
  const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const inr = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let body = '';
  if (mode === 'day') {
    body = (rows || []).map(r => `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${esc(r.type)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${esc(r.ref)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${esc(r.name)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${r.inflow ? '₹'+inr(r.inflow) : '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${r.outflow ? '₹'+inr(r.outflow) : '—'}</td>
    </tr>`).join('');
    const tin = (rows||[]).reduce((s,r)=>s+(Number(r.inflow)||0),0);
    const tout = (rows||[]).reduce((s,r)=>s+(Number(r.outflow)||0),0);
    body += `<tr style="font-weight:700;background:#f8fafc">
      <td colspan="3" style="padding:8px;text-align:right">Total Voucher Value For The Day:</td>
      <td style="padding:8px;text-align:right">₹${inr(tin)}</td>
      <td style="padding:8px;text-align:right">₹${inr(tout)}</td>
    </tr>`;
  } else {
    body = (rows || []).map(r => `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap">${esc(r.date)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${esc(r.name)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${esc(r.type)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${r.inflow ? '₹'+inr(r.inflow) : '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${r.outflow ? '₹'+inr(r.outflow) : '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">₹${inr(r.balance)}</td>
    </tr>`).join('');
  }
  const headCols = mode === 'day'
    ? '<th>Voucher Type</th><th>Voucher No.</th><th>Particulars</th><th style="text-align:right">Inward (₹)</th><th style="text-align:right">Outward (₹)</th>'
    : '<th>Date</th><th>Party / Particulars</th><th>Type</th><th style="text-align:right">Money In (Dr)</th><th style="text-align:right">Money Out (Cr)</th><th style="text-align:right">Running Bal</th>';
  const period = mode === 'day' ? `Report Period: ${esc(dayDate)}` : 'Account: Main Cashbook';
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(title)}</title>
<style>
@page{size:A4;margin:12mm}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#0f172a;margin:0}
.hdr{text-align:center;border-bottom:2.5px solid #1e3a5f;padding-bottom:10px;margin-bottom:12px}
.hdr h1{margin:0;font-size:20px;letter-spacing:0.1em;color:#1e3a5f}
.hdr .doc{margin-top:6px;font-size:13px;font-weight:700;letter-spacing:0.08em;color:#334155}
.meta{display:flex;justify-content:space-between;margin-bottom:12px;font-size:11px;color:#475569}
.close{text-align:right}.close .lbl{font-size:9px;text-transform:uppercase;color:#64748b}
.close .amt{font-size:16px;font-weight:700;color:#0f172a}
table{width:100%;border-collapse:collapse}
thead th{background:#f1f5f9;padding:8px;border-bottom:2px solid #94a3b8;font-size:9px;text-transform:uppercase;color:#475569;text-align:left}
.foot{margin-top:16px;font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:8px}
</style></head><body>
<div class="hdr"><h1>${esc(company).toUpperCase()}</h1><div class="doc">${esc(subtitle)}</div></div>
<div class="meta"><div>${period}<br/>Generated on: ${new Date().toLocaleString('en-IN')}</div>
${mode !== 'day' ? `<div class="close"><div class="lbl">Closing Balance</div><div class="amt">₹${inr(closing)}</div></div>` : ''}
</div>
<table><thead><tr>${headCols}</tr></thead><tbody>${body || '<tr><td colspan="6" style="padding:16px;text-align:center;color:#94a3b8">No entries</td></tr>'}</tbody></table>
<div class="foot">This is a computer-generated document from ${esc(company)}. No signature is required.</div>
<script>setTimeout(function(){window.print()},250)</script>
</body></html>`);
  w.document.close();
}


export default function CashBookView() {
  const [receipts, setReceipts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [bills, setBills] = useState([]);
  const [journals, setJournals] = useState([]);
  const [profile, setProfile] = useState({});
  const [ob, setOb] = useState(() => {
    try { return Number(localStorage.getItem('freegstbill_cashbook_ob') || 0); } catch { return 0; }
  });
  const [tab, setTab] = useState('ledger');
  const [dayDate, setDayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [obDate, setObDate] = useState(() => {
    try { return localStorage.getItem('freegstbill_cashbook_ob_date') || '2024-04-01'; } catch { return '2024-04-01'; }
  });

  useEffect(() => {
    (async () => {
      try {
        const [r, e, b, p, j] = await Promise.all([
          getAllReceipts(), getAllExpenses(), getAllBills(), getProfile(), getAllJournals().catch(() => [])
        ]);
        setProfile(p || {});
        setReceipts((r || []).filter(x => belongsToProfile(x, p)));
        setExpenses((e || []).filter(x => belongsToProfile(x, p)));
        setBills((b || []).filter(x => belongsToProfile(x, p)));
        setJournals(j || []);
      } catch {
        toast('Failed to load cash book data', 'error');
      }
    })();
  }, []);

  const rows = useMemo(() => {
    // Single source of truth: Journal only (same as General Ledger).
    // Receipts/expenses without a journal no longer appear here — prevents
    // "cash book shows payment, ledger does not" drift.
    const entries = [];
    (journals || []).forEach(j => {
      if (j.IsReversed || j.isReversed || j.reversed) return;
      // Show BOTH original receipt AND its reversal so cash book nets to zero
      // (hiding the original left only the outflow — negative impossible cash).
      (j.entries || []).forEach(e => {
        const acc = (e.account || '').toLowerCase();
        if (!/bank|cash/.test(acc)) return;
        const dr = Math.round((Number(e.debit) || 0) * 100) / 100;
        const cr = Math.round((Number(e.credit) || 0) * 100) / 100;
        if (dr < 0.005 && cr < 0.005) return;
        // P2: human document number only — never internal pay_/jnl_ hashes
        let invRef = j.againstInvoice || j.invoiceNumber || j.receiptNo || '';
        if (!invRef && j.refType === 'expense') invRef = j.narration || '';
        if (!invRef && j.refId && !/^pay_|^jnl_|^rcpt_/i.test(String(j.refId))) invRef = String(j.refId);
        if (!invRef) invRef = (j.narration || '').split('—')[0].trim().slice(0, 40);
        entries.push({
          date: j.date,
          type: j.refType === 'payment-reversal' ? 'Reversal'
            : (j.refType === 'payment' || j.refType === 'advance') ? 'Receipt'
            : j.refType === 'expense' ? 'Expense'
            : (dr > 0 ? 'Inflow' : 'Outflow'),
          ref: invRef || j.narration || '',
          name: j.party || j.clientName || e.party || '',
          inflow: dr > 0 ? dr : 0,
          outflow: cr > 0 ? cr : 0,
        });
      });
    });
    entries.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    let bal = Number(ob) || 0;
    return entries
      .filter(e => !obDate || !e.date || e.date >= obDate)
      .map(e => {
        bal = bal + e.inflow - e.outflow;
        return { ...e, balance: bal };
      });
  }, [journals, ob, obDate]);

  const saveOb = () => {
    localStorage.setItem('freegstbill_cashbook_ob', String(ob));
    localStorage.setItem('freegstbill_cashbook_ob_date', obDate);
    toast('Opening balance saved', 'success');
  };

  const closing = rows.length ? rows[rows.length - 1].balance : Number(ob) || 0;

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Banknote size={22} /> Cash Book
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => exportCashCsv(rows)}>Export CSV</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={async () => {
            let company = 'SAI DURGA';
            try { const p = await getProfile(); company = p?.businessName || p?.name || company; } catch (_) {}
            if (tab === 'day') {
              const dayRows = rows.filter(r => r.date === dayDate);
              exportCashPdf({ title: 'Day Book', subtitle: 'VOUCHER LOG (DAY BOOK)', company, rows: dayRows, mode: 'day', dayDate });
            } else {
              exportCashPdf({ title: 'Cash Book', subtitle: 'CASHBOOK LEDGER', company, rows, mode: 'ledger', closing });
            }
          }}>{tab === 'day' ? 'Export Day Book PDF' : 'Export Cash Book PDF'}</button>
        </div>
        <p className="page-subtitle">Running balance from Journal (Bank/Cash) — same source as General Ledger</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" className={`btn ${tab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('ledger')}>Bank Ledger</button>
        <button type="button" className={`btn ${tab === 'day' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('day')}>Day Book</button>
      </div>

      {tab === 'day' && (() => {
        const dayRows = rows.filter(r => r.date === dayDate);
        const tin = dayRows.reduce((s, r) => s + r.inflow, 0);
        const tout = dayRows.reduce((s, r) => s + r.outflow, 0);
        return (
          <div className="glass-panel p-4 mb-4">
            <div className="form-group" style={{ maxWidth: 220 }}>
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={dayDate} onChange={e => setDayDate(e.target.value)} />
            </div>
            <p><strong>In:</strong> {formatCurrency(tin)} · <strong>Out:</strong> {formatCurrency(tout)}</p>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Type</th><th>Ref</th><th>Particulars</th>
                  <th className="text-end">In</th><th className="text-end">Out</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.type}</td>
                    <td>{r.ref}</td>
                    <td>{r.name}</td>
                    <td className="text-end">{r.inflow ? formatCurrency(r.inflow) : '—'}</td>
                    <td className="text-end">{r.outflow ? formatCurrency(r.outflow) : '—'}</td>
                  </tr>
                ))}
                {dayRows.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center' }}>No vouchers this day</td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })()}

      {tab === 'ledger' && (
        <>
          <div className="glass-panel" style={{
            display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center',
            padding: '0.65rem 1rem', marginBottom: '0.75rem',
          }}>
            <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Opening balance (₹)</label>
            <input type="number" className="form-input" style={{ width: 140, margin: 0 }}
              value={ob} onChange={e => setOb(Number(e.target.value) || 0)} />
            <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>As of</label>
            <input type="date" className="form-input" style={{ width: 150, margin: 0 }}
              value={obDate} onChange={e => setObDate(e.target.value)} />
            <button type="button" className="btn btn-primary btn-sm" onClick={saveOb}>Save OB</button>
            <div style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.95rem' }}>
              Closing: {formatCurrency(closing)}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Date</th><th>Type</th><th>Ref</th><th>Particulars</th>
                  <th className="text-end">In</th><th className="text-end">Out</th><th className="text-end">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: '#f8fafc' }}>
                  <td colSpan={4}><strong>Opening balance</strong></td>
                  <td></td><td></td>
                  <td className="text-end"><strong>{formatCurrency(ob)}</strong></td>
                </tr>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td>{r.type}</td>
                    <td>{r.ref}</td>
                    <td>{r.name}</td>
                    <td className="text-end" style={{ color: '#059669' }}>{r.inflow ? formatCurrency(r.inflow) : '—'}</td>
                    <td className="text-end" style={{ color: '#dc2626' }}>{r.outflow ? formatCurrency(r.outflow) : '—'}</td>
                    <td className="text-end"><strong>{formatCurrency(r.balance)}</strong></td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8' }}>No movements after OB date</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
