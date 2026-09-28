/**
 * Unified master lists for HSN/SAC, Units, Expense categories.
 * Merges legacy keys so Invoice, WO, PO, and Master Data stay in sync.
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
        const v = String(x || '').trim();
        if (v && !seen.has(v)) { seen.add(v); out.push(v); }
      }
    } catch { /* ignore */ }
  }
  return out;
}

function writePrimary(keys, arr) {
  const primary = keys[0];
  localStorage.setItem(primary, JSON.stringify(arr));
  // mirror to legacy key so older code paths still see updates
  if (keys[1]) localStorage.setItem(keys[1], JSON.stringify(arr));
}

export function getHsnMaster() {
  return readMerged(SAC_KEYS);
}

export function addHsnCode(code) {
  const t = String(code || '').trim();
  if (!t) return getHsnMaster();
  const arr = getHsnMaster();
  if (!arr.includes(t)) arr.push(t);
  writePrimary(SAC_KEYS, arr);
  return arr;
}

export function removeHsnCode(code) {
  const arr = getHsnMaster().filter(x => x !== code);
  writePrimary(SAC_KEYS, arr);
  return arr;
}

export function getUnitMaster() {
  const base = ['Nos', 'Hrs', 'Days', 'Kg', 'Ltr', 'Mtr', 'Sqft', 'Job', 'Pcs', 'Set'];
  const custom = readMerged(UNIT_KEYS);
  return [...new Set([...base, ...custom])];
}

export function addUnit(unit) {
  const t = String(unit || '').trim();
  if (!t) return getUnitMaster();
  const custom = readMerged(UNIT_KEYS);
  if (!custom.includes(t)) custom.push(t);
  writePrimary(UNIT_KEYS, custom);
  return getUnitMaster();
}

export function removeUnit(unit) {
  const custom = readMerged(UNIT_KEYS).filter(x => x !== unit);
  writePrimary(UNIT_KEYS, custom);
  return getUnitMaster();
}

export function getExpenseCategories() {
  return readMerged(EXP_KEYS);
}

export function addExpenseCategory(cat) {
  const t = String(cat || '').trim();
  if (!t) return getExpenseCategories();
  const arr = getExpenseCategories();
  if (!arr.includes(t)) arr.push(t);
  writePrimary(EXP_KEYS, arr);
  return arr;
}

export function removeExpenseCategory(cat) {
  const arr = getExpenseCategories().filter(x => x !== cat);
  writePrimary(EXP_KEYS, arr);
  return arr;
}


export async function syncMasterDataToServer() {
  try {
    const body = {
      hsn: getHsnMaster(),
      units: getUnitMaster().filter((u) => !['Nos', 'Hrs', 'Days', 'Kg', 'Ltr', 'Mtr', 'Sqft', 'Job', 'Pcs', 'Set'].includes(u)),
      expenseCategories: getExpenseCategories(),
    };
    await fetch('/api/master-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) { /* offline */ }
}

export async function loadMasterDataFromServer() {
  try {
    const res = await fetch('/api/master-data');
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data.hsn) && data.hsn.length) {
      localStorage.setItem('freegstbill_custom_sac', JSON.stringify(data.hsn));
      localStorage.setItem('fgsb_custom_sac', JSON.stringify(data.hsn));
    }
    if (Array.isArray(data.units) && data.units.length) {
      localStorage.setItem('freegstbill_custom_units', JSON.stringify(data.units));
      localStorage.setItem('fgsb_custom_units', JSON.stringify(data.units));
    }
    if (Array.isArray(data.expenseCategories) && data.expenseCategories.length) {
      localStorage.setItem('freegstbill_expense_categories', JSON.stringify(data.expenseCategories));
      localStorage.setItem('fgsb_expense_categories', JSON.stringify(data.expenseCategories));
    }
    return data;
  } catch (e) {
    return null;
  }
}
