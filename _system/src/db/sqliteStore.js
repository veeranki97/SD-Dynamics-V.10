/**
 * Full SQLite store — SD Dynamics
 * Primary: data/sd-dynamics.sqlite | JSON mirror default ON (SD_JSON_MIRROR=0 to disable)
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/** Top-level + HRM nested (forward-slash keys) */
export const COLLECTIONS = [
  'bills',
  'clients',
  'templates',
  'products',
  'expenses',
  'recurring',
  'receipts',
  'profiles',
  'purchases',
  'workorders',
  'journals',
  'purchaseorders',
  'costcenters',
  'accounts',
  'budgets',
  'hrm/employees',
  'hrm/attendance',
  'hrm/payroll',
  'hrm/minwages',
  'hrm/settings',
];

let db = null;
let dataDir = null;
let jsonMirror = true;
let ready = false;

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function isSqliteReady() {
  return ready && !!db;
}

export function getSqliteDb() {
  return db;
}

function safeFileName(id) {
  return String(id).replace(/[/\\:*?"<>|]/g, '_');
}

/** collection may be "bills" or "hrm/employees" */
function collectionDir(collection) {
  return path.join(dataDir, ...String(collection).split('/').filter(Boolean));
}

export function initSqliteStore(DATA_DIR) {
  dataDir = DATA_DIR;
  jsonMirror = process.env.SD_JSON_MIRROR !== '0';

  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    console.warn('[sqlite] better-sqlite3 not installed — JSON-only mode. Run: npm i better-sqlite3');
    ready = false;
    return { ok: false, reason: 'missing-better-sqlite3' };
  }

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const dbPath = path.join(DATA_DIR, 'sd-dynamics.sqlite');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS records (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        invoiceNumber TEXT,
        docDate TEXT,
        clientName TEXT,
        status TEXT,
        totalAmount REAL DEFAULT 0,
        workOrderId TEXT,
        invoiceType TEXT,
        updatedAt TEXT,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (collection, id)
      );
      CREATE INDEX IF NOT EXISTS idx_rec_coll ON records(collection);
      CREATE INDEX IF NOT EXISTS idx_rec_date ON records(collection, docDate);
      CREATE INDEX IF NOT EXISTS idx_rec_client ON records(collection, clientName);
      CREATE INDEX IF NOT EXISTS idx_rec_status ON records(collection, status);
      CREATE INDEX IF NOT EXISTS idx_rec_wo ON records(collection, workOrderId);
      CREATE INDEX IF NOT EXISTS idx_rec_invnum ON records(collection, invoiceNumber);
    `);

    const migratedFlag = db.prepare('SELECT value FROM meta WHERE key = ?').get('json_import_done');
    const force = process.env.SD_SQLITE_REIMPORT === '1';
    let migrated = 0;
    if (!migratedFlag || force) {
      migrated = importAllJson(DATA_DIR);
      db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
        'json_import_done',
        new Date().toISOString()
      );
      db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
        'json_import_count',
        String(migrated)
      );
      console.log(`[sqlite] Imported ${migrated} records from JSON → ${dbPath}`);
      process.env.SD_SQLITE_REIMPORT = '0';
    } else {
      const row = db.prepare('SELECT COUNT(*) AS c FROM records').get();
      console.log(`[sqlite] Open ${dbPath} (${row?.c || 0} records, mirror=${jsonMirror ? 'on' : 'off'})`);
    }

    ready = true;
    return { ok: true, migrated };
  } catch (e) {
    console.error('[sqlite] init failed:', e.message);
    db = null;
    ready = false;
    return { ok: false, reason: e.message };
  }
}

function extractIndex(collection, obj) {
  if (!obj || typeof obj !== 'object') return {};
  const id = String(obj.id || obj.invoiceNumber || obj.empId || obj.code || '');
  return {
    id,
    invoiceNumber: obj.invoiceNumber || obj.woNumber || obj.poNumber || obj.number || obj.empCode || '',
    docDate:
      obj.invoiceDate ||
      obj.date ||
      obj.billDate ||
      obj.month ||
      obj.createdAt ||
      obj.updatedAt ||
      '',
    clientName:
      obj.clientName ||
      obj.data?.client?.name ||
      obj.vendorName ||
      obj.supplierName ||
      obj.name ||
      obj.employeeName ||
      '',
    status: obj.status || (obj.isActive === false ? 'inactive' : '') || '',
    totalAmount: money(obj.totalAmount ?? obj.total ?? obj.data?.totals?.total ?? obj.gross ?? 0),
    workOrderId: obj.workOrderId || obj.data?.workOrderId || '',
    invoiceType: obj.invoiceType || obj.data?.invoiceType || collection,
    updatedAt: new Date().toISOString(),
  };
}

function walkJsonFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (st.isDirectory()) walkJsonFiles(full, out);
    else if (name.endsWith('.json')) out.push(full);
  }
  return out;
}

function importAllJson(DATA_DIR) {
  if (!db) return 0;
  const upsert = db.prepare(`
    INSERT INTO records (collection, id, invoiceNumber, docDate, clientName, status, totalAmount, workOrderId, invoiceType, updatedAt, payload_json)
    VALUES (@collection, @id, @invoiceNumber, @docDate, @clientName, @status, @totalAmount, @workOrderId, @invoiceType, @updatedAt, @payload_json)
    ON CONFLICT(collection, id) DO UPDATE SET
      invoiceNumber=excluded.invoiceNumber,
      docDate=excluded.docDate,
      clientName=excluded.clientName,
      status=excluded.status,
      totalAmount=excluded.totalAmount,
      workOrderId=excluded.workOrderId,
      invoiceType=excluded.invoiceType,
      updatedAt=excluded.updatedAt,
      payload_json=excluded.payload_json
  `);
  const tx = db.transaction((rows) => { for (const r of rows) upsert.run(r); });
  const batch = [];

  for (const collection of COLLECTIONS) {
    const dir = path.join(DATA_DIR, ...collection.split('/'));
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      try {
        const obj = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const idx = extractIndex(collection, obj);
        if (!idx.id) idx.id = f.replace(/\.json$/i, '');
        batch.push({ collection, ...idx, payload_json: JSON.stringify(obj) });
      } catch { /* skip */ }
    }
  }

  // Any extra JSON under data/hrm/** not covered above
  const hrmRoot = path.join(DATA_DIR, 'hrm');
  if (fs.existsSync(hrmRoot)) {
    for (const fp of walkJsonFiles(hrmRoot)) {
      try {
        const rel = path.relative(DATA_DIR, fp).replace(/\\/g, '/');
        // hrm/employees/foo.json → collection hrm/employees, id foo
        const parts = rel.split('/');
        if (parts.length < 3) continue;
        const collection = parts.slice(0, -1).join('/');
        if (COLLECTIONS.includes(collection) && batch.some((b) => b.collection === collection && b.id === parts[parts.length - 1].replace(/\.json$/i, ''))) {
          continue; // already imported
        }
        const obj = JSON.parse(fs.readFileSync(fp, 'utf8'));
        const idx = extractIndex(collection, obj);
        if (!idx.id) idx.id = parts[parts.length - 1].replace(/\.json$/i, '');
        batch.push({ collection, ...idx, payload_json: JSON.stringify(obj) });
      } catch { /* skip */ }
    }
  }

  const profilePath = path.join(DATA_DIR, 'profile.json');
  if (fs.existsSync(profilePath)) {
    try {
      const obj = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      batch.push({
        collection: 'profiles',
        id: obj.id || 'default',
        invoiceNumber: '',
        docDate: '',
        clientName: obj.businessName || '',
        status: '',
        totalAmount: 0,
        workOrderId: '',
        invoiceType: 'profile',
        updatedAt: new Date().toISOString(),
        payload_json: JSON.stringify(obj),
      });
    } catch { /* */ }
  }

  if (batch.length) tx(batch);
  return batch.length;
}

function mirrorWrite(collection, id, obj) {
  if (!jsonMirror || !dataDir) return;
  try {
    if (collection === 'profiles' && (id === 'default' || id === 'profile')) {
      fs.writeFileSync(path.join(dataDir, 'profile.json'), JSON.stringify(obj, null, 2), 'utf8');
      return;
    }
    const dir = collectionDir(collection);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const fp = path.join(dir, safeFileName(id) + '.json');
    const tmp = fp + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
    fs.renameSync(tmp, fp);
  } catch (e) {
    console.warn('[sqlite] JSON mirror write failed:', e.message);
  }
}

function mirrorDelete(collection, id) {
  if (!jsonMirror || !dataDir) return;
  try {
    const fp = path.join(collectionDir(collection), safeFileName(id) + '.json');
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch (e) {
    console.warn('[sqlite] JSON mirror delete failed:', e.message);
  }
}

/**
 * @param {string} collection
 * @param {{ includeDeleted?: boolean, limit?: number, offset?: number, status?: string, q?: string }} opts
 */
export function sqliteList(collection, opts = {}) {
  if (!ready || !db) return null;
  const {
    includeDeleted = false,
    limit,
    offset = 0,
    status,
    q,
  } = opts;

  let sql = 'SELECT payload_json FROM records WHERE collection = ?';
  const params = [collection];
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (q) {
    sql += ' AND (clientName LIKE ? OR invoiceNumber LIKE ? OR id LIKE ?)';
    const like = '%' + q + '%';
    params.push(like, like, like);
  }
  sql += ' ORDER BY docDate DESC, id DESC';
  if (limit != null && Number(limit) > 0) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset) || 0);
  }

  const rows = db.prepare(sql).all(...params);
  const out = [];
  for (const r of rows) {
    try {
      const obj = JSON.parse(r.payload_json);
      if (!includeDeleted && (obj.deleted || obj.isDeleted || obj._deleted)) continue;
      out.push(obj);
    } catch { /* skip */ }
  }
  return out;
}

export function sqliteCount(collection, { status, q, includeDeleted = false } = {}) {
  if (!ready || !db) return 0;
  // Count via payload filter is expensive; approximate with SQL then filter deleted in rare cases
  let sql = 'SELECT payload_json FROM records WHERE collection = ?';
  const params = [collection];
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (q) {
    sql += ' AND (clientName LIKE ? OR invoiceNumber LIKE ? OR id LIKE ?)';
    const like = '%' + q + '%';
    params.push(like, like, like);
  }
  const rows = db.prepare(sql).all(...params);
  let n = 0;
  for (const r of rows) {
    try {
      const obj = JSON.parse(r.payload_json);
      if (!includeDeleted && (obj.deleted || obj.isDeleted || obj._deleted)) continue;
      n += 1;
    } catch { /* */ }
  }
  return n;
}

export function sqliteGet(collection, id) {
  if (!ready || !db) return null;
  const row = db
    .prepare('SELECT payload_json FROM records WHERE collection = ? AND id = ?')
    .get(collection, String(id));
  if (!row) return undefined;
  try {
    return JSON.parse(row.payload_json);
  } catch {
    return null;
  }
}

export function sqliteUpsert(collection, obj) {
  if (!ready || !db || !obj) return false;
  const idx = extractIndex(collection, obj);
  if (!idx.id) return false;
  db.prepare(`
    INSERT INTO records (collection, id, invoiceNumber, docDate, clientName, status, totalAmount, workOrderId, invoiceType, updatedAt, payload_json)
    VALUES (@collection, @id, @invoiceNumber, @docDate, @clientName, @status, @totalAmount, @workOrderId, @invoiceType, @updatedAt, @payload_json)
    ON CONFLICT(collection, id) DO UPDATE SET
      invoiceNumber=excluded.invoiceNumber,
      docDate=excluded.docDate,
      clientName=excluded.clientName,
      status=excluded.status,
      totalAmount=excluded.totalAmount,
      workOrderId=excluded.workOrderId,
      invoiceType=excluded.invoiceType,
      updatedAt=excluded.updatedAt,
      payload_json=excluded.payload_json
  `).run({
    collection,
    ...idx,
    payload_json: JSON.stringify(obj),
  });
  mirrorWrite(collection, idx.id, obj);
  return true;
}

/** Run several upserts in one transaction (e.g. bill + journal). */
export function sqliteUpsertMany(pairs) {
  if (!ready || !db || !Array.isArray(pairs)) return false;
  const run = db.transaction((list) => {
    for (const { collection, obj } of list) {
      sqliteUpsert(collection, obj);
    }
  });
  run(pairs);
  return true;
}

export function sqliteRemove(collection, id) {
  if (!ready || !db) return false;
  db.prepare('DELETE FROM records WHERE collection = ? AND id = ?').run(collection, String(id));
  mirrorDelete(collection, id);
  return true;
}

/** Count JSON files on disk for a collection (non-recursive for top-level; recursive for hrm/*). */
export function countJsonFiles(collection) {
  if (!dataDir) return 0;
  const dir = collectionDir(collection);
  if (!fs.existsSync(dir)) return 0;
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

export function verifyParity() {
  const rows = [];
  let allOk = true;
  for (const collection of COLLECTIONS) {
    const jsonCount = countJsonFiles(collection);
    const sqlCount = ready && db
      ? (db.prepare('SELECT COUNT(*) AS n FROM records WHERE collection = ?').get(collection)?.n || 0)
      : 0;
    const ok = jsonCount === sqlCount;
    if (!ok) allOk = false;
    rows.push({ collection, jsonCount, sqlCount, ok });
  }
  // profile.json special
  const profileJson = dataDir && fs.existsSync(path.join(dataDir, 'profile.json')) ? 1 : 0;
  const profileSql = ready && db
    ? (db.prepare("SELECT COUNT(*) AS n FROM records WHERE collection = 'profiles'").get()?.n || 0)
    : 0;
  rows.push({
    collection: 'profiles (profile.json)',
    jsonCount: profileJson,
    sqlCount: profileSql,
    ok: profileJson <= profileSql,
  });
  if (profileJson > profileSql) allOk = false;
  return { ok: allOk, rows };
}

export function sqliteStats() {
  if (!ready || !db) return { ready: false };
  const counts = {};
  for (const c of COLLECTIONS) {
    counts[c] = db.prepare('SELECT COUNT(*) AS n FROM records WHERE collection = ?').get(c)?.n || 0;
  }
  return {
    ready: true,
    path: path.join(dataDir || '', 'sd-dynamics.sqlite'),
    jsonMirror,
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  };
}

/** Resolve data/<collection>/<id>.json → { collection, id } or null */
export function pathToCollectionId(filePath, DATA_DIR) {
  try {
    const rel = path.relative(DATA_DIR, path.resolve(filePath)).replace(/\\/g, '/');
    if (rel === 'profile.json') return { collection: 'profiles', id: 'default' };
    const parts = rel.split('/');
    if (parts.length < 2 || parts[0].startsWith('..')) return null;
    if (parts[0] === 'hrm' && parts.length >= 3) {
      return {
        collection: parts.slice(0, -1).join('/'),
        id: parts[parts.length - 1].replace(/\.json$/i, ''),
      };
    }
    if (parts.length === 2 && parts[1].endsWith('.json')) {
      return {
        collection: parts[0],
        id: parts[1].replace(/\.json$/i, ''),
      };
    }
    // nested non-hrm: join all but last
    if (parts.length > 2 && parts[parts.length - 1].endsWith('.json')) {
      return {
        collection: parts.slice(0, -1).join('/'),
        id: parts[parts.length - 1].replace(/\.json$/i, ''),
      };
    }
  } catch { /* */ }
  return null;
}
