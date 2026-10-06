import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, BarChart3, Clock, Search, X, Users, Package, FileText } from 'lucide-react';
import { getAllBills, getAllExpenses, getProfile, getAllWorkOrders } from '../store';
import { formatCurrency, getFYOptions, belongsToProfile } from '../utils';
import { toast } from './Toast';
import AuditReportView from './AuditReportView';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// v1.10.6 — audit L4: local copy removed, imported from utils above.

const getBillCurrency = (b) => b.currency || b.data?.invoiceOptions?.currency || 'INR';

export default function ReportsView() {
  const [bills, setBills] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('pl');
  const [filterMode, setFilterMode] = useState('fy');
  const [fyFilter, setFyFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [agingSearch, setAgingSearch] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('INR');

  const fyOptions = getFYOptions();
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) yearOptions.push(y);

  const loadData = async () => {
    try {
      const [billData, expData, prof, wos] = await Promise.all([
        getAllBills(), getAllExpenses(), getProfile().catch(() => null), getAllWorkOrders().catch(() => []),
      ]);
      setWorkOrders(wos || []);
      // v1.10.64 (#55) — reports are per business. Mixing two companies'
      // turnover into one profit figure is simply a wrong number.
      setBills((billData || []).filter(b => belongsToProfile(b, prof)));
      // v1.10.66 (#64) — expenses too. Filtering only the invoices left every
      // company's expenses in each company's profit and loss.
      setExpenses((expData || []).filter(e => belongsToProfile(e, prof)));
    } catch {
      toast('Failed to load data', 'error');
    }
  };

  useEffect(() => {
    const now = new Date();
    const fy = fyOptions[0];
    if (fy) setFyFilter(fy.value);
    setYearFilter(String(now.getFullYear()));
    setMonthFilter(String(now.getMonth()));
    loadData();
  }, []);

  const filterByPeriod = (date) => {
    if (!date) return false;
    if (filterMode === 'fy') {
      const fy = fyOptions.find(f => f.value === fyFilter);
      return fy ? date >= fy.from && date <= fy.to : true;
    } else {
      const d = new Date(date);
      return d.getFullYear() === parseInt(yearFilter) && d.getMonth() === parseInt(monthFilter);
    }
  };

  const allFilteredBills = bills.filter(bill => bill.data && filterByPeriod(bill.invoiceDate));
  // v1.10.1 — Filter expenses by the same currency as the P&L view.
  // Prior code left this unfiltered, so USD-invoice revenue got INR
  // expenses subtracted → nonsense net profit. Expenses without a
  // `currency` field are assumed INR (legacy records).
  const filteredExpenses = expenses.filter(exp =>
    filterByPeriod(exp.date) && ((exp.currency || 'INR') === currencyFilter));

  // All distinct currencies in the filtered period
  const allCurrencies = [...new Set(allFilteredBills.map(getBillCurrency))].sort();
  // Set currency filter to first available if current selection not in list
  useEffect(() => {
    if (allCurrencies.length > 0 && !allCurrencies.includes(currencyFilter)) {
      setCurrencyFilter(allCurrencies[0]);
    }
  }, [allCurrencies.join(',')]);

  // Bills for P&L — only selected currency
  const plBills = allFilteredBills.filter(b => getBillCurrency(b) === currencyFilter);

  // P&L
  const totalRevenue = plBills.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalTaxCollected = plBills.reduce((s, b) => s + (b.totalTaxAmount || 0), 0);
  const revenueExTax = totalRevenue - totalTaxCollected;
  const totalExpenseAmount = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalExpenseGST = filteredExpenses.reduce((s, e) => s + (e.gstAmount || 0), 0);
  const expenseExGST = totalExpenseAmount - totalExpenseGST;
  const netProfit = revenueExTax - expenseExGST;

  // Monthly breakdown — per selected currency
  const monthlyPL = {};
  plBills.forEach(b => {
    if (!b.invoiceDate) return;
    const key = b.invoiceDate.substring(0, 7);
    if (!monthlyPL[key]) monthlyPL[key] = { revenue: 0, tax: 0, expense: 0, expGst: 0 };
    monthlyPL[key].revenue += b.totalAmount || 0;
    monthlyPL[key].tax += b.totalTaxAmount || 0;
  });
  filteredExpenses.forEach(e => {
    if (!e.date) return;
    const key = e.date.substring(0, 7);
    if (!monthlyPL[key]) monthlyPL[key] = { revenue: 0, tax: 0, expense: 0, expGst: 0 };
    monthlyPL[key].expense += e.amount || 0;
    monthlyPL[key].expGst += e.gstAmount || 0;
  });
  const monthlyKeys = Object.keys(monthlyPL).sort();

  // ========== Outstanding & Aging ==========
  const today = new Date();
  // Aging: open tax / sales invoices only (not quotation, proforma, DC, converted, cancelled)
  const unpaidBills = bills.filter(b => {
    const st = String(b.status || '').toLowerCase();
    if (st === 'paid' || st === 'received' || st === 'cancelled' || st === 'converted') return false;
    const t = String(b.invoiceType || b.data?.invoiceType || b.type || '').toLowerCase();
    if (t.includes('quotation') || t.includes('proforma') || t.includes('challan') || t.includes('delivery')) return false;
    if (t.includes('credit')) return false;
    // tax-invoice, invoice, or empty type treated as sales
    const total = Number(b.totalAmount ?? b.data?.totals?.total ?? 0) || 0;
    const paid = Number(b.paidAmount ?? 0) || 0;
    return total - paid > 0.5;
  });
  const agingData = unpaidBills.map(b => {
    // Guard against missing or invalid dates — `new Date(undefined)` returns Invalid Date
    // which propagates as NaN through the aging math and breaks the chart.
    const dueDate = b.data?.details?.dueDate || b.invoiceDate;
    const due = dueDate ? new Date(dueDate) : null;
    const daysOverdue = (due && !isNaN(due.getTime()))
      ? Math.max(0, Math.floor((today - due) / 86400000))
      : 0;
    const outstanding = (Number(b.totalAmount ?? b.data?.totals?.total ?? 0) || 0) - (Number(b.paidAmount ?? 0) || 0);
    let bucket = 'notYetDue';
    if (daysOverdue > 90) bucket = '90plus';
    else if (daysOverdue > 60) bucket = '61to90';
    else if (daysOverdue > 30) bucket = '31to60';
    else if (daysOverdue > 0) bucket = '0to30';

    return {
      clientName: b.clientName || 'Unknown',
      invoiceNumber: b.invoiceNumber,
      invoiceDate: b.invoiceDate,
      dueDate,
      totalAmount: b.totalAmount || 0,
      paidAmount: b.paidAmount || 0,
      outstanding,
      daysOverdue,
      bucket,
      currency: getBillCurrency(b),
    };
  }).filter(r => r.outstanding > 0);

  const agingFiltered = agingSearch.trim()
    ? agingData.filter(r => r.clientName.toLowerCase().includes(agingSearch.toLowerCase()))
    : agingData;

  // Aging summary — group by currency
  const agingByCurrency = {};
  agingFiltered.forEach(r => {
    if (!agingByCurrency[r.currency]) agingByCurrency[r.currency] = { total: 0, notYetDue: 0, '0to30': 0, '31to60': 0, '61to90': 0, '90plus': 0 };
    agingByCurrency[r.currency].total += r.outstanding;
    agingByCurrency[r.currency][r.bucket] += r.outstanding;
  });
  // Keep INR-first ordering for display
  const agingCurrencies = Object.keys(agingByCurrency).sort((a, b) => a === 'INR' ? -1 : b === 'INR' ? 1 : a.localeCompare(b));

  const agingSorted = [...agingFiltered].sort((a, b) => b.daysOverdue - a.daysOverdue);

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Financial reports and receivables analysis</p>
        </div>
      </div>

      {/* Tab Selector — v1.9.5 adds Client + Product tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button className={`btn ${activeTab === 'pl' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('pl')}>
          <BarChart3 size={16} /> Profit & Loss
        </button>
        <button className={`btn ${activeTab === 'aging' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('aging')}>
          <Clock size={16} /> Outstanding & Aging
        </button>
        <button className={`btn ${activeTab === 'clients' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('clients')}>
          <Users size={16} /> Client Analytics
        </button>
        <button className={`btn ${activeTab === 'partyos' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('partyos')}>
          <Wallet size={16} /> Party Outstanding
        </button>
        <button className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('audit')}>
          <FileText size={16} /> Audit Report
        </button>
        <button className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('products')}>
          <Package size={16} /> Service / Product Performance
        </button>
      </div>


      {activeTab === 'pl' && (
        <>
          {/* Period + Currency Selector */}
          <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Filter By</label>
                <select className="form-input" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
                  <option value="fy">Fiscal Year</option>
                  <option value="month">Month / Year</option>
                </select>
              </div>
              {filterMode === 'fy' ? (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Fiscal Year</label>
                  <select className="form-input" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
                    {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
                  </select>
                </div>
              ) : (
                <>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Month</label>
                    <select className="form-input" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                      {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Year</label>
                    <select className="form-input" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                      {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </>
              )}
              {allCurrencies.length > 1 && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Currency</label>
                  <select className="form-input" value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)}>
                    {allCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* P&L Summary Cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-icon stat-icon-green"><TrendingUp size={22} /></div>
              <div><p className="stat-label">Revenue (ex. tax)</p><h2 className="stat-value stat-value-green">{formatCurrency(revenueExTax, currencyFilter)}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-purple"><TrendingDown size={22} /></div>
              <div><p className="stat-label">Expenses (ex. GST)</p><h2 className="stat-value stat-value-purple">{formatCurrency(expenseExGST, currencyFilter)}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: netProfit >= 0 ? 'var(--success-light)' : 'var(--danger-light)', color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                <Wallet size={22} />
              </div>
              <div>
                <p className="stat-label">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</p>
                <h2 className="stat-value" style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(Math.abs(netProfit), currencyFilter)}</h2>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-blue"><BarChart3 size={22} /></div>
              <div><p className="stat-label">Margin</p><h2 className="stat-value">{revenueExTax > 0 ? Math.round((netProfit / revenueExTax) * 100) : 0}%</h2></div>
            </div>
          </div>

          {/* P&L Statement */}
          <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
            <div className="table-header">
              <h3>Profit & Loss Statement</h3>
              {allCurrencies.length > 1 && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                  Showing {currencyFilter} invoices only
                </span>
              )}
            </div>
            <div style={{ padding: '1.5rem' }}>
              <table style={{ width: '100%', maxWidth: '500px', margin: '0 auto', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>Total Revenue</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalRevenue, currencyFilter)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>Less: GST Collected</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(totalTaxCollected, currencyFilter)}</td>
                  </tr>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 700 }}>Net Revenue</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(revenueExTax, currencyFilter)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>Total Expenses</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalExpenseAmount, currencyFilter)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>Less: GST on Expenses (ITC)</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', color: '#059669' }}>-{formatCurrency(totalExpenseGST, currencyFilter)}</td>
                  </tr>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 700 }}>Net Expenses</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(expenseExGST, currencyFilter)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '1rem 0', fontWeight: 800, fontSize: '1.1rem' }}>
                      Net {netProfit >= 0 ? 'Profit' : 'Loss'}
                    </td>
                    <td style={{ padding: '1rem 0', textAlign: 'right', fontWeight: 800, fontSize: '1.25rem', color: netProfit >= 0 ? '#059669' : '#dc2626' }}>
                      {formatCurrency(Math.abs(netProfit), currencyFilter)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly Breakdown */}
          {monthlyKeys.length > 0 && (
            <div className="glass-panel">
              <div className="table-header"><h3>Monthly Breakdown</h3></div>
              <div className="table-scroll">
                <table className="data-table" style={{ minWidth: '600px' }}>
                  <thead><tr>
                    <th>Month</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Expenses</th>
                    <th style={{ textAlign: 'right' }}>Profit/Loss</th>
                  </tr></thead>
                  <tbody>
                    {monthlyKeys.map(key => {
                      const m = monthlyPL[key];
                      const rev = m.revenue - m.tax;
                      const exp = m.expense - m.expGst;
                      const pl = rev - exp;
                      const [y, mo] = key.split('-');
                      return (
                        <tr key={key}>
                          <td className="font-medium">{MONTHS[parseInt(mo) - 1]} {y}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(rev, currencyFilter)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(exp, currencyFilter)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: pl >= 0 ? '#059669' : '#dc2626' }}>
                            {formatCurrency(Math.abs(pl), currencyFilter)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'aging' && (
        <>
          {/* Aging Summary Cards — per currency */}
          {agingCurrencies.map(cur => (
            <div key={cur} style={{ marginBottom: '1rem' }}>
              {agingCurrencies.length > 1 && (
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{cur}</p>
              )}
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-blue"><Wallet size={22} /></div>
                  <div><p className="stat-label">Total Outstanding</p><h2 className="stat-value">{formatCurrency(agingByCurrency[cur].total, cur)}</h2></div>
                </div>
                <div className="stat-card">
                  <div><p className="stat-label">Not yet due</p><h2 className="stat-value stat-value-green">{formatCurrency(agingByCurrency[cur].notYetDue || 0, cur)}</h2></div>
                  <div><p className="stat-label">0-30 overdue</p><h2 className="stat-value">{formatCurrency(agingByCurrency[cur]['0to30'] || 0, cur)}</h2></div>
                </div>
                <div className="stat-card">
                  <div><p className="stat-label">31-60 days</p><h2 className="stat-value stat-value-amber">{formatCurrency(agingByCurrency[cur]['31to60'], cur)}</h2></div>
                </div>
                <div className="stat-card">
                  <div><p className="stat-label">61-90 days</p><h2 className="stat-value stat-value-purple">{formatCurrency(agingByCurrency[cur]['61to90'], cur)}</h2></div>
                </div>
                <div className="stat-card">
                  <div><p className="stat-label">90+ days</p><h2 className="stat-value" style={{ color: '#dc2626' }}>{formatCurrency(agingByCurrency[cur]['90plus'], cur)}</h2></div>
                </div>
              </div>
            </div>
          ))}
          {agingCurrencies.length === 0 && (
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '1.5rem' }}>
              {['Total Outstanding', 'Current (0-30d)', '31-60 days', '61-90 days', '90+ days'].map(label => (
                <div key={label} className="stat-card">
                  <div><p className="stat-label">{label}</p><h2 className="stat-value">{formatCurrency(0)}</h2></div>
                </div>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="glass-panel p-4 mb-6" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
            <div className="search-box" style={{ maxWidth: '350px' }}>
              <Search size={16} className="search-icon" />
              <input type="text" placeholder="Filter by client name..." value={agingSearch}
                onChange={e => setAgingSearch(e.target.value)} className="search-input" />
              {agingSearch && <button className="icon-btn" onClick={() => setAgingSearch('')}><X size={14} /></button>}
            </div>
          </div>

          {/* Aging Table */}
          <div className="glass-panel">
            <div className="table-header"><h3>Outstanding Receivables</h3></div>
            {agingSorted.length === 0 ? (
              <div className="empty-state">
                <Wallet size={48} />
                <p>No outstanding receivables found.</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table" style={{ minWidth: '850px' }}>
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th>Due Date</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th style={{ textAlign: 'right' }}>Paid</th>
                      <th style={{ textAlign: 'right' }}>Outstanding</th>
                      <th style={{ textAlign: 'right' }}>Days Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agingSorted.map((r, i) => (
                      <tr key={i} className={r.daysOverdue > 90 ? 'row-overdue' : r.daysOverdue > 30 ? 'row-warning' : ''}>
                        <td className="font-medium">{r.clientName}</td>
                        <td><span className="invoice-badge">{r.invoiceNumber}</span></td>
                        <td className="text-muted">{r.invoiceDate ? new Date(r.invoiceDate).toLocaleDateString('en-IN') : '-'}</td>
                        <td className="text-muted">{r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-IN') : '-'}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.totalAmount, r.currency)}</td>
                        <td style={{ textAlign: 'right' }} className="text-muted">{r.paidAmount > 0 ? formatCurrency(r.paidAmount, r.currency) : '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(r.outstanding, r.currency)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{
                            padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                            background: r.daysOverdue > 90 ? 'rgba(220,38,38,0.15)' : r.daysOverdue > 60 ? 'rgba(139,92,246,0.15)' : r.daysOverdue > 30 ? 'rgba(217,119,6,0.15)' : 'rgba(5,150,105,0.15)',
                            color: r.daysOverdue > 90 ? '#dc2626' : r.daysOverdue > 60 ? '#8b5cf6' : r.daysOverdue > 30 ? '#d97706' : '#059669',
                          }}>
                            {r.daysOverdue === 0 ? 'Current' : `${r.daysOverdue}d`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* v1.9.5 — CLIENT ANALYTICS (revenue by client, aging, retention) */}
      {/* ============================================================ */}
      {activeTab === 'clients' && (() => {
        const filteredBills = allFilteredBills.filter(b => getBillCurrency(b) === currencyFilter);
        // Aggregate revenue + outstanding + count per client
        const byClient = {};
        filteredBills.forEach(b => {
          const name = b.clientName || '—';
          if (!byClient[name]) byClient[name] = { name, revenue: 0, paid: 0, outstanding: 0, count: 0, lastInvoiceDate: '' };
          byClient[name].revenue += (b.totalAmount || 0);
          byClient[name].paid += (b.paidAmount || 0);
          byClient[name].outstanding += Math.max(0, (b.totalAmount || 0) - (b.paidAmount || 0));
          byClient[name].count += 1;
          if (!byClient[name].lastInvoiceDate || b.invoiceDate > byClient[name].lastInvoiceDate) {
            byClient[name].lastInvoiceDate = b.invoiceDate;
          }
        });
        const clientArr = Object.values(byClient);
        const topByRevenue = [...clientArr].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
        const worstPayers = clientArr.filter(c => c.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).slice(0, 10);
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel report-card" style={{ padding: '1.25rem', background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12 }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>🏆 Top clients by revenue</h3>
              {topByRevenue.length === 0 ? <p className="text-muted">No client data for this period.</p> : (
                <table className="data-table" style={{ marginBottom: 0 }}>
                  <thead><tr><th>Client</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>Invoices</th></tr></thead>
                  <tbody>
                    {topByRevenue.map((c, i) => (
                      <tr key={i}>
                        <td className="font-medium">{c.name}</td>
                        <td style={{ textAlign: 'right', color: '#059669', fontWeight: 600 }}>{formatCurrency(c.revenue, currencyFilter)}</td>
                        <td style={{ textAlign: 'right' }}>{c.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="glass-panel report-card" style={{ padding: '1.25rem', background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12 }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>⚠️ Highest outstanding (worst payers)</h3>
              {worstPayers.length === 0 ? <p className="text-muted">Everyone is up to date. 🎉</p> : (
                <table className="data-table" style={{ marginBottom: 0 }}>
                  <thead><tr><th>Client</th><th style={{ textAlign: 'right' }}>Outstanding</th><th style={{ textAlign: 'right' }}>% Unpaid</th></tr></thead>
                  <tbody>
                    {worstPayers.map((c, i) => (
                      <tr key={i}>
                        <td className="font-medium">{c.name}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ display: 'inline-block', minWidth: 88, padding: '4px 8px', borderRadius: 6, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626', fontWeight: 700 }}>
                            {formatCurrency(c.outstanding, currencyFilter)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ display: 'inline-block', minWidth: 52, padding: '4px 8px', borderRadius: 6, background: 'var(--surface-2, #f3f4f6)', border: '1px solid var(--border)' }}>
                            {Math.round((c.outstanding / c.revenue) * 100)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem', gridColumn: '1 / -1' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>📊 All clients breakdown ({clientArr.length})</h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ marginBottom: 0 }}>
                  <thead><tr>
                    <th>Client</th>
                    <th style={{ textAlign: 'right' }}>Invoices</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Paid</th>
                    <th style={{ textAlign: 'right' }}>Outstanding</th>
                    <th>Last Invoice</th>
                  </tr></thead>
                  <tbody>
                    {clientArr.sort((a, b) => b.revenue - a.revenue).map((c, i) => (
                      <tr key={i}>
                        <td className="font-medium">{c.name}</td>
                        <td style={{ textAlign: 'right' }}>{c.count}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(c.revenue, currencyFilter)}</td>
                        <td style={{ textAlign: 'right', color: '#059669' }}>{formatCurrency(c.paid, currencyFilter)}</td>
                        <td style={{ textAlign: 'right', color: c.outstanding > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: c.outstanding > 0 ? 600 : 400 }}>
                          {c.outstanding > 0 ? formatCurrency(c.outstanding, currencyFilter) : '—'}
                        </td>
                        <td className="text-muted">{c.lastInvoiceDate ? new Date(c.lastInvoiceDate).toLocaleDateString('en-IN') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* v1.9.5 — PRODUCT PERFORMANCE (best sellers, revenue per SKU) */}
      {/* ============================================================ */}
      {activeTab === 'products' && (() => {
        /* Service-first report: line descriptions from invoices (not inventory-only) */
        const filteredBills = allFilteredBills.filter(b => getBillCurrency(b) === currencyFilter);
        // Aggregate quantity + revenue + last-sold per unique item name
        const byProduct = {};
        filteredBills.forEach(b => {
          (b.data?.items || []).forEach(item => {
            const name = (item.name || item.description || 'Unnamed').trim();
            if (!name || name === 'Unnamed') return;
            if (!byProduct[name]) byProduct[name] = { name, hsn: item.hsn || '', qty: 0, revenue: 0, txns: 0, lastSold: '' };
            const qty = Number(item.quantity) || 0;
            const rate = Number(item.rate) || 0;
            byProduct[name].qty += Math.round((Number(qty) || 0) * 1000) / 1000;
            byProduct[name].revenue += (qty * rate);
            byProduct[name].txns += 1;
            if (!byProduct[name].lastSold || b.invoiceDate > byProduct[name].lastSold) byProduct[name].lastSold = b.invoiceDate;
            if (item.hsn && !byProduct[name].hsn) byProduct[name].hsn = item.hsn;
          });
        });
        const productArr = Object.values(byProduct);
        const bestSellers = [...productArr].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
        const mostSoldByUnits = [...productArr].sort((a, b) => b.qty - a.qty).slice(0, 10);
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel report-card" style={{ padding: '1.25rem', background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12 }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>💰 Top revenue services</h3>
              {bestSellers.length === 0 ? <p className="text-muted">No product data for this period.</p> : (
                <table className="data-table" style={{ marginBottom: 0 }}>
                  <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>Qty sold</th></tr></thead>
                  <tbody>
                    {bestSellers.map((p, i) => (
                      <tr key={i}>
                        <td className="font-medium" title={p.hsn ? `HSN ${p.hsn}` : ''}>{p.name}</td>
                        <td style={{ textAlign: 'right', color: '#059669', fontWeight: 600 }}>{formatCurrency(p.revenue, currencyFilter)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(p.qty).toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="glass-panel report-card" style={{ padding: '1.25rem', background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12 }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>📦 Most billed units</h3>
              {mostSoldByUnits.length === 0 ? <p className="text-muted">No product data.</p> : (
                <table className="data-table" style={{ marginBottom: 0 }}>
                  <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Qty sold</th><th style={{ textAlign: 'right' }}>Txns</th></tr></thead>
                  <tbody>
                    {mostSoldByUnits.map((p, i) => (
                      <tr key={i}>
                        <td className="font-medium">{p.name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{Number(p.qty).toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{p.txns}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem', gridColumn: '1 / -1' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>📋 All services / items ({productArr.length})</h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ marginBottom: 0 }}>
                  <thead><tr>
                    <th>Product</th><th>HSN</th>
                    <th style={{ textAlign: 'right' }}>Qty sold</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Avg rate</th>
                    <th style={{ textAlign: 'right' }}>Txns</th>
                    <th>Last sold</th>
                  </tr></thead>
                  <tbody>
                    {productArr.sort((a, b) => b.revenue - a.revenue).map((p, i) => (
                      <tr key={i}>
                        <td className="font-medium">{p.name}</td>
                        <td className="text-muted" style={{ fontSize: '0.78rem' }}>{p.hsn || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{Number(p.qty).toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(p.revenue, currencyFilter)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{p.qty > 0 ? formatCurrency(p.revenue / p.qty, currencyFilter) : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{p.txns}</td>
                        <td className="text-muted">{p.lastSold ? new Date(p.lastSold).toLocaleDateString('en-IN') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {activeTab === 'partyos' && (() => {
        // Upstream 1.10.75 Party Outstanding: parties × months + Earlier + Total
        const useCalendar = filterMode === 'year' || filterMode === 'month';
        // Build 12-month columns: FY Apr–Mar or calendar Jan–Dec
        let yearStart, yearEnd, monthKeys = [];
        const now = new Date();
        if (!useCalendar && fyFilter) {
          // fy value like 2026-27
          const y1 = parseInt(String(fyFilter).slice(0, 4), 10) || now.getFullYear();
          yearStart = new Date(y1, 3, 1); // Apr 1
          yearEnd = new Date(y1 + 1, 2, 31, 23, 59, 59);
          for (let m = 3; m <= 11; m++) monthKeys.push({ y: y1, m, label: MONTHS[m].slice(0, 3) + ' ' + String(y1).slice(2) });
          for (let m = 0; m <= 2; m++) monthKeys.push({ y: y1 + 1, m, label: MONTHS[m].slice(0, 3) + ' ' + String(y1 + 1).slice(2) });
        } else {
          const y = parseInt(yearFilter, 10) || now.getFullYear();
          yearStart = new Date(y, 0, 1);
          yearEnd = new Date(y, 11, 31, 23, 59, 59);
          for (let m = 0; m < 12; m++) monthKeys.push({ y, m, label: MONTHS[m].slice(0, 3) });
        }
        const isSales = (b) => {
          const t = String(b.invoiceType || 'tax-invoice').toLowerCase();
          if (/quotation|proforma|delivery|challan|estimate/.test(t)) return false;
          if ((b.status || '') === 'cancelled') return false;
          return true;
        };
        const remaining = (b) => {
          const total = Number(b.totalAmount) || 0;
          const paid = Number(b.paidAmount) || 0;
          const rem = total - paid;
          // Credit notes reduce outstanding
          if (/credit/.test(String(b.invoiceType || '').toLowerCase())) return -Math.abs(total);
          return rem > 0.005 ? rem : 0;
        };
        const partyMap = {};
        bills.filter(isSales).forEach(b => {
          const name = b.clientName || b.data?.client?.name || 'Unknown';
          if (!partyMap[name]) {
            partyMap[name] = { name, earlier: 0, months: Object.fromEntries(monthKeys.map(k => [`${k.y}-${k.m}`, 0])), total: 0 };
          }
          const rem = remaining(b);
          if (Math.abs(rem) < 0.005) return;
          const d = new Date(b.invoiceDate || b.dueDate || b.createdAt);
          if (isNaN(d.getTime())) return;
          if (d < yearStart) {
            partyMap[name].earlier += rem;
          } else if (d <= yearEnd) {
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (partyMap[name].months[key] != null) partyMap[name].months[key] += rem;
            else partyMap[name].earlier += rem;
          }
        });
        Object.values(partyMap).forEach(p => {
          p.total = p.earlier + Object.values(p.months).reduce((s, v) => s + v, 0);
        });
        const rows = Object.values(partyMap).filter(p => Math.abs(p.total) > 0.5).sort((a, b) => b.total - a.total);
        const colTotals = { earlier: 0, total: 0, months: Object.fromEntries(monthKeys.map(k => [`${k.y}-${k.m}`, 0])) };
        rows.forEach(p => {
          colTotals.earlier += p.earlier;
          colTotals.total += p.total;
          monthKeys.forEach(k => { const key = `${k.y}-${k.m}`; colTotals.months[key] += p.months[key] || 0; });
        });

        const exportCsv = () => {
          const headers = ['Party', 'Earlier', ...monthKeys.map(k => k.label), 'Total'];
          const lines = [headers.join(',')];
          rows.forEach(p => {
            lines.push([
              `"${p.name.replace(/"/g, '""')}"`,
              p.earlier.toFixed(2),
              ...monthKeys.map(k => (p.months[`${k.y}-${k.m}`] || 0).toFixed(2)),
              p.total.toFixed(2),
            ].join(','));
          });
          const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `Party-Outstanding-${useCalendar ? yearFilter : fyFilter}.csv`;
          a.click();
        };

        const printPdf = () => {
          const w = window.open('', '_blank');
          if (!w) { toast('Pop-up blocked', 'warning'); return; }
          const th = monthKeys.map(k => `<th style="padding:4px;border:1px solid #333;font-size:10px">${k.label}</th>`).join('');
          const body = rows.map(p => `<tr>
            <td style="padding:4px;border:1px solid #333;text-align:left">${p.name}</td>
            <td style="padding:4px;border:1px solid #333;text-align:right">${p.earlier.toFixed(2)}</td>
            ${monthKeys.map(k => `<td style="padding:4px;border:1px solid #333;text-align:right">${(p.months[`${k.y}-${k.m}`]||0).toFixed(2)}</td>`).join('')}
            <td style="padding:4px;border:1px solid #333;text-align:right;font-weight:700">${p.total.toFixed(2)}</td>
          </tr>`).join('');
          w.document.write(`<!DOCTYPE html><html><head><title>Party Outstanding</title>
            <style>@page{size:A4 landscape;margin:10mm} body{font-family:system-ui,sans-serif;font-size:11px}</style></head><body>
            <h2>Party Outstanding — ${useCalendar ? 'Calendar ' + yearFilter : 'FY ' + fyFilter}</h2>
            <table style="border-collapse:collapse;width:100%"><thead><tr>
            <th style="padding:4px;border:1px solid #333">Party</th>
            <th style="padding:4px;border:1px solid #333">Earlier</th>${th}
            <th style="padding:4px;border:1px solid #333">Total</th>
            </tr></thead><tbody>${body}</tbody></table>
            <script>window.onload=()=>window.print()</script></body></html>`);
          w.document.close();
        };

        return (
          <div className="glass-panel p-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>Party Outstanding</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Unpaid balances by party × month. Use period filters above (FY = Apr–Mar; Year = calendar Jan–Dec).
                  <strong> Earlier</strong> = still unpaid from before this year.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={exportCsv}>Export CSV</button>
                <button type="button" className="btn btn-primary" onClick={printPdf}>Print / PDF</button>
              </div>
            </div>
            {rows.length === 0 ? (
              <p className="text-muted">No outstanding balances for this period.</p>
            ) : (
              <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Party</th>
                      <th style={{ textAlign: 'right' }}>Earlier</th>
                      {monthKeys.map(k => <th key={k.label} style={{ textAlign: 'right' }}>{k.label}</th>)}
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(p => (
                      <tr key={p.name}>
                        <td className="font-medium">{p.name}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(p.earlier, currencyFilter)}</td>
                        {monthKeys.map(k => (
                          <td key={k.label} style={{ textAlign: 'right' }}>{formatCurrency(p.months[`${k.y}-${k.m}`] || 0, currencyFilter)}</td>
                        ))}
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(p.total, currencyFilter)}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 700, background: 'var(--bg-secondary, #f8fafc)' }}>
                      <td>Total</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(colTotals.earlier, currencyFilter)}</td>
                      {monthKeys.map(k => (
                        <td key={k.label} style={{ textAlign: 'right' }}>{formatCurrency(colTotals.months[`${k.y}-${k.m}`] || 0, currencyFilter)}</td>
                      ))}
                      <td style={{ textAlign: 'right' }}>{formatCurrency(colTotals.total, currencyFilter)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}


      {activeTab === 'audit' && (
        <AuditReportView />
      )}

    </div>
  );
}
