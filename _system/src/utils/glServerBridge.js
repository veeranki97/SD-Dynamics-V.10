/**
 * Server-side GL bridge (Phase C–D).
 * Call from server.js after DATA_DIR / readJSON / writeJSON exist.
 *
 * Usage (add near top after path helpers):
 *   import { createServerGlContext, ensureCoaOnBoot, registerGlMetaRoutes,
 *            afterTaxInvoiceSaved, afterReceiptSaved, afterExpenseSaved,
 *            afterPurchaseSaved } from './src/utils/glServerBridge.js';
 *
 *   const glCtx = createServerGlContext({ DATA_DIR, readJSON, writeJSON, readAllFromDir, META_PATH, safeFileName, path, fs });
 *   ensureCoaOnBoot(glCtx);
 *   registerGlMetaRoutes(app, glCtx);
 *
 * After successful tax invoice write:
 *   afterTaxInvoiceSaved(glCtx, bill);
 * After receipt:
 *   afterReceiptSaved(glCtx, receipt, bill);
 *
 * Default: meta.useGlEngine false → all after* are no-ops.
 */

import path from 'path';
import { ensureCoaSeeded, COA_SEED } from './coaSeed.js';
import { createGlEngine } from './glPosting.js';
import {
  linesTaxInvoice,
  linesReceipt,
  linesPiToTiAdvance,
  linesExpense,
  linesPurchase,
  linesVendorPayment,
} from './glRecipes.js';

export function createServerGlContext(io) {
  const {
    DATA_DIR,
    readJSON,
    writeJSON,
    readAllFromDir,
    META_PATH,
    safeFileName,
    path: pathMod,
    fs,
  } = io;

  function getMeta() {
    return readJSON(META_PATH, {}) || {};
  }

  function listAccounts() {
    return readAllFromDir('accounts') || [];
  }

  function listJournals() {
    return readAllFromDir('journals') || [];
  }

  function saveJournal(j) {
    const dir = pathMod.join(DATA_DIR, 'journals');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const id = j.id || ('jnl_' + Date.now().toString(36));
    j.id = id;
    writeJSON(pathMod.join(dir, safeFileName(id) + '.json'), j);
  }

  function upsertAccount(row) {
    const dir = pathMod.join(DATA_DIR, 'accounts');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeJSON(pathMod.join(dir, safeFileName(row.id) + '.json'), row);
  }

  const engine = createGlEngine({
    getMeta,
    listJournals,
    saveJournal,
    listAccounts,
    freezeDays: undefined, // read from meta inside assert
  });

  return {
    getMeta,
    listAccounts,
    listJournals,
    saveJournal,
    upsertAccount,
    engine,
    DATA_DIR,
    readJSON,
    writeJSON,
    META_PATH,
    path: pathMod,
    fs,
    safeFileName,
  };
}

export function ensureCoaOnBoot(ctx) {
  try {
    const result = ensureCoaSeeded({
      listAccounts: ctx.listAccounts,
      upsertAccount: ctx.upsertAccount,
    });
    if (result.seeded) console.log('[gl] CoA seeded', result.count, 'accounts');
    else console.log('[gl] CoA present', result.count, 'accounts');
  } catch (e) {
    console.warn('[gl] CoA seed skipped:', e.message);
  }
}

/** Replace empty/legacy minimal seed with full COA_SEED if only old seed ids exist and user opts in */
export function migrateLegacyCoaIfEmptyish(ctx) {
  const list = ctx.listAccounts();
  if (list.length >= 20) return;
  // If only the old short seed, do not wipe — additive: add missing codes
  const codes = new Set(list.map((a) => a.code).filter(Boolean));
  const now = new Date().toISOString();
  for (const row of COA_SEED) {
    if (list.some((a) => a.id === row.id || a.code === row.code)) continue;
    if (codes.has(row.code)) continue;
    ctx.upsertAccount({ ...row, isActive: true, companyId: 'default', updatedAt: now, createdAt: now });
  }
}

