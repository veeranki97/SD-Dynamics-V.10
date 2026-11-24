/**
 * Home metrics layout (no stock/catalog):
 * 1) 4 KPI cards
 * 2) Aging | Payment status | GST  (3-col)
 * 3) Top clients | Top sites | Sales by state  (3-col)
 * 4) Sales / purchases / receipts  (full width)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { IndianRupee, Clock, AlertTriangle, CalendarDays } from 'lucide-react';
import { isRevenueDocument } from '../utils/revenueFilter';
import { getChartPrefs, chartColor } from '../utils/chartPrefs';

function compactInr(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e7) {
    const x = abs / 1e7;
    return sign + '₹' + (x >= 10 ? x.toFixed(1) : x.toFixed(2)).replace(/\.?0+$/, '') + 'Cr';
  }
  if (abs >= 1e5) {
    const x = abs / 1e5;
    return sign + '₹' + x.toFixed(1).replace(/\.0$/, '') + 'L';
  }
  if (abs >= 1e3) {
    const x = abs / 1e3;
    return sign + '₹' + (x >= 100 ? Math.round(x) : x.toFixed(1)).replace(/\.0$/, '') + 'K';
  }
  return sign + '₹' + Math.round(abs).toLocaleString('en-IN');
}

function monthLabel(ym) {
  if (!ym || ym.length < 7) return ym || '';
  const [y, m] = ym.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return (names[(m || 1) - 1] || m) + ' ' + String(y).slice(2);
}

function normalizeChartType(raw, fallback = 'bar') {
  const t = String(raw || fallback).toLowerCase();
  if (t === 'area') return { type: 'line', isArea: true, isHoriz: false, isStacked: false };
  if (t === 'horizontalbar') return { type: 'bar', isArea: false, isHoriz: true, isStacked: false };
  if (t === 'stacked') return { type: 'bar', isArea: false, isHoriz: false, isStacked: true };
  if (['line', 'bar', 'pie', 'doughnut'].includes(t)) {
    return { type: t, isArea: false, isHoriz: false, isStacked: false };
  }
  return { type: fallback, isArea: false, isHoriz: false, isStacked: false };
}

function getCurrentFyBounds() {
  const now = new Date();
  const y = now.getFullYear();
  const fyStartYear = now.getMonth() >= 3 ? y : y - 1;
  return {
    from: `${fyStartYear}-04`,
    to: `${fyStartYear + 1}-03`,
    label: `FY ${String(fyStartYear).slice(-2)}-${String(fyStartYear + 1).slice(-2)}`,
  };
}

export default function DashboardHomeLayout({ bills = [], purchases = [], stats = {}, onFilterInvoices }) {
  const [prefs, setPrefs] = useState(() => getChartPrefs());
  const [prefsTick, setPrefsTick] = useState(0);

  useEffect(() => {
    const bump = () => {
      setPrefs(getChartPrefs());
      setPrefsTick((n) => n + 1);
    };
    window.addEventListener('sd-chart-prefs-changed', bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener('sd-chart-prefs-changed', bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  const agingRef = useRef(null);
  const donutRef = useRef(null);
  const gstRef = useRef(null);
  const clientsRef = useRef(null);
  const sitesRef = useRef(null);
  const stateRef = useRef(null);
  const trendRef = useRef(null);
  const chartsRef = useRef([]);

  const dateRange = prefs.dateRange || '12M';

  const snap = useMemo(() => {
    const list = Array.isArray(bills) ? bills : [];
    let netSales = 0, outstanding = 0, overdueAmt = 0, overdueCount = 0;
    let activeSales = 0, awaiting = 0, monthSales = 0, monthReceived = 0;
    let paidC = 0, partialC = 0, unpaidC = 0;
    const byMonthSales = {};
    const byMonthPurch = {};
    const byMonthRecv = {};
    const byMonthGst = {};
    let gstC = 0, gstS = 0, gstI = 0;
    const ymNow = new Date().toISOString().slice(0, 7);
	const prevDate = new Date();
	prevDate.setMonth(prevDate.getMonth() - 1);
	const ymPrev = prevDate.toISOString().slice(0, 7);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const b of list) {
      if (!b || b.isDeleted || b.deleted) continue;
      const st = String(b.status || '').toLowerCase();
      if (st === 'cancelled') continue;
      if (!isRevenueDocument(b)) continue;

      const total = Number(b.totalAmount) || 0;
      const paid = Number(b.paidAmount) || 0;
      const bal = Math.max(0, total - paid);
      netSales += total;
      outstanding += bal;
      activeSales += 1;
      if (bal > 0.5) awaiting += 1;

      if (st === 'paid' || bal <= 0.5) paidC += 1;
      else if (paid > 0.5) partialC += 1;
      else unpaidC += 1;

      const due = b.data?.details?.dueDate || b.dueDate;
      const dueD = due ? new Date(due) : null;
      if (dueD && !Number.isNaN(dueD.getTime())) {
        dueD.setHours(0, 0, 0, 0);
        if (bal > 0.5 && dueD < today) {
          overdueAmt += bal;
          overdueCount += 1;
        }
      } else if (st === 'overdue' && bal > 0.5) {
        overdueAmt += bal;
        overdueCount += 1;
      }

      const idate = String(b.data?.details?.invoiceDate || b.invoiceDate || '').slice(0, 7);
      if (idate) byMonthSales[idate] = (byMonthSales[idate] || 0) + total;
      if (idate === ymNow) monthSales += total;

      const t = b.data?.totals || {};
      let c = Number(t.cgst) || 0;
      let s = Number(t.sgst) || Number(t.utgst) || 0;
      let ig = Number(t.igst) || 0;
      if (!c && !s && !ig && b.totalTaxAmount) ig = Number(b.totalTaxAmount) || 0;
      gstC += c;
      gstS += s;
      gstI += ig;
      if (idate) {
        if (!byMonthGst[idate]) byMonthGst[idate] = { c: 0, s: 0, i: 0 };
        byMonthGst[idate].c += c;
        byMonthGst[idate].s += s;
        byMonthGst[idate].i += ig;
      }

      const pays = Array.isArray(b.payments) ? b.payments : [];
      if (pays.length) {
        for (const p of pays) {
          const pm = String(p.date || p.paidAt || p.recordedAt || '').slice(0, 7);
          const amt = Number(p.amount) || 0;
          if (pm) byMonthRecv[pm] = (byMonthRecv[pm] || 0) + amt;
          if (pm === ymNow) monthReceived += amt;
        }
      } else if (paid > 0 && idate) {
        byMonthRecv[idate] = (byMonthRecv[idate] || 0) + paid;
        if (idate === ymNow) monthReceived += paid;
      }
    }

    for (const p of purchases || []) {
      if (!p || String(p.status || '').toLowerCase() === 'cancelled') continue;
      const d = String(p.date || p.billDate || p.invoiceDate || '').slice(0, 7);
      const amt = Number(p.totalAmount ?? p.grandTotal ?? p.amount ?? 0) || 0;
      if (d) byMonthPurch[d] = (byMonthPurch[d] || 0) + amt;
    }

    let allKeys = Array.from(new Set([
      ...Object.keys(byMonthSales),
      ...Object.keys(byMonthPurch),
      ...Object.keys(byMonthRecv),
      ...Object.keys(byMonthGst),
    ])).sort();

    let rangeLabel = 'Last 12 months';
    if (dateRange === '3M') {
      allKeys = allKeys.slice(-3);
      rangeLabel = 'Last 3 months';
    } else if (dateRange === '6M') {
      allKeys = allKeys.slice(-6);
      rangeLabel = 'Last 6 months';
    } else if (dateRange === 'FY') {
      const fy = getCurrentFyBounds();
      allKeys = allKeys.filter((k) => k >= fy.from && k <= fy.to);
      rangeLabel = fy.label;
    } else {
      allKeys = allKeys.slice(-12);
    }

    const avgInvoice = activeSales > 0 ? netSales / activeSales : 0;
	const prevMonthSales = byMonthSales[ymPrev] || 0;
	const momPct = prevMonthSales > 0
	? ((monthSales - prevMonthSales) / prevMonthSales) * 100
	: (monthSales > 0 ? 100 : 0);

    // Prefer parent stats for aging / breakdown charts when provided
    const aging = stats.aging || { notDue: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
    const topClients = Array.isArray(stats.topClients) ? stats.topClients : [];
    const topSites = Array.isArray(stats.topSites) ? stats.topSites : [];
    const salesByState = Array.isArray(stats.salesByState) ? stats.salesByState : [];

    return {
      netSales, outstanding, overdueAmt, overdueCount, activeSales, awaiting,
      monthSales, monthReceived, paidC, partialC, unpaidC, avgInvoice,momPct,
      gstC, gstS, gstI, rangeLabel,
      labels: allKeys.map(monthLabel),
      sales: allKeys.map((k) => byMonthSales[k] || 0),
      purch: allKeys.map((k) => byMonthPurch[k] || 0),
      recv: allKeys.map((k) => byMonthRecv[k] || 0),
      gstCgm: allKeys.map((k) => byMonthGst[k]?.c || 0),
      gstSgm: allKeys.map((k) => byMonthGst[k]?.s || 0),
      gstIgm: allKeys.map((k) => byMonthGst[k]?.i || 0),
      aging, topClients, topSites, salesByState,
    };
  }, [bills, purchases, stats, dateRange]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Chart, registerables } = await import('chart.js');
        if (cancelled) return;
        Chart.register(...registerables);
        chartsRef.current.forEach((c) => { try { c.destroy(); } catch { /* */ } });
        chartsRef.current = [];

        const mk = (canvas, cfg) => {
          if (!canvas) return;
          const existing = Chart.getChart(canvas);
          if (existing) existing.destroy();
          chartsRef.current.push(new Chart(canvas, cfg));
        };

        const base = { responsive: true, maintainAspectRatio: false };
        const p = getChartPrefs() || {};
        const showAging = p.showAging !== false;
        const showPayment = p.showPaymentStatus !== false;
        const showGst = p.showGstBreakdown !== false;
        const showClients = p.showTopClients !== false;
        const showSites = p.showTopSites !== false;
        const showState = p.showSalesByState !== false;
        const showTrend = p.showSalesTrend !== false;

        const agingType = String(p.agingChart || p.aging?.type || 'doughnut').toLowerCase();
        const paymentType = String(p.paymentChart || 'doughnut').toLowerCase();
        const gstType = String(p.gstBreakdown?.type || p.gstChart || 'bar').toLowerCase();
        const clientsType = String(p.clientsChart || p.topClients?.type || 'bar').toLowerCase();
        const sitesType = String(p.topSites?.type || p.sitesChart || 'doughnut').toLowerCase();
        const stateType = String(p.salesByState?.type || p.stateChart || 'horizontalBar').toLowerCase();
        const salesType = String(p.salesChart || p.salesTrend?.type || 'combo').toLowerCase();

        const legendPos = p.legendPosition || 'right';
        const isSideLegend = legendPos === 'right';
        const RADIAL_RADIUS = isSideLegend ? '88%' : '76%';
        const RADIAL_CUTOUT = '64%';

        const radialLegend = {
          display: true,
          position: legendPos,
          align: 'center',
          labels: {
            boxWidth: 9,
            boxHeight: 9,
            padding: isSideLegend ? 10 : 8,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 11 },
          },
        };

        const themeColor = chartColor(p.theme || 'blue') || '#3b82f6';
        const multiColors = [
          chartColor('blue') || '#3b82f6',
          chartColor('green') || '#10b981',
          chartColor('amber') || '#f59e0b',
          chartColor('purple') || '#8b5cf6',
          chartColor('red') || '#ef4444',
          chartColor('cyan') || '#06b6d4',
        ];

        // 1) Aging
        const a = snap.aging || {};
        const agingCfg = normalizeChartType(agingType, 'doughnut');
        const agingIsRadial = agingCfg.type === 'pie' || agingCfg.type === 'doughnut';
        if (showAging) mk(agingRef.current, {
          type: agingCfg.type,
          data: {
            labels: ['Not Due', '0-30d', '31-60d', '61-90d', '90d+'],
            datasets: [{
              label: 'Outstanding',
              data: [
                Number(a.notDue) || 0,
                Number(a.d0_30) || 0,
                Number(a.d31_60) || 0,
                Number(a.d61_90) || 0,
                Number(a.d90p) || 0,
              ],
              backgroundColor: multiColors.slice(0, 5),
              borderColor: agingCfg.type === 'line' ? themeColor : undefined,
              fill: agingCfg.isArea,
              borderWidth: agingIsRadial ? 0 : 2,
              borderRadius: agingCfg.type === 'bar' ? 4 : undefined,
            }],
          },
          options: {
            ...base,
            indexAxis: agingCfg.isHoriz ? 'y' : 'x',
            radius: agingIsRadial ? RADIAL_RADIUS : undefined,
            cutout: agingCfg.type === 'doughnut' ? RADIAL_CUTOUT : undefined,
            plugins: {
              legend: agingIsRadial ? radialLegend : { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.label}: ${compactInr(ctx.raw)}`,
                },
              },
            },
            scales: agingIsRadial ? undefined : {
              [agingCfg.isHoriz ? 'x' : 'y']: {
                beginAtZero: true,
                ticks: { callback: (v) => compactInr(v), font: { size: 10 } },
                grid: { color: 'rgba(148,163,184,0.2)' },
              },
              [agingCfg.isHoriz ? 'y' : 'x']: {
                grid: { display: false },
                ticks: { font: { size: 10 } },
              },
            },
          },
        });

        // 2) Payment status
        const payCfg = normalizeChartType(paymentType, 'doughnut');
        const payIsRadial = payCfg.type === 'pie' || payCfg.type === 'doughnut';
        const payUseSideLegend = payIsRadial && isSideLegend;
        if (showPayment) mk(donutRef.current, {
          type: payCfg.type,
          data: {
            labels: [
              `Paid (${snap.paidC})`,
              `Partial (${snap.partialC})`,
              `Unpaid (${snap.unpaidC})`,
            ],
            datasets: [{
              label: 'Invoices',
              data: [snap.paidC, snap.partialC, snap.unpaidC],
              backgroundColor: ['#0f766e', '#b45309', '#e11d48'],
              borderWidth: 0,
              borderRadius: payCfg.type === 'bar' ? 4 : undefined,
            }],
          },
          options: {
            ...base,
            radius: payIsRadial ? (payUseSideLegend ? '88%' : '92%') : undefined,
            cutout: payCfg.type === 'doughnut' ? RADIAL_CUTOUT : undefined,
            plugins: {
              legend: payUseSideLegend ? radialLegend : { display: false },
            },
            scales: payIsRadial ? undefined : {
              y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } },
              x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            },
          },
        });

        // 3) GST breakdown
        const gstCfg = normalizeChartType(gstType, 'bar');
        const gstIsRadial = gstCfg.type === 'pie' || gstCfg.type === 'doughnut';
        const gstStack = (gstCfg.isStacked || gstType === 'bar') ? 'g' : undefined;
        if (showGst) mk(gstRef.current, gstIsRadial ? {
          type: gstCfg.type,
          data: {
            labels: ['IGST', 'CGST', 'SGST'],
            datasets: [{
              data: [snap.gstI, snap.gstC, snap.gstS],
              backgroundColor: ['rgba(124,58,237,0.85)', 'rgba(37,99,235,0.8)', 'rgba(5,150,105,0.8)'],
              borderWidth: 0,
            }],
          },
          options: {
            ...base,
            radius: RADIAL_RADIUS,
            cutout: gstCfg.type === 'doughnut' ? RADIAL_CUTOUT : undefined,
            plugins: {
              legend: radialLegend,
              tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${compactInr(ctx.raw)}` } },
            },
          },
        } : {
          type: gstCfg.type,
          data: {
            labels: snap.labels.length ? snap.labels : ['—'],
            datasets: [
              { label: 'IGST', data: snap.gstIgm.length ? snap.gstIgm : [0], backgroundColor: 'rgba(124,58,237,0.85)', borderColor: '#7c3aed', borderRadius: 3, stack: gstStack, fill: gstCfg.isArea },
              { label: 'CGST', data: snap.gstCgm.length ? snap.gstCgm : [0], backgroundColor: 'rgba(37,99,235,0.8)', borderColor: '#2563eb', borderRadius: 3, stack: gstStack, fill: gstCfg.isArea },
              { label: 'SGST', data: snap.gstSgm.length ? snap.gstSgm : [0], backgroundColor: 'rgba(5,150,105,0.8)', borderColor: '#059669', borderRadius: 3, stack: gstStack, fill: gstCfg.isArea },
            ],
          },
          options: {
            ...base,
            indexAxis: gstCfg.isHoriz ? 'y' : 'x',
            plugins: {
			legend: { position: legendPos, labels: { boxWidth: 8, font: { size: 10 } } },
			tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${compactInr(ctx.raw)}` } },
				},
            scales: {
              x: { stacked: Boolean(gstStack), grid: { display: false }, ticks: { font: { size: 10 } } },
              y: { stacked: Boolean(gstStack), ticks: { callback: (v) => compactInr(v), font: { size: 10 } }, grid: { color: 'rgba(148,163,184,0.2)' } },
            },
          },
        });

        // 4) Top clients
        const tc = snap.topClients || [];
        const clientCfg = normalizeChartType(clientsType, 'bar');
        const clientIsRadial = clientCfg.type === 'pie' || clientCfg.type === 'doughnut';
        if (showClients) mk(clientsRef.current, {
          type: clientCfg.type,
          data: {
            labels: tc.length ? tc.map((x) => x.name || '—') : ['No data'],
            datasets: [{
              label: 'Billed',
              data: tc.length ? tc.map((x) => Number(x.amount) || 0) : [0],
              backgroundColor: clientIsRadial
                ? (tc.length ? tc.map((_, i) => multiColors[i % multiColors.length]) : ['#e2e8f0'])
                : themeColor,
              borderWidth: clientIsRadial ? 0 : undefined,
              borderRadius: clientCfg.type === 'bar' ? 4 : undefined,
            }],
          },
          options: {
            ...base,
            indexAxis: clientCfg.isHoriz ? 'y' : 'x',
            radius: clientIsRadial ? RADIAL_RADIUS : undefined,
            cutout: clientCfg.type === 'doughnut' ? RADIAL_CUTOUT : undefined,
            plugins: {
              legend: clientIsRadial ? radialLegend : { display: false },
              tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${compactInr(ctx.raw)}` } },
            },
            scales: clientIsRadial ? undefined : {
              [clientCfg.isHoriz ? 'x' : 'y']: { beginAtZero: true, ticks: { callback: (v) => compactInr(v), font: { size: 10 } } },
              [clientCfg.isHoriz ? 'y' : 'x']: { ticks: { font: { size: 10 } } },
            },
          },
        });

        // 5) Top sites
        const ts = snap.topSites || [];
        const siteCfg = normalizeChartType(sitesType, 'doughnut');
        const siteIsRadial = siteCfg.type === 'pie' || siteCfg.type === 'doughnut';
        if (showSites) mk(sitesRef.current, {
          type: siteCfg.type,
          data: {
            labels: ts.length ? ts.map((x) => x.name || '—') : ['No data'],
            datasets: [{
              label: 'Revenue',
              data: ts.length ? ts.map((x) => Number(x.amount) || 0) : [siteIsRadial ? 1 : 0],
              backgroundColor: ts.length
                ? (siteIsRadial ? ts.map((_, i) => multiColors[i % multiColors.length]) : themeColor)
                : ['#e2e8f0'],
              borderWidth: siteIsRadial ? 0 : undefined,
              borderRadius: siteCfg.type === 'bar' ? 4 : undefined,
            }],
          },
          options: {
            ...base,
            indexAxis: siteCfg.isHoriz ? 'y' : 'x',
            radius: siteIsRadial ? RADIAL_RADIUS : undefined,
            cutout: siteCfg.type === 'doughnut' ? RADIAL_CUTOUT : undefined,
            plugins: {
              legend: siteIsRadial ? radialLegend : { display: false },
              tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${compactInr(ctx.raw)}` } },
            },
            scales: siteIsRadial ? undefined : {
              [siteCfg.isHoriz ? 'x' : 'y']: { beginAtZero: true, ticks: { callback: (v) => compactInr(v), font: { size: 10 } } },
              [siteCfg.isHoriz ? 'y' : 'x']: { ticks: { font: { size: 10 } } },
            },
          },
        });

        // 6) Sales by state
        const ss = snap.salesByState || [];
        const stateCfg = normalizeChartType(stateType, 'horizontalBar');
        const stateIsRadial = stateCfg.type === 'pie' || stateCfg.type === 'doughnut';
        if (showState) mk(stateRef.current, {
          type: stateCfg.type,
          data: {
            labels: ss.length ? ss.map((x) => x.name || '—') : ['No data'],
            datasets: [{
              label: 'Sales',
              data: ss.length ? ss.map((x) => Number(x.amount) || 0) : [stateIsRadial ? 1 : 0],
              backgroundColor: ss.length
                ? (stateIsRadial ? ss.map((_, i) => multiColors[i % multiColors.length]) : (chartColor(p.theme || 'purple') || '#8b5cf6'))
                : ['#e2e8f0'],
              borderWidth: stateIsRadial ? 0 : undefined,
              borderRadius: stateCfg.type === 'bar' ? 4 : undefined,
            }],
          },
          options: {
            ...base,
            indexAxis: stateCfg.isHoriz ? 'y' : 'x',
            radius: stateIsRadial ? RADIAL_RADIUS : undefined,
            cutout: stateCfg.type === 'doughnut' ? RADIAL_CUTOUT : undefined,
            plugins: {
              legend: stateIsRadial ? radialLegend : { display: false },
              tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${compactInr(ctx.raw)}` } },
            },
            scales: stateIsRadial ? undefined : {
              [stateCfg.isHoriz ? 'x' : 'y']: { beginAtZero: true, ticks: { callback: (v) => compactInr(v), font: { size: 10 } } },
              [stateCfg.isHoriz ? 'y' : 'x']: { ticks: { font: { size: 10 } } },
            },
          },
        });

        // 7) Full-width trend
        const trendCfg = normalizeChartType(salesType, 'bar');
        const receiptsIsBar = trendCfg.type === 'line';
        if (showTrend) mk(trendRef.current, {
          type: trendCfg.type,
          data: {
            labels: snap.labels.length ? snap.labels : ['—'],
            datasets: [
              {
                label: 'Sales',
                data: snap.sales,
                borderColor: '#0f766e',
                backgroundColor: trendCfg.isArea ? 'rgba(15,118,110,0.22)' : 'rgba(15,118,110,0.85)',
                fill: trendCfg.isArea,
                tension: 0.35,
                pointRadius: trendCfg.type === 'line' ? 3 : 0,
                borderWidth: trendCfg.type === 'line' ? 2.5 : 0,
                borderRadius: trendCfg.type === 'bar' ? 5 : 0,
                order: 2,
              },
              {
                label: 'Purchases',
                data: snap.purch,
                borderColor: '#3b82f6',
                backgroundColor: trendCfg.isArea ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.5)',
                fill: trendCfg.isArea,
                tension: 0.35,
                pointRadius: trendCfg.type === 'line' ? 3 : 0,
                borderWidth: trendCfg.type === 'line' ? 2.5 : 0,
                borderRadius: trendCfg.type === 'bar' ? 5 : 0,
                order: 3,
              },
              {
                type: receiptsIsBar ? 'bar' : 'line',
                label: 'Receipts',
                data: snap.recv,
                borderColor: '#b45309',
                backgroundColor: receiptsIsBar ? 'rgba(180,83,9,0.28)' : 'rgba(180,83,9,0.12)',
                borderRadius: receiptsIsBar ? 5 : 0,
                tension: 0.35,
                pointRadius: receiptsIsBar ? 0 : 3.5,
                borderWidth: receiptsIsBar ? 0 : 2.5,
                order: 1,
              },
            ],
          },
          options: {
            ...base,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 11 }, usePointStyle: true } },
              tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${compactInr(ctx.raw)}` } },
            },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 11 } } },
              y: { ticks: { callback: (v) => compactInr(v), font: { size: 10 } }, grid: { color: 'rgba(148,163,184,0.2)' } },
            },
          },
        });
      } catch (e) {
        console.warn('DashboardHomeLayout charts', e);
      }
    })();
    return () => {
      cancelled = true;
      chartsRef.current.forEach((c) => { try { c.destroy(); } catch { /* */ } });
      chartsRef.current = [];
    };
  }, [snap, prefsTick]);

  const go = (statusFilter) => {
    if (typeof onFilterInvoices === 'function') {
      onFilterInvoices({ typeFilter: 'tax-invoice', statusFilter });
    } else {
      try {
        sessionStorage.setItem('sd_invoice_list_filters', JSON.stringify({ typeFilter: 'tax-invoice', statusFilter }));
        sessionStorage.setItem('gst_currentView', 'invoices');
        window.dispatchEvent(new CustomEvent('sd-navigate', { detail: 'invoices' }));
      } catch { /* */ }
    }
  };

  const totalInv = snap.paidC + snap.partialC + snap.unpaidC;
  const paymentIsBar = String(prefs.paymentChart || 'doughnut').toLowerCase() === 'bar';

  const kpis = [
    {
      label: 'Net sales',
      value: compactInr(snap.netSales),
      sub: `${snap.activeSales} active sales invoices.`,
      icon: IndianRupee,
      iconBg: 'rgba(15, 118, 110, 0.12)',
      iconColor: '#0f766e',
      onClick: () => go('all'),
    },
    {
      label: 'Outstanding',
      value: compactInr(snap.outstanding),
      sub: `${snap.awaiting} invoices awaiting payment.`,
      icon: Clock,
      iconBg: 'rgba(245, 158, 11, 0.14)',
      iconColor: '#d97706',
      onClick: () => go('unpaid'),
    },
    {
      label: 'Overdue',
      value: compactInr(snap.overdueAmt),
      sub: `${snap.overdueCount} invoices past their due date.`,
      icon: AlertTriangle,
      iconBg: 'rgba(225, 29, 72, 0.12)',
      iconColor: '#e11d48',
      danger: true,
      onClick: () => go('overdue'),
    },
    {
      label: 'This month',
      value: compactInr(snap.monthSales),
      sub: `${compactInr(snap.monthReceived)} received · ${snap.momPct >= 0 ? '+' : ''}${Math.round(snap.momPct)}% vs last mo`,
      icon: CalendarDays,
      iconBg: 'rgba(37, 99, 235, 0.12)',
      iconColor: '#2563eb',
      onClick: () => go('all'),
    },
  ];

  const panel = (title, sub, body) => (
    <div className="sd-panel">
      <div className="sd-panel-kicker">{title}</div>
      {sub ? <div className="sd-panel-title">{sub}</div> : null}
      {body}
    </div>
  );

  return (
    <div className="sd-home-layout">
      <style>{`
        .sd-home-layout { width: 100%; margin-bottom: 1.25rem; }
        .sd-kpi-premium {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }
        .sd-row-3 {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 14px;
        }
        .sd-row-1 { margin-bottom: 14px; }
        @media (max-width: 1100px) {
          .sd-row-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 960px) {
          .sd-kpi-premium { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .sd-kpi-premium, .sd-row-3 { grid-template-columns: 1fr; }
        }
        .sd-kpi-card {
          background: var(--card, #fff);
          border: 1px solid var(--border, #e8eef5);
          border-radius: 16px;
          padding: 18px 16px 16px;
          text-align: center;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(15,23,42,0.04);
          transition: border-color .15s, box-shadow .15s;
        }
        .sd-kpi-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 12px rgba(15,23,42,0.06);
        }
        .sd-kpi-icon {
          width: 36px; height: 36px; border-radius: 10px;
          display: inline-flex; align-items: center; justify-content: center;
          margin: 0 auto 10px;
        }
        .sd-kpi-label {
          font-size: 11px; font-weight: 700; letter-spacing: .07em;
          text-transform: uppercase; color: #64748b; margin: 0 0 6px;
        }
        .sd-kpi-value {
          font-size: 1.65rem; font-weight: 800; letter-spacing: -.03em;
          line-height: 1.15; color: var(--text, #0f172a); margin: 0 0 6px;
        }
        .sd-kpi-value.danger { color: #e11d48; }
        .sd-kpi-sub { font-size: 12px; color: #64748b; line-height: 1.35; margin: 0; }
        .sd-panel {
          background: var(--card, #fff);
          border: 1px solid var(--border, #e8eef5);
          border-radius: 16px;
          padding: 14px 16px;
          box-shadow: 0 1px 2px rgba(15,23,42,0.04);
          min-height: 280px;
        }
        .sd-panel-kicker {
          font-size: 10px; font-weight: 700; letter-spacing: .08em;
          text-transform: uppercase; color: #64748b;
        }
        .sd-panel-title {
          font-size: .92rem; font-weight: 700; color: var(--text, #0f172a); margin: 2px 0 8px;
        }
        .sd-chart-box { height: 210px; position: relative; }
        .sd-chart-box-lg { height: 240px; position: relative; }
      `}</style>

      {/* 1) KPIs */}
      <div className="sd-kpi-premium">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <button key={k.label} type="button" className="sd-kpi-card" onClick={k.onClick}>
              <div className="sd-kpi-icon" style={{ background: k.iconBg, color: k.iconColor }}>
                <Icon size={18} />
              </div>
              <p className="sd-kpi-label">{k.label}</p>
              <p className={`sd-kpi-value${k.danger ? ' danger' : ''}`}>{k.value}</p>
              <p className="sd-kpi-sub">{k.sub}</p>
            </button>
          );
        })}
      </div>

      {/* 2) Aging | Payment | GST */}
      <div className="sd-row-3">
        {prefs.showAging !== false && panel('Receivables', 'Aging by due date', (
          <div className="sd-chart-box"><canvas ref={agingRef} /></div>
        ))}
        {prefs.showPaymentStatus !== false && panel('Receivables', 'Payment status', (() => {
          const sideMode = (prefs.legendPosition || 'right') === 'right' && !paymentIsBar;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: (paymentIsBar || sideMode) ? '100%' : 142,
                height: sideMode ? 182 : 142,
                position: 'relative',
              }}>
                <canvas ref={donutRef} />
                {!paymentIsBar && !sideMode && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{totalInv}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>INVOICES</div>
                  </div>
                )}
              </div>
              <div style={{ width: '100%', fontSize: 12, marginTop: 8 }}>
                {!sideMode && [
                  { label: 'Paid', n: snap.paidC, color: '#0f766e' },
                  { label: 'Partial', n: snap.partialC, color: '#b45309' },
                  { label: 'Unpaid', n: snap.unpaidC, color: '#e11d48' },
                ].map((r) => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569' }}>
                      <span style={{ width: 7, height: 7, borderRadius: 99, background: r.color }} />
                      {r.label}
                    </span>
                    <strong>{r.n}</strong>
                  </div>
                ))}
                <div style={{
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: '1px solid var(--border,#e2e8f0)',
                  color: '#64748b',
                  fontSize: 11,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                  <span>Total: <strong style={{ color: 'var(--text)' }}>{totalInv}</strong></span>
                  <span>Avg invoice <strong style={{ color: 'var(--text)' }}>{compactInr(snap.avgInvoice)}</strong></span>
                </div>
              </div>
            </div>
          );
        })())}
        {prefs.showGstBreakdown !== false && panel('Tax', 'GST breakdown', (
          <div className="sd-chart-box"><canvas ref={gstRef} /></div>
        ))}
      </div>

      {/* 3) Clients | Sites | State */}
      <div className="sd-row-3">
        {prefs.showTopClients !== false && panel('Clients', 'Top clients by billed amount', (
          <div className="sd-chart-box"><canvas ref={clientsRef} /></div>
        ))}
        {prefs.showTopSites !== false && panel('Sites', 'Revenue by site', (
          <div className="sd-chart-box"><canvas ref={sitesRef} /></div>
        ))}
        {prefs.showSalesByState !== false && panel('Geography', 'Sales by state', (
          <div className="sd-chart-box"><canvas ref={stateRef} /></div>
        ))}
      </div>

      {/* 4) Full-width trend */}
      {prefs.showSalesTrend !== false && (
      <div className="sd-row-1">
        <div className="sd-panel" style={{ minHeight: 300 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div className="sd-panel-kicker">Trend</div>
              <div className="sd-panel-title" style={{ marginBottom: 0 }}>Sales, purchases & receipts</div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9',
              padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap',
            }}>{snap.rangeLabel}</span>
          </div>
          <div className="sd-chart-box-lg" style={{ marginTop: 8 }}>
            <canvas ref={trendRef} />
          </div>
        </div>
      </div>
      )}
    </div>
  );
}