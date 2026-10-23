import { useState, useEffect, useMemo } from 'react';
import { getAllJournals, saveJournal, getAllBills, getAllExpenses, getAllWorkOrders, getAllCostCenters, getProfile, getAllAccounts } from '../store';
import { formatCurrency } from '../utils';
import {
  trialBalance, balanceSheet, computeTradingPnL, siteWisePnL,
  woWisePnL, costCenterWisePnL, filterJournalsByProfile,
  periodCloseJournal, bankBalance, lockMonth, unlockMonth, isMonthLocked,
} from '../utils/ledger';
import { trialBalanceFromJournals, activeGlJournals } from '../utils/glPosting';
import { linesOpeningFromRows, linesPeriodClose } from '../utils/glRecipes';
import { toast } from './Toast';
import { downloadCsv, printHtmlTable } from '../utils/exportData';

export default function FinancialBooksView() {
  /* Sidebar label: Financial Books — tabs: TB, BS, P&L, Site, WO, Cost Center, Period Lock */
  const [journals, setJournals] = useState([]);
  const [billRows, setBillRows] = useState([]);
  const [expRows, setExpRows] = useState([]);
  const [woRows, setWoRows] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [tab, setTab] = useState('tb'); // tb | bs | pnl | site | lock
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [from, setFrom] = useState(() => {
    const y = new Date().getFullYear();
    const m = new Date().getMonth();
    return m >= 3 ? `${y}-04-01` : `${y - 1}-04-01`;
  });
  const [lockMonthKey, setLockMonthKey] = useState(() => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  });
  const [useGlEngine, setUseGlEngine] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [ledgerAccountId, setLedgerAccountId] = useState('');
  const [showGlReversals, setShowGlReversals] = useState(false);
  const [opRows, setOpRows] = useState([{ accountId: '', debit: '', credit: '' }]);
  const [mjLines, setMjLines] = useState([
    { accountId: '', debit: '', credit: '' },
    { accountId: '', debit: '', credit: '' },
  ]);
  const [mjDate, setMjDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mjNarr, setMjNarr] = useState('');

  const [profile, setProfile] = useState(null);
  const load = () => {
    getAllJournals().then(setJournals).catch(() => toast('Failed to load journals', 'error'));
    getProfile().then(setProfile).catch(() => setProfile(null));
    getAllAccounts().then((a) => setAccounts(Array.isArray(a) ? a : [])).catch(() => setAccounts([]));
    fetch('/api/meta/useGlEngine', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => setUseGlEngine(!!d.value))
      .catch(() => {});
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    getAllBills().then(setBillRows).catch(() => setBillRows([]));
    getAllExpenses().then(setExpRows).catch(() => setExpRows([]));
    getAllWorkOrders().then(setWoRows).catch(() => setWoRows([]));
    getAllCostCenters().then(setCostCenters).catch(() => setCostCenters([]));
  }, []);

  const scopedJournals = useMemo(() => filterJournalsByProfile(journals, profile), [journals, profile]);
  
  const exportTradingCapitalPdf = () => {
    const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const inr = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sales = Number(pnl.sales || 0);
    const purchases = Number(pnl.purchases || 0);
    const expenses = Number(pnl.expenses || 0);
    const gp = Number(pnl.grossProfit || 0);
    const np = Number(pnl.netProfit || 0);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Trading-PL-Capital</title>
<style>@page{size:A4;margin:12mm}body{font-family:Segoe UI,Arial,sans-serif;font-size:10px;color:#0f172a}
h1{font-size:14px;margin:0 0 4px}h2{font-size:12px;margin:16px 0 8px;border-bottom:1px solid #0f172a;padding-bottom:4px}
table{width:100%;border-collapse:collapse;margin-bottom:12px}td,th{border:1px solid #0f172a;padding:6px 8px}
.side{display:grid;grid-template-columns:1fr 1fr;gap:0} .muted{color:#64748b;font-size:9px}
</style></head><body>
<div class="muted">${esc(from)} to ${esc(asOf)}</div>
<h1>Trading Account / Profit & Loss / Capital</h1>
<h2>Trading Account</h2>
<table>
<tr><td>To Opening Stock</td><td style="text-align:right">₹0.00</td><td>By Sales</td><td style="text-align:right">₹${inr(sales)}</td></tr>
<tr><td>To Purchases</td><td style="text-align:right">₹${inr(purchases)}</td><td>By Closing Stock</td><td style="text-align:right">₹0.00</td></tr>
<tr><td>To Gross Profit c/d</td><td style="text-align:right">₹${inr(Math.max(0,gp))}</td><td>By Gross Loss c/d</td><td style="text-align:right">₹${inr(Math.max(0,-gp))}</td></tr>
</table>
<h2>Profit & Loss Account</h2>
<table>
<tr><td>To Indirect Expenses</td><td style="text-align:right">₹${inr(expenses)}</td><td>By Gross Profit b/d</td><td style="text-align:right">₹${inr(Math.max(0,gp))}</td></tr>
<tr><td>To Net Profit transferred to Capital</td><td style="text-align:right">₹${inr(Math.max(0,np))}</td><td>By Net Loss</td><td style="text-align:right">₹${inr(Math.max(0,-np))}</td></tr>
</table>
<h2>Capital Account (summary)</h2>
<table>
<tr><td>To Net Loss</td><td style="text-align:right">₹${inr(Math.max(0,-np))}</td><td>By Net Profit</td><td style="text-align:right">₹${inr(Math.max(0,np))}</td></tr>
<tr><td colspan="2" class="muted">Stock lines omitted (no inventory qty). Figures from journals / sales / purchases for the period.</td><td></td><td></td></tr>
</table>
<script>setTimeout(function(){window.print()},300)</script>
</body></html>`;
    let iframe = document.getElementById('sd-trading-print-frame');
    if (!iframe) { iframe = document.createElement('iframe'); iframe.id = 'sd-trading-print-frame'; document.body.appendChild(iframe); }
    iframe.style.cssText = 'position:fixed;left:0;top:0;width:210mm;height:297mm;opacity:0;z-index:-1;pointer-events:none;border:0';
    const prev = document.title;
    document.title = 'Trading-PL-Capital';
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => { try { iframe.contentWindow.print(); } catch(_){} document.title = prev; }, 400);
  };

  const tb = useMemo(() => {
    if (useGlEngine) {
      const rows = trialBalanceFromJournals(scopedJournals, asOf);
      return rows.map((r) => ({ account: r.account, debit: r.debit, credit: r.credit, accountId: r.accountId }));
    }
    return trialBalance(scopedJournals, asOf);
  }, [scopedJournals, asOf, useGlEngine]);
  const bs = useMemo(() => balanceSheet(scopedJournals, asOf), [scopedJournals, asOf]);
  const pnl = useMemo(() => computeTradingPnL(scopedJournals, from, asOf), [scopedJournals, from, asOf]);
  const sites = useMemo(() => {
    const fromJ = siteWisePnL(scopedJournals, from, asOf) || [];
    const hasReal = fromJ.some(s => s.site !== 'Unassigned' && ((s.income || 0) + (s.expense || 0) > 0.01));
    if (hasReal) return fromJ;
    const map = {};
    (billRows || []).forEach(b => {
      if (b.status === 'cancelled') return;
      const d = b.invoiceDate || b.data?.details?.invoiceDate || '';
      if (from && d && d < from) return;
      if (asOf && d && d > asOf) return;
      const site = b.site || b.data?.site || b.data?.details?.site || b.data?.client?.site || 'Unassigned';
      if (!map[site]) map[site] = { site, income: 0, expense: 0 };
      const total = Number(b.totalAmount) || 0;
      const tax = Number(b.totalTaxAmount) || 0;
      map[site].income += Math.max(0, total - tax);
    });
    (expRows || []).forEach(e => {
      const d = e.date || '';
      if (from && d && d < from) return;
      if (asOf && d && d > asOf) return;
      const site = e.site || e.costCenterId || 'Unassigned';
      if (!map[site]) map[site] = { site, income: 0, expense: 0 };
      map[site].expense += Number(e.amount) || 0;
    });
    return Object.values(map).map(s => ({
      ...s,
      income: Math.round(s.income * 100) / 100,
      expense: Math.round(s.expense * 100) / 100,
      profit: Math.round((s.income - s.expense) * 100) / 100,
    }));
  }, [journals, from, asOf, billRows, expRows]);
  const wos = useMemo(() => {
    const fromJ = (typeof woWisePnL === 'function' ? woWisePnL(scopedJournals, from, asOf) : []) || [];
    const hasReal = fromJ.some(r => r.workOrderId && r.workOrderId !== 'Unassigned' && ((r.income || 0) + (r.expense || 0) > 0.01));
    const labelWo = (id) => {
      if (!id || id === 'Unassigned') return 'Unassigned';
      const w = (woRows || []).find(x => x.id === id || x.woNumber === id || x.number === id);
      if (w) return w.woNumber || w.number || w.title || id;
      return id;
    };
    if (hasReal) {
      return fromJ.map(r => ({ ...r, workOrderLabel: labelWo(r.workOrderId) }));
    }
    // Fallback: invoices + expenses tagged with WO (journals often lack workOrderId)
    const map = {};
    const isRev = (b) => {
      const st = String(b.status || '').toLowerCase();
      if (st === 'cancelled' || b.is_deleted) return false;
      const t = String(b.invoiceType || b.type || 'tax-invoice').toLowerCase().replace(/\s+/g, '-');
      if (t.includes('quotation') || t === 'delivery-challan' || t === 'dc' || t.includes('proforma')) return false;
      return true;
    };
    (billRows || []).forEach(b => {
      if (!isRev(b)) return;
      const d = String(b.invoiceDate || b.date || '').slice(0, 10);
      if (from && d && d < from) return;
      if (asOf && d && d > asOf) return;
      const wo = b.workOrderId || b.data?.workOrderId || b.data?.details?.workOrderId
        || b.workOrderNo || b.data?.details?.workOrderNo || b.woNumber || 'Unassigned';
      const key = String(wo || 'Unassigned');
      if (!map[key]) map[key] = { workOrderId: key, income: 0, expense: 0, net: 0 };
      const tot = Number(b.grandTotal ?? b.total ?? b.data?.totals?.total ?? 0) || 0;
      const t = String(b.invoiceType || b.type || '').toLowerCase();
      if (t.includes('credit')) map[key].income -= tot;
      else map[key].income += tot;
    });
    (expRows || []).forEach(e => {
      const d = String(e.date || e.expenseDate || '').slice(0, 10);
      if (from && d && d < from) return;
      if (asOf && d && d > asOf) return;
      const wo = e.workOrderId || e.woNumber || e.workOrderNo || 'Unassigned';
      const key = String(wo || 'Unassigned');
      if (!map[key]) map[key] = { workOrderId: key, income: 0, expense: 0, net: 0 };
      map[key].expense += Number(e.amount || e.total || 0) || 0;
    });
    return Object.values(map).map(r => ({
      ...r,
      income: Math.round(r.income * 100) / 100,
      expense: Math.round(r.expense * 100) / 100,
      net: Math.round((r.income - r.expense) * 100) / 100,
      workOrderLabel: labelWo(r.workOrderId),
    })).sort((a, b) => b.net - a.net);
  }, [scopedJournals, from, asOf, billRows, expRows, woRows]);

  const ccs = useMemo(() => {
    const fromJ = (typeof costCenterWisePnL === 'function' ? costCenterWisePnL(scopedJournals, from, asOf) : []) || [];
    const hasReal = fromJ.some(r => r.costCenter && r.costCenter !== 'Unassigned' && ((r.income || 0) + (r.expense || 0) > 0.01));
    if (hasReal) return fromJ;
    const map = {};
    const isRev = (b) => {
      const st = String(b.status || '').toLowerCase();
      if (st === 'cancelled' || b.is_deleted) return false;
      const t = String(b.invoiceType || b.type || 'tax-invoice').toLowerCase().replace(/\s+/g, '-');
      if (t.includes('quotation') || t === 'delivery-challan' || t === 'dc' || t.includes('proforma')) return false;
      return true;
    };
    (billRows || []).forEach(b => {
      if (!isRev(b)) return;
      const d = String(b.invoiceDate || b.date || '').slice(0, 10);
      if (from && d && d < from) return;
      if (asOf && d && d > asOf) return;
      const cc = b.costCenterId || b.data?.costCenterId || b.costCenter
        || (Array.isArray(b.data?.items) && b.data.items.find(i => i.costCenterId)?.costCenterId)
        || 'Unassigned';
      const key = String(cc || 'Unassigned');
      if (!map[key]) map[key] = { costCenter: key, income: 0, expense: 0 };
      const tot = Number(b.grandTotal ?? b.total ?? b.data?.totals?.total ?? 0) || 0;
      const t = String(b.invoiceType || b.type || '').toLowerCase();
      if (t.includes('credit')) map[key].income -= tot;
      else map[key].income += tot;
    });
    (expRows || []).forEach(e => {
      const d = String(e.date || e.expenseDate || '').slice(0, 10);
      if (from && d && d < from) return;
      if (asOf && d && d > asOf) return;
      const cc = e.costCenterId || e.costCenter || 'Unassigned';
      const key = String(cc || 'Unassigned');
      if (!map[key]) map[key] = { costCenter: key, income: 0, expense: 0 };
      map[key].expense += Number(e.amount || e.total || 0) || 0;
    });
    return Object.values(map).map(s => ({
      ...s,
      income: Math.round(s.income * 100) / 100,
      expense: Math.round(s.expense * 100) / 100,
      profit: Math.round((s.income - s.expense) * 100) / 100,
    }));
  }, [scopedJournals, from, asOf, billRows, expRows]);
  const bank = useMemo(() => bankBalance(scopedJournals, 'Bank') + bankBalance(scopedJournals, 'Cash'), [scopedJournals]);

  const runPeriodClose = async () => {
    const closeMsg = 'Post period-close for ' + asOf + ' to Retained Earnings and lock month?';
    if (!window.confirm(closeMsg)) return;
    try {
      if (useGlEngine) {
        // Build TB-like rows with types from CoA for income/expense close
        const tbRows = trialBalanceFromJournals(scopedJournals, asOf).map((r) => {
          const acc = (accounts || []).find((a) => a.id === r.accountId || a.name === r.account);
          return { ...r, type: acc ? acc.type : '' };
        });
        const lines = linesPeriodClose(tbRows, {});
        if (!lines || !lines.length) {
          toast('Nothing to close (P&L ~ 0)', 'info');
          return;
        }
        const res = await fetch('/api/gl/post', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceType: 'period_close',
            sourceId: 'close_' + String(asOf).slice(0, 7),
            date: asOf,
            narration: 'Period close ' + asOf + ' → Retained Earnings',
            lines,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || 'GL close failed');
      } else {
        const j = periodCloseJournal(scopedJournals, asOf);
        if (!j) {
          toast('Nothing to close (P&L ~ 0)', 'info');
          return;
        }
        await saveJournal(j);
      }
      // Lock month via existing period lock (server meta preferred)
      const yyyymm = String(asOf).slice(0, 7);
      try {
        await fetch('/api/period-lock', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month: yyyymm, action: 'lock' }),
        });
      } catch (_) {
        lockMonth(yyyymm);
      }
      toast('Period close posted; month ' + yyyymm + ' locked', 'success');
      load();
    } catch (e) {
      toast(e.message || 'Close failed', 'error');
    }
  };

    // Display name: Financial Books (TB, BS, P&L, dimensions, period lock)
  const tabs = [
    { id: 'tb', label: 'Trial Balance' },
    { id: 'bs', label: 'Balance Sheet' },
    { id: 'pnl', label: 'P&L' },
    { id: 'site', label: 'Site-wise P&L' },
    { id: 'wo', label: 'WO-wise P&L' },
    { id: 'cc', label: 'Cost Center P&L' },
    { id: 'ledger', label: 'Account Ledger' },
    { id: 'opening', label: 'Opening Balances' },
    { id: 'manual', label: 'Manual Journal' },
    { id: 'lock', label: 'Period Lock' },
  ];

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Financial Books</h2>
          <p className="page-subtitle" style={{ margin: 0 }}>
            GL-backed statements · Bank+Cash: <strong>{formatCurrency(bank)}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: 13 }}>From</label>
          <input type="date" className="form-input" style={{ width: 140 }} value={from} onChange={e => setFrom(e.target.value)} />
          <label style={{ fontSize: 13 }}>As of</label>
          <input type="date" className="form-input" style={{ width: 140 }} value={asOf} onChange={e => setAsOf(e.target.value)} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
            if (tab === 'tb') {
              downloadCsv('trial-balance.csv', tb, ['account', 'debit', 'credit', 'balance']);
            } else if (tab === 'pnl') {
              downloadCsv('pnl.csv', [pnl], ['sales', 'purchases', 'expenses', 'grossProfit', 'netProfit']);
            } else if (tab === 'site') {
              downloadCsv('site-pnl.csv', sites, ['site', 'income', 'expense', 'profit']);
            } else if (tab === 'wo') {
              const exportWos = wos.map(s => {
                const woObj = woRows.find(w => w.id === s.workOrderId);
                return { ...s, workOrder: woObj ? (woObj.woNumber || woObj.id) : s.workOrderId };
              });
              downloadCsv('wo-pnl.csv', exportWos, ['workOrder', 'income', 'expense', 'net']);
            } else if (tab === 'cc') {
              const exportCcs = (ccs || []).map(r => {
                const ccObj = costCenters.find(c => c.id === r.costCenter);
                return { ...r, costCenterName: ccObj ? (ccObj.name || ccObj.id) : r.costCenter };
              });
              downloadCsv('cc-pnl.csv', exportCcs, ['costCenterName', 'income', 'expense', 'profit']);
            }
          }}>Export CSV</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} type="button"
            className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'tb' && (
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr><th>Account</th><th className="text-end">Debit</th><th className="text-end">Credit</th><th className="text-end">Balance (Dr-Cr)</th></tr>
          </thead>
          <tbody>
            {tb.map(r => (
              <tr key={r.account}>
                <td>{r.account}</td>
                <td className="text-end">{r.debit ? formatCurrency(r.debit) : '—'}</td>
                <td className="text-end">{r.credit ? formatCurrency(r.credit) : '—'}</td>
                <td className="text-end">{formatCurrency(r.balance)}</td>
              </tr>
            ))}
            {tb.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8' }}>
                No journal postings yet. Save a Tax Invoice to auto-post Dr Debtors / Cr Sales + GST.
              </td></tr>
            )}
            {tb.length > 0 && (
              <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                <td>Total</td>
                <td className="text-end">{formatCurrency(tb.reduce((s, r) => s + r.debit, 0))}</td>
                <td className="text-end">{formatCurrency(tb.reduce((s, r) => s + r.credit, 0))}</td>
                <td className="text-end">{formatCurrency(tb.reduce((s, r) => s + r.balance, 0))}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {tab === 'bs' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="glass-panel p-4">
            <h3>Assets</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {bs.assets.map(a => (
                <li key={a.account} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{a.account}</span><span>{formatCurrency(a.amount)}</span>
                </li>
              ))}
            </ul>
            <div style={{ fontWeight: 700, borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
              Total Assets: {formatCurrency(bs.totalAssets)}
            </div>
          </div>
          <div className="glass-panel p-4">
            <h3>Liabilities & Equity</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {[...bs.liabilities, ...bs.equity].map(a => (
                <li key={a.account} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{a.account}</span><span>{formatCurrency(a.amount)}</span>
                </li>
              ))}
            </ul>
            <div style={{ fontWeight: 700, borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
              Total L+E: {formatCurrency(bs.totalLiabilitiesAndEquity)}
            </div>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
              Net profit (YTD logic): {formatCurrency(bs.netProfit)}
            </p>
          </div>
        </div>
      )}

      {(tab === 'pnl') && (
          <div style={{ marginBottom: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={exportTradingCapitalPdf}>Print Trading / P&L / Capital</button>
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={async () => {
              try {
                const { isConnected, uploadJSON } = await import('../services/googleDrive');
                if (!isConnected?.()) { toast('Connect Google Drive in Settings first', 'warning'); return; }
                const payload = { type: 'trading-pl-capital', from, asOf, pnl, generatedAt: new Date().toISOString() };
                // scrub
                delete payload.smtp; delete payload.pinHash;
                await uploadJSON(payload, `Trading-PL-${from || 'start'}-${asOf || 'end'}.json`);
                toast('Archived summary JSON to Google Drive', 'success');
              } catch (e) { toast(e.message || 'Drive archive failed', 'error'); }
            }}>Archive to Drive</button>
          </div>
        )}
        {tab === 'pnl' && (
        <div className="glass-panel p-4" style={{ maxWidth: 480 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sales</span><strong>{formatCurrency(pnl.sales)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Direct costs / purchases</span><span>{formatCurrency(pnl.purchases)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', marginTop: 8, paddingTop: 8 }}>
            <span>Gross profit</span><strong>{formatCurrency(pnl.grossProfit)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Indirect expenses</span><span>{formatCurrency(pnl.expenses)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', marginTop: 8, paddingTop: 8, fontSize: '1.1rem' }}>
            <span>Net profit</span><strong style={{ color: pnl.netProfit >= 0 ? '#059669' : '#dc2626' }}>{formatCurrency(pnl.netProfit)}</strong>
          </div>
          <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={runPeriodClose}>
            Period close → Retained Earnings
          </button>
        </div>
      )}

      {tab === 'site' && (
        <table className="data-table" style={{ width: '100%' }}>
          <thead><tr><th>Site</th><th className="text-end">Income</th><th className="text-end">Expense</th><th className="text-end">Profit</th></tr></thead>
          <tbody>
            {(sites).map(s => (
              <tr key={s.site}>
                <td>{s.site}</td>
                <td className="text-end">{formatCurrency(s.income)}</td>
                <td className="text-end">{formatCurrency(s.expense)}</td>
                <td className="text-end">{formatCurrency(s.profit ?? (s.income - s.expense))}</td>
              </tr>
            ))}
            {sites.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8' }}>Tag site on invoices/expenses to see site-wise P&L</td></tr>}
          </tbody>
        </table>
      )}

      {tab === 'wo' && (
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Work Order</th>
              <th className="text-end">Income</th>
              <th className="text-end">Expense</th>
              <th className="text-end">Net</th>
            </tr>
          </thead>
          <tbody>
            {wos.map(s => {
              const woObj = woRows.find(w =>
                w.id === s.workOrderId || w.woNumber === s.workOrderId || w.number === s.workOrderId
              );
              const displayWo = s.workOrderLabel
                || (woObj ? (woObj.woNumber || woObj.number || woObj.id) : null)
                || s.workOrderId;
              return (
              <tr key={String(s.workOrderId)}>
                <td title={String(s.workOrderId)}>{displayWo}</td>
                <td className="text-end">{formatCurrency(s.income)}</td>
                <td className="text-end">{formatCurrency(s.expense)}</td>
                <td className="text-end" style={{ color: (s.net ?? 0) >= 0 ? '#059669' : '#dc2626', fontWeight: 600 }}>
                  {formatCurrency(s.net ?? 0)}
                </td>
              </tr>
            )})}
            {wos.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8' }}>
                  No WO-linked invoices/expenses in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {tab === 'cc' && (
        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Cost Center</th>
                <th className="text-end">Income</th>
                <th className="text-end">Expense</th>
                <th className="text-end">Profit</th>
              </tr>
            </thead>
            <tbody>
              {(ccs || []).map((r) => {
                const ccObj = costCenters.find(c => c.id === r.costCenter);
                const displayCc = ccObj ? (ccObj.name || ccObj.id) : r.costCenter;
                return (
                <tr key={r.costCenter}>
                  <td>{displayCc}</td>
                  <td className="text-end">{formatCurrency(r.income)}</td>
                  <td className="text-end">{formatCurrency(r.expense)}</td>
                  <td className="text-end" style={{ fontWeight: 600, color: (r.profit || 0) >= 0 ? '#059669' : '#dc2626' }}>
                    {formatCurrency(r.profit)}
                  </td>
                </tr>
              )})}
              {!(ccs || []).length && (
                <tr>
                  <td colSpan={4} className="text-muted" style={{ textAlign: 'center' }}>
                    No cost-center data. Set Cost Center on invoices/expenses so journals include costCenterId.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}


      {tab === 'ledger' && (
        <div className="glass-panel" style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="form-input" style={{ minWidth: 260 }} value={ledgerAccountId} onChange={e => setLedgerAccountId(e.target.value)}>
              <option value="">Select account</option>
              {(accounts || []).filter(a => a && !a.isGroup && a.isActive !== false).map(a => (
                <option key={a.id || a.code} value={a.id || a.code}>{(a.code ? String(a.code) + ' — ' : '') + (a.name || a.id)}</option>
              ))}
            </select>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, color: '#64748b' }}>
              <input type="checkbox" checked={showGlReversals} onChange={e => setShowGlReversals(e.target.checked)} />
              Show reversals
            </label>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              Same journal source as General Ledger · From / As of apply
            </span>
          </div>
          <div className="table-responsive" style={{ maxHeight: 'min(60vh, 520px)', overflow: 'auto' }}>
            <table className="data-table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <thead><tr><th style={{ width: '12%' }}>Date</th><th>Narration</th><th style={{ width: '14%' }}>Debit</th><th style={{ width: '14%' }}>Credit</th><th style={{ width: '14%' }}>Balance</th></tr></thead>
              <tbody>
                {(() => {
                  if (!ledgerAccountId) {
                    return <tr><td colSpan={5} style={{ color: '#64748b' }}>Select an account above.</td></tr>;
                  }
                  const selAcc = (accounts || []).find(a => a && (a.id === ledgerAccountId || String(a.code) === String(ledgerAccountId)));
                  const selCode = selAcc ? String(selAcc.code || '').trim() : '';
                  const selName = selAcc ? String(selAcc.name || '').trim() : '';
                  const selId = String(ledgerAccountId).trim();
                  const norm = (s) => String(s || '').replace(/^acc_/i, '').trim().toLowerCase();

                  const matchEntry = (e) => {
                    if (!e) return false;
                    const id = String(e.accountId || e.account_id || '').trim();
                    const code = String(e.accountCode || e.code || '').trim();
                    const nm = String(e.account || e.accountName || '').trim();
                    const extractCode = (s) => {
                      const m = String(s || '').match(/(?:^|acc_)(\d{3,6})\b/i);
                      return m ? m[1] : '';
                    };
                    // Selected account may be id "acc_5100" or code "5100"
                    const want = new Set();
                    const add = (x) => {
                      const s = String(x || '').trim();
                      if (!s) return;
                      want.add(s);
                      want.add(s.replace(/^acc_/i, ''));
                      const c = extractCode(s);
                      if (c) { want.add(c); want.add('acc_' + c); }
                    };
                    add(selId);
                    add(selCode);
                    if (selAcc) { add(selAcc.id); add(selAcc.code); add(selAcc.name); }
                    // Match id / code / label code / name substring
                    if (id && (want.has(id) || want.has(id.replace(/^acc_/i, '')))) return true;
                    if (code && (want.has(code) || want.has(code.replace(/^acc_/i, '')))) return true;
                    const nmCode = extractCode(nm);
                    if (nmCode && want.has(nmCode)) return true;
                    if (nm) {
                      for (const w of want) {
                        if (w.length >= 3 && nm.toLowerCase().includes(String(w).toLowerCase())) return true;
                      }
                    }
                    return false;
                  };

                  // Account Ledger: use full journal list (profile scope can hide party-less expense/purchase lines)
                  const journalPool = (journals && journals.length) ? journals : (scopedJournals || []);
                  let activeRaw = showGlReversals
                    ? (journalPool || []).filter(Boolean)
                    : activeGlJournals(journalPool || []);
                  if (!showGlReversals && activeRaw.some(j => j && j.glEngine === true)) {
                    activeRaw = activeRaw.filter(j => j && j.glEngine === true);
                  }

                  const flat = [];
                  activeRaw.forEach(j => {
                    if (!j) return;
                    if (!showGlReversals && (j.isReversed || j.IsReversed)) return;
                    const d = String(j.date || '').slice(0, 10);
                    if (from && d && d < from) return;
                    if (asOf && d && d > asOf) return;
                    const ents = j.entries || j.lines || [];
                    ents.forEach(e => {
                      if (!matchEntry(e)) return;
                      flat.push({
                        date: j.date,
                        narration: j.narration || '',
                        debit: Number(e.debit) || 0,
                        credit: Number(e.credit) || 0,
                        tag: j.isReversal ? ' [REV]' : (j.isReversed ? ' [REVERSED]' : ''),
                        jid: j.id,
                        faded: !!(j.isReversal || j.isReversed),
                      });
                    });
                  });
                  flat.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

                  if (!flat.length) {
                    const totalJ = (journalPool || []).length;
                    const totalE = (journalPool || []).reduce((s, j) => s + ((j && (j.entries || j.lines)) || []).length, 0);
                    return (
                      <tr>
                        <td colSpan={5} style={{ color: '#64748b' }}>
                          No lines for this account. Journals loaded: {totalJ}, entry lines: {totalE}.
                          Try another account (e.g. 1300 Sundry Debtors / 1210 Bank) or open Books → General Ledger.
                        </td>
                      </tr>
                    );
                  }
                  let bal = 0;
                  return flat.map((r, idx) => {
                    bal += r.debit - r.credit;
                    return (
                      <tr key={(r.jid || 'j') + '-' + idx} style={r.faded ? { opacity: 0.65 } : undefined}>
                        <td style={{ whiteSpace: 'nowrap' }}>{r.date}</td>
                        <td title={r.narration + r.tag} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }}>{(r.narration + r.tag)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.debit)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.credit)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(bal)}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'opening' && (
        <div className="glass-panel" style={{ padding: 12, maxWidth: 720 }}>
          <p style={{ fontSize: 13, color: '#64748b' }}>Opening balances for FY start. Must balance (Dr = Cr). Posts only when GL engine is ON.</p>
          {opRows.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
              <select className="form-input" value={row.accountId} onChange={e => setOpRows(prev => prev.map((r, j) => j === i ? { ...r, accountId: e.target.value } : r))}>
                <option value="">Account</option>
                {(accounts || []).filter(a => !a.isGroup).map(a => (
                  <option key={a.id} value={a.id}>{(a.code ? a.code + ' ' : '') + a.name}</option>
                ))}
              </select>
              <input type="number" className="form-input" placeholder="Dr" value={row.debit} onChange={e => setOpRows(prev => prev.map((r, j) => j === i ? { ...r, debit: e.target.value } : r))} />
              <input type="number" className="form-input" placeholder="Cr" value={row.credit} onChange={e => setOpRows(prev => prev.map((r, j) => j === i ? { ...r, credit: e.target.value } : r))} />
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setOpRows(prev => prev.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setOpRows(prev => [...prev, { accountId: '', debit: '', credit: '' }])}>+ Line</button>
          <button type="button" className="btn btn-primary" style={{ marginLeft: 8 }} onClick={async () => {
            if (!useGlEngine) { toast('Enable GL Engine first (GL Engine tab)', 'warning'); return; }
            const lines = linesOpeningFromRows(opRows);
            const dr = lines.reduce((s, e) => s + e.debit, 0);
            const cr = lines.reduce((s, e) => s + e.credit, 0);
            if (Math.abs(dr - cr) > 0.01) { toast('Opening must balance', 'error'); return; }
            try {
              const res = await fetch('/api/gl/post', {
                method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sourceType: 'opening_balance',
                  sourceId: 'op_' + from,
                  date: from,
                  narration: 'Opening balances ' + from,
                  lines,
                }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.message || data.error || 'Failed');
              toast('Opening balances posted', 'success');
              load();
            } catch (e) { toast(e.message || 'Post failed', 'error'); }
          }}>Post opening</button>
        </div>
      )}

      {tab === 'manual' && (
        <div className="glass-panel" style={{ padding: 12, maxWidth: 720 }}>
          <p style={{ fontSize: 13, color: '#64748b' }}>Balanced manual journal. Uses /api/gl/post when engine ON; otherwise legacy saveJournal.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input type="date" className="form-input" value={mjDate} onChange={e => setMjDate(e.target.value)} />
            <input className="form-input" style={{ flex: 1 }} placeholder="Narration" value={mjNarr} onChange={e => setMjNarr(e.target.value)} />
          </div>
          {mjLines.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <select className="form-input" value={row.accountId} onChange={e => setMjLines(prev => prev.map((r, j) => j === i ? { ...r, accountId: e.target.value } : r))}>
                <option value="">Account</option>
                {(accounts || []).filter(a => !a.isGroup).map(a => (
                  <option key={a.id} value={a.id}>{(a.code ? a.code + ' ' : '') + a.name}</option>
                ))}
              </select>
              <input type="number" className="form-input" placeholder="Debit" value={row.debit} onChange={e => setMjLines(prev => prev.map((r, j) => j === i ? { ...r, debit: e.target.value } : r))} />
              <input type="number" className="form-input" placeholder="Credit" value={row.credit} onChange={e => setMjLines(prev => prev.map((r, j) => j === i ? { ...r, credit: e.target.value } : r))} />
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setMjLines(prev => [...prev, { accountId: '', debit: '', credit: '' }])}>+ Line</button>
          <button type="button" className="btn btn-primary" style={{ marginLeft: 8 }} onClick={async () => {
            const lines = mjLines.filter(r => r.accountId && (Number(r.debit) || Number(r.credit)));
            const dr = lines.reduce((s, e) => s + (Number(e.debit) || 0), 0);
            const cr = lines.reduce((s, e) => s + (Number(e.credit) || 0), 0);
            if (Math.abs(dr - cr) > 0.01) { toast('Journal must balance', 'error'); return; }
            try {
              if (useGlEngine) {
                const res = await fetch('/api/gl/post', {
                  method: 'POST', credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    sourceType: 'manual_journal',
                    sourceId: 'mj_' + Date.now(),
                    date: mjDate,
                    narration: mjNarr || 'Manual journal',
                    lines: lines.map(l => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
                  }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || data.error || 'Failed');
              } else {
                await saveJournal({
                  id: 'jnl_mj_' + Date.now().toString(36),
                  date: mjDate,
                  narration: mjNarr || 'Manual journal',
                  entries: lines.map(l => {
                    const acc = accounts.find(a => a.id === l.accountId);
                    return { account: acc ? acc.name : l.accountId, accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 };
                  }),
                });
              }
              toast('Journal saved', 'success');
              load();
            } catch (e) { toast(e.message || 'Save failed', 'error'); }
          }}>Post journal</button>
        </div>
      )}

      
      {tab === 'lock' && (
        <div className="glass-panel p-4" style={{ maxWidth: 420 }}>
          <p style={{ fontSize: 14, color: '#64748b' }}>
            Lock a month to block edits (uses local period lock). Combine with freeze-days for audit control.
          </p>
          <input className="form-input" value={lockMonthKey} onChange={e => setLockMonthKey(e.target.value)} placeholder="YYYY-MM" />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-primary" onClick={() => { lockMonth(lockMonthKey); toast(`Locked ${lockMonthKey}`, 'success'); }}>Lock month</button>
            <button type="button" className="btn btn-secondary" onClick={() => { unlockMonth(lockMonthKey); toast(`Unlocked ${lockMonthKey}`, 'success'); }}>Unlock</button>
          </div>
          <p style={{ marginTop: 12, fontSize: 13 }}>
            Status for {lockMonthKey}: <strong>{isMonthLocked(lockMonthKey + '-01') ? 'LOCKED' : 'Open'}</strong>
          </p>
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Freeze after N days (0 = off)</label>
            <input type="number" className="form-input" defaultValue={localStorage.getItem('fgsb_freeze_days') || '0'}
              onBlur={async e => {
              const v = Number(e.target.value) || 0;
              localStorage.setItem('fgsb_freeze_days', String(v));
              try {
                await fetch('/api/meta/freezeDays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ value: v }) });
              } catch (_) {}
              toast('Freeze days saved (server enforced)', 'success');
            }} />
          </div>
        </div>
      )}
    </div>
  );
}