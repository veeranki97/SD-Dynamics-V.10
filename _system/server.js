import express from 'express';
// v1.10.0 — `cors` package no longer imported. The CORS-lockdown
// middleware below is intentionally custom + strict (localhost only)
// where `cors()` echoed `*` for every origin.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// v1.10.31 — Data-F3.1: share computeInvoiceTotals with the client so
// server-generated recurring invoices honour UTGST, cess, RCM, TDS/TCS,
// discount modes (percent / unit / with-tax), tax-inclusive back-calc,
// invoice-level discount, and round-off. Previously the recurring auto-fire
// re-implemented totals inline and silently reintroduced every bug the
// v1.10.1 extraction fixed. Same source of truth now.
import { computeInvoiceTotals } from './src/utils.js';
import {
  initSqliteStore, isSqliteReady, sqliteList, sqliteGet, sqliteUpsert, sqliteRemove, sqliteStats,
} from './src/db/sqliteStore.js';
import { filterActiveRecords, softDeleteRecord, isSoftDeleted, isSubmitted } from './src/utils/softDelete.js';
import { auditChange, auditMiddleware } from './src/middleware/auditLog.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
try { /* ensure activity dir early */ } catch {}
const DATA_DIR = path.join(__dirname, 'data');

// Port choice — we deliberately default to a high, unusual number rather than
// the conventional 3001. The 3000-range is heavily used by every other Node /
// Vite / React / Express app, dev servers, Grafana, etc., which means every
// other install would land on 3002 / 3003 / etc. and the user would be left
// guessing which URL is "theirs". 47371 is in IANA's unassigned range
// (between registered 1024-49151 and dynamic 49152-65535) and isn't claimed
// by any common software we could find. The persisted `data/port.txt` always
// wins over this default — so a single user who genuinely needs 47371 for
// something else can edit that file and we'll respect it forever.
const DEFAULT_PORT = 47371;
const PORT_FILE = path.join(__dirname, 'data', 'port.txt');

// Read the persisted port (if any) — written once on first successful start
// and every time we get bumped off our preferred port by EADDRINUSE.
const persistedPort = (() => {
  try {
    if (!fs.existsSync(PORT_FILE)) return null;
    const n = parseInt(fs.readFileSync(PORT_FILE, 'utf-8').trim(), 10);
    return (isFinite(n) && n >= 1024 && n <= 65535) ? n : null;
  } catch { return null; }
})();
const STARTING_PORT = persistedPort || DEFAULT_PORT;
const MAX_PORT_SCAN = 50; // 47371 → 47420 is enough headroom for any conceivable collision

const app = express();
app.use(auditMiddleware());


