/**
 * Budget vs Actual Engine
 * Evaluates budget ceilings per Cost Center x Account x Fiscal Year
 * Enforcement actions: Stop (block save) | Warn (show alert/confirm) | Ignore
 */

import { getFinancialYearLabel } from '../utils';

export function matchBudget(budget, { costCenterId, accountCode, fiscalYear }) {
  if (!budget) return false;
  const matchCC = !budget.costCenterId || String(budget.costCenterId).trim() === String(costCenterId).trim();
  const matchAcc = !budget.accountCode || String(budget.accountCode).trim().toLowerCase() === String(accountCode).trim().toLowerCase();
  const matchFY = !budget.fiscalYear || String(budget.fiscalYear).trim() === String(fiscalYear).trim();
  return matchCC && matchAcc && matchFY;
}

export function checkBudgetLimit({
  budgets = [],
  costCenterId,
  accountCode,
  fiscalYear,
  newAmount = 0,
  currentActual = 0,
}) {
  if (!costCenterId || !accountCode) return { allowed: true, action: 'Ignore' };
  
  const fy = fiscalYear || getFinancialYearLabel();
  const matched = budgets.find(b => matchBudget(b, { costCenterId, accountCode, fiscalYear: fy }));
  if (!matched) return { allowed: true, action: 'Ignore' };

  const budgetAmount = Number(matched.amount) || 0;
  const projectedTotal = (Number(currentActual) || 0) + (Number(newAmount) || 0);
  const exceeded = projectedTotal > budgetAmount && budgetAmount > 0;

  return {
    allowed: !exceeded || matched.action !== 'Stop',
    exceeded,
    action: matched.action || 'Warn',
    budgetAmount,
    currentActual: Number(currentActual) || 0,
    projectedTotal,
    overAmount: Math.max(0, projectedTotal - budgetAmount),
    budget: matched,
  };
}