export function registerGlMetaRoutes(app, ctx) {
  app.get('/api/meta/useGlEngine', (req, res) => {
    try {
      const meta = ctx.getMeta();
      res.json({ value: meta.useGlEngine === true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/meta/useGlEngine', (req, res) => {
    try {
      const meta = ctx.getMeta();
      const on = req.body?.value === true || req.body?.value === 'true' || req.body?.value === 1;
      meta.useGlEngine = on;
      ctx.writeJSON(ctx.META_PATH, meta);
      res.json({ ok: true, value: on });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/meta/glMap', (req, res) => {
    try {
      const meta = ctx.getMeta();
      res.json({ value: meta.glMap || {} });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/meta/glMap', (req, res) => {
    try {
      const meta = ctx.getMeta();
      meta.glMap = { ...(meta.glMap || {}), ...(req.body?.value || req.body || {}) };
      ctx.writeJSON(ctx.META_PATH, meta);
      res.json({ ok: true, value: meta.glMap });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /** Manual post through engine (Books journal entry) */
  app.post('/api/gl/post', (req, res) => {
    try {
      if (!ctx.engine.engineEnabled()) {
        return res.status(400).json({ error: 'engine_off', message: 'Set meta.useGlEngine true first' });
      }
      const result = ctx.engine.postDocument(req.body || {});
      res.json(result);
    } catch (e) {
      const code = e.code || 'gl_error';
      res.status(400).json({ error: code, message: e.message });
    }
  });
}

function safePost(ctx, payload) {
  try {
    if (!ctx.engine.engineEnabled()) return { skipped: true };
    return ctx.engine.postDocument(payload);
  } catch (e) {
    console.warn('[gl] post failed', payload?.sourceType, e.message);
    return { ok: false, error: e.message, code: e.code };
  }
}

export function afterTaxInvoiceSaved(ctx, bill) {
  const meta = ctx.getMeta();
  const type = String(bill.invoiceType || bill.type || bill.data?.invoiceType || '').toLowerCase();
  if (type.includes('quotation') || type.includes('proforma') || type.includes('challan') || type.includes('delivery')) {
    return { skipped: true, reason: 'non_revenue_doc' };
  }
  if (bill.status === 'cancelled' || bill.cancelled) return { skipped: true, reason: 'cancelled' };
  const lines = linesTaxInvoice(bill, meta);
  if (!lines) return { skipped: true };
  return safePost(ctx, {
    sourceType: 'tax_invoice',
    sourceId: bill.id || bill.invoiceNumber,
    date: bill.invoiceDate || bill.data?.details?.invoiceDate || new Date().toISOString().slice(0, 10),
    narration: 'Tax invoice ' + (bill.invoiceNumber || bill.id),
    lines,
  });
}

export function afterReceiptSaved(ctx, receipt, bill) {
  const meta = ctx.getMeta();
  const lines = linesReceipt({ ...receipt, clientName: receipt.clientName || bill?.clientName }, meta);
  if (!lines) return { skipped: true };
  return safePost(ctx, {
    sourceType: 'receipt',
    sourceId: receipt.id || receipt.receiptNo || receipt.paymentId,
    date: receipt.date || receipt.paymentDate || new Date().toISOString().slice(0, 10),
    narration: 'Receipt ' + (receipt.receiptNo || receipt.id) + (bill?.invoiceNumber ? ' vs ' + bill.invoiceNumber : ''),
    lines,
  });
}

export function afterPiToTiAdvance(ctx, amount, party, sourceId, date) {
  const meta = ctx.getMeta();
  const lines = linesPiToTiAdvance(amount, party, meta);
  if (!lines) return { skipped: true };
  return safePost(ctx, {
    sourceType: 'pi_to_ti_advance',
    sourceId: sourceId || ('pi_ti_' + Date.now()),
    date: date || new Date().toISOString().slice(0, 10),
    narration: 'Advance apply PI→TI ' + (party || ''),
    lines,
  });
}

export function afterExpenseSaved(ctx, exp) {
  const meta = ctx.getMeta();
  const lines = linesExpense(exp, meta);
  if (!lines) return { skipped: true };
  return safePost(ctx, {
    sourceType: 'expense',
    sourceId: exp.id,
    date: exp.date || exp.expenseDate || new Date().toISOString().slice(0, 10),
    narration: 'Expense ' + (exp.category || exp.id),
    lines,
  });
}

export function afterPurchaseSaved(ctx, purch) {
  const meta = ctx.getMeta();
  const lines = linesPurchase(purch, meta);
  if (!lines) return { skipped: true };
  return safePost(ctx, {
    sourceType: 'purchase',
    sourceId: purch.id || purch.billNumber,
    date: purch.date || purch.billDate || new Date().toISOString().slice(0, 10),
    narration: 'Purchase ' + (purch.billNumber || purch.id),
    lines,
  });
}

export function afterVendorPayment(ctx, pay) {
  const meta = ctx.getMeta();
  const lines = linesVendorPayment(pay, meta);
  if (!lines) return { skipped: true };
  return safePost(ctx, {
    sourceType: 'vendor_payment',
    sourceId: pay.id || pay.receiptNo,
    date: pay.date || new Date().toISOString().slice(0, 10),
    narration: 'Vendor payment ' + (pay.vendorName || ''),
    lines,
  });
}
