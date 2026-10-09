/**
 * Hybrid SQLite store for SD-Dynamics (better-sqlite3).
 *
 * Mirror policy:
 * - Default SD_JSON_MIRROR=1 (or unset): after upsert, also write data/<collection>/<id>.json
 *   when server does not dual-write itself. Server writeJSON always writes the file;
 *   pass { mirror: false } from writeJSON to avoid double file write.
 * - SD_JSON_MIRROR=0: skip file mirror inside sqliteUpsert only; file read fallback remains.
 *
 * Schema: single `records` table with collection + id + index columns + payload_json.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/** Collections with folder under data/ or logical names for singletons / special paths. */
export const COLLECTIONS = [
  'bills', 'clients', 'templates', 'products', 'expenses', 'recurring', 'receipts',
  'profiles', 'purchases', 'workorders', 'journals', 'purchaseorders', 'costcenters',
  'accounts', 'budgets',
  // extended
  'meta', 'master_data', 'activity_logs', 'invoice_revisions', 'trash',
  'hrm/employees', 'hrm/attendance', 'hrm/payroll', 'hrm/minwages', 'hrm/settings',
];

const SCHEMA_VERSION = 2;

let _db = null;
let _ready = false;
let _dataDir = null;
let _jsonMirror = true;

export function isSqliteReady() {
  return _ready && !!_db;
}

function jsonMirrorEnabled() {
  const v = process.env.SD_JSON_MIRROR;
  if (v === '0' || v === 'false' || v === 'off') return false;
  return true;
}

function openDb(dbPath) {
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      invoiceNumber TEXT,
      clientName TEXT,
      status TEXT,
      docDate TEXT,
      totalAmount REAL,
      workOrderId TEXT,
      isDeleted INTEGER DEFAULT 0,
      updatedAt TEXT,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS idx_rec_coll_date ON records(collection, docDate);
    CREATE INDEX IF NOT EXISTS idx_rec_coll_inv ON records(collection, invoiceNumber);
    CREATE INDEX IF NOT EXISTS idx_rec_coll_status ON records(collection, status);
    CREATE INDEX IF NOT EXISTS idx_rec_coll_client ON records(collection, clientName);
    CREATE INDEX IF NOT EXISTS idx_rec_coll_wo ON records(collection, workOrderId);
    CREATE INDEX IF NOT EXISTS idx_rec_coll_del ON records(collection, isDeleted);
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  const row = db.prepare('SELECT value FROM schema_meta WHERE key = ?').get('version');
  const ver = row ? parseInt(row.value, 10) : 0;
  if (ver < SCHEMA_VERSION) {
    db.prepare('INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)').run('version', String(SCHEMA_VERSION));
  }
}

function extractIndexCols(obj) {
  if (!obj || typeof obj !== 'object') {
    return { invoiceNumber: null, clientName: null, status: null, docDate: null, totalAmount: null, workOrderId: null, isDeleted: 0, updatedAt: null };
  }
  const isDeleted = (obj.deleted || obj.isDeleted || obj.is_deleted || obj._deleted) ? 1 : 0;
  return {
    invoiceNumber: obj.invoiceNumber || obj.poNumber || obj.woNumber || obj.receiptNumber || null,
    clientName: obj.clientName || obj.vendorName || obj.supplierName || obj.name || null,
    status: obj.status || null,
    docDate: (obj.invoiceDate || obj.date || obj.docDate || obj.at || obj.timestamp || '').toString().slice(0, 10) || null,
    totalAmount: obj.totalAmount != null ? Number(obj.totalAmount) : (obj.totals?.finalTotal != null ? Number(obj.totals.finalTotal) : null),
    workOrderId: obj.workOrderId || obj.workOrderNo || null,
    isDeleted,
    updatedAt: obj.updatedAt || obj.createdAt || obj.at || new Date().toISOString(),
  };
}

/**
 * Map a filesystem path under DATA_DIR to { collection, id }.
 * Returns null if path is not a managed JSON document.
 */
