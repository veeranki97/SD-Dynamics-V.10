#!/usr/bin/env node
/**
 * Second-pass migration: force JSON → SQLite re-import.
 * Usage (from _system folder):
 *   node scripts/migrate-to-sqlite.mjs
 *   node scripts/migrate-to-sqlite.mjs --mirror-off   (sets note only; env at runtime)
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const DATA_DIR = path.join(root, 'data');

process.env.SD_SQLITE_REIMPORT = '1';

const require = createRequire(import.meta.url);
let ok = false;
try {
  require('better-sqlite3');
  ok = true;
} catch (e) {
  console.error('better-sqlite3 not installed. Run: npm install better-sqlite3');
  process.exit(1);
}

const { initSqliteStore, sqliteStats } = await import('../src/db/sqliteStore.js');
const result = initSqliteStore(DATA_DIR);
console.log('init:', result);
console.log('stats:', sqliteStats());
if (!result.ok) process.exit(1);
console.log('Done. Restart the app (node server.js) if it was running.');
