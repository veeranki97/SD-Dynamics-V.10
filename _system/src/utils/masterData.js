/**
 * Unified master lists for HSN/SAC, Units, Expense categories.
 * Merges legacy keys so Invoice, WO, PO, and Master Data stay in sync.
 * Add helpers reject duplicates (case-insensitive).
 */
const SAC_KEYS = ['freegstbill_custom_sac', 'fgsb_custom_sac'];
const UNIT_KEYS = ['freegstbill_custom_units', 'fgsb_custom_units'];
const EXP_KEYS = ['freegstbill_expense_categories', 'fgsb_expense_categories'];

function readMerged(keys) {
  const out = [];
  const seen = new Set();
  for (const key of keys) {
    try {
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(arr)) continue;
      for (const x of arr) {
        const s = String(x || '').trim();
        if (!s) continue;
        const k = s.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(s);
      }
    } catch { /* */ }
  }
  return out;
}

function writePrimary(keys, list) {
  try {
    localStorage.setItem(keys[0], JSON.stringify(list));
  } catch { /* */ }
}

export function getHsnMaster() {
  return readMerged(SAC_KEYS);
}

/** @returns {{ ok: boolean, error?: string, list: string[] }} */
export function addHsnCode(code) {
  const c = String(code || '').trim();
  if (!c) return { ok: false, error: 'HSN/SAC code is required', list: getHsnMaster() };
  const list = getHsnMaster();
  if (list.some(x => String(x).toLowerCase() === c.toLowerCase())) {
    return { ok: false, error: `Duplicate HSN/SAC: "${c}" already exists`, list };
  }
  const next = [...list, c];
  writePrimary(SAC_KEYS, next);
  return { ok: true, list: next };
}

export function removeHsnCode(code) {
  const c = String(code || '').trim().toLowerCase();
  const next = getHsnMaster().filter(x => String(x).toLowerCase() !== c);
  writePrimary(SAC_KEYS, next);
  return next;
}

export function getUnitMaster() {
  return readMerged(UNIT_KEYS);
}

/** @returns {{ ok: boolean, error?: string, list: string[] }} */
export function addUnit(unit) {
  const u = String(unit || '').trim();
  if (!u) return { ok: false, error: 'Unit is required', list: getUnitMaster() };
  const list = getUnitMaster();
  if (list.some(x => String(x).toLowerCase() === u.toLowerCase())) {
    return { ok: false, error: `Duplicate unit: "${u}" already exists`, list };
  }
  const next = [...list, u];
  writePrimary(UNIT_KEYS, next);
  return { ok: true, list: next };
}

export function removeUnit(unit) {
  const u = String(unit || '').trim().toLowerCase();
  const next = getUnitMaster().filter(x => String(x).toLowerCase() !== u);
  writePrimary(UNIT_KEYS, next);
  return next;
}

export function getExpenseCategories() {
  return readMerged(EXP_KEYS);
}

/** @returns {{ ok: boolean, error?: string, list: string[] }} */
export function addExpenseCategory(cat) {
  const c = String(cat || '').trim();
  if (!c) return { ok: false, error: 'Category is required', list: getExpenseCategories() };
  const list = getExpenseCategories();
  if (list.some(x => String(x).toLowerCase() === c.toLowerCase())) {
    return { ok: false, error: `Duplicate category: "${c}" already exists`, list };
  }
  const next = [...list, c];
  writePrimary(EXP_KEYS, next);
  return { ok: true, list: next };
}

export function removeExpenseCategory(cat) {
  const c = String(cat || '').trim().toLowerCase();
  const next = getExpenseCategories().filter(x => String(x).toLowerCase() !== c);
  writePrimary(EXP_KEYS, next);
  return next;
}

// Back-compat aliases used by older call sites that ignored return value
export const saveUnitMaster = addUnit;
export const deleteUnitMaster = removeUnit;

/** Optional server hydrate (no-op if API missing). */
export async function loadMasterDataFromServer() {
  try {
    const res = await fetch('/api/master-data');
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.hsn)) localStorage.setItem(SAC_KEYS[0], JSON.stringify(data.hsn));
    if (Array.isArray(data.units)) localStorage.setItem(UNIT_KEYS[0], JSON.stringify(data.units));
    if (Array.isArray(data.expenseCategories)) localStorage.setItem(EXP_KEYS[0], JSON.stringify(data.expenseCategories));
  } catch { /* offline / no endpoint */ }
}

export async function syncMasterDataToServer() {
  try {
    await fetch('/api/master-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hsn: getHsnMaster(),
        units: getUnitMaster(),
        expenseCategories: getExpenseCategories(),
      }),
    });
  } catch { /* */ }
}