export function pathToCollectionId(filePath, dataDir) {
  if (!filePath || !dataDir) return null;
  const abs = path.resolve(filePath);
  const root = path.resolve(dataDir);
  if (!abs.startsWith(root)) return null;
  let rel = abs.slice(root.length).replace(/^[\\/]/, '').replace(/\\/g, '/');
  if (!rel.endsWith('.json')) return null;
  rel = rel.slice(0, -5); // drop .json

  // Singletons
  if (rel === 'meta') return { collection: 'meta', id: 'app' };
  if (rel === 'master-data') return { collection: 'master_data', id: 'default' };

  // activity-logs/<file>
  if (rel.startsWith('activity-logs/')) {
    const id = rel.slice('activity-logs/'.length);
    if (!id || id.includes('/')) return null;
    return { collection: 'activity_logs', id };
  }

  // invoice-revisions/<file>
  if (rel.startsWith('invoice-revisions/')) {
    const id = rel.slice('invoice-revisions/'.length);
    if (!id || id.includes('/')) return null;
    return { collection: 'invoice_revisions', id };
  }

  // trash/<file> (flat bill trash) or trash/<subdir>/<file>
  if (rel.startsWith('trash/')) {
    const rest = rel.slice('trash/'.length);
    if (!rest) return null;
    // Flatten path into id so journals under trash/journals/x work
    const id = rest.replace(/\//g, '__');
    return { collection: 'trash', id };
  }

  // hrm/<subdir>/<id>
  if (rel.startsWith('hrm/')) {
    const parts = rel.split('/');
    if (parts.length === 3) {
      // hrm/employees/emp1
      return { collection: `hrm/${parts[1]}`, id: parts[2] };
    }
    if (parts.length === 2) {
      // unexpected
      return null;
    }
    return null;
  }

  // Standard data/<collection>/<id>
  const parts = rel.split('/');
  if (parts.length === 2) {
    const [collection, id] = parts;
    if (COLLECTIONS.includes(collection) || collection === 'bills') {
      return { collection, id };
    }
    // allow any single-level collection folder
    return { collection, id };
  }

  return null;
}

function mirrorPath(collection, id) {
  if (!_dataDir) return null;
  if (collection === 'meta') return path.join(_dataDir, 'meta.json');
  if (collection === 'master_data') return path.join(_dataDir, 'master-data.json');
  if (collection === 'activity_logs') return path.join(_dataDir, 'activity-logs', `${id}.json`);
  if (collection === 'invoice_revisions') return path.join(_dataDir, 'invoice-revisions', `${id}.json`);
  if (collection === 'trash') {
    // id may contain __ for nested
    const rel = String(id).replace(/__/g, path.sep);
    return path.join(_dataDir, 'trash', rel.endsWith('.json') ? rel : `${rel}.json`);
  }
  if (collection.startsWith('hrm/')) {
    const sub = collection.slice(4);
    return path.join(_dataDir, 'hrm', sub, `${id}.json`);
  }
  return path.join(_dataDir, collection, `${id}.json`);
}

function writeMirrorFile(collection, id, obj) {
  if (!jsonMirrorEnabled() || !_jsonMirror) return;
  const fp = mirrorPath(collection, id);
  if (!fp) return;
  try {
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    const tmp = fp + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
    fs.renameSync(tmp, fp);
  } catch (e) {
    console.warn('[sqlite] mirror write failed', collection, id, e.message);
  }
}

export function sqliteUpsert(collection, data, opts = {}) {
  if (!_db || !data) return false;
  const id = data.id != null ? String(data.id) : null;
  if (!id) {
    console.warn('[sqlite] upsert skipped: missing id', collection);
    return false;
  }
  const idx = extractIndexCols(data);
  const payload = JSON.stringify(data);
  _db.prepare(`
    INSERT INTO records (collection, id, invoiceNumber, clientName, status, docDate, totalAmount, workOrderId, isDeleted, updatedAt, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(collection, id) DO UPDATE SET
      invoiceNumber = excluded.invoiceNumber,
      clientName = excluded.clientName,
      status = excluded.status,
      docDate = excluded.docDate,
      totalAmount = excluded.totalAmount,
      workOrderId = excluded.workOrderId,
      isDeleted = excluded.isDeleted,
      updatedAt = excluded.updatedAt,
      payload_json = excluded.payload_json
  `).run(
    collection,
    id,
    idx.invoiceNumber,
    idx.clientName,
    idx.status,
    idx.docDate,
    idx.totalAmount,
    idx.workOrderId,
    idx.isDeleted,
    idx.updatedAt,
    payload,
  );
  // Server writeJSON already writes file when mirror:false
  if (opts.mirror !== false) {
    writeMirrorFile(collection, id, data);
  }
  return true;
}

export function sqliteUpsertMany(collection, rows, opts = {}) {
  if (!_db || !Array.isArray(rows)) return 0;
  const run = _db.transaction((list) => {
    let n = 0;
    for (const row of list) {
      if (sqliteUpsert(collection, row, opts)) n++;
    }
    return n;
  });
  return run(rows);
}

export function sqliteGet(collection, id) {
  if (!_db || id == null) return null;
  const row = _db.prepare('SELECT payload_json FROM records WHERE collection = ? AND id = ?').get(collection, String(id));
  if (!row) return null;
  try {
    return JSON.parse(row.payload_json);
  } catch {
    return null;
  }
}

export function sqliteRemove(collection, id) {
  if (!_db || id == null) return false;
  _db.prepare('DELETE FROM records WHERE collection = ? AND id = ?').run(collection, String(id));
  return true;
}

/**
 * @param {string} collection
 * @param {{ includeDeleted?: boolean, limit?: number, offset?: number, status?: string, q?: string }} opts
 */
export function sqliteList(collection, opts = {}) {
  if (!_db) return [];
  const includeDeleted = !!opts.includeDeleted;
  const clauses = ['collection = ?'];
  const params = [collection];
  if (!includeDeleted) {
    clauses.push('isDeleted = 0');
  }
  if (opts.status) {
    clauses.push('status = ?');
    params.push(String(opts.status));
  }
  if (opts.q) {
    clauses.push('(invoiceNumber LIKE ? OR clientName LIKE ? OR id LIKE ?)');
    const q = `%${opts.q}%`;
    params.push(q, q, q);
  }
  let sql = `SELECT payload_json FROM records WHERE ${clauses.join(' AND ')} ORDER BY docDate DESC, id DESC`;
  if (opts.limit != null) {
    sql += ' LIMIT ?';
    params.push(Number(opts.limit) || 100);
    if (opts.offset != null) {
      sql += ' OFFSET ?';
      params.push(Number(opts.offset) || 0);
    }
  }
  const rows = _db.prepare(sql).all(...params);
  const out = [];
  for (const r of rows) {
    try {
      out.push(JSON.parse(r.payload_json));
    } catch { /* skip */ }
  }
  return out;
}

export function sqliteCount(collection, opts = {}) {
  if (!_db) return 0;
  const includeDeleted = !!opts.includeDeleted;
  if (includeDeleted) {
    return _db.prepare('SELECT COUNT(*) AS c FROM records WHERE collection = ?').get(collection).c;
  }
  return _db.prepare('SELECT COUNT(*) AS c FROM records WHERE collection = ? AND isDeleted = 0').get(collection).c;
}

export function sqliteStats() {
  if (!_db) {
    return { ready: false, path: null, jsonMirror: jsonMirrorEnabled(), counts: {}, total: 0 };
  }
  const counts = {};
  let total = 0;
  for (const col of COLLECTIONS) {
    try {
      const c = sqliteCount(col, { includeDeleted: true });
      counts[col] = c;
      total += c;
    } catch {
      counts[col] = 0;
    }
  }
  return {
    ready: true,
    path: path.join(_dataDir, 'sd-dynamics.sqlite'),
    jsonMirror: jsonMirrorEnabled(),
    counts,
    total,
  };
}

function importJsonFile(collection, id, filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return false;
    if (obj.id == null) obj.id = id;
    // Don't overwrite newer SQL row
    const existing = sqliteGet(collection, id);
    if (existing) {
      const et = Date.parse(existing.updatedAt || existing.createdAt || 0) || 0;
      const ot = Date.parse(obj.updatedAt || obj.createdAt || obj.at || 0) || 0;
      if (et > ot) return false;
    }
    return sqliteUpsert(collection, obj, { mirror: false });
  } catch {
    return false;
  }
}

