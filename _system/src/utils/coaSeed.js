/**
 * Chart of Accounts seed — Indian services / contracting SME.
 * Used once when accounts collection is empty (ensureCoaSeeded).
 * Codes align with LEDGER_POSTING.md defaults.
 *
 * Storage: sqliteStore collection "accounts" (same hybrid path as costcenters).
 * Do not invent a parallel DB table.
 */

export const COA_SEED = [
  // —— Assets 1000–1999 ——
  { id: 'acc_1000', code: '1000', name: 'Current Assets', parentId: null, type: 'asset', accountType: 'group', isGroup: true, isSystem: true },
  { id: 'acc_1100', code: '1100', name: 'Cash-in-Hand', parentId: 'acc_1000', type: 'asset', accountType: 'cash', isGroup: false, isSystem: true },
  { id: 'acc_1200', code: '1200', name: 'Bank Accounts', parentId: 'acc_1000', type: 'asset', accountType: 'group', isGroup: true, isSystem: true },
  { id: 'acc_1210', code: '1210', name: 'Primary Operating Bank', parentId: 'acc_1200', type: 'asset', accountType: 'bank', isGroup: false, isSystem: true },
  { id: 'acc_1300', code: '1300', name: 'Sundry Debtors', parentId: 'acc_1000', type: 'asset', accountType: 'debtor', isGroup: false, isSystem: true },
  { id: 'acc_1400', code: '1400', name: 'GST ITC', parentId: 'acc_1000', type: 'asset', accountType: 'group', isGroup: true, isSystem: true },
  { id: 'acc_1410', code: '1410', name: 'Input CGST', parentId: 'acc_1400', type: 'asset', accountType: 'tax', isGroup: false, isSystem: true },
  { id: 'acc_1420', code: '1420', name: 'Input SGST', parentId: 'acc_1400', type: 'asset', accountType: 'tax', isGroup: false, isSystem: true },
  { id: 'acc_1430', code: '1430', name: 'Input IGST', parentId: 'acc_1400', type: 'asset', accountType: 'tax', isGroup: false, isSystem: true },

  // —— Liabilities 2000–2999 ——
  { id: 'acc_2000', code: '2000', name: 'Current Liabilities', parentId: null, type: 'liability', accountType: 'group', isGroup: true, isSystem: true },
  { id: 'acc_2100', code: '2100', name: 'Sundry Creditors', parentId: 'acc_2000', type: 'liability', accountType: 'creditor', isGroup: false, isSystem: true },
  { id: 'acc_2200', code: '2200', name: 'Duties & Taxes', parentId: 'acc_2000', type: 'liability', accountType: 'group', isGroup: true, isSystem: true },
  { id: 'acc_2210', code: '2210', name: 'Output CGST', parentId: 'acc_2200', type: 'liability', accountType: 'tax', isGroup: false, isSystem: true },
  { id: 'acc_2220', code: '2220', name: 'Output SGST', parentId: 'acc_2200', type: 'liability', accountType: 'tax', isGroup: false, isSystem: true },
  { id: 'acc_2230', code: '2230', name: 'Output IGST', parentId: 'acc_2200', type: 'liability', accountType: 'tax', isGroup: false, isSystem: true },
  { id: 'acc_2240', code: '2240', name: 'TDS Payable', parentId: 'acc_2200', type: 'liability', accountType: 'tax', isGroup: false, isSystem: true },
  { id: 'acc_2250', code: '2250', name: 'TCS Payable', parentId: 'acc_2200', type: 'liability', accountType: 'tax', isGroup: false, isSystem: true },
  { id: 'acc_2300', code: '2300', name: 'Advances from Customers', parentId: 'acc_2000', type: 'liability', accountType: 'advance', isGroup: false, isSystem: true },

  // —— Equity 3000–3999 ——
  { id: 'acc_3100', code: '3100', name: 'Owner / Capital', parentId: null, type: 'equity', accountType: 'capital', isGroup: false, isSystem: true },
  { id: 'acc_3200', code: '3200', name: 'Retained Earnings / Reserve', parentId: null, type: 'equity', accountType: 'retained', isGroup: false, isSystem: true },

  // —— Income 4000–4999 ——
  { id: 'acc_4100', code: '4100', name: 'Sales & Service Revenue', parentId: null, type: 'income', accountType: 'revenue', isGroup: false, isSystem: true },
  { id: 'acc_4200', code: '4200', name: 'Other Income', parentId: null, type: 'income', accountType: 'other_income', isGroup: false, isSystem: true },

  // —— Expenses 5000–5999 ——
  { id: 'acc_5100', code: '5100', name: 'Direct Project / Material', parentId: null, type: 'expense', accountType: 'direct_expense', isGroup: false, isSystem: true },
  { id: 'acc_5200', code: '5200', name: 'Direct Labour & Subcontract', parentId: null, type: 'expense', accountType: 'direct_expense', isGroup: false, isSystem: true },
  { id: 'acc_5300', code: '5300', name: 'Rent & Utilities', parentId: null, type: 'expense', accountType: 'indirect_expense', isGroup: false, isSystem: true },
  { id: 'acc_5400', code: '5400', name: 'Salaries & Staff', parentId: null, type: 'expense', accountType: 'indirect_expense', isGroup: false, isSystem: true },
  { id: 'acc_5500', code: '5500', name: 'Bank Charges', parentId: null, type: 'expense', accountType: 'indirect_expense', isGroup: false, isSystem: true },
  { id: 'acc_5900', code: '5900', name: 'Round-off', parentId: null, type: 'expense', accountType: 'round_off', isGroup: false, isSystem: true },
];

/** Default GL mapping keys → account id (Settings panel later). */
export const DEFAULT_GL_MAP = {
  revenue: 'acc_4100',
  receivables: 'acc_1300',
  payables: 'acc_2100',
  operatingBank: 'acc_1210',
  cash: 'acc_1100',
  projectExpense: 'acc_5100',
  outputCgst: 'acc_2210',
  outputSgst: 'acc_2220',
  outputIgst: 'acc_2230',
  inputCgst: 'acc_1410',
  inputSgst: 'acc_1420',
  inputIgst: 'acc_1430',
  advancesFromCustomers: 'acc_2300',
  roundOff: 'acc_5900',
  retainedEarnings: 'acc_3200',
  capital: 'acc_3100',
};

/**
 * Ensure seed rows exist. Idempotent: skips if any account with isSystem already present
 * OR if list length > 0 (user may have partial CoA).
 *
 * @param {{ listAccounts: () => object[], upsertAccount: (row: object) => void }} deps
 * @returns {{ seeded: boolean, count: number }}
 */
export function ensureCoaSeeded(deps) {
  const existing = (deps.listAccounts && deps.listAccounts()) || [];
  if (existing.length > 0) {
    return { seeded: false, count: existing.length };
  }
  const now = new Date().toISOString();
  for (const row of COA_SEED) {
    deps.upsertAccount({
      ...row,
      isActive: true,
      companyId: 'default',
      updatedAt: now,
      createdAt: now,
    });
  }
  return { seeded: true, count: COA_SEED.length };
}

/**
 * Resolve account by id or code or exact name (legacy journal compatibility).
 */
export function findAccount(accounts, ref) {
  if (!ref || !accounts) return null;
  const s = String(ref).trim();
  return (
    accounts.find((a) => a.id === s) ||
    accounts.find((a) => a.code === s) ||
    accounts.find((a) => String(a.name).toLowerCase() === s.toLowerCase()) ||
    null
  );
}