// v1.10.0 — CORS lockdown. Previously `app.use(cors())` echoed
// Access-Control-Allow-Origin: *, which meant any site the user visited
// could `fetch('http://localhost:47371/api/bills')` and read/wipe all
// data. This is a local desktop-style app: legitimate callers either
// have no Origin header (same-page fetch from our own served HTML,
// browsers' XHR to localhost from about:blank tools, curl) or an
// Origin pointing at http://localhost:<port>. Everything else is
// rejected. The Vite dev server proxies /api → us so its origin is
// also localhost.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allow =
    !origin ||
    /^https?:\/\/localhost(:\d+)?$/i.test(origin) ||
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin) ||
    /^https?:\/\/\[::1\](:\d+)?$/i.test(origin);
  if (!allow) {
    return res.status(403).json({ error: 'Cross-origin request refused' });
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// v1.10.0 — Body size lowered from 50mb → 5mb. Legit invoice payloads
// are single-digit kilobytes; a full import archive with 5000 bills fits
// comfortably in 2-3mb. 50mb + wildcard CORS previously meant any site
// could OOM the Node process with a nested-JSON payload.
app.use(express.json({ limit: '5mb' }));

// Ensure data directory and sub-directories exist
const DIRS = ['bills', 'clients', 'templates', 'products', 'expenses', 'recurring', 'receipts', 'profiles', 'purchases', 'workorders', 'journals', 'purchaseorders', 'costcenters', 'accounts', 'budgets'];
for (const dir of DIRS) {
  const dirPath = path.join(DATA_DIR, dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

// ========================
// SQLite primary store (full cut-over)
// ========================
const _sqliteInit = initSqliteStore(DATA_DIR);
if (_sqliteInit.ok) {
  console.log('[sqlite] Primary store ready', _sqliteInit.migrated != null ? `(migrated ${_sqliteInit.migrated})` : '');
} else {
  console.warn('[sqlite] Falling back to JSON files:', _sqliteInit.reason);
}


// Helper: safe filename from ID (replace slashes, etc.)
function safeFileName(id) {
  return String(id).replace(/[/\\:*?"<>|]/g, '_');
}

// v1.10.0 — Path-traversal-safe user-string → single path segment.
// Strips path separators, drive letters, and every `..` occurrence
// (including URL-encoded variants after decode). Used for the
// save-pdf / trash-pdf endpoints that construct paths from query
// params. Never returns an empty string; falls back to a sentinel so
// callers can trust the return value for `path.join`.
function safePathSegment(input, fallback = 'Untitled') {
  if (input === undefined || input === null) return fallback;
  let s;
  try { s = decodeURIComponent(String(input)); } catch { s = String(input); }
  s = s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-');    // reserved/control chars
  s = s.replace(/\.{2,}/g, '-');                    // squash .. and ...
  s = s.replace(/^[.\s]+|[.\s]+$/g, '');            // trim leading/trailing . and space (Windows reserves)
  s = s.slice(0, 120);                              // cap length
  return s || fallback;
}

// v1.10.0 — Enforce that `resolved` lives strictly inside `root`.
// Returns true if inside, false otherwise. Callers should reject on
// false and log server-side.
function isPathInside(resolved, root) {
  const r = path.resolve(root);
  const p = path.resolve(resolved);
  return p === r || p.startsWith(r + path.sep);
}

// v1.10.0 — Generic error response helper. Never returns raw Node
// error messages to the client (they leak absolute filesystem paths,
// EACCES/EPERM strings that hint at server structure). Server-side
// logs the full detail; client sees a stable code + generic phrase.
function errRes(res, status, code, err) {
  if (err) {
    try {
      const ts = new Date().toISOString();
      const msg = err && err.stack ? err.stack : String(err);
      fs.appendFileSync(ERRORS_LOG, `[${ts}] [api:${code}] ${msg}\n`, 'utf-8');
    } catch { /* ignore log failures */ }
  }
  const MESSAGES = {
    'bad-request': 'Invalid request',
    'not-found': 'Not found',
    'conflict': 'Conflict with existing resource',
    'server-error': 'Internal server error',
    'forbidden': 'Refused',
    'invalid-path': 'Invalid path',
    'payload-too-large': 'Request body too large',
  };
  return res.status(status).json({ error: MESSAGES[code] || code, code });
}

// v1.10.0 — Atomic file write. Writes to `<file>.tmp` then renames
// over the target so a mid-write crash / power loss cannot leave a
// truncated file on disk. Critical for META_PATH which stores the
// invoice counter — a truncated meta.json read back as `{}` reissues
// invoice numbers from zero.
function writeFileAtomic(filePath, contents) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, contents, 'utf-8');
  fs.renameSync(tmp, filePath);
}

// Errors log path — declared here so errRes() can find it. The actual
// file is created lazily; ERRORS_LOG constant below still points here.
const ERRORS_LOG = path.join(DATA_DIR, 'errors.log');

// In-memory cache for directory reads — invalidated on write/delete.
// v1.10.6 — audit L12: added a 5s TTL. Users are documented as being
// able to hand-edit JSON files in data/*; prior code never noticed
// external edits until a POST/DELETE happened to invalidate. Now: any
// cached entry older than 5 seconds is treated as stale and re-read.
const dirCache = {};
const DIR_CACHE_TTL_MS = 5000;
function invalidateCache(dir) { delete dirCache[dir]; }

// Helper: read all JSON files from a directory (cached, 5s TTL)
function readAllFromDir(dir, { includeDeleted = false } = {}) {
  if (isSqliteReady()) {
    const list = sqliteList(dir, { includeDeleted });
    if (list) return list;
  }
  const dirPath = path.join(DATA_DIR, dir);
  if (!fs.existsSync(dirPath)) return [];
  // In-memory cache for directory reads (JSON fallback)
  const now = Date.now();
  const cached = dirCache[dir];
  if (cached && (now - (cached.ts || 0)) < DIR_CACHE_TTL_MS) {
    return includeDeleted ? cached.data : cached.data.filter(o => !(o.deleted || o.isDeleted || o._deleted));
  }
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try {
      const obj = JSON.parse(fs.readFileSync(path.join(dirPath, f), 'utf8'));
      out.push(obj);
    } catch { /* skip */ }
  }
  dirCache[dir] = { data: out, ts: now };
  if (!includeDeleted) {
    return out.filter(o => !(o.deleted || o.isDeleted || o._deleted));
  }
  return out;
}

// Helper: read a single JSON file
function readJSON(filePath, fallback = null) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch { /* ignore */ }
  return fallback;
}

// Helper: write JSON file (with cache invalidation). v1.10.0 — writes
// atomically via temp+rename so a crash mid-write can't leave a
// truncated meta.json that resets the invoice counter.
function writeJSON(filePath, data) {
  // SQLite primary write when path is data/<collection>/<id>.json
  try {
    if (isSqliteReady() && data && typeof data === 'object') {
      const rel = path.relative(DATA_DIR, path.resolve(filePath));
      const parts = rel.split(path.sep);
      if (parts.length >= 2 && !parts[0].startsWith('..')) {
        const collection = parts[0];
        const base = parts[parts.length - 1].replace(/\.json$/i, '');
        if (data.id == null) data.id = base;
        sqliteUpsert(collection, data);
      } else if (path.basename(filePath) === 'profile.json') {
        const p = { ...data, id: data.id || 'default' };
        sqliteUpsert('profiles', p);
      }
    }
  } catch (se) { console.warn('[sqlite] upsert on writeJSON:', se.message); }

  writeFileAtomic(filePath, JSON.stringify(data, null, 2));
  // Invalidate cache for the parent directory
  const parentDir = path.basename(path.dirname(filePath));
  if (DIRS.includes(parentDir)) invalidateCache(parentDir);
}

// Helper: delete file (with cache invalidation)
function deleteFile(filePath) {
  try {
    if (isSqliteReady()) {
      const rel = path.relative(DATA_DIR, path.resolve(filePath));
      const parts = rel.split(path.sep);
      if (parts.length >= 2 && !parts[0].startsWith('..')) {
        const collection = parts[0];
        const id = parts[parts.length - 1].replace(/\.json$/i, '');
        sqliteRemove(collection, id);
      }
    }
  } catch (e) { console.warn('[sqlite] remove on deleteFile:', e.message); }

  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  const parentDir = path.basename(path.dirname(filePath));
  if (DIRS.includes(parentDir)) invalidateCache(parentDir);
}

// ========================
// BILLS
// ========================
/**
 * Server-side GST recompute (Finding 12).
 * Never trust browser-only tax figures for books / GSTR.
 * Uses same intra/inter split rules as the client: same state → CGST+SGST, else IGST.
 */
function money2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function stateCodeFromGstin(gstin) {
  const g = String(gstin || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (g.length >= 2 && /^\d{2}/.test(g)) return g.slice(0, 2);
  return '';
}

function normalizeStateKey(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isInterstateBill(profile, client, details) {
  const hostGst = stateCodeFromGstin(profile?.gstin);
  const clientGst = stateCodeFromGstin(client?.gstin);
  if (hostGst && clientGst) return hostGst !== clientGst;
  const hostState = normalizeStateKey(profile?.state);
  const pos = normalizeStateKey(details?.placeOfSupply || client?.state);
  if (hostState && pos) return hostState !== pos;
  return false;
}

/**
 * Canonical server-side tax rollup. Never trust browser-only totals.
 * Proforma / quotation KEEP GST (display + stored totals) — only
 * Bill of Supply / composition / delivery challan omit GST.
 */
function recomputeBillTax(bill) {
  if (!bill || typeof bill !== 'object') return { bill, warnings: ['invalid bill'] };
  const data = bill.data || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const profile = data.profile || {};
  const client = data.client || {};
  const details = data.details || {};
  const invType = String(data.invoiceType || bill.invoiceType || 'tax-invoice').toLowerCase();
  const opts = { ...(data.invoiceOptions || {}) };
  const omitGst = /bill-of-supply|composition/.test(invType)
    || (invType.includes('delivery') && invType.includes('challan'));
  const showGST = opts.showGST !== false && !omitGst;

  let totals;
  try {
    totals = computeInvoiceTotals({
      items,
      profile,
      client,
      details,
      showGST,
      taxInclusive: !!(opts.taxInclusive || data.taxInclusive),
      invoiceOptions: { ...opts, showGST },
    });
  } catch (e) {
    console.warn('[tax] computeInvoiceTotals failed, falling back', e.message);
    totals = null;
  }

  if (!totals) {
    // Fallback arithmetic if utils import path fails
    let taxable = 0, taxTotal = 0;
    for (const it of items) {
      const qty = Math.max(0, Number(it.quantity) || Number(it.qty) || 0);
      const rate = Math.max(0, Number(it.rate) || 0);
      const disc = Math.max(0, Number(it.discount) || 0);
      let line = Math.max(0, qty * rate - disc);
      const taxPct = showGST ? Math.max(0, Number(it.taxPercent) || Number(it.taxRate) || 0) : 0;
      if ((opts.taxInclusive || data.taxInclusive) && taxPct > 0) {
        const base = line / (1 + taxPct / 100);
        taxable += base;
        taxTotal += line - base;
      } else {
        taxable += line;
        taxTotal += line * taxPct / 100;
      }
    }
    taxable = money2(taxable);
    taxTotal = money2(taxTotal);
    const interstate = isInterstateBill(profile, client, details);
    totals = {
      taxableAmount: taxable,
      cgst: showGST && !interstate ? money2(taxTotal / 2) : 0,
      sgst: showGST && !interstate ? money2(taxTotal / 2) : 0,
      igst: showGST && interstate ? taxTotal : 0,
      totalTaxAmount: showGST ? taxTotal : 0,
      total: money2(taxable + (showGST ? taxTotal : 0)),
      isInterstate: interstate,
    };
  }

  const cgst = money2(totals.cgst);
  const sgst = money2(totals.sgst);
  const igst = money2(totals.igst);
  const utgst = money2(totals.utgst);
  const cess = money2(totals.cess);
  const taxAmt = money2(totals.totalTaxAmount ?? (cgst + sgst + igst + utgst + cess));
  const grand = money2(totals.total);
  const warnings = [];
  const prevTotal = money2(bill.totalAmount);
  const prevTax = money2(bill.totalTaxAmount);
  if (Math.abs(prevTotal - grand) > 0.009 || Math.abs(prevTax - taxAmt) > 0.009) {
    warnings.push(`Tax recalculated on server (client total ${prevTotal} → ${grand}, tax ${prevTax} → ${taxAmt})`);
  }

  const mergedTotals = {
    ...(data.totals || {}),
    ...totals,
    cgst, sgst, igst, utgst, cess,
    totalTax: taxAmt,
    totalTaxAmount: taxAmt,
    total: grand,
    grandTotal: grand,
  };

  bill.totalAmount = grand;
  bill.totalTaxAmount = taxAmt;
  bill.data = {
    ...data,
    totals: mergedTotals,
    serverTaxVerified: true,
    serverTaxWarnings: warnings,
  };
  return { bill, warnings };
}

/** Reject fat-finger payments that exceed outstanding (Grand Total − paid). */
function validateBillPayments(bill) {
  const total = money2(bill.totalAmount);
  const payments = Array.isArray(bill.payments) ? bill.payments : [];
  let paid = 0;
  for (const p of payments) {
    const amt = money2(p.amount);
    if (amt < 0) return { ok: false, error: 'Payment amount cannot be negative' };
    paid = money2(paid + amt);
  }
  // Allow 1 paise rounding; reject overpayment (incl. 10× typos)
  if (paid > total + 0.05) {
    return {
      ok: false,
      error: `Payment ₹${paid.toFixed(2)} exceeds invoice grand total ₹${total.toFixed(2)}. Outstanding is ₹${Math.max(0, total - (money2(bill.paidAmount) || 0)).toFixed(2)}.`,
    };
  }
  bill.paidAmount = paid;
  return { ok: true };
}


app.get('/api/bills', (req, res) => {
  const bills = readAllFromDir('bills');
  bills.sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
  res.json(bills);
});

app.post('/api/bills', (req, res) => {
  let bill = req.body;
  if (!bill || !bill.id) return res.status(400).json({ error: 'Bill must have an id' });
  const filePath = path.join(DATA_DIR, 'bills', safeFileName(bill.id) + '.json');

  // Dupe-check: the invoice-number field is free-text on the client, so a
  // typo (INV/2026/0007 typed again for a fresh bill) would silently
  // overwrite the previous saved bill. That's data loss. Require the
  // client to pass ?overwrite=1 to allow it — used for edits + auto-fire
  // re-processing. Otherwise refuse with 409 so the UI can prompt the user.
  const overwrite = req.query.overwrite === '1' || req.query.overwrite === 'true';
  if (!overwrite && fs.existsSync(filePath)) {
    return res.status(409).json({
      error: 'A bill with this invoice number already exists',
      invoiceNumber: bill.id,
    });
  }

  // Finding 12 / 18: server-side GST recompute (never trust browser-only tax)
  let taxWarnings = [];
  try {
    if (typeof recomputeBillTax === 'function') {
      const result = recomputeBillTax(bill);
      bill = result.bill;
      taxWarnings = result.warnings || [];
    }
  } catch (e) {
    console.warn('[tax] recompute failed, storing client totals:', e.message);
  }

  const payCheck = validateBillPayments(bill);
  if (!payCheck.ok) return res.status(400).json({ error: payCheck.error, code: 'payment-exceeds-invoice' });

  // P2: default docstatus for financial invoices
  if (bill.docstatus == null) {
    const t = String(bill.invoiceType || bill.data?.invoiceType || 'tax-invoice').toLowerCase();
    const nonFin = /quotation|delivery|challan|bill-of-supply|composition|proforma/.test(t);
    bill.docstatus = nonFin ? 0 : 1;
  }
  const beforeBill = fs.existsSync(filePath) ? readJSON(filePath, null) : null;
  // P2: lock submitted docs against full overwrite unless ?force=1 or payment-only
  if (beforeBill && isSubmitted(beforeBill) && req.query.force !== '1') {
    const statusOnly = bill.status !== beforeBill.status || bill.paidAmount !== beforeBill.paidAmount;
    // allow payment status updates; block other field rewrites by merging
    if (!statusOnly && JSON.stringify({ ...beforeBill, status: bill.status, paidAmount: bill.paidAmount, payments: bill.payments }) !== JSON.stringify(bill)) {
      // soft lock: still allow save but stamp
      bill.docstatus = beforeBill.docstatus;
    }
  }
    writeJSON(filePath, bill);
  // Invoice revision history (GAS InvoiceRevisions equivalent)
  try {
    const revDir = path.join(DATA_DIR, 'invoice-revisions');
    if (!fs.existsSync(revDir)) fs.mkdirSync(revDir, { recursive: true });
    const invKey = safeFileName(bill.id || bill.invoiceNumber || 'unknown');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rev = {
      timestamp: new Date().toISOString(),
      action: beforeBill ? 'EDIT' : 'CREATE',
      invoiceNumber: bill.invoiceNumber || bill.id,
      snapshot: bill,
      previous: beforeBill || null,
    };
    writeJSON(path.join(revDir, `${invKey}_${stamp}.json`), rev);
    // keep last 30 revisions per invoice number prefix
    const all = fs.readdirSync(revDir).filter(f => f.startsWith(invKey + '_')).sort();
    while (all.length > 30) {
      try { fs.unlinkSync(path.join(revDir, all.shift())); } catch {}
    }
  } catch (re) { console.warn('[revisions]', re.message); } try {
    const aDir = path.join(DATA_DIR, 'activity-logs');
    fs.mkdirSync(aDir, { recursive: true });
    const at = new Date().toISOString();
    const aName = at.replace(/[:.]/g, '-') + '_invoice_' + safeFileName(String(bill.invoiceNumber || bill.id || 'x')) + '.json';
    fs.writeFileSync(path.join(aDir, aName), JSON.stringify({
      entityType: 'invoice', entityId: bill.invoiceNumber || bill.id,
      action: typeof beforeBill !== 'undefined' && beforeBill ? 'update' : 'create',
      user: 'server', at,
      diff: { totalAmount: bill.totalAmount, status: bill.status },
    }, null, 2));
  } catch (ae) { console.warn('[activity]', ae.message); }
  try {
    auditChange({
      entityType: 'bill',
      entityId: bill.id,
      action: beforeBill ? 'update' : 'create',
      before: beforeBill,
      after: bill,
      baseDir: path.join(DATA_DIR, 'activity-logs'),
    });
  } catch { /* ignore audit failures */ };
  res.json({ success: true, taxWarnings });
});

// v1.10.31 — Data-F9.1: block deletion of a bill that's a client-credit
// SOURCE for another live bill. Deleting it would leave the target bill
// showing "paid" via credit-applied without a real source, breaking the
// dual-entry integrity guaranteed by v1.10.24. Client can force-delete
// by passing `?force=1` (they accept the ledger inconsistency).
function findCreditDependents(billId) {
  try {
    const billsDir = path.join(DATA_DIR, 'bills');
    const dependents = [];
    for (const f of fs.readdirSync(billsDir).filter(n => n.endsWith('.json'))) {
      let other;
      try { other = readJSON(path.join(billsDir, f), null); } catch { continue; }
      if (!other || other.id === billId) continue;
      const payments = other.payments || other.data?.payments || [];
      for (const p of payments) {
        if (p?.mode !== 'credit-applied') continue;
        const sources = p?.creditSourceBillIds || [];
        if (sources.includes(billId)) {
          dependents.push({ id: other.id, invoiceNumber: other.invoiceNumber, amount: p.amount });
          break;
        }
      }
    }
    return dependents;
  } catch {
    return [];
  }
}

app.delete('/api/bills/:id', (req, res) => {
  // v1.9.5 — soft delete: move to data/trash/ instead of unlinking so
  // users can restore within 30 days. Query ?permanent=1 skips trash and
  // deletes forever (used by the Trash bin UI's "Delete forever" action).
  const fname = safeFileName(req.params.id) + '.json';
  const filePath = path.join(DATA_DIR, 'bills', fname);
  if (!fs.existsSync(filePath)) return res.json({ success: true });

  // v1.10.31 — Data-F9.1: client-credit dependency check. Blocks silent
  // deletion of a credit source that would leave a paid-via-credit target
  // bill dangling. Force override via ?force=1.
  const force = req.query.force === '1' || req.query.force === 'true';
  if (!force) {
    const dependents = findCreditDependents(req.params.id);
    if (dependents.length > 0) {
      return res.status(409).json({
        error: 'client-credit-dependency',
        message: 'This bill was used as a client-credit source on another invoice. Deleting it would leave that invoice paid via credit that no longer has a real source.',
        dependents,
      });
    }
  }
  // Always reverse/trash the matching invoice journal so GL stays consistent
  const trashInvoiceJournal = (billId, permanent) => {
    try {
      const jDir = path.join(DATA_DIR, 'journals');
      if (!fs.existsSync(jDir)) return;
      const candidates = [
        'jnl_inv_' + safeFileName(billId) + '.json',
        'jnl_inv_' + String(billId).replace(/[^a-zA-Z0-9._-]/g, '_') + '.json',
      ];
      // Also scan for refId match
      let files = candidates.filter(f => fs.existsSync(path.join(jDir, f)));
      if (!files.length) {
        try {
          for (const f of fs.readdirSync(jDir)) {
            if (!f.startsWith('jnl_inv_') || !f.endsWith('.json')) continue;
            try {
              const j = JSON.parse(fs.readFileSync(path.join(jDir, f), 'utf8'));
              if (j.refId === billId || j.refId === req.params.id) files.push(f);
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }
      const jTrash = path.join(DATA_DIR, 'trash', 'journals');
      for (const f of files) {
        const src = path.join(jDir, f);
        if (!fs.existsSync(src)) continue;
        if (permanent) {
          try { fs.unlinkSync(src); } catch { /* ignore */ }
        } else {
          if (!fs.existsSync(jTrash)) fs.mkdirSync(jTrash, { recursive: true });
          try { fs.renameSync(src, path.join(jTrash, f)); } catch {
            try { fs.unlinkSync(src); } catch { /* ignore */ }
          }
        }
      }
    } catch (e) {
      console.warn('trashInvoiceJournal', e.message);
    }
  };

  if (req.query.permanent === '1') {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    trashInvoiceJournal(req.params.id, true);
    return res.json({ success: true, permanent: true });
  }
  try {
    const trashDir = path.join(DATA_DIR, 'trash');
    if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true });
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const marked = softDeleteRecord(raw, 'user');
      writeJSON(path.join(trashDir, fname), marked);
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    } catch {
      fs.renameSync(filePath, path.join(trashDir, fname));
    }
    trashInvoiceJournal(req.params.id, false);
    try {
      auditChange({ entityType: 'bill', entityId: req.params.id, action: 'soft_delete', before: { id: req.params.id }, after: { is_deleted: true } });
    } catch { /* ignore */ }
    res.json({ success: true, trashed: true });
  } catch (err) {
    errRes(res, 500, 'server-error', err);
  }
});

// ========================
// PROFILE
// ========================
const PROFILE_PATH = path.join(DATA_DIR, 'profile.json');
const DEFAULT_PROFILE = {
  businessName: '', address: '', state: '', gstin: '', pan: '',
  email: '', phone: '', bankName: '', accountNumber: '', ifsc: '',
  logo: '', signature: '', upiId: '', googleClientId: '', googleDriveFolder: 'GST Billing Invoices',
};

app.get('/api/profile', (req, res) => {
  res.json(readJSON(PROFILE_PATH, DEFAULT_PROFILE));
});

app.post('/api/profile', (req, res) => {
  writeJSON(PROFILE_PATH, req.body);
  res.json({ success: true });
});

// ========================
// CLIENTS
// ========================
app.get('/api/clients', (req, res) => {
  const clients = readAllFromDir('clients');
  clients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  res.json(clients);
});

app.post('/api/clients', (req, res) => {
  const client = req.body;
  if (!client.id) client.id = 'cli_' + Date.now();
  const filePath = path.join(DATA_DIR, 'clients', safeFileName(client.id) + '.json');
  writeJSON(filePath, client);
  res.json({ success: true, id: client.id });
});

app.delete('/api/clients/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'clients', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
});

// ========================
// TERMS TEMPLATES
// ========================
app.get('/api/templates', (req, res) => {
  let templates = readAllFromDir('templates');
  if (templates.length === 0) {
    // Seed default template
    const defaultTpl = {
      id: 'default',
      name: 'Standard Terms',
      content: '1. Payment is due within 15 days of invoice date unless otherwise agreed in writing.\n2. Interest @ 18% p.a. will be charged on overdue payments beyond the due date.\n3. The scope of work is limited to what is explicitly mentioned in the project proposal/agreement. Any additional requirements will be quoted and billed separately.\n4. All intellectual property and source code will be transferred to the client only upon receipt of full payment.\n5. We shall not be liable for any delays caused by incomplete or late submission of content, credentials, or approvals from the client\'s end.\n6. Any change requests after project approval may attract additional charges and revised timelines.\n7. This invoice is subject to the jurisdiction of courts at the service provider\'s registered location.\n8. E. & O.E.'
    };
    writeJSON(path.join(DATA_DIR, 'templates', 'default.json'), defaultTpl);
    templates = [defaultTpl];
  }
  templates.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  res.json(templates);
});

app.post('/api/templates', (req, res) => {
  const tpl = req.body;
  if (!tpl.id) tpl.id = 'tpl_' + Date.now();
  const filePath = path.join(DATA_DIR, 'templates', safeFileName(tpl.id) + '.json');
  writeJSON(filePath, tpl);
  res.json({ success: true, id: tpl.id });
});

app.delete('/api/templates/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'templates', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
});

// ========================
// PRODUCTS / INVENTORY
// ========================
app.get('/api/products', (req, res) => {
  const products = readAllFromDir('products');
  products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  res.json(products);
});

app.post('/api/products', (req, res) => {
  const product = req.body;
  if (!product.id) product.id = 'prod_' + Date.now();
  const filePath = path.join(DATA_DIR, 'products', safeFileName(product.id) + '.json');
  writeJSON(filePath, product);
  res.json({ success: true, id: product.id });
});

app.delete('/api/products/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'products', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
});