function importDir(collection, dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let n = 0;
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const id = f.replace(/\.json$/i, '');
    if (importJsonFile(collection, id, path.join(dirPath, f))) n++;
  }
  return n;
}

function importTrash(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let n = 0;
  const walk = (dir, prefix) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        walk(full, prefix ? `${prefix}__${name}` : name);
      } else if (name.endsWith('.json')) {
        const id = (prefix ? `${prefix}__` : '') + name.replace(/\.json$/i, '');
        if (importJsonFile('trash', id, full)) n++;
      }
    }
  };
  walk(dirPath, '');
  return n;
}

/**
 * Import all known JSON sources into SQLite. Skips when SQL already has data
 * unless forceReimport / SD_SQLITE_REIMPORT=1.
 */
function migrateFromDisk(dataDir, { force = false } = {}) {
  let migrated = 0;
  const forceAll = force || process.env.SD_SQLITE_REIMPORT === '1';

  const maybeImportCollection = (collection, dirRel) => {
    const count = sqliteCount(collection, { includeDeleted: true });
    if (count > 0 && !forceAll) return 0;
    const dir = path.join(dataDir, dirRel);
    return importDir(collection, dir);
  };

  // Standard DIRS
  for (const col of [
    'bills', 'clients', 'templates', 'products', 'expenses', 'recurring', 'receipts',
    'profiles', 'purchases', 'workorders', 'journals', 'purchaseorders', 'costcenters',
    'accounts', 'budgets',
  ]) {
    migrated += maybeImportCollection(col, col);
  }

  // meta.json singleton
  {
    const count = sqliteCount('meta', { includeDeleted: true });
    const fp = path.join(dataDir, 'meta.json');
    if ((count === 0 || forceAll) && fs.existsSync(fp)) {
      try {
        const obj = JSON.parse(fs.readFileSync(fp, 'utf8'));
        obj.id = 'app';
        if (sqliteUpsert('meta', obj, { mirror: false })) migrated++;
      } catch { /* */ }
    }
  }

  // master-data.json
  {
    const count = sqliteCount('master_data', { includeDeleted: true });
    const fp = path.join(dataDir, 'master-data.json');
    if ((count === 0 || forceAll) && fs.existsSync(fp)) {
      try {
        const obj = JSON.parse(fs.readFileSync(fp, 'utf8'));
        obj.id = 'default';
        if (sqliteUpsert('master_data', obj, { mirror: false })) migrated++;
      } catch { /* */ }
    }
  }

  // activity-logs
  if (sqliteCount('activity_logs', { includeDeleted: true }) === 0 || forceAll) {
    migrated += importDir('activity_logs', path.join(dataDir, 'activity-logs'));
  }

  // invoice-revisions
  if (sqliteCount('invoice_revisions', { includeDeleted: true }) === 0 || forceAll) {
    migrated += importDir('invoice_revisions', path.join(dataDir, 'invoice-revisions'));
  }

  // HRM
  for (const sub of ['employees', 'attendance', 'payroll', 'minwages', 'settings']) {
    const col = `hrm/${sub}`;
    if (sqliteCount(col, { includeDeleted: true }) === 0 || forceAll) {
      migrated += importDir(col, path.join(dataDir, 'hrm', sub));
    }
  }

  // trash
  if (sqliteCount('trash', { includeDeleted: true }) === 0 || forceAll) {
    migrated += importTrash(path.join(dataDir, 'trash'));
  }

  return migrated;
}

function countJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  try {
    return fs.readdirSync(dirPath).filter((f) => f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

export function verifyParity() {
  if (!_db || !_dataDir) {
    return { ok: false, rows: [], error: 'not ready' };
  }
  const rows = [];
  let ok = true;

  const check = (collection, jsonCount) => {
    const sqlCount = sqliteCount(collection, { includeDeleted: true });
    const rowOk = sqlCount >= jsonCount; // SQL may have more after mirror-off writes
    if (!rowOk) ok = false;
    rows.push({ collection, jsonCount, sqlCount, ok: rowOk });
  };

  for (const col of [
    'bills', 'clients', 'templates', 'products', 'expenses', 'recurring', 'receipts',
    'profiles', 'purchases', 'workorders', 'journals', 'purchaseorders', 'costcenters',
    'accounts', 'budgets',
  ]) {
    check(col, countJsonFiles(path.join(_dataDir, col)));
  }

  check('meta', fs.existsSync(path.join(_dataDir, 'meta.json')) ? 1 : 0);
  check('master_data', fs.existsSync(path.join(_dataDir, 'master-data.json')) ? 1 : 0);
  check('activity_logs', countJsonFiles(path.join(_dataDir, 'activity-logs')));
  check('invoice_revisions', countJsonFiles(path.join(_dataDir, 'invoice-revisions')));
  for (const sub of ['employees', 'attendance', 'payroll', 'minwages', 'settings']) {
    check(`hrm/${sub}`, countJsonFiles(path.join(_dataDir, 'hrm', sub)));
  }

  return { ok, rows };
}

/**
 * Open DB, migrate schema, import JSON if needed.
 * @returns {{ ready: boolean, migrated: number, path: string, error?: string }}
 */
export function initSqliteStore(dataDir) {
  _dataDir = dataDir;
  _jsonMirror = jsonMirrorEnabled();
  const dbPath = path.join(dataDir, 'sd-dynamics.sqlite');
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (_db) {
      try { _db.close(); } catch { /* */ }
      _db = null;
      _ready = false;
    }
    _db = openDb(dbPath);
    migrate(_db);
    _ready = true;
    const force = process.env.SD_SQLITE_REIMPORT === '1';
    const migrated = migrateFromDisk(dataDir, { force });
    if (force) process.env.SD_SQLITE_REIMPORT = '0';
    const stats = sqliteStats();
    console.log(`[sqlite] Open ${dbPath} (${stats.total} records, mirror=${_jsonMirror ? 'on' : 'off'})`);
    console.log(`[sqlite] Primary store ready (migrated ${migrated})`);
    return { ready: true, migrated, path: dbPath, total: stats.total };
  } catch (e) {
    _ready = false;
    _db = null;
    console.warn('[sqlite] init failed:', e.message);
    console.warn('[sqlite] Falling back to JSON files:', e.message);
    return { ready: false, migrated: 0, path: dbPath, error: e.message };
  }
}

export default {
  COLLECTIONS,
  initSqliteStore,
  isSqliteReady,
  sqliteList,
  sqliteGet,
  sqliteUpsert,
  sqliteRemove,
  sqliteStats,
  sqliteCount,
  verifyParity,
  pathToCollectionId,
  sqliteUpsertMany,
};
