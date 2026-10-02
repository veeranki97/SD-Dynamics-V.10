import { useState, useEffect, useMemo } from 'react';
import { getAllJournals, saveJournal } from '../store';
import { formatCurrency } from '../utils';
import {
  trialBalance, balanceSheet, computeTradingPnL, siteWisePnL,
  woWisePnL, costCenterWisePnL,
  periodCloseJournal, bankBalance, lockMonth, unlockMonth, isMonthLocked,
} from '../utils/ledger';
import { getAllBills, getAllExpenses, getAllWorkOrders } from '../store';
import { toast } from './Toast';
import { downloadCsv, printHtmlTable } from '../utils/exportData';

export default function FinancialBooksView() {
  const [journals, setJournals] = useState([]);
  const [billRows, setBillRows] = useState([]);
  const [expRows, setExpRows] = useState([]);
  const [woRows, setWoRows] = useState([]);
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

  const load = () => getAllJournals().then(setJournals).catch(() => toast('Failed to load journals', 'error'));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    getAllBills().then(setBillRows).catch(() => setBillRows([]));
    getAllExpenses().then(setExpRows).catch(() => setExpRows([]));
    getAllWorkOrders().then(setWoRows).catch(() => setWoRows([]));
  }, []);

  const tb = useMemo(() => trialBalance(journals, asOf), [journals, asOf]);
  const bs = useMemo(() => balanceSheet(journals, asOf), [journals, asOf]);
  const pnl = useMemo(() => computeTradingPnL(journals, from, asOf), [journals, from, asOf]);
  const sites = useMemo(() => {
    const fromJ = siteWisePnL(journals, from, asOf) || [];
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
  const wos = useMemo(() => (typeof woWisePnL === 'function' ? woWisePnL(journals, from, asOf) : []), [journals, from, asOf]);
  const ccs = useMemo(() => (typeof costCenterWisePnL === 'function' ? costCenterWisePnL(journals, from, asOf) : []), [journals, from, asOf]);
  const bank = useMemo(() => bankBalance(journals, 'Bank') + bankBalance(journals, 'Cash'), [journals]);

  const runPeriodClose = async () => {
    const j = periodCloseJournal(journals, asOf);
    if (!j) return toast('Nothing to close (P&L ~ 0)', 'info');
    if (!confirm(`Post period-close journal for ${asOf}? Net P&L: ${j.entries.debit || j.entries.credit}`)) return;
    try {
      await saveJournal(j);
      toast('Period close posted to Retained Earnings', 'success');
      load();
    } catch (e) {
      toast(e.message || 'Close failed', 'error');
    }
  };

  const tabs = [
    { id: 'tb', label: 'Trial Balance' },
    { id: 'bs', label: 'Balance Sheet' },
    { id: 'pnl', label: 'P&L' },
    { id: 'site', label: 'Site-wise P&L' },
    { id: 'wo', label: 'WO-wise P&L' },
    { id: 'cc', label: 'Cost Center P&L' },
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
            if (tab === 'tb') downloadCsv('trial-balance.csv', tb, ['account', 'debit', 'credit', 'balance']);
            else if (tab === 'pnl') downloadCsv('pnl.csv', [pnl], ['sales', 'purchases', 'expenses', 'grossProfit', 'netProfit']);
            else if (tab === 'site' || tab === 'wo') downloadCsv('site-pnl.csv', sites, ['site', 'income', 'expense', 'profit']);
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
            {wos.map(s => (
              <tr key={String(s.workOrderId)}>
                <td>{s.workOrderId}</td>
                <td className="text-end">{formatCurrency(s.income)}</td>
                <td className="text-end">{formatCurrency(s.expense)}</td>
                <td className="text-end" style={{ color: (s.net ?? 0) >= 0 ? '#059669' : '#dc2626', fontWeight: 600 }}>
                  {formatCurrency(s.net ?? 0)}
                </td>
              </tr>
            ))}
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
              {(ccs || []).map((r) => (
                <tr key={r.costCenter}>
                  <td>{r.costCenter}</td>
                  <td className="text-end">{formatCurrency(r.income)}</td>
                  <td className="text-end">{formatCurrency(r.expense)}</td>
                  <td className="text-end" style={{ fontWeight: 600, color: (r.profit || 0) >= 0 ? '#059669' : '#dc2626' }}>
                    {formatCurrency(r.profit)}
                  </td>
                </tr>
              ))}
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
              onBlur={e => { localStorage.setItem('fgsb_freeze_days', String(Number(e.target.value) || 0)); toast('Freeze days saved', 'success'); }} />
          </div>
        </div>
      )}

    </div>
  );
}