// ========================
// EXPENSES
// ========================
app.get('/api/expenses', (req, res) => {
  const expenses = readAllFromDir('expenses');
  expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(expenses);
});

app.post('/api/expenses', (req, res) => {
  const expense = req.body;
  if (!expense.id) expense.id = 'exp_' + Date.now();
  const filePath = path.join(DATA_DIR, 'expenses', safeFileName(expense.id) + '.json');
  writeJSON(filePath, expense);
  res.json({ success: true, id: expense.id });
});

app.delete('/api/expenses/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'expenses', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
});

// ========================
// RECURRING INVOICES
// ========================
app.get('/api/recurring', (req, res) => {
  const items = readAllFromDir('recurring');
  items.sort((a, b) => (a.clientName || '').localeCompare(b.clientName || ''));
  res.json(items);
});

app.post('/api/recurring', (req, res) => {
  const item = req.body;
  if (!item.id) item.id = 'rec_' + Date.now();
  const filePath = path.join(DATA_DIR, 'recurring', safeFileName(item.id) + '.json');
  writeJSON(filePath, item);
  res.json({ success: true, id: item.id });
});

app.delete('/api/recurring/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'recurring', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
});

// ========================
// RECEIPTS / PAYMENT VOUCHERS
// ========================
app.get('/api/receipts', (req, res) => {
  const receipts = readAllFromDir('receipts');
  receipts.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(receipts);
});

app.post('/api/receipts', (req, res) => {
  const receipt = req.body;
  if (!receipt.id) receipt.id = 'rcp_' + Date.now();
  const filePath = path.join(DATA_DIR, 'receipts', safeFileName(receipt.id) + '.json');
  writeJSON(filePath, receipt);
  res.json({ success: true, id: receipt.id });
});

app.delete('/api/receipts/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'receipts', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
});

// ========================
// PURCHASES (Purchase Bills for ITC)
// ========================
app.get('/api/purchases', (req, res) => {
  const purchases = readAllFromDir('purchases');
  purchases.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(purchases);
});

app.post('/api/purchases', (req, res) => {
  const purchase = req.body;
  if (!purchase.id) purchase.id = 'pur_' + Date.now();
  const filePath = path.join(DATA_DIR, 'purchases', safeFileName(purchase.id) + '.json');
  writeJSON(filePath, purchase);
  res.json({ success: true, id: purchase.id });
});

app.delete('/api/purchases/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'purchases', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
});

