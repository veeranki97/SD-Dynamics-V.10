/**
 * Work Order helpers – line items, remaining qty, budget ceiling
 */

export function emptyWOItem() {
  return {
    id: 'wi_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    description: '',
    hsn: '',
    unit: 'Nos',
    qty: 1,
    rate: 0,
    amount: 0,
    costHead: '',
  };
}

export function calcItemAmount(item) {
  const qty = Number(item.qty) || 0;
  const rate = Number(item.rate) || 0;
  return +(qty * rate).toFixed(2);
}

export function calcWOUsage(wo, allBills, purchaseOrders = [], purchases = [], expenses = []) {
  if (!wo) return {
    billedAmount: 0, remaining: 0, linkedInvoiceIds: [], billedByItem: {}, remainingByItem: [],
    committedCost: 0, actualCost: 0, projectedProfit: 0, costOverrun: false,
  };

  const woNo = wo.woNumber || wo.id;
  const matchWoId = (id, no) => (id && (id === wo.id || id === wo.woNumber)) || (no && woNo && String(no) === String(woNo));

  // Index all bills by id/number for conversion-chain WO inheritance
  const byKey = new Map();
  (allBills || []).forEach(b => {
    if (b.id) byKey.set(String(b.id), b);
    if (b.invoiceNumber) byKey.set(String(b.invoiceNumber), b);
  });

  const billHasWo = (b) => {
    const billWoId = b.workOrderId || b.data?.workOrderId || b.data?.details?.workOrderId;
    const billWoNo = b.data?.details?.workOrderNo || b.data?.workOrderNo || b.workOrderNo;
    if (matchWoId(billWoId, billWoNo)) return true;
    // Inherit WO from source doc (QUO/PI → TI) when convert did not copy workOrderId
    const src =
      b.convertedFromId || b.convertedFrom || b.sourceInvoiceId || b.sourceInvoiceNumber ||
      b.data?.convertedFromId || b.data?.convertedFrom || b.data?.sourceInvoiceNumber ||
      b.data?.details?.convertedFrom || b.data?.details?.sourceInvoiceNumber || '';
    if (src && byKey.has(String(src))) {
      const s = byKey.get(String(src));
      const sId = s.workOrderId || s.data?.workOrderId || s.data?.details?.workOrderId;
      const sNo = s.data?.details?.workOrderNo || s.data?.workOrderNo || s.workOrderNo;
      if (matchWoId(sId, sNo)) return true;
    }
    return false;
  };

  const linked = (allBills || []).filter(b => {
    if (b.status === 'cancelled' || b.status === 'converted' || b.deleted || b.isDeleted) return false;
    const typ = String(b.invoiceType || b.data?.invoiceType || '').toLowerCase();
    // Proforma / quotation / challan do not consume WO budget — only tax docs do.
    if (/proforma|quotation|estimate|delivery|challan/.test(typ)) return false;
    return billHasWo(b);
  });

  let billedAmount = 0;
  const billedByItem = {};

  linked.forEach(bill => {
    billedAmount += Number(bill.totalAmount) || 0;
    (bill.data?.items || []).forEach(it => {
      const key = (it.description || it.name || '').trim().toLowerCase();
      if (!key) return;
      // Invoice lines use `quantity`; WO lines use `qty` — count both
      const q = Number(it.quantity ?? it.qty) || 0;
      billedByItem[key] = (billedByItem[key] || 0) + q;
    });
  });

  const remainingByItem = (wo.items || []).map(it => {
    const key = (it.description || '').trim().toLowerCase();
    const orig = Number(it.qty) || 0;
    const used = billedByItem[key] || 0;
    return {
      description: it.description,
      originalQty: orig,
      billedQty: used,
      remainingQty: Math.max(0, orig - used),
      rate: Number(it.rate) || 0,
      hsn: it.hsn,
      unit: it.unit,
      costHead: it.costHead,
    };
  });

  // Committed PO cost (sum of open/issued POs linked to this WO)
  const linkedPOs = (purchaseOrders || []).filter(po => {
    if (po.status === 'cancelled') return false;
    return matchWoId(po.workOrderId, po.workOrderNo);
  });
  const committedCost = linkedPOs.reduce((s, p) => s + (Number(p.total || p.totalAmount) || 0), 0);

  // Actual Costs (purchases + expenses linked to this WO)
  const linkedPurchases = (purchases || []).filter(p => matchWoId(p.workOrderId, p.workOrderNo));
  const purchaseCost = linkedPurchases.reduce((s, p) => s + (Number(p.totalAmount || p.totals?.finalTotal) || 0), 0);

  const linkedExpenses = (expenses || []).filter(e => matchWoId(e.workOrderId, e.workOrderNo));
  const expenseCost = linkedExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const actualCost = +(purchaseCost + expenseCost).toFixed(2);
  const totalCost = actualCost > 0 ? actualCost : committedCost;
  const projectedProfit = +(billedAmount - totalCost).toFixed(2);
  const costOverrun = (Number(wo.approvedBudget) || 0) > 0 && totalCost > (Number(wo.approvedBudget) || 0);

  // Open PO value (not fully billed/received/cancelled)
  const openPOs = linkedPOs.filter(po => {
    const st = String(po.status || po.billingStatus || '').toLowerCase();
    if (/cancel/.test(st)) return false;
    if (/fully.?billed|fully.?received|closed|complete/.test(st)) return false;
    return true;
  });
  const openPO = +(openPOs.reduce((s, p) => s + (Number(p.total || p.totalAmount) || 0), 0)).toFixed(2);

  // Job margin = Billed − Purchases − Expenses (committed PO is informational only)
  const margin = +(billedAmount - purchaseCost - expenseCost).toFixed(2);
  const marginPct = billedAmount > 0 ? +((margin / billedAmount) * 100).toFixed(1) : null;

  const remaining = Math.max(0, (Number(wo.approvedBudget) || 0) - billedAmount);
  return {
    billedAmount,
    remaining,
    linkedInvoiceIds: linked.map(b => b.id),
    linkedInvoices: linked,
    billedByItem,
    remainingByItem,
    committedCost,
    openPO,
    openPOCount: openPOs.length,
    purchases: purchaseCost,
    purchaseCost,
    expenses: expenseCost,
    expenseCost,
    actualCost,
    projectedProfit: margin,
    margin,
    marginPct,
    costOverrun,
  };
}

