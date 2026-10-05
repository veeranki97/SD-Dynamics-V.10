/**
 * Full SQLite cut-over for SD Dynamics
 * ------------------------------------
 * Primary store: data/sd-dynamics.sqlite (better-sqlite3)
 * On first boot (empty DB): imports all JSON files under data/<collection>/
 * Writes: SQLite always; JSON mirror when SD_JSON_MIRROR=1 (default ON for safety)
 * Disable JSON mirror: SD_JSON_MIRROR=0
 * Force re-import from JSON: SD_SQLITE_REIMPORT=1
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const COLLECTIONS = [
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

/**
 * Open DB, create schema, migrate from JSON if needed.
 * @param {string} DATA_DIR absolute path to data/
 * @returns {{ ok: boolean, reason?: string, migrated?: number }}
 */
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
  const id = String(obj.id || obj.invoiceNumber || '');
  return {
    id,
    invoiceNumber: obj.invoiceNumber || obj.woNumber || obj.poNumber || obj.number || '',
    docDate:
      obj.invoiceDate ||
      obj.date ||
      obj.billDate ||
      obj.createdAt ||
      obj.updatedAt ||
      '',
    clientName:
      obj.clientName ||
      obj.data?.client?.name ||
      obj.vendorName ||
      obj.supplierName ||
      obj.name ||
      '',
    status: obj.status || '',
    totalAmount: money(obj.totalAmount ?? obj.total ?? obj.data?.totals?.total ?? 0),
    workOrderId: obj.workOrderId || obj.data?.workOrderId || '',
    invoiceType: obj.invoiceType || obj.data?.invoiceType || collection,
    updatedAt: new Date().toISOString(),
  };
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

  const tx = db.transaction((rows) => {
    for (const r of rows) upsert.run(r);
  });

  const batch = [];
  for (const collection of COLLECTIONS) {
    const dir = path.join(DATA_DIR, collection);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      try {
        const raw = fs.readFileSync(path.join(dir, f), 'utf8');
        const obj = JSON.parse(raw);
        const idx = extractIndex(collection, obj);
        if (!idx.id) idx.id = f.replace(/\.json$/i, '');
        batch.push({
          collection,
          ...idx,
          payload_json: JSON.stringify(obj),
        });
      } catch {
        /* skip corrupt */
      }
    }
  }
  // profile.json at root
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

function safeFileName(id) {
  return String(id).replace(/[/\\:*?"<>|]/g, '_');
}

function mirrorWrite(collection, id, obj) {
  if (!jsonMirror || !dataDir) return;
  try {
    if (collection === 'profiles' && (id === 'default' || id === 'profile')) {
      fs.writeFileSync(path.join(dataDir, 'profile.json'), JSON.stringify(obj, null, 2), 'utf8');
      return;
    }
    const dir = path.join(dataDir, collection);
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
    const fp = path.join(dataDir, collection, safeFileName(id) + '.json');
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch (e) {
    console.warn('[sqlite] JSON mirror delete failed:', e.message);
  }
}

/** List all records in a collection (parsed objects). */
export function sqliteList(collection, { includeDeleted = false } = {}) {
  if (!ready || !db) return null;
  const rows = db
    .prepare('SELECT payload_json FROM records WHERE collection = ? ORDER BY docDate DESC, id DESC')
    .all(collection);
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

export function sqliteGet(collection, id) {
  if (!ready || !db) return null;
  const row = db
    .prepare('SELECT payload_json FROM records WHERE collection = ? AND id = ?')
    .get(collection, String(id));
  if (!row) return undefined; // undefined = miss (caller may fall back)
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

export function sqliteRemove(collection, id) {
  if (!ready || !db) return false;
  db.prepare('DELETE FROM records WHERE collection = ? AND id = ?').run(collection, String(id));
  mirrorDelete(collection, id);
  return true;
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

export { COLLECTIONS };