// ========================
// WORK ORDERS (custom addition)
// ========================
app.get('/api/workorders', (req, res) => {
  try {
    const list = readAllFromDir('workorders');
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/workorders', (req, res) => {
  try {
    const wo = req.body;
    if (!wo?.id) return res.status(400).json({ error: 'Missing id' });
    const dir = path.join(DATA_DIR, 'workorders');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, safeFileName(wo.id) + '.json');
    if (fs.existsSync(filePath) && !req.query.overwrite) {
      return res.status(409).json({ error: 'Work Order already exists' });
    }
    writeJSON(filePath, wo);
    res.json({ success: true, id: wo.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/workorders/:id', (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, 'workorders', safeFileName(req.params.id) + '.json');
    deleteFile(filePath);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ========================
// JOURNALS (simple double-entry — custom)
// ========================
app.get('/api/journals', (req, res) => {
  try {
    const list = readAllFromDir('journals');
    list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/journals', (req, res) => {
  try {
    const j = req.body || {};
    // P0: reject unbalanced journals
    {
      const entries = j.entries || [];
      const dr = entries.reduce((s, e) => s + (Number(e.debit) || 0), 0);
      const cr = entries.reduce((s, e) => s + (Number(e.credit) || 0), 0);
      if (entries.length && Math.abs(dr - cr) > 0.5) {
        return res.status(400).json({ error: 'unbalanced_journal', debit: dr, credit: cr });
      }
    }
    if (!j?.id) return res.status(400).json({ error: 'Missing id' });
    const dir = path.join(DATA_DIR, 'journals');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Paise-safe money on every line; never mutate an existing journal (append-only)
    j.entries = (j.entries || []).map(e => ({
      ...e,
      debit: money2(e.debit),
      credit: money2(e.credit),
    }));
    let dest = path.join(dir, safeFileName(j.id) + '.json');
    const overwrite = req.query.overwrite === '1' || req.query.overwrite === 'true' || j.overwrite === true
      || String(j.id || '').startsWith('jnl_inv_');
    // Payment / reversal journals are append-only — never overwrite history
    if ((String(j.id || '').startsWith('jnl_pay_') || String(j.id || '').startsWith('jnl_rev_'))
        && fs.existsSync(dest) && req.query.overwrite !== '1') {
      j.id = j.id + '_' + Date.now().toString(36);
      dest = path.join(dir, safeFileName(j.id) + '.json');
    }
    if (fs.existsSync(dest) && !overwrite) {
      return res.status(409).json({
        error: 'journal-exists',
        message: 'A journal with this id already exists. Pass overwrite=1 to replace.',
        id: j.id,
      });
    }
    writeJSON(dest, j);
    res.json({ success: true, id: j.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ========================
// PURCHASE ORDERS (custom)
// ========================
app.get('/api/purchaseorders', (req, res) => {
  try {
    const list = readAllFromDir('purchaseorders');
    list.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/purchaseorders', (req, res) => {
  try {
    const po = req.body;
    if (!po?.id) return res.status(400).json({ error: 'Missing id' });
    const dir = path.join(DATA_DIR, 'purchaseorders');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, safeFileName(po.id) + '.json');
    if (fs.existsSync(filePath) && !req.query.overwrite) {
      return res.status(409).json({ error: 'PO already exists' });
    }
    writeJSON(filePath, po);
    res.json({ success: true, id: po.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/purchaseorders/:id', (req, res) => {
  try {
    deleteFile(path.join(DATA_DIR, 'purchaseorders', safeFileName(req.params.id) + '.json'));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// COST CENTERS
app.get('/api/costcenters', (req, res) => {
  try {
    const list = readAllFromDir('costcenters');
    if (!list.length) {
      const root = { id: 'cc_company', name: 'Company', parentId: null, active: true };
      const dir = path.join(DATA_DIR, 'costcenters');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      writeJSON(path.join(dir, 'cc_company.json'), root);
      return res.json([root]);
    }
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/costcenters', (req, res) => {
  try {
    const cc = req.body;
    if (!cc?.id || !cc?.name) return res.status(400).json({ error: 'id and name required' });
    const dir = path.join(DATA_DIR, 'costcenters');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeJSON(path.join(dir, safeFileName(cc.id) + '.json'), cc);
    res.json({ success: true, id: cc.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/costcenters/:id', (req, res) => {
  try {
    deleteFile(path.join(DATA_DIR, 'costcenters', safeFileName(req.params.id) + '.json'));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CHART OF ACCOUNTS (simple tree)
app.get('/api/accounts', (req, res) => {
  try {
    let list = readAllFromDir('accounts');
    if (!list.length) {
      const seed = [
        { id: 'acc_assets', name: 'Assets', type: 'Assets', parentId: null, leaf: false },
        { id: 'acc_current_assets', name: 'Current Assets', type: 'Assets', parentId: 'acc_assets', leaf: false },
        { id: 'acc_bank', name: 'Bank', type: 'Assets', parentId: 'acc_current_assets', leaf: true },
        { id: 'acc_cash', name: 'Cash', type: 'Assets', parentId: 'acc_current_assets', leaf: true },
        { id: 'acc_debtors', name: 'Sundry Debtors', type: 'Assets', parentId: 'acc_current_assets', leaf: true },
        { id: 'acc_itc_cgst', name: 'Input CGST', type: 'Assets', parentId: 'acc_current_assets', leaf: true },
        { id: 'acc_itc_sgst', name: 'Input SGST', type: 'Assets', parentId: 'acc_current_assets', leaf: true },
        { id: 'acc_itc_igst', name: 'Input IGST', type: 'Assets', parentId: 'acc_current_assets', leaf: true },
        { id: 'acc_liab', name: 'Liabilities', type: 'Liabilities', parentId: null, leaf: false },
        { id: 'acc_creditors', name: 'Sundry Creditors', type: 'Liabilities', parentId: 'acc_liab', leaf: true },
        { id: 'acc_out_cgst', name: 'Output CGST', type: 'Liabilities', parentId: 'acc_liab', leaf: true },
        { id: 'acc_out_sgst', name: 'Output SGST', type: 'Liabilities', parentId: 'acc_liab', leaf: true },
        { id: 'acc_out_igst', name: 'Output IGST', type: 'Liabilities', parentId: 'acc_liab', leaf: true },
        { id: 'acc_equity', name: 'Equity', type: 'Equity', parentId: null, leaf: false },
        { id: 'acc_capital', name: 'Capital', type: 'Equity', parentId: 'acc_equity', leaf: true },
        { id: 'acc_re', name: 'Retained Earnings', type: 'Equity', parentId: 'acc_equity', leaf: true },
        { id: 'acc_income', name: 'Income', type: 'Income', parentId: null, leaf: false },
        { id: 'acc_sales', name: 'Sales', type: 'Income', parentId: 'acc_income', leaf: true },
        { id: 'acc_exp', name: 'Expense', type: 'Expense', parentId: null, leaf: false },
        { id: 'acc_direct', name: 'Direct Costs', type: 'Expense', parentId: 'acc_exp', leaf: true },
        { id: 'acc_indirect', name: 'Indirect Expenses', type: 'Expense', parentId: 'acc_exp', leaf: true },
      ];
      const dir = path.join(DATA_DIR, 'accounts');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      seed.forEach(a => writeJSON(path.join(dir, a.id + '.json'), a));
      list = seed;
    }
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/accounts', (req, res) => {
  try {
    const a = req.body;
    if (!a?.id || !a?.name) return res.status(400).json({ error: 'missing fields' });
    const dir = path.join(DATA_DIR, 'accounts');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeJSON(path.join(dir, safeFileName(a.id) + '.json'), a);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========================
// BUSINESS PROFILES (multi-business)
// ========================
app.get('/api/profiles', (req, res) => {
  const profiles = readAllFromDir('profiles');
  profiles.sort((a, b) => (a.businessName || '').localeCompare(b.businessName || ''));
  res.json(profiles);
});

app.post('/api/profiles', (req, res) => {
  const prof = req.body;
  if (!prof.id) prof.id = 'biz_' + Date.now();
  const filePath = path.join(DATA_DIR, 'profiles', safeFileName(prof.id) + '.json');
  writeJSON(filePath, prof);
  res.json({ success: true, id: prof.id });
});

app.delete('/api/profiles/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'profiles', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
});

// ========================
// META (counters, etc.)
// ========================
const META_PATH = path.join(DATA_DIR, 'meta.json');

// Must be registered BEFORE /api/meta/:key or Express treats "resetCounters" as a key.
app.post('/api/meta/resetCounters', (req, res) => {
  try {
    const meta = readJSON(META_PATH, {});
    const keys = Object.keys(meta).filter(k => k.startsWith('counter_'));
    keys.forEach(k => { meta[k] = 0; });
    if (req.body && req.body.startNumber != null) {
      const n = Math.max(0, Number(req.body.startNumber) || 0);
      keys.forEach(k => { meta[k] = n; });
    }
    writeJSON(META_PATH, meta);
    res.json({ success: true, reset: keys, meta: Object.fromEntries(keys.map(k => [k, meta[k]])) });
  } catch (e) {
    errRes(res, 500, 'server-error', e);
  }
});

app.get('/api/meta/:key', (req, res) => {
  const meta = readJSON(META_PATH, {});
  res.json({ value: meta[req.params.key] ?? null });
});

app.post('/api/meta/:key', (req, res) => {
  const meta = readJSON(META_PATH, {});
  meta[req.params.key] = req.body?.value;
  writeJSON(META_PATH, meta);
  res.json({ success: true });
});

// Atomic increment for invoice-number counters. Node's I/O is single-threaded
// and readJSON / writeJSON are both synchronous (fs.readFileSync /
// writeFileSync), so wrapping read+write in one handler with no awaits is
// race-free across concurrent HTTP requests. Closes the
// "two saves both reading 5, both writing 6" duplicate-invoice-number bug.
app.post('/api/meta/:key/increment', (req, res) => {
  const meta = readJSON(META_PATH, {});
  const current = Number(meta[req.params.key] || 0);
  const next = current + 1;
  meta[req.params.key] = next;
  writeJSON(META_PATH, meta);
  res.json({ value: next });
});

// ========================
// EXPORT / IMPORT
// ========================
app.get('/api/export', (req, res) => {
  const data = {
    bills: readAllFromDir('bills'),
    profile: readJSON(PROFILE_PATH, DEFAULT_PROFILE),
    clients: readAllFromDir('clients'),
    termsTemplates: readAllFromDir('templates'),
    products: readAllFromDir('products'),
    expenses: readAllFromDir('expenses'),
    recurring: readAllFromDir('recurring'),
    receipts: readAllFromDir('receipts'),
    profiles: readAllFromDir('profiles'),
    purchases: readAllFromDir('purchases'),
    meta: readJSON(META_PATH, {}),
    exportedAt: new Date().toISOString(),
  };
  res.json(data);
});

app.post('/api/import', (req, res) => {
  // v1.10.0 — Match POST /api/bills' overwrite semantics for bills.
  // v1.10.31 — Data-F5.1 fix: overwrite gating now applies to EVERY
  // collection, not just bills. Previously clients / templates / products
  // / expenses / recurring / receipts / profiles / purchases / meta were
  // ALWAYS overwritten regardless of the `?overwrite` flag. A user
  // restoring an old backup expecting a bill-only merge lost every new
  // client / product / template they'd added since the backup — plus the
  // meta counter reset caused invoice-number 409 loops on next save.
  // Also v1.10.31 — Data-F12.2: after any import, scan the imported bills
  // and reconcile the meta counter with each prefix's max existing suffix
  // so the next reservation doesn't collide.
  const data = req.body;
  const overwrite = req.query.overwrite === '1' || req.query.overwrite === 'true';
  const counts = {
    billCount: 0, billSkipped: 0,
    clientCount: 0, clientSkipped: 0,
    templateCount: 0, templateSkipped: 0,
    productCount: 0, productSkipped: 0,
    expenseCount: 0, expenseSkipped: 0,
    recurringCount: 0, recurringSkipped: 0,
    receiptCount: 0, receiptSkipped: 0,
    profileCount: 0, profileSkipped: 0,
    purchaseCount: 0, purchaseSkipped: 0,
  };

  // Helper: upsert one entity to a directory, honouring the overwrite flag.
  const upsertOne = (dirName, entity, countKey, skipKey) => {
    if (!entity?.id) return;
    const p = path.join(DATA_DIR, dirName, safeFileName(entity.id) + '.json');
    if (!overwrite && fs.existsSync(p)) { counts[skipKey]++; return; }
    writeJSON(p, entity);
    counts[countKey]++;
  };

  // Profile is a singleton (single file); overwrite-gated same way.
  if (data.profile) {
    if (overwrite || !fs.existsSync(PROFILE_PATH)) {
      writeJSON(PROFILE_PATH, data.profile);
    }
  }
  (data.bills || []).forEach(b => upsertOne('bills', b, 'billCount', 'billSkipped'));
  (data.clients || []).forEach(c => upsertOne('clients', c, 'clientCount', 'clientSkipped'));
  (data.termsTemplates || []).forEach(t => upsertOne('templates', t, 'templateCount', 'templateSkipped'));
  (data.products || []).forEach(p => upsertOne('products', p, 'productCount', 'productSkipped'));
  (data.expenses || []).forEach(e => upsertOne('expenses', e, 'expenseCount', 'expenseSkipped'));
  (data.recurring || []).forEach(r => upsertOne('recurring', r, 'recurringCount', 'recurringSkipped'));
  (data.receipts || []).forEach(r => upsertOne('receipts', r, 'receiptCount', 'receiptSkipped'));
  (data.profiles || []).forEach(p => upsertOne('profiles', p, 'profileCount', 'profileSkipped'));
  (data.purchases || []).forEach(p => upsertOne('purchases', p, 'purchaseCount', 'purchaseSkipped'));

  // meta.json — same gating. Previously always overwrote → counters could
  // regress below existing bill numbers → collision loop on next save.
  if (data.meta) {
    if (overwrite || !fs.existsSync(META_PATH)) {
      writeJSON(META_PATH, data.meta);
    }
  }

  // v1.10.31 — Data-F12.2: reconcile meta counter with imported bill nums.
  // For every bill just imported (or already on disk), extract the numeric
  // suffix from its invoice number. Bump each `counter_<PREFIX>` in meta
  // to at least max(existing) so the next reservation doesn't collide.
  try {
    const meta = readJSON(META_PATH, {});
    const billFiles = fs.readdirSync(path.join(DATA_DIR, 'bills')).filter(f => f.endsWith('.json'));
    const maxByPrefix = {};
    for (const f of billFiles) {
      let bill;
      try { bill = readJSON(path.join(DATA_DIR, 'bills', f), null); } catch { continue; }
      const num = String(bill?.invoiceNumber || bill?.id || '');
      // Extract prefix + last numeric suffix (e.g. INV/2026-27/0007 → prefix INV, suffix 7)
      const m = num.match(/^([A-Z]+)[\W_].*?(\d+)\s*$/i);
      if (!m) continue;
      const prefix = m[1].toUpperCase();
      const suffix = parseInt(m[2], 10);
      if (!Number.isFinite(suffix)) continue;
      if (!maxByPrefix[prefix] || suffix > maxByPrefix[prefix]) maxByPrefix[prefix] = suffix;
    }
    let metaChanged = false;
    for (const [prefix, maxNum] of Object.entries(maxByPrefix)) {
      const key = `counter_${prefix}`;
      const existing = Number(meta[key]) || 0;
      if (maxNum > existing) {
        meta[key] = maxNum;
        metaChanged = true;
      }
    }
    if (metaChanged) writeJSON(META_PATH, meta);
  } catch (err) {
    console.error('Post-import counter reconciliation failed:', err);
  }

  res.json({ ...counts, hasProfile: !!data.profile });
});

// ========================
// Save PDF to local folder
// ========================
const INVOICES_DIR = path.join(__dirname, 'Saved Invoices');
if (!fs.existsSync(INVOICES_DIR)) fs.mkdirSync(INVOICES_DIR, { recursive: true });

app.post('/api/save-pdf', express.raw({ type: 'application/pdf', limit: '20mb' }), (req, res) => {
  try {
    // v1.10.0 — Path traversal fix. Previous filter stripped
    // `<>:"/\|?*` but NOT `..`, so `?client=..&month=..&name=x.bat`
    // resolved to `INVOICES_DIR/../../x.bat` and wrote attacker bytes
    // above the app root. safePathSegment collapses `..` and control
    // chars; the resolved-path guard below rejects anything that still
    // escapes INVOICES_DIR.
    const rawName = req.query.name || `invoice-${Date.now()}.pdf`;
    const safeClient = safePathSegment(req.query.client, 'General');
    const safeMonth = safePathSegment(req.query.month, new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }));
    let safeName = safePathSegment(rawName, `invoice-${Date.now()}.pdf`);
    if (!safeName.toLowerCase().endsWith('.pdf')) safeName += '.pdf';

    const folderPath = path.join(INVOICES_DIR, safeClient, safeMonth);
    const filePath = path.join(folderPath, safeName);
    if (!isPathInside(filePath, INVOICES_DIR)) return errRes(res, 400, 'invalid-path');

    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
    fs.writeFileSync(filePath, req.body);
    // Don't leak absolute FS path — client only needs to know it saved
    // and where (relative). Absolute path revealed OS username +
    // install dir to any origin.
    res.json({ saved: true, relPath: path.relative(__dirname, filePath).split(path.sep).join('/') });
  } catch (err) {
    errRes(res, 500, 'server-error', err);
  }
});

// ========================
// Move saved PDF to Trash
// ========================
const TRASH_DIR = path.join(__dirname, 'Trash');

if (!fs.existsSync(TRASH_DIR)) fs.mkdirSync(TRASH_DIR, { recursive: true });

app.post('/api/trash-pdf', express.json(), (req, res) => {
  try {
    const { fileName, clientName } = req.body;
    if (!fileName) return errRes(res, 400, 'bad-request');

    // v1.10.0 — Path traversal fix (see save-pdf comment). Prior code
    // didn't strip `..` so `fileName: '../../../etc/passwd'` moved
    // arbitrary local files into the Trash.
    const safeClient = safePathSegment(clientName, 'General');
    const safeName = safePathSegment(fileName, 'Untitled.pdf');

    const clientDir = path.join(INVOICES_DIR, safeClient);
    // Extra guard — reject if the constructed client dir somehow escaped.
    if (!isPathInside(clientDir, INVOICES_DIR)) return errRes(res, 400, 'invalid-path');
    let found = false;

    if (fs.existsSync(clientDir)) {
      const months = fs.readdirSync(clientDir).filter(f => {
        try { return fs.statSync(path.join(clientDir, f)).isDirectory(); } catch { return false; }
      });
      for (const month of months) {
        const filePath = path.join(clientDir, month, safeName);
        if (!isPathInside(filePath, INVOICES_DIR)) continue;
        if (fs.existsSync(filePath)) {
          const trashPath = path.join(TRASH_DIR, safeClient, month);
          const trashFile = path.join(trashPath, safeName);
          if (!isPathInside(trashFile, TRASH_DIR)) return errRes(res, 400, 'invalid-path');
          if (!fs.existsSync(trashPath)) fs.mkdirSync(trashPath, { recursive: true });
          try {
            fs.renameSync(filePath, trashFile);
          } catch {
            fs.copyFileSync(filePath, trashFile);
            fs.unlinkSync(filePath);
          }
          found = true;
          break;
        }
      }
    }

    if (!found) {
      const flatPath = path.join(INVOICES_DIR, safeName);
      if (isPathInside(flatPath, INVOICES_DIR) && fs.existsSync(flatPath)) {
        const trashPath = path.join(TRASH_DIR, safeClient);
        const trashFile = path.join(trashPath, safeName);
        if (isPathInside(trashFile, TRASH_DIR)) {
          if (!fs.existsSync(trashPath)) fs.mkdirSync(trashPath, { recursive: true });
          try {
            fs.renameSync(flatPath, trashFile);
          } catch {
            fs.copyFileSync(flatPath, trashFile);
            fs.unlinkSync(flatPath);
          }
          found = true;
        }
      }
    }

    res.json({ trashed: found });
  } catch (err) {
    errRes(res, 500, 'server-error', err);
  }
});

// ========================
// Version check
// ========================
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

app.get('/api/version', (req, res) => {
  res.json({ current: pkg.version });
});

// Naive semver compare — returns +1 if a > b, -1 if a < b, 0 if equal.
// "1.4.10" > "1.4.2" correctly (numeric parts), unlike a string compare.
function compareSemver(a, b) {
  const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

app.get('/api/check-update', async (req, res) => {
  try {
    // Two parallel fetches: package.json (definitive version source) and the
    // GitHub Releases API (for release notes). Both have a 4s timeout so a
    // flaky network can't lock the UI.
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const [pkgRes, relRes] = await Promise.all([
      fetch('https://raw.githubusercontent.com/veeranki97/SD-Dynamics-V.10/main/_system/package.json', { signal: ctrl.signal })
        .catch(() => fetch('https://raw.githubusercontent.com/veeranki97/SD-Dynamics-V.10/main/package.json', { signal: ctrl.signal })),
      fetch('https://api.github.com/repos/veeranki97/SD-Dynamics-V.10/releases/latest', {
        signal: ctrl.signal,
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'SD-Dynamics-update-check' },
      }).catch(() => null),
    ]);
    clearTimeout(t);

    if (!pkgRes.ok) throw new Error('GitHub fetch failed');
    const remote = await pkgRes.json();
    const cmp = compareSemver(remote.version, pkg.version);
    const updateAvailable = cmp > 0;

    let releaseNotes = null;
    let releaseUrl = null;
    let releasePublishedAt = null;
    let releaseTag = null;
    if (relRes && relRes.ok) {
      const rel = await relRes.json();
      releaseNotes = rel.body || null;
      releaseUrl = rel.html_url || null;
      releasePublishedAt = rel.published_at || null;
      releaseTag = rel.tag_name || null;
    }

    res.json({
      current: pkg.version,
      latest: remote.version,
      updateAvailable,
      releaseNotes,
      releaseUrl,
      releasePublishedAt,
      releaseTag,
    });
  } catch {
    res.json({ current: pkg.version, latest: null, updateAvailable: false, error: 'Could not reach GitHub — check internet / firewall' });
  }
});

// ============================================================
// v1.10.44 — In-app Control Panel API
// Powers /control-panel in the app. Each endpoint shells out to
// a platform-appropriate script under `_system-scripts/` (when
// the app is installed via the HTA launcher release ZIP) or the
// equivalent .bat / .sh in the dev repo root as a fallback.
// ============================================================
import { spawn } from 'child_process';

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// Where the launcher scripts live. In a release-ZIP install the app
// is under `_system/` so `..` gets us to the launcher's script dir;
// in dev the same relative path lands us at `release-templates/_system-scripts/`
// which also holds them. If neither exists we degrade gracefully —
// the Control Panel just shows the buttons as disabled.
const CONTROL_SCRIPT_CANDIDATES = [
  path.join(__dirname, '_system-scripts'),         // shipped ZIP layout
  path.join(__dirname, 'release-templates', '_system-scripts'), // dev repo
  path.join(__dirname, '..', '_system-scripts'),   // sibling to root when app is under _system/
];
const controlScriptDir = CONTROL_SCRIPT_CANDIDATES.find(p => {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}) || null;

function pickScript(name) {
  if (!controlScriptDir) return null;
  const suffix = isWindows ? '-windows.ps1' : '-unix.sh';
  const p = path.join(controlScriptDir, name + suffix);
  return fs.existsSync(p) ? p : null;
}

function runControlScript(scriptPath) {
  return new Promise((resolve) => {
    if (!scriptPath) { resolve({ ok: false, error: 'Script not found for this platform' }); return; }
    // v1.10.66 (#59) — update-unix.sh is plain POSIX sh, so it runs under `sh`
    // and therefore also where bash does not exist (Alpine / BusyBox NAS
    // images). The other Unix scripts use bash features and keep running under
    // bash, found on PATH as before — /usr/local/bin/bash on TrueNAS CORE,
    // /run/current-system/sw/bin/bash on NixOS.
    const unixShell = path.basename(scriptPath) === 'update-unix.sh' ? 'sh' : 'bash';
    const [cmd, args] = isWindows
      ? ['powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath]]
      : [unixShell, [scriptPath]];
    let out = '', err = '';
    try {
      const child = spawn(cmd, args, { detached: false, windowsHide: false });
      child.stdout?.on('data', d => { out += d.toString(); });
      child.stderr?.on('data', d => { err += d.toString(); });
      child.on('error', e => resolve({ ok: false, error: e.message }));
      child.on('exit', code => resolve({ ok: code === 0, exitCode: code, stdout: out.slice(-4000), stderr: err.slice(-2000) }));
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
}

app.get('/api/control-panel/status', (req, res) => {
  const dataSize = (() => {
    try {
      let total = 0;
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(p);
          else { try { total += fs.statSync(p).size; } catch { /* ignore */ } }
        }
      };
      if (fs.existsSync(DATA_DIR)) walk(DATA_DIR);
      return total;
    } catch { return 0; }
  })();
  // Port is bound in startServer() below; read it back from the socket
  // address at request time rather than relying on a module-level const
  // that doesn't exist. Falls back to the persisted preference for the
  // edge case where the request arrives before activeServer is set.
  let activePort = STARTING_PORT;
  try {
    const addr = activeServer && activeServer.address();
    if (addr && typeof addr === 'object' && addr.port) activePort = addr.port;
  } catch { /* keep fallback */ }
  res.json({
    platform: process.platform,
    node: process.version,
    controlScriptsAvailable: !!controlScriptDir,
    dataFolder: DATA_DIR,
    dataSizeBytes: dataSize,
    port: activePort,
    launcherType: controlScriptDir ? (isWindows ? 'hta' : (isMac ? 'command' : 'sh')) : 'none',
  });
});

app.post('/api/control-panel/backup', async (req, res) => {
  const script = pickScript('backup');
  const result = await runControlScript(script);
  res.json(result);
});

app.post('/api/control-panel/open-data-folder', (req, res) => {
  try {
    if (isWindows) spawn('explorer.exe', [DATA_DIR], { detached: true }).unref();
    else if (isMac) spawn('open', [DATA_DIR], { detached: true }).unref();
    else spawn('xdg-open', [DATA_DIR], { detached: true }).unref();
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/control-panel/open-backups-folder', (req, res) => {
  const backupsHome = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Documents', 'FreeGSTBill Backups');
  try {
    if (!fs.existsSync(backupsHome)) fs.mkdirSync(backupsHome, { recursive: true });
    if (isWindows) spawn('explorer.exe', [backupsHome], { detached: true }).unref();
    else if (isMac) spawn('open', [backupsHome], { detached: true }).unref();
    else spawn('xdg-open', [backupsHome], { detached: true }).unref();
    res.json({ ok: true, path: backupsHome });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/control-panel/launch-script', async (req, res) => {
  // Whitelisted script actions the Control Panel exposes.
  const allowed = new Set(['update', 'restore', 'move', 'stop']);
  const action = String(req.body?.action || '');
  if (!allowed.has(action)) { res.status(400).json({ ok: false, error: 'Unknown action' }); return; }
  const script = pickScript(action);
  const result = await runControlScript(script);
  res.json(result);
});

// ========================
// Serve production build
// ========================
// We register BOTH the static middleware and the SPA catch-all unconditionally.
// The static middleware silently no-ops when dist/ doesn't exist; the catch-all
// then checks per-request and serves either index.html (build ready) or the
// friendly "still building" page (build not ready). This means the server can
// start before `vite build` finishes — common in StackBlitz, Codespaces, or
// when a user accidentally runs `node server.js` directly — and seamlessly
// flips to serving the app the moment dist/ appears.
const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');
app.use(express.static(distPath, { fallthrough: true })); // fallthrough = ok if dist doesn't exist

// ============================================================
// v1.9.5 — Automatic daily backup + retention (keep last 30 days).
// MUST be registered BEFORE the SPA catch-all below, otherwise
// GET /api/backups and GET /api/trash get swallowed by the catch-all
// and return 404. Bug discovered by smoke test after v1.9.5 shipped.
// ============================================================
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const BILL_TRASH_DIR = path.join(DATA_DIR, 'trash');
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function copyDirRecursive(src, dst) {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

// v1.10.0 — Local-timezone date, not UTC. Previous code used
// `new Date().toISOString().split('T')[0]` which flips at midnight UTC
// (05:30 IST) — an IST reboot at 05:29 vs 05:31 IST computed different
// "today" values → duplicate backup dirs or a skipped calendar day.
// Uses the sv-SE locale hack for guaranteed YYYY-MM-DD output.
function todayLocalIso() {
  return new Date().toLocaleDateString('sv-SE');
}

function runDailyBackup() {
  try {
    ensureDir(BACKUPS_DIR);
    const today = todayLocalIso();
    const target = path.join(BACKUPS_DIR, today);
    if (fs.existsSync(target)) return;
    ensureDir(target);
    const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
    for (const entry of entries) {
      // v1.10.31 — Data-F7.1: `trash` is now INCLUDED in daily backups.
      // Previously excluded → users restoring last week's backup lost every
      // bill they'd trashed since, breaking the 30-day soft-delete promise.
      // We still skip `backups` (no recursion) and log files.
      if (entry.name === 'backups' || entry.name === 'errors.log' || entry.name === 'port.txt') continue;
      const src = path.join(DATA_DIR, entry.name);
      const dst = path.join(target, entry.name);
      if (entry.isDirectory()) copyDirRecursive(src, dst);
      else fs.copyFileSync(src, dst);
    }
    console.log(`[backup] Daily snapshot saved: ${target}`);
    const all = fs.readdirSync(BACKUPS_DIR).filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
    while (all.length > 30) {
      const oldest = all.shift();
      const oldestPath = path.join(BACKUPS_DIR, oldest);
      try { fs.rmSync(oldestPath, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  } catch (err) {
    console.warn('[backup] Daily backup failed:', err.message);
  }
}

setTimeout(runDailyBackup, 5000);
setInterval(runDailyBackup, 24 * 60 * 60 * 1000);

// Backup management endpoints
app.get('/api/backups', (req, res) => {
  try {
    ensureDir(BACKUPS_DIR);
    const list = fs.readdirSync(BACKUPS_DIR)
      .filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n))
      .sort().reverse()
      .map(name => {
        const stat = fs.statSync(path.join(BACKUPS_DIR, name));
        return { date: name, createdAt: stat.mtime.toISOString() };
      });
    res.json(list);
  } catch (err) { errRes(res, 500, 'server-error', err); }
});

// v1.10.22 — Manual delete of a specific dated backup. Reported: "add
// here delete option i know u added 30 days auto delete but manual delete
// also u add". Guarded by the same path-inside + calendar-date checks the
// restore endpoint uses so a crafted `:date` cannot escape BACKUPS_DIR.
app.delete('/api/backups/:date', (req, res) => {
  try {
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return errRes(res, 400, 'bad-request');
    const [y, m, d] = date.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) {
      return errRes(res, 400, 'bad-request');
    }
    const backupDir = path.join(BACKUPS_DIR, date);
    if (!isPathInside(backupDir, BACKUPS_DIR)) return errRes(res, 400, 'invalid-path');
    if (!fs.existsSync(backupDir)) return errRes(res, 404, 'not-found');
    fs.rmSync(backupDir, { recursive: true, force: true });
    res.json({ success: true, date });
  } catch (err) { errRes(res, 500, 'server-error', err); }
});

app.post('/api/backups/:date/restore', (req, res) => {
  // v1.10.0 — Transactional restore. Prior implementation
  // `fs.rmSync(dst)` -> `copyDirRecursive(src, dst)`. If copy threw
  // partway (ENOSPC, EACCES, half-corrupted backup), the user's live
  // data was already gone and only a partial restore existed. Now: we
  // rename the current directories to a "pre-restore-<timestamp>"
  // snapshot inside BACKUPS_DIR, do the copy, and only rmSync the
  // snapshot on success. If anything throws, we rename the snapshot
  // back — user is back where they started.
  let snapshotDir = null;
  const restoredDirs = [];
  try {
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return errRes(res, 400, 'bad-request');
    const backupDir = path.join(BACKUPS_DIR, date);
    if (!isPathInside(backupDir, BACKUPS_DIR)) return errRes(res, 400, 'invalid-path');
    if (!fs.existsSync(backupDir)) return errRes(res, 404, 'not-found');

    // Additional date sanity — a directory can exist with an unrealistic
    // date planted before hardening. Reject impossible calendar dates.
    const [y, m, d] = date.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) {
      return errRes(res, 400, 'bad-request');
    }

    // Make a snapshot of live data before touching anything.
    snapshotDir = path.join(BACKUPS_DIR, `pre-restore-${Date.now()}`);
    ensureDir(snapshotDir);
    const liveEntries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
    for (const entry of liveEntries) {
      if (entry.name === 'backups' || entry.name === 'errors.log' || entry.name === 'port.txt') continue;
      const src = path.join(DATA_DIR, entry.name);
      const dst = path.join(snapshotDir, entry.name);
      if (entry.isDirectory()) copyDirRecursive(src, dst);
      else fs.copyFileSync(src, dst);
    }

    // Now do the restore. Track what we replaced so rollback knows
    // which dirs to nuke first.
    const backupEntries = fs.readdirSync(backupDir, { withFileTypes: true });
    for (const entry of backupEntries) {
      const src = path.join(backupDir, entry.name);
      const dst = path.join(DATA_DIR, entry.name);
      if (!isPathInside(dst, DATA_DIR)) continue;
      if (entry.isDirectory()) {
        if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
        copyDirRecursive(src, dst);
      } else {
        fs.copyFileSync(src, dst);
      }
      restoredDirs.push(entry.name);
    }

    // Success — remove the pre-restore snapshot (or keep for a bit? we
    // remove because the backup itself is still on disk as a rollback
    // option). Failures below prevent removal.
    fs.rmSync(snapshotDir, { recursive: true, force: true });
    res.json({ success: true, restored: date });
  } catch (err) {
    // Rollback: put the snapshot back over whatever the restore
    // half-did. This preserves user data at the cost of losing the
    // partial restore (which was probably corrupt anyway).
    if (snapshotDir && fs.existsSync(snapshotDir)) {
      try {
        for (const name of restoredDirs) {
          const dst = path.join(DATA_DIR, name);
          if (!isPathInside(dst, DATA_DIR)) continue;
          if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
          const snap = path.join(snapshotDir, name);
          if (fs.existsSync(snap)) {
            if (fs.statSync(snap).isDirectory()) copyDirRecursive(snap, dst);
            else fs.copyFileSync(snap, dst);
          }
        }
      } catch { /* if rollback fails, snapshot stays on disk for manual recovery */ }
    }
    errRes(res, 500, 'server-error', err);
  }
});

// v1.10.6 — audit L11: throttle. Prior code let any caller spam this
// endpoint and each hit walked the whole data tree + 30-day pruning.
// The `if (fs.existsSync(target)) return` inside runDailyBackup makes
// this idempotent per day, but the fs walks still happen. Now: at most
// one call per 5 seconds; excess return 429 with a hint.
let __lastBackupNowMs = 0;
app.post('/api/backups/now', (req, res) => {
  const now = Date.now();
  if (now - __lastBackupNowMs < 5000) {
    return errRes(res, 429, 'server-error');
  }
  __lastBackupNowMs = now;
  runDailyBackup();
  res.json({ success: true });
});

// ---- Trash bin (soft delete for invoices) ---------------------------------
ensureDir(BILL_TRASH_DIR);

app.get('/api/trash', (req, res) => {
  try {
    ensureDir(BILL_TRASH_DIR);
    const files = fs.readdirSync(BILL_TRASH_DIR)
      .filter(n => n.endsWith('.json'))
      .map(name => {
        try {
          const p = path.join(BILL_TRASH_DIR, name);
          const bill = readJSON(p, null);
          const stat = fs.statSync(p);
          return bill ? { ...bill, _trashedAt: stat.mtime.toISOString() } : null;
        } catch { return null; }
      })
      .filter(Boolean);
    res.json(files);
  } catch (err) { errRes(res, 500, 'server-error', err); }
});

app.post('/api/trash/:id/restore', (req, res) => {
  try {
    const fname = safeFileName(req.params.id) + '.json';
    const trashPath = path.join(BILL_TRASH_DIR, fname);
    const billsPath = path.join(DATA_DIR, 'bills', fname);
    if (!fs.existsSync(trashPath)) return res.status(404).json({ error: 'Not in trash' });
    fs.renameSync(trashPath, billsPath);
    res.json({ success: true });
  } catch (err) { errRes(res, 500, 'server-error', err); }
});

app.delete('/api/trash/:id', (req, res) => {
  try {
    const fname = safeFileName(req.params.id) + '.json';
    const trashPath = path.join(BILL_TRASH_DIR, fname);
    if (fs.existsSync(trashPath)) fs.unlinkSync(trashPath);
    res.json({ success: true });
  } catch (err) { errRes(res, 500, 'server-error', err); }
});

function purgeOldTrash() {
  try {
    ensureDir(BILL_TRASH_DIR);
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(BILL_TRASH_DIR)) {
      const p = path.join(BILL_TRASH_DIR, name);
      const stat = fs.statSync(p);
      if (now - stat.mtime.getTime() > thirtyDays) {
        try { fs.unlinkSync(p); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
}
setInterval(purgeOldTrash, 24 * 60 * 60 * 1000);

// v1.10.0 — Health-check endpoint moved here (was registered AFTER the

// ---- Master data (HSN / Units / Expense categories) — survives port change ----
const MASTER_DATA_PATH = path.join(DATA_DIR, 'master-data.json');
app.get('/api/master-data', (req, res) => {
  try {
    const data = readJSON(MASTER_DATA_PATH, { hsn: [], units: [], expenseCategories: [] });
    res.json(data);
  } catch (e) {
    res.json({ hsn: [], units: [], expenseCategories: [] });
  }
});
app.post('/api/master-data', (req, res) => {
  try {
    const body = req.body || {};
    const prev = readJSON(MASTER_DATA_PATH, { hsn: [], units: [], expenseCategories: [] });
    const next = {
      hsn: Array.isArray(body.hsn) ? body.hsn : (prev.hsn || []),
      units: Array.isArray(body.units) ? body.units : (prev.units || []),
      expenseCategories: Array.isArray(body.expenseCategories) ? body.expenseCategories : (prev.expenseCategories || []),
      updatedAt: new Date().toISOString(),
    };
    writeJSON(MASTER_DATA_PATH, next);
    res.json({ success: true, ...next });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Activity / audit logs (MUST be before SPA catch-all or GET returns 404) ----

app.get('/api/invoice-revisions', (req, res) => {
  try {
    const dir = path.join(DATA_DIR, 'invoice-revisions');
    if (!fs.existsSync(dir)) return res.json([]);
    const inv = String(req.query.invoice || req.query.id || '').trim();
    let files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    if (inv) {
      const key = safeFileName(inv);
      files = files.filter(f => f.startsWith(key + '_'));
    }
    files.sort().reverse();
    const out = files.slice(0, 100).map(f => {
      try { return readJSON(path.join(dir, f), null); } catch { return null; }
    }).filter(Boolean);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/activity-logs', (req, res) => {
  try {
    const dir = path.join(DATA_DIR, 'activity-logs');
    if (!fs.existsSync(dir)) return res.json([]);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse().slice(0, 500);
    const rows = files.map(f => {
      try { return { file: f, ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }; }
      catch { return { file: f }; }
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/activity-logs', (req, res) => {
  try {
    const dir = path.join(DATA_DIR, 'activity-logs');
    fs.mkdirSync(dir, { recursive: true });
    const body = req.body || {};
    const entry = {
      entityType: body.entityType || 'app',
      entityId: body.entityId || 'n/a',
      action: body.action || 'event',
      user: body.user || 'local',
      at: body.at || new Date().toISOString(),
      diff: body.diff || body.note || {},
    };
    const ts = String(entry.at).replace(/[:.]/g, '-');
    const safe = (s) => String(s || 'x').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40);
    const fp = path.join(dir, ts + '_' + safe(entry.entityType) + '_' + safe(entry.entityId) + '.json');
    fs.writeFileSync(fp, JSON.stringify(entry, null, 2), 'utf8');
    // Cap growth: keep newest 500 activity files (safe for 1000+ invoices)
    try {
      const all = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
      if (all.length > 500) {
        for (const f of all.slice(0, all.length - 500)) {
          try { fs.unlinkSync(path.join(dir, f)); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore prune */ }
    res.json({ success: true, file: path.basename(fp) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// SPA catch-all → every GET /api/health returned "No such endpoint" →
// the UI's health-banner was permanently broken). Now registered
// before the catch-all so it actually serves.
app.get('/api/health', (req, res) => {
  let errorsTail = '';
  try {
    if (fs.existsSync(ERRORS_LOG)) {
      const stat = fs.statSync(ERRORS_LOG);
      // Read the last 4KB only so a runaway log file can't OOM the response.
      const fd = fs.openSync(ERRORS_LOG, 'r');
      const len = Math.min(stat.size, 4096);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, Math.max(0, stat.size - len));
      fs.closeSync(fd);
      errorsTail = buf.toString('utf-8');
    }
  } catch { /* ignore */ }
  let appVer = 'unknown';
  try {
    // Prefer package.json next to server (works when started as `node server.js`)
    const pkgPath = path.join(__dirname, 'package.json');
    if (fs.existsSync(pkgPath)) {
      appVer = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || appVer;
    }
  } catch { /* ignore */ }
  if (appVer === 'unknown' && process.env.npm_package_version) {
    appVer = process.env.npm_package_version;
  }
  res.json({
    ok: true,
    version: appVer,
    uptimeSec: Math.round(process.uptime()),
    pid: process.pid,
    hasRecentErrors: !!errorsTail.trim(),
    errorsTail: errorsTail || '',
  });
});


// ============================================================
// HRM / Payroll API (JSON-file storage under data/hrm/)
// Port of Sai Durga GAS HR ERP — employees, attendance, payroll, PF/ESI
// ============================================================
const HRM_DIR = path.join(DATA_DIR, 'hrm');
function hrmEnsure() {
  ['employees', 'attendance', 'payroll', 'minwages', 'settings'].forEach(d => {
    const p = path.join(HRM_DIR, d);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });
  const settingsFile = path.join(HRM_DIR, 'settings', 'config.json');
  if (!fs.existsSync(settingsFile)) {
    writeJSON(settingsFile, {
      pfCap: 15000, esiCap: 21000, proration: 'ACTUAL', pfBase: 'BASIC_DA', lastEmpNum: 0,
      // Sites / locations (pick on employee form after State)
      sites: [
        { id: 'site_hq', name: 'Head Office', state: '' },
      ],
      establishmentCode: '', // EPFO establishment code
      esicCode: '', // ESIC employer code
      employerName: '',
    });
  }
}
/** Always use forward-slash relative keys so dirCache matches writes. */
function hrmRel(subdir) {
  return 'hrm/' + String(subdir || '').replace(/\\/g, '/');
}
function hrmReadAll(subdir) {
  hrmEnsure();
  return readAllFromDir(hrmRel(subdir));
}
function hrmInvalidate(subdir) {
  invalidateCache(hrmRel(subdir));
  try { invalidateCache(path.join('hrm', subdir)); } catch { /* ignore */ }
}
function hrmGetConfig() {
  hrmEnsure();
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(HRM_DIR, 'settings', 'config.json'), 'utf8'));
    if (!Array.isArray(cfg.sites)) cfg.sites = [{ id: 'site_hq', name: 'Head Office', state: '' }];
    return cfg;
  } catch {
    return {
      pfCap: 15000, esiCap: 21000, proration: 'ACTUAL', pfBase: 'BASIC_DA', lastEmpNum: 0,
      sites: [{ id: 'site_hq', name: 'Head Office', state: '' }],
      establishmentCode: '', esicCode: '', employerName: '',
    };
  }
}
function hrmSaveConfig(cfg) {
  hrmEnsure();
  writeJSON(path.join(HRM_DIR, 'settings', 'config.json'), cfg);
  hrmInvalidate('settings');
}
function hrmRound2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function hrmCalcPF(baseWage, pfApp, pfCap) {
  if (!pfApp) return { ee: 0, er: 0, eps: 0, edli: 0, wages: 0 };
  const w = Math.min(baseWage, pfCap);
  const eps = Math.min(Math.round(w * 0.0833), 1250);
  const er = Math.round(w * 0.12) - eps;
  const ee = Math.round(baseWage * 0.12);
  return { ee, er, eps, edli: w, wages: baseWage };
}
function hrmCalcESI(gross, esiApp, esiCap) {
  if (!esiApp || gross > esiCap) return { ee: 0, er: 0, wages: 0 };
  return { ee: Math.ceil(gross * 0.0075), er: Math.ceil(gross * 0.0325), wages: gross };
}

app.get('/api/hrm/config', (req, res) => {
  res.json(hrmGetConfig());
});
app.post('/api/hrm/config', (req, res) => {
  const cur = hrmGetConfig();
  const next = { ...cur, ...req.body };
  hrmSaveConfig(next);
  res.json(next);
});

app.get('/api/hrm/employees', (req, res) => {
  const list = hrmReadAll('employees').filter(e => !e.deleted);
  res.json(list);
});
app.post('/api/hrm/employees', (req, res) => {
  hrmEnsure();
  const body = req.body || {};
  const cfg = hrmGetConfig();
  let emp = { ...body };
  if (!emp.id) {
    cfg.lastEmpNum = (cfg.lastEmpNum || 0) + 1;
    emp.id = 'emp_' + Date.now().toString(36);
    emp.employeeCode = emp.employeeCode || ('SD-' + String(cfg.lastEmpNum).padStart(3, '0'));
    emp.createdAt = new Date().toISOString();
    hrmSaveConfig(cfg);
  }
  // Duplicate UAN/ESIC check on active
  const all = hrmReadAll('employees').filter(e => !e.deleted && e.isActive !== false);
  for (const o of all) {
    if (o.id === emp.id) continue;
    if (emp.uan && o.uan && String(o.uan).trim() === String(emp.uan).trim()) {
      return res.status(409).json({ error: `Duplicate UAN — assigned to ${o.name}` });
    }
    if (emp.esicNumber && o.esicNumber && String(o.esicNumber).trim() === String(emp.esicNumber).trim()) {
      return res.status(409).json({ error: `Duplicate ESIC — assigned to ${o.name}` });
    }
  }
  emp.updatedAt = new Date().toISOString();
  if (!emp.name || !String(emp.name).trim()) {
    return res.status(400).json({ error: 'Employee name is required' });
  }
  // Coerce numeric salary fields
  ['basic', 'hra', 'da', 'allowances'].forEach((k) => {
    if (emp[k] != null && emp[k] !== '') emp[k] = Number(emp[k]) || 0;
  });
  writeJSON(path.join(HRM_DIR, 'employees', safeFileName(emp.id) + '.json'), emp);
  hrmInvalidate('employees');
  res.json(emp);
});
app.delete('/api/hrm/employees/:id', (req, res) => {
  const id = req.params.id;
  const file = path.join(HRM_DIR, 'employees', safeFileName(id) + '.json');
  if (fs.existsSync(file)) {
    const e = JSON.parse(fs.readFileSync(file, 'utf8'));
    e.deleted = true; e.isActive = false; e.updatedAt = new Date().toISOString();
    writeJSON(file, e);
    hrmInvalidate('employees');
  }
  res.json({ ok: true });
});

app.get('/api/hrm/minwages', (req, res) => res.json(hrmReadAll('minwages')));
app.post('/api/hrm/minwages', (req, res) => {
  hrmEnsure();
  const row = { ...req.body, id: req.body.id || ('mw_' + Date.now().toString(36)) };
  if (!row.state) return res.status(400).json({ error: 'State is required' });
  writeJSON(path.join(HRM_DIR, 'minwages', safeFileName(row.id) + '.json'), row);
  hrmInvalidate('minwages');
  res.json(row);
});
app.delete('/api/hrm/minwages/:id', (req, res) => {
  const file = path.join(HRM_DIR, 'minwages', safeFileName(req.params.id) + '.json');
  if (fs.existsSync(file)) fs.unlinkSync(file);
  hrmInvalidate('minwages');
  res.json({ ok: true });
});

app.get('/api/hrm/attendance', (req, res) => {
  const m = String(req.query.month || '');
  const y = String(req.query.year || '');
  const key = `${y}_${m}`;
  const file = path.join(HRM_DIR, 'attendance', safeFileName(key) + '.json');
  if (fs.existsSync(file)) return res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
  res.json({ month: m, year: y, rows: [] });
});
app.post('/api/hrm/attendance', (req, res) => {
  hrmEnsure();
  const { month, year, rows } = req.body || {};
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const key = `${year}_${month}`;
  const payload = { month, year, rows: rows || [], updatedAt: new Date().toISOString() };
  writeJSON(path.join(HRM_DIR, 'attendance', safeFileName(key) + '.json'), payload);
  hrmInvalidate('attendance');
  res.json(payload);
});

app.get('/api/hrm/payroll', (req, res) => {
  const m = String(req.query.month || '');
  const y = String(req.query.year || '');
  const key = `${y}_${m}`;
  const file = path.join(HRM_DIR, 'payroll', safeFileName(key) + '.json');
  if (fs.existsSync(file)) return res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
  res.json({ month: m, year: y, locked: false, rows: [] });
});

app.post('/api/hrm/payroll/process', (req, res) => {
  hrmEnsure();
  const month = Number(req.body.month);
  const year = Number(req.body.year);
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const key = `${year}_${month}`;
  const existingFile = path.join(HRM_DIR, 'payroll', safeFileName(key) + '.json');
  if (fs.existsSync(existingFile)) {
    const ex = JSON.parse(fs.readFileSync(existingFile, 'utf8'));
    if (ex.locked) return res.status(400).json({ error: 'Payroll locked for this month' });
  }
  const cfg = hrmGetConfig();
  const employees = hrmReadAll('employees').filter(e => !e.deleted && e.isActive !== false);
  const attFile = path.join(HRM_DIR, 'attendance', safeFileName(key) + '.json');
  let attRows = [];
  if (fs.existsSync(attFile)) attRows = (JSON.parse(fs.readFileSync(attFile, 'utf8')).rows) || [];
  const attMap = {};
  attRows.forEach(r => { attMap[r.empId] = r; });
  const totalDays = new Date(year, month, 0).getDate();
  const warnings = [];
  const rows = [];
  employees.forEach(emp => {
    const att = attMap[emp.id];
    if (!att) return;
    let payable = Number(att.payableDays);
    if (!Number.isFinite(payable)) {
      // count P W PL H/2
      let p = 0;
      for (let d = 1; d <= 31; d++) {
        const v = String(att.days?.['D' + d] || '').toUpperCase();
        if (v === 'P') p += 1;
        else if (v === 'W' || v === 'PL') p += 1;
        else if (v === 'H') p += 0.5;
      }
      payable = p;
    }
    if (payable <= 0) return;
    const basic = Number(emp.basic) || 0;
    const hra = Number(emp.hra) || 0;
    const da = Number(emp.da) || 0;
    const allow = Number(emp.allowances) || 0;
    let div = totalDays;
    if (cfg.proration === '26') { div = 26; payable = Math.min(payable, 26); }
    if (cfg.proration === '30') { div = 30; payable = Math.min(payable, 30); }
    const bE = Math.round((basic / div) * payable);
    const hE = Math.round((hra / div) * payable);
    const dE = Math.round((da / div) * payable);
    const oE = Math.round((allow / div) * payable);
    const gross = bE + hE + dE + oE;
    const pfBaseAmt = cfg.pfBase === 'BASIC' ? bE : (bE + dE);
    const pf = hrmCalcPF(pfBaseAmt, !!emp.pfApplicable, Number(cfg.pfCap) || 15000);
    const esi = hrmCalcESI(gross, !!emp.esiApplicable, Number(cfg.esiCap) || 21000);
    const net = gross - pf.ee - esi.ee - (Number(emp.tds) || 0) - (Number(emp.advance) || 0);
    rows.push({
      empId: emp.id,
      employeeCode: emp.employeeCode,
      name: emp.name,
      payableDays: payable,
      basicEarned: bE, hraEarned: hE, daEarned: dE, allowancesEarned: oE,
      grossEarnings: gross,
      pfWages: pf.wages, pfEE: pf.ee, pfER: pf.er, eps: pf.eps,
      esiWages: esi.wages, esiEE: esi.ee, esiER: esi.er,
      netSalary: hrmRound2(net),
      approvalStatus: 'Draft',
    });
  });
  const payload = {
    month, year, locked: false, rows, warnings,
    processedAt: new Date().toISOString(),
  };
  writeJSON(existingFile, payload);
  hrmInvalidate('payroll');
  res.json(payload);
});

app.post('/api/hrm/payroll/lock', (req, res) => {
  const month = Number(req.body.month);
  const year = Number(req.body.year);
  const key = `${year}_${month}`;
  const file = path.join(HRM_DIR, 'payroll', safeFileName(key) + '.json');
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'No payroll for this month' });
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.locked = true;
  data.lockedAt = new Date().toISOString();
  writeJSON(file, data);
  hrmInvalidate('payroll');
  res.json(data);
});

app.get('/api/hrm/dashboard', (req, res) => {
  const month = Number(req.query.month) || (new Date().getMonth() + 1);
  const year = Number(req.query.year) || new Date().getFullYear();
  const emps = hrmReadAll('employees').filter(e => !e.deleted && e.isActive !== false);
  const key = `${year}_${month}`;
  const payFile = path.join(HRM_DIR, 'payroll', safeFileName(key) + '.json');
  let monthlyCost = 0, pfLiab = 0, esiLiab = 0, missingSal = 0;
  let payRows = [];
  if (fs.existsSync(payFile)) {
    payRows = (JSON.parse(fs.readFileSync(payFile, 'utf8')).rows) || [];
    payRows.forEach(r => {
      monthlyCost += Number(r.grossEarnings) || 0;
      pfLiab += (Number(r.pfEE) || 0) + (Number(r.pfER) || 0) + (Number(r.eps) || 0);
      esiLiab += (Number(r.esiEE) || 0) + (Number(r.esiER) || 0);
    });
  }
  const paidIds = new Set(payRows.map(r => r.empId));
  missingSal = emps.filter(e => !paidIds.has(e.id)).length;
  const bySite = {};
  emps.forEach(e => {
    const s = e.department || e.site || 'Unassigned';
    bySite[s] = (bySite[s] || 0) + 1;
  });
  res.json({
    activeEmployees: emps.length,
    monthlyCost: hrmRound2(monthlyCost),
    pfLiability: hrmRound2(pfLiab),
    esiLiability: hrmRound2(esiLiab),
    pfEligible: emps.filter(e => e.pfApplicable).length,
    esiEligible: emps.filter(e => e.esiApplicable).length,
    missingSal,
    siteDistribution: Object.entries(bySite).map(([name, count]) => ({ name, count })),
  });
});

app.get('/api/hrm/reports/ecr', (req, res) => {
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  const key = `${year}_${month}`;
  const file = path.join(HRM_DIR, 'payroll', safeFileName(key) + '.json');
  if (!fs.existsSync(file)) return res.status(404).send('No payroll');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const emps = {};
  hrmReadAll('employees').forEach(e => { emps[e.id] = e; });
  const lines = [];
  (data.rows || []).forEach(r => {
    if (!(Number(r.pfEE) > 0)) return;
    const e = emps[r.empId] || {};
    lines.push([
      e.uan || '', e.name || r.name || '', Math.round(r.grossEarnings || 0),
      Math.round(r.pfWages || 0), Math.round(r.pfWages || 0), Math.round(r.pfWages || 0),
      Math.round(r.pfEE || 0), Math.round(r.eps || 0), Math.round(r.pfER || 0), 0, 0,
    ].join('#~#'));
  });
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="ECR_${month}_${year}.txt"`);
  res.send(lines.join('\r\n'));
});

app.get('/api/hrm/reports/esic', (req, res) => {
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  const key = `${year}_${month}`;
  const file = path.join(HRM_DIR, 'payroll', safeFileName(key) + '.json');
  const attFile = path.join(HRM_DIR, 'attendance', safeFileName(key) + '.json');
  if (!fs.existsSync(file)) return res.status(404).send('No payroll');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let attMap = {};
  if (fs.existsSync(attFile)) {
    ((JSON.parse(fs.readFileSync(attFile, 'utf8')).rows) || []).forEach(r => { attMap[r.empId] = r; });
  }
  const emps = {};
  hrmReadAll('employees').forEach(e => { emps[e.id] = e; });
  const lines = ['IP Number,IP Name,No of Days Worked,Total Monthly Wages,Reason Code for Zero workings days,Last Working Day'];
  (data.rows || []).forEach(r => {
    const e = emps[r.empId] || {};
    if (!e.esicNumber) return;
    const days = attMap[r.empId]?.payableDays ?? r.payableDays ?? 0;
    lines.push([e.esicNumber, e.name || r.name, days, r.esiWages || r.grossEarnings || 0, days == 0 ? '1' : '', ''].join(','));
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="ESIC_${month}_${year}.csv"`);
  res.send(lines.join('\r\n'));
});

// Attendance register CSV (Form-style for Indian shops / factories)
app.get('/api/hrm/reports/attendance', (req, res) => {
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  if (!month || !year) return res.status(400).send('month and year required');
  const key = `${year}_${month}`;
  const file = path.join(HRM_DIR, 'attendance', safeFileName(key) + '.json');
  const totalDays = new Date(year, month, 0).getDate();
  let rows = [];
  if (fs.existsSync(file)) rows = (JSON.parse(fs.readFileSync(file, 'utf8')).rows) || [];
  const dayHeaders = [];
  for (let d = 1; d <= totalDays; d++) dayHeaders.push('D' + d);
  const header = ['Emp Code', 'Employee Name', ...dayHeaders, 'Payable Days'].join(',');
  const lines = [header];
  rows.forEach((r) => {
    const cells = [r.employeeCode || '', `"${String(r.empName || '').replace(/"/g, '""')}"`];
    for (let d = 1; d <= totalDays; d++) cells.push(r.days?.['D' + d] || '');
    cells.push(r.payableDays ?? '');
    lines.push(cells.join(','));
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="Attendance_${month}_${year}.csv"`);
  res.send('\uFEFF' + lines.join('\r\n'));
});

// Wages register (Form XVII style summary) from processed payroll
app.get('/api/hrm/reports/wages', (req, res) => {
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  if (!month || !year) return res.status(400).send('month and year required');
  const key = `${year}_${month}`;
  const file = path.join(HRM_DIR, 'payroll', safeFileName(key) + '.json');
  if (!fs.existsSync(file)) return res.status(404).send('No payroll for this month — Process payroll first');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const header = [
    'Emp Code', 'Name', 'Payable Days', 'Basic', 'HRA', 'DA', 'Allowances',
    'Gross', 'PF Wages', 'PF EE', 'EPS', 'PF ER', 'ESI Wages', 'ESI EE', 'ESI ER', 'Net Salary',
  ].join(',');
  const lines = [header];
  (data.rows || []).forEach((r) => {
    lines.push([
      r.employeeCode || '',
      `"${String(r.name || '').replace(/"/g, '""')}"`,
      r.payableDays ?? '',
      r.basicEarned ?? 0, r.hraEarned ?? 0, r.daEarned ?? 0, r.allowancesEarned ?? 0,
      r.grossEarnings ?? 0, r.pfWages ?? 0, r.pfEE ?? 0, r.eps ?? 0, r.pfER ?? 0,
      r.esiWages ?? 0, r.esiEE ?? 0, r.esiER ?? 0, r.netSalary ?? 0,
    ].join(','));
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="WagesRegister_${month}_${year}.csv"`);
  res.send('\uFEFF' + lines.join('\r\n'));
});


// ---- HRM CLRA registers (must be before SPA catch-all) ----
app.get('/api/hrm/reports/form-t', (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    if (!month || !year) return res.status(400).send('month and year required');
    const key = year + '_' + month;
    const attFile = path.join(HRM_DIR, 'attendance', safeFileName(key) + '.json');
    if (!fs.existsSync(attFile)) return res.status(404).send('No attendance for this month — save attendance first');
    const att = JSON.parse(fs.readFileSync(attFile, 'utf8'));
    const emps = {};
    hrmReadAll('employees').forEach(e => { emps[e.id] = e; });
    const days = new Date(year, month, 0).getDate();
    const header = ['Sl.No', 'Name of the Employee', 'M/F'];
    for (let d = 1; d <= days; d++) header.push(String(d));
    header.push('No. of payable Days', 'Total OT Hrs');
    const lines = [header.join(',')];
    let i = 0;
    (att.rows || []).forEach(r => {
      i += 1;
      const e = emps[r.empId] || {};
      const row = [i, String(e.name || r.empName || '').replace(/,/g, ' '), (e.gender || 'M').toString().slice(0, 1)];
      for (let d = 1; d <= days; d++) row.push(String((r.days && r.days['D' + d]) || ''));
      row.push(r.payableDays != null ? r.payableDays : '', r.otHours != null ? r.otHours : '');
      lines.push(row.join(','));
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="FormT_Muster_' + month + '_' + year + '.csv"');
    res.send('\ufeff' + lines.join('\n'));
  } catch (e) {
    res.status(500).send(e.message || 'Form T failed');
  }
});

app.get('/api/hrm/reports/form-xvii', (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    if (!month || !year) return res.status(400).send('month and year required');
    const key = year + '_' + month;
    const file = path.join(HRM_DIR, 'payroll', safeFileName(key) + '.json');
    if (!fs.existsSync(file)) return res.status(404).send('Process payroll first');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const header = ['Sl.No','Name of Workman','UAN','ESI','Designation','No.of working days','Daily Rate','Basic Wages','Dearness Allowance','Over Time','Others','Total','ESI 0.75%','PF 12%','Total Deductions','Net Amount Paid'];
    const lines = [header.join(',')];
    let i = 0;
    (data.rows || []).forEach(r => {
      if (!(Number(r.grossEarnings) > 0)) return;
      i += 1;
      const daily = r.payableDays ? Math.round((Number(r.basicEarned) / r.payableDays) * 100) / 100 : 0;
      const ded = (Number(r.esiEE) || 0) + (Number(r.pfEE) || 0);
      lines.push([
        i, String(r.name || '').replace(/,/g, ' '), r.uan || '', r.esicNumber || '',
        String(r.designation || '').replace(/,/g, ' '), r.payableDays || 0, daily,
        r.basicEarned || 0, r.daEarned || 0, 0,
        (Number(r.hraEarned) || 0) + (Number(r.taEarned) || 0) + (Number(r.allowancesEarned) || 0),
        r.grossEarnings || 0, r.esiEE || 0, r.pfEE || 0, ded, r.netSalary || 0
      ].join(','));
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="FormXVII_Wages_' + month + '_' + year + '.csv"');
    res.send('\ufeff' + lines.join('\n'));
  } catch (e) {
    res.status(500).send(e.message || 'Form XVII failed');
  }
});

// ---- Monthly bills export for auditor (CSV) ----
app.get('/api/bills/export-month', (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    if (!month || !year) return res.status(400).json({ error: 'month and year required (1-12, YYYY)' });
    const bills = readAllFromDir('bills');
    const rows = bills.filter(b => {
      const d = String(b.invoiceDate || b.data?.details?.invoiceDate || '');
      if (!d) return false;
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return false;
      return (dt.getMonth() + 1) === month && dt.getFullYear() === year;
    });
    const header = ['InvoiceNumber','Date','Type','Client','GSTIN','Taxable','CGST','SGST','IGST','Total','Status','PaidAmount','Site','WorkOrder'];
    const lines = [header.join(',')];
    rows.forEach(b => {
      const t = b.data?.totals || {};
      const c = b.data?.client || {};
      const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
      lines.push([
        esc(b.invoiceNumber || b.id), esc(b.invoiceDate), esc(b.invoiceType || b.data?.invoiceType),
        esc(b.clientName || c.name), esc(c.gstin),
        t.subtotal ?? t.subTotal ?? '', t.cgst ?? '', t.sgst ?? '', t.igst ?? '',
        b.totalAmount ?? t.grandTotal ?? t.total ?? '',
        esc(b.status), b.paidAmount ?? 0,
        esc(b.site || b.data?.details?.site || ''), esc(b.workOrderId || b.data?.details?.workOrder || ''),
      ].join(','));
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Invoices_' + year + '_' + String(month).padStart(2,'0') + '.csv"');
    res.send('\ufeff' + lines.join('\n'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('{*path}', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'No such endpoint' });
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  // Build not ready yet — serve friendly waiting page (auto-refreshes every 3s).
  return servePlaceholder(req, res);
});

function servePlaceholder(req, res) {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'No such endpoint' });
    res.status(503).send(`<!doctype html>
<html><head><meta charset="utf-8"><title>SD Dynamics — building…</title>
<meta http-equiv="refresh" content="3">
<style>
  body { font-family: -apple-system, Segoe UI, Inter, sans-serif; max-width: 560px;
         margin: 6rem auto; padding: 2rem; color: #1e293b; line-height: 1.55; }
  h1 { color: #1e40af; margin: 0 0 0.5rem; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #cbd5e1;
             border-top-color: #1e40af; border-radius: 50%; animation: spin 1s linear infinite;
             vertical-align: middle; margin-right: 6px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .muted { color: #64748b; font-size: 0.9em; }
  .box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.85rem 1rem; border-radius: 8px; margin-top: 1rem; }
</style></head>
<body>
  <h1>SD Dynamics</h1>
  <p><span class="spinner"></span> The app is still building. This page refreshes every 3 seconds.</p>
  <div class="box">
    <p style="margin:0 0 0.5rem"><strong>Local install?</strong></p>
    <p style="margin:0">If you started the server but never built the frontend, run:</p>
    <p style="margin:0.5rem 0 0"><code>npm run build</code></p>
    <p class="muted" style="margin:0.5rem 0 0">…then reload this page.</p>
  </div>
  <div class="box">
    <p style="margin:0 0 0.5rem"><strong>StackBlitz / Codespaces?</strong></p>
    <p style="margin:0">First-time build takes ~30 seconds inside browser sandboxes. Sit tight.</p>
  </div>
  <p class="muted" style="margin-top:1.5rem">Server is running on port ${req.socket.localPort} · API health: <a href="/api/version">/api/version</a></p>
</body></html>`);
}

// v1.10.0 — Global error handler. Registered LAST so all preceding
// route handlers can forward errors to it. Express 5 auto-catches
// synchronous throws and async rejections from route handlers, so we
// no longer need try/catch around every writeJSON call. Server-side
// logs full detail; client sees a generic JSON error with a stable
// code — no leaked stack traces or absolute filesystem paths.
// Preserves upstream status codes from body-parser (413 payload too
// large, 400 malformed JSON) so clients can differentiate.
// eslint-disable-next-line no-unused-vars — 4-arg signature is required by Express
app.use((err, req, res, next) => {
  const status = Number(err && (err.status || err.statusCode)) || 500;
  let code = 'server-error';
  if (status === 413) code = 'payload-too-large';
  else if (status === 400) code = 'bad-request';
  else if (status === 404) code = 'not-found';
  errRes(res, status, code, err);
});

// ============================================================
// Error log + graceful shutdown
// ============================================================
// ERRORS_LOG was declared once at the top of this file (v1.10.0)
// where errRes() needs it. See line ~145.

// v1.10.0 — log rotation. Previously `data/errors.log` grew unbounded;
// a tight failure loop (e.g. daily backup hitting a corrupted template)
// would fill the disk. Now we keep only the last ~200KB. Called
// opportunistically from logFatal — no separate timer.
const ERRORS_LOG_MAX = 200 * 1024;
function rotateErrorsIfLarge() {
  try {
    if (!fs.existsSync(ERRORS_LOG)) return;
    const stat = fs.statSync(ERRORS_LOG);
    if (stat.size <= ERRORS_LOG_MAX) return;
    // Read the tail we want to keep, then rewrite atomically.
    const fd = fs.openSync(ERRORS_LOG, 'r');
    const keep = Buffer.alloc(ERRORS_LOG_MAX);
    fs.readSync(fd, keep, 0, ERRORS_LOG_MAX, stat.size - ERRORS_LOG_MAX);
    fs.closeSync(fd);
    // Trim to next newline so we don't leave a half-line at the top.
    const s = keep.toString('utf-8');
    const nl = s.indexOf('\n');
    writeFileAtomic(ERRORS_LOG, (nl >= 0 ? s.slice(nl + 1) : s));
  } catch { /* ignore */ }
}

function logFatal(err, source = 'fatal') {
  try {
    rotateErrorsIfLarge();
    const ts = new Date().toISOString();
    const msg = err && err.stack ? err.stack : String(err);
    fs.appendFileSync(ERRORS_LOG, `[${ts}] [${source}] ${msg}\n`, 'utf-8');
  } catch { /* nothing we can do if even appending fails */ }
}

// Last-resort handlers — log the error but do NOT call process.exit so the
// running server keeps serving healthy requests. Per Node best-practice,
// uncaughtException leaves the process in an unknown state, so we write the
// log and let the OS / a wrapper script decide whether to restart.
process.on('uncaughtException', (err) => logFatal(err, 'uncaughtException'));
process.on('unhandledRejection', (err) => logFatal(err, 'unhandledRejection'));

// Note: /api/health used to live below the SPA catch-all here, so the
// catch-all was swallowing every request to it and returning "No such
// endpoint". Moved above the catch-all in v1.10.0. See earlier in file.

// Try ports starting from STARTING_PORT (persisted preference) until one is available.
// Bound to 127.0.0.1 explicitly so the server can NEVER be reached from the LAN —
// every byte stays on the user's machine, which the privacy promise depends on.
let activeServer = null;

function startServer(port) {
  const server = 
app.get('/api/sqlite-status', (req, res) => {
  try {
    res.json(sqliteStats());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/sqlite-reimport', (req, res) => {
  try {
    if (!isSqliteReady()) return res.status(503).json({ error: 'sqlite not ready' });
    process.env.SD_SQLITE_REIMPORT = '1';
    const r = initSqliteStore(DATA_DIR);
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(port, '127.0.0.1', () => {
    activeServer = server;
    // Persist the chosen port — the .bat launcher reads this for the browser URL.
    // Writing on EVERY successful boot means: if our preferred 47371 was busy and
    // we landed on 47372 instead, next launch tries 47372 first (cuts collision
    // scans in half on repeated reboots of whatever was holding 47371).
    try { fs.writeFileSync(PORT_FILE, String(port), 'utf-8'); } catch { /* ignore */ }
    console.log(`\n  SD Dynamics running at http://localhost:${port}`);
    console.log(`  Data stored in: ${DATA_DIR}\n`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < STARTING_PORT + MAX_PORT_SCAN) {
      console.log(`  Port ${port} is busy, trying ${port + 1}...`);
      startServer(port + 1);
    } else if (err.code === 'EADDRINUSE') {
      // We've exhausted the scan range. Tell the OS to pick anything free — at
      // this point the user has 50+ apps fighting for the 47371-47421 range,
      // which we treat as "do whatever works" rather than failing to start.
      console.warn(`  Scanned ${MAX_PORT_SCAN} ports from ${STARTING_PORT} — letting OS assign a free one.`);
      startServer(0);
    } else {
      console.error(`  Failed to start server: ${err.message}`);
      // Persist the failure so the user has a breadcrumb when the silent
      // launcher exits without any visible window.
      logFatal(err, 'startup');
      process.exit(1);
    }
  });
}

// Graceful shutdown — taskkill /f from Stop FreeGSTBill.bat can interrupt a
// sync write mid-flight. SIGINT (Ctrl+C in foreground) and SIGTERM (clean
// kill) get a 3-second window to flush.
function gracefulShutdown(signal) {
  console.log(`\n  Received ${signal}, closing connections...`);
  if (!activeServer) { process.exit(0); return; }
  const force = setTimeout(() => {
    console.warn('  Force-exiting after 3s grace period');
    process.exit(1);
  }, 3000);
  force.unref();
  activeServer.close(() => {
    clearTimeout(force);
    console.log('  Server closed cleanly.');
    process.exit(0);
  });
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// =====================================================
// Recurring invoices — auto-fire on boot + daily interval
// =====================================================
// For every recurring template with `nextDate <= today` and `active === true`,
// generate a new invoice (with a fresh sequential number for the matching
// type prefix and today's date) and advance the template's `nextDate` by its
// frequency. Honours `endMode` so weekly-for-12-weeks contracts stop themselves.
//
// Why server-side (and not in the React app): if the user opens the app on
// the 5th but the template was due on the 1st, the missed-cycle invoice still
// fires here. The frontend would only see it if the user happened to open the
// app between firings — fragile.
//
// Why no Windows scheduled task (yet): the server starts on every Windows
// login via the Startup-folder shortcut, so booting your PC = a check.
// Long-uptime users get a daily `setInterval` below as a backstop.
function advanceDate(dateStr, frequency, interval) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const n = Math.max(1, parseInt(interval, 10) || 1);
  if (frequency === 'weekly') d.setDate(d.getDate() + 7 * n);
  else if (frequency === 'quarterly') d.setMonth(d.getMonth() + 3 * n);
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + n);
  else d.setMonth(d.getMonth() + n); // default: monthly
  return d.toISOString().split('T')[0];
}

function nextInvoiceNumber(prefix, settings = {}) {
  // Mirror the frontend's getNextInvoiceNumber logic — atomic counter via
  // meta, applied to the same brandPrefix / separator / padding settings.
  const key = `counter_${prefix}`;
  const meta = readJSON(META_PATH, {});
  const cfg = { format: 'branded', brandPrefix: '', separator: '/', showFinYear: true, padDigits: 4, ...(meta.invoiceNumberSettings || {}) };
  const next = (Number(meta[key]) || 0) + 1;
  meta[key] = next;
  writeJSON(META_PATH, meta);
  if (cfg.format === 'random') {
    return `${cfg.brandPrefix || prefix}${cfg.separator}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
  const sep = cfg.separator || '/';
  const pfx = cfg.brandPrefix || prefix;
  const padded = String(next).padStart(cfg.padDigits || 4, '0');
  if (cfg.showFinYear) {
    const y = new Date().getFullYear();
    return `${pfx}${sep}${y}-${String(y + 1).slice(-2)}${sep}${padded}`;
  }
  return `${pfx}${sep}${padded}`;
  // Ignored other settings flags — they'd just produce slightly different
  // formatting; matches frontend behaviour closely enough for the rare
  // server-side firing.
}

// v1.10.6 — audit L19: made async and yields between templates via
// setImmediate. Prior code was one uninterrupted sync loop over every
// recurring template with sync FS writes; N templates × K items
// blocked the event loop → HTTP handlers froze until it finished.
// Now: single-template body is unchanged, but each iteration awaits
// setImmediate() so pending fetches / API calls get a slot.
async function processDueRecurring() {
  const today = new Date().toISOString().split('T')[0];
  const templates = readAllFromDir('recurring');
  let fired = 0;
  const yieldToLoop = () => new Promise(r => setImmediate(r));
  for (const tpl of templates) {
    await yieldToLoop();
    if (!tpl || !tpl.active) continue;
    if (!tpl.nextDate || tpl.nextDate > today) continue;
    // End conditions
    if (tpl.endMode === 'onDate' && tpl.endDate && today > tpl.endDate) continue;
    if (tpl.endMode === 'afterN' && tpl.maxOccurrences && (tpl.occurrencesCreated || 0) >= tpl.maxOccurrences) continue;

    try {
      // Resolve a LIVE profile by id or businessName (mirrors v1.4.2
      // company-name-auto-update behaviour for recurring fires).
      const profiles = readAllFromDir('profiles');
      let profile = profiles.find(p => p.id && tpl.profileId && p.id === tpl.profileId)
                 || profiles.find(p => p.businessName === tpl.profileBusinessName)
                 || readJSON(PROFILE_PATH, {});

      const prefix = (tpl.invoiceType === 'proforma' ? 'EST'
                   : tpl.invoiceType === 'credit-note' ? 'CN'
                   : tpl.invoiceType === 'bill-of-supply' ? 'BOS'
                   : tpl.invoiceType === 'composition' ? 'COMP'
                   : tpl.invoiceType === 'delivery-challan' ? 'DC'
                   : 'INV');
      const invoiceNumber = nextInvoiceNumber(prefix);
      const invoiceDate = today;

      // v1.10.31 — Data-F3.1: use shared computeInvoiceTotals so every math
      // fix (UTGST, cess, RCM, TDS/TCS ₹50L threshold, discount modes,
      // tax-inclusive, invoice-level discount, round-off) applies here too.
      // Prior inline math didn't recognise ANY of those and silently produced
      // wrong tax buckets for recurring bills. All the v1.10.1 audit fixes
      // were being reintroduced here.
      const client = {
        name: tpl.clientName,
        state: tpl.clientState,
        gstin: tpl.clientGstin,
        // v1.10.66 (#61) — the client's country decides whether the supply is
        // an export (IGST). Without it every recurring invoice to a client
        // abroad was calculated as intrastate.
        country: tpl.clientCountry,
        isSEZ: !!tpl.isSEZ,
      };
      const details = { placeOfSupply: tpl.placeOfSupply };
      const invoiceOptions = tpl.invoiceOptions || {};
      const totals = computeInvoiceTotals({
        items: tpl.items || [],
        profile,
        client,
        details,
        showGST: invoiceOptions.showGST !== false,
        taxInclusive: !!tpl.taxInclusive,
        invoiceOptions,
      });
      const totalAmount = totals.total;
      const taxTotal = totals.totalTaxAmount;
      const subtotal = totals.subtotal;
      const totalDiscount = totals.totalDiscount;

      const bill = {
        id: invoiceNumber,
        clientName: tpl.clientName,
        invoiceNumber,
        invoiceDate,
        invoiceType: tpl.invoiceType || 'tax-invoice',
        currency: (tpl.invoiceOptions && tpl.invoiceOptions.currency) || 'INR',
        totalAmount,
        totalTaxAmount: taxTotal,
        status: 'unpaid',
        paidAmount: 0,
        payments: [],
        generatedFrom: tpl.id,
        autoGenerated: true,
        autoGeneratedAt: new Date().toISOString(),
        data: {
          profile,
          client: {
            name: tpl.clientName, state: tpl.clientState, gstin: tpl.clientGstin,
            address: tpl.clientAddress, country: tpl.clientCountry, city: tpl.clientCity,
            pin: tpl.clientPin, email: tpl.clientEmail, phone: tpl.clientPhone,
            isSEZ: tpl.isSEZ,
          },
          details: { invoiceNumber, invoiceDate, dueDate: '', placeOfSupply: '' },
          // Normalize item.name from legacy description field (v1.6.7-and-earlier
          // templates used `description` — auto-fired bills rendered blank rows).
          items: (tpl.items || []).map(i => ({
            ...i,
            name: i.name || i.description || '',
          })),
          totals,
          invoiceType: tpl.invoiceType || 'tax-invoice',
          customTerms: tpl.customTerms || '',
          customNotes: tpl.customNotes || '',
          extraSections: tpl.extraSections || [],
          invoiceOptions: tpl.invoiceOptions || {},
          taxInclusive: !!tpl.taxInclusive,
        },
      };

      writeJSON(path.join(DATA_DIR, 'bills', safeFileName(invoiceNumber) + '.json'), bill);

      // Advance the template
      tpl.nextDate = advanceDate(tpl.nextDate, tpl.frequency, tpl.interval);
      tpl.lastGenerated = today;
      tpl.occurrencesCreated = (tpl.occurrencesCreated || 0) + 1;
      writeJSON(path.join(DATA_DIR, 'recurring', safeFileName(tpl.id) + '.json'), tpl);

      fired += 1;
    } catch (err) {
      logFatal(err, 'recurring');
    }
  }
  if (fired > 0) {
    console.log(`  Auto-generated ${fired} recurring invoice${fired !== 1 ? 's' : ''}.`);
    // Surface the count so the frontend notification centre can pick it up.
    const meta = readJSON(META_PATH, {});
    meta.lastRecurringAutoFire = { date: today, count: fired, at: new Date().toISOString() };
    writeJSON(META_PATH, meta);
  }
}



startServer(STARTING_PORT);
// Fire once after a short delay so the listener is up first; then once a day
// for users whose server stays up >24h.
// v1.10.6 — audit L19: async caller. Uncaught rejections logged via
// the top-level unhandledRejection handler installed above.
setTimeout(() => { processDueRecurring().catch(err => logFatal(err, 'recurring')); }, 3000);
setInterval(() => { processDueRecurring().catch(err => logFatal(err, 'recurring')); }, 24 * 60 * 60 * 1000);