export function deriveWOStatus(wo, allBills) {
  const { billedAmount, remaining } = calcWOUsage(wo, allBills);
  const budget = Number(wo.approvedBudget) || 0;
  if (wo.status === 'cancelled') return 'cancelled';
  if (budget <= 0) return wo.status || 'draft';
  if (billedAmount <= 0.01) return wo.status === 'approved' || wo.status === 'in-progress' ? wo.status : (wo.status || 'draft');
  if (remaining <= 0.01) return 'completed';
  return 'partial';
}

export function canInvoiceAgainstWO(wo, invoiceTotal, allBills, invoiceItems, opts = {}) {
  if (!wo) return { ok: false, reason: 'Work Order not found' };
  if (wo.status === 'cancelled' || wo.status === 'draft') {
    return { ok: false, reason: 'Work Order is not approved' };
  }
  // When editing an existing invoice, exclude it from "already billed" so re-save is not treated as double-billing.
  const excludeId = opts.excludeBillId || opts.editingBillId || opts.excludeSourceDocId || null;
  const excludeNum = opts.excludeInvoiceNumber || opts.excludeSourceDocNumber || null;
  const billsForUsage = (allBills || []).filter(b => {
    if (excludeId && (b.id === excludeId || b.invoiceNumber === excludeId)) return false;
    if (excludeNum && (b.invoiceNumber === excludeNum || b.id === excludeNum)) return false;
    return true;
  });
  const usage = calcWOUsage(wo, billsForUsage);
  if (Number(invoiceTotal) > usage.remaining + 5.0) {
    return {
      ok: false,
      reason: `Invoice ₹${Number(invoiceTotal).toFixed(2)} exceeds remaining WO budget ₹${usage.remaining.toFixed(2)} (₹5 tolerance)`,
    };
  }
  if (invoiceItems && invoiceItems.length && usage.remainingByItem.length) {
    for (const it of invoiceItems) {
      const key = (it.description || it.name || '').trim().toLowerCase();
      if (!key) continue;
      const row = usage.remainingByItem.find(r => (r.description || '').trim().toLowerCase() === key);
      const invQty = Number(it.quantity ?? it.qty) || 0;
      if (row && invQty > row.remainingQty + 0.0001) {
        return {
          ok: false,
          reason: `Cannot bill ${invQty} of "${it.description || it.name}" — Work Order has only ${row.remainingQty} remaining (already billed ${row.billedQty} of ${row.originalQty})`,
        };
      }
    }
  }
  return { ok: true };
}

export function woItemsToInvoiceItems(woItems, allBills, wo) {
  const usage = wo ? calcWOUsage(wo, allBills) : { remainingByItem: [] };
  const remMap = {};
  (usage.remainingByItem || []).forEach(r => {
    remMap[(r.description || '').trim().toLowerCase()] = r.remainingQty;
  });

  return (woItems || []).map((it, idx) => {
    const key = (it.description || it.name || '').trim().toLowerCase();
    const rem = remMap[key];
    const qty = rem != null ? Math.min(Number(it.qty) || Number(it.quantity) || 0, rem) : (Number(it.qty) || Number(it.quantity) || 1);
    const rate = Number(it.rate) || 0;
    const desc = it.description || it.name || '';
    return {
      id: 'item_' + Date.now().toString(36) + '_' + idx,
      name: desc,
      description: '',
      hsn: it.hsn || it.sac || '',
      unit: it.unit || 'Nos',
      quantity: qty > 0 ? qty : 0,
      rate,
      discount: 0,
      discountType: 'fixed',
      taxPercent: Number(it.taxPercent) || Number(it.taxRate) || 18,
      cessPercent: 0,
      costCenterId: it.costCenterId || it.costHead || '',
    };
  }).filter(it => Number(it.quantity) > 0);
}

