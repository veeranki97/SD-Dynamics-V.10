import { useState, useMemo } from 'react';
import { getAllBills, getAllExpenses, saveBill, saveExpense } from '../store';
import { formatCurrency } from '../utils';
import { toast } from './Toast';

/** Parse simple bank CSV: Date, Description, Debit, Credit, Balance (flexible headers) */
function parseBankCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const split = (row) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') { q = !q; continue; }
      if (c === ',' && !q) { out.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = split(lines[0]).map(h => h.toLowerCase());
  const di = headers.findIndex(h => /date|txn|value/.test(h));
  const ni = headers.findIndex(h => /narrat|desc|particular|remarks/.test(h));
  const debitI = headers.findIndex(h => /debit|withdrawal|dr/.test(h));
  const creditI = headers.findIndex(h => /credit|deposit|cr/.test(h));
  const amtI = headers.findIndex(h => /amount|amt/.test(h));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = split(lines[i]);
    if (cols.length < 2) continue;
    let debit = 0, credit = 0;
    if (debitI >= 0 || creditI >= 0) {
      debit = parseFloat(String(cols[debitI] || '').replace(/,/g, '')) || 0;
      credit = parseFloat(String(cols[creditI] || '').replace(/,/g, '')) || 0;
    } else if (amtI >= 0) {
      const a = parseFloat(String(cols[amtI] || '').replace(/,/g, '')) || 0;
      if (a < 0) debit = Math.abs(a); else credit = a;
    }
    rows.push({
      id: 'bf_' + i,
      date: cols[di >= 0 ? di : 0] || '',
      narration: cols[ni >= 0 ? ni : 1] || '',
      debit, credit,
      matched: null,
    });
  }
  return rows;
}

export default function BankFeedView() {
  const [rows, setRows] = useState([]);
  const [bills, setBills] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadMasters = async () => {
    try {
      const [b, e] = await Promise.all([getAllBills(), getAllExpenses()]);
      setBills(b || []); setExpenses(e || []);
    } catch { toast('Could not load bills/expenses', 'error'); }
  };

  const onFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    setRows(parseBankCsv(text));
    await loadMasters();
    toast('Statement loaded — review suggested matches', 'success');
  };

  const openInvoices = useMemo(() => (bills || []).filter(b => {
    const due = (b.totalAmount || 0) - (b.paidAmount || 0);
    return due > 0.5 && !String(b.invoiceType || '').toLowerCase().includes('proforma');
  }), [bills]);

  const suggest = (row) => {
    if (row.credit > 0) {
      const hits = openInvoices.filter(b => Math.abs((b.totalAmount || 0) - (b.paidAmount || 0) - row.credit) < 1
        || Math.abs((b.totalAmount || 0) - row.credit) < 1);
      return hits.slice(0, 3).map(b => ({ type: 'invoice', ref: b }));
    }
    if (row.debit > 0) {
      const hits = (expenses || []).filter(e => Math.abs((Number(e.amount) || 0) - row.debit) < 1).slice(0, 3);
      return hits.map(e => ({ type: 'expense', ref: e }));
    }
    return [];
  };

  const confirmMatch = async (row, suggestion) => {
    setBusy(true);
    try {
      if (suggestion.type === 'invoice') {
        const bill = suggestion.ref;
        const amt = row.credit;
        const entry = { amount: amt, date: row.date, mode: 'bank-transfer', note: `Bank feed: ${row.narration}`, recordedAt: new Date().toISOString() };
        const nextPayments = [...(bill.payments || []), entry];
        const newPaid = (bill.paidAmount || 0) + amt;
        const status = newPaid >= (bill.totalAmount || 0) - 0.01 ? 'paid' : 'partial';
        await saveBill({ ...bill, paidAmount: newPaid, status, payments: nextPayments }, { overwrite: true });
        toast(`Matched to ${bill.invoiceNumber}`, 'success');
      } else {
        toast('Expense already recorded — marked matched', 'success');
      }
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, matched: suggestion.ref.invoiceNumber || suggestion.ref.id } : r));
    } catch (e) {
      toast(e.message || 'Match failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <h2>Bank Feed & Reconciliation</h2>
      <p className="page-subtitle">Upload bank CSV (Date, Description, Debit, Credit). Auto-suggest matches to open invoices.</p>
      <input type="file" accept=".csv,text/csv" onChange={e => onFile(e.target.files?.[0])} className="form-input" style={{ maxWidth: 420 }} />
      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr><th>Date</th><th>Narration</th><th className="text-end">Debit</th><th className="text-end">Credit</th><th>Suggested match</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const sug = r.matched ? [] : suggest(r);
              return (
                <tr key={r.id} style={r.matched ? { background: '#f0fdf4' } : undefined}>
                  <td>{r.date}</td>
                  <td>{r.narration}</td>
                  <td className="text-end">{r.debit ? formatCurrency(r.debit) : '—'}</td>
                  <td className="text-end">{r.credit ? formatCurrency(r.credit) : '—'}</td>
                  <td>
                    {r.matched ? <span style={{ color: '#059669' }}>✓ {r.matched}</span> : (
                      sug.map((s, i) => (
                        <div key={i} style={{ fontSize: 12 }}>
                          {s.type === 'invoice' ? s.ref.invoiceNumber : (s.ref.description || s.ref.id)}
                          {' '}({formatCurrency(s.type === 'invoice' ? s.ref.totalAmount : s.ref.amount)})
                        </div>
                      ))
                    )}
                    {!r.matched && !sug.length && <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>
                  <td>
                    {!r.matched && sug[0] && (
                      <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => confirmMatch(r, sug[0])}>Confirm</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>Upload a CSV statement to begin</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
