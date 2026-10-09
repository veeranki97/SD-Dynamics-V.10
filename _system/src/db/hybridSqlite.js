/**
 * Hybrid SQLite index for bills / WOs / POs (optional acceleration).
 * Enable with env SD_USE_SQLITE=1 after: npm install better-sqlite3
 *
 * Schema: indexed columns + payload_json — no normalized line-item tables.
 * JSON files under data/ remain source of truth until you cut over reads.
 */
import fs from 'fs';
import path from 'path';

let Database = null;
try {
  Database = (await import('better-sqlite3')).default;
} catch {
  Database = null;
}

export function openHybridDb(dataDir) {
  if (!Database || process.env.SD_USE_SQLITE !== '1') return null;
  const dbPath = path.join(dataDir, 'sd-index.sqlite');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS bills_idx (
      id TEXT PRIMARY KEY,
      invoiceNumber TEXT,
      invoiceDate TEXT,
      clientName TEXT,
      status TEXT,
      totalAmount REAL,
      workOrderId TEXT,
      invoiceType TEXT,
      payload_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bills_date ON bills_idx(invoiceDate);
    CREATE INDEX IF NOT EXISTS idx_bills_client ON bills_idx(clientName);
    CREATE INDEX IF NOT EXISTS idx_bills_status ON bills_idx(status);
    CREATE INDEX IF NOT EXISTS idx_bills_wo ON bills_idx(workOrderId);
  `);
  return db;
}

export function upsertBillIndex(db, bill) {
  if (!db || !bill) return;
  const id = String(bill.id || bill.invoiceNumber || '');
  if (!id) return;
  const stmt = db.prepare(`
    INSERT INTO bills_idx (id, invoiceNumber, invoiceDate, clientName, status, totalAmount, workOrderId, invoiceType, payload_json)
    VALUES (@id, @invoiceNumber, @invoiceDate, @clientName, @status, @totalAmount, @workOrderId, @invoiceType, @payload_json)
    ON CONFLICT(id) DO UPDATE SET
      invoiceNumber=excluded.invoiceNumber,
      invoiceDate=excluded.invoiceDate,
      clientName=excluded.clientName,
      status=excluded.status,
      totalAmount=excluded.totalAmount,
      workOrderId=excluded.workOrderId,
      invoiceType=excluded.invoiceType,
      payload_json=excluded.payload_json
  `);
  stmt.run({
    id,
    invoiceNumber: bill.invoiceNumber || '',
    invoiceDate: bill.invoiceDate || '',
    clientName: bill.clientName || bill.data?.client?.name || '',
    status: bill.status || '',
    totalAmount: Number(bill.totalAmount) || 0,
    workOrderId: bill.workOrderId || bill.data?.workOrderId || '',
    invoiceType: bill.invoiceType || bill.data?.invoiceType || '',
    payload_json: JSON.stringify(bill),
  });
}

/** One-time: scan data/bills/*.json into SQLite index */
export function rebuildBillsIndex(db, billsDir) {
  if (!db || !fs.existsSync(billsDir)) return 0;
  const files = fs.readdirSync(billsDir).filter(f => f.endsWith('.json'));
  const tx = db.transaction((rows) => {
    for (const bill of rows) upsertBillIndex(db, bill);
  });
  const rows = [];
  for (const f of files) {
    try {
      rows.push(JSON.parse(fs.readFileSync(path.join(billsDir, f), 'utf8')));
    } catch { /* skip */ }
  }
  tx(rows);
  return rows.length;
}