/**
 * Resolve cost center / site from a Work Order document.
 * WO may store costCenterId on the header OR only on line items.
 */
export function resolveWoCostCenter(wo) {
  if (!wo) return '';
  const header = wo.costCenterId || wo.costCentreId || wo.costCenter || '';
  if (header) return String(header);
  const items = wo.items || [];
  for (const it of items) {
    const c = it.costCenterId || it.costCentreId || it.costHead || '';
    if (c) return String(c);
  }
  return '';
}

export function resolveWoSite(wo) {
  if (!wo) return '';
  return wo.site || wo.siteName || wo.deliverySite || '';
}


/**
 * Pull Work Order id/number from a bill — covers flat + nested data.details shapes.
 */
export function extractBillWorkOrderRef(bill) {
  if (!bill) return '';
  // Support list rows that only nest under data, or full documents
  const root = bill.data && typeof bill.data === 'object' ? { ...bill, ...bill.data } : bill;
  const d = bill.data || {};
  const det = d.details || root.details || bill.details || {};
  const candidates = [
    bill.workOrderId, root.workOrderId, d.workOrderId, det.workOrderId,
    bill.workOrderNo, root.workOrderNo, d.workOrderNo, det.workOrderNo,
    bill.woNumber, root.woNumber, d.woNumber, det.woNumber,
    bill.workOrder, root.workOrder, d.workOrder, det.workOrder,
    bill.woId, root.woId, d.woId, det.woId,
    det.linkedWorkOrderId, d.linkedWorkOrderId,
  ];
  for (const c of candidates) {
    if (c != null && String(c).trim()) return String(c).trim();
  }
  return '';
}

/** Match a WO list entry by id or woNumber (case-insensitive). */
export function findWorkOrderForBill(bill, workOrders) {
  const raw = extractBillWorkOrderRef(bill);
  if (!raw) return null;
  const list = workOrders || [];
  const low = raw.toLowerCase();
  return list.find(w =>
    w.id === raw ||
    w.woNumber === raw ||
    String(w.woNumber || '').toLowerCase() === low ||
    String(w.id || '').toLowerCase() === low
  ) || null;
}

/**
 * Cost center / site from bill first, then linked WO.
 */
export function resolveBillCostCenterSite(bill, workOrders, costCenters) {
  let wo = findWorkOrderForBill(bill, workOrders);
  const d = bill?.data || {};
  const det = d.details || bill?.details || {};
  const clientName = (
    bill?.clientName || d.clientName || bill?.client?.name || d.client?.name || ''
  ).trim().toLowerCase();

  // Fallback: if invoice has no WO link, use the only open WO for this client
  if (!wo && clientName && (workOrders || []).length) {
    const open = (workOrders || []).filter(w => {
      const st = String(w.status || '').toLowerCase();
      if (/cancel|closed|completed|complete/.test(st)) return false;
      const cn = String(w.clientName || w.client || '').trim().toLowerCase();
      return cn && cn === clientName;
    });
    if (open.length === 1) wo = open[0];
  }

  let costCenterId =
    resolveWoCostCenter(wo) ||
    bill?.costCenterId || bill?.costCenter ||
    d.costCenterId || det.costCenterId ||
    d.client?.costCenterId || '';
  costCenterId = costCenterId ? String(costCenterId) : '';

  // Map cost-center name → id so <select value={id}> shows correctly
  if (costCenterId && Array.isArray(costCenters) && costCenters.length) {
    const hit = costCenters.find(cc =>
      String(cc.id) === costCenterId ||
      String(cc.name || '').toLowerCase() === costCenterId.toLowerCase()
    );
    if (hit) costCenterId = String(hit.id || hit.name || costCenterId);
  }

  const site =
    resolveWoSite(wo) ||
    bill?.site || d.site || det.site ||
    bill?.client?.site || d.client?.site ||
    '';
  return {
    wo,
    workOrderId: wo ? String(wo.id || '') : extractBillWorkOrderRef(bill),
    workOrderNo: wo ? String(wo.woNumber || '') : '',
    costCenterId,
    site: site ? String(site) : '',
    clientName: bill?.clientName || d.clientName || bill?.client?.name || d.client?.name || '',
  };
}
