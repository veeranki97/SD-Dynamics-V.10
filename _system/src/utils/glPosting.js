/**
 * GL posting spine (Phase B) — idempotent double-entry via postDocument.
 *
 * Kill-switch: meta.useGlEngine !== true → callers must use legacy journal writers.
 * postDocument itself returns { skipped: true, reason: 'engine_off' } when off so
 * server can fall through without dual writes.
 *
 * Persistence: journals collection (same hybrid sqlite + JSON mirror as today).
 * Each journal batch:
 *   id, date, narration, sourceType, sourceId, companyId, entries[],
 *   isReversed, reversesId, glEngine: true, updatedAt
 * Line: { accountId, account, debit, credit, partyType?, partyId?, workOrderId?, site?, costCenterId? }
 *
 * Cash book rule (chosen): when engine ON, cash/bank movements that pass through
 * postDocument are source of truth; CashBookView should eventually read GL lines
 * for accountType cash|bank. Legacy cash writers remain when engine OFF.
 *
 * No ES6 template-literal requirement here (Node module); server/UI wiring later.
 */

import { isMonthLocked, monthKeyFromDate } from './periodLock.js';
import { DEFAULT_GL_MAP, findAccount } from './coaSeed.js';

/** Rupee → integer paise */
export function toPaise(n) {
  return Math.round((Number(n) || 0) * 100);
}

export function fromPaise(p) {
  return Math.round(Number(p) || 0) / 100;
}

/** Stable hash of normalised lines (accountId|account + debit/credit paise). */
export function hashGlLines(lines) {
  const parts = (lines || []).map((e) => {
    const id = String(e.accountId || e.account || '').trim().toLowerCase();
    return id + ':' + toPaise(e.debit) + ':' + toPaise(e.credit);
  });
  parts.sort();
  return parts.join('|');
}

/**
 * @typedef {object} PostLine
 * @property {string} [accountId]
 * @property {string} [account]  legacy name
 * @property {number} debit
 * @property {number} credit
 * @property {string} [partyType]
 * @property {string} [partyId]
 * @property {string} [workOrderId]
 * @property {string} [site]
 * @property {string} [costCenterId]
 * @property {string} [companyId]
 */

/**
 * @typedef {object} PostPayload
 * @property {string} sourceType  e.g. manual_journal | receipt | tax_invoice | opening_balance
 * @property {string} sourceId
 * @property {string} date        YYYY-MM-DD
 * @property {string} [narration]
 * @property {PostLine[]} lines
 * @property {string} [companyId]
 */

/**
 * Build deps once from server (or tests):
 * {
 *   getMeta: () => object,
 *   listJournals: () => object[],
 *   saveJournal: (j) => void,          // upsert journals collection
 *   listAccounts: () => object[],
 *   assertPeriodOpen?: (dateStr) => void, // throws if locked/frozen
 *   freezeDays?: number,                 // optional softer rule
 * }
 */
export function createGlEngine(deps) {
  if (!deps || typeof deps.saveJournal !== 'function') {
    throw new Error('createGlEngine requires saveJournal');
  }

  function engineEnabled() {
    const meta = (deps.getMeta && deps.getMeta()) || {};
    return meta.useGlEngine === true || meta.useGlEngine === 'true' || meta.useGlEngine === 1;
  }

  function assertPeriodOpen(dateStr) {
    if (typeof deps.assertPeriodOpen === 'function') {
      deps.assertPeriodOpen(dateStr);
      return;
    }
    const meta = (deps.getMeta && deps.getMeta()) || {};
    if (isMonthLocked(meta, dateStr)) {
      const err = new Error('Period locked for ' + monthKeyFromDate(dateStr) + '. Unlock in Books / GST Filing assist before posting.');
      err.code = 'PERIOD_LOCKED';
      throw err;
    }
    // Soft freeze days (optional)
    const freeze = Number(deps.freezeDays != null ? deps.freezeDays : meta.freezeDays) || 0;
    if (freeze > 0 && dateStr) {
      const d = new Date(String(dateStr).slice(0, 10) + 'T12:00:00');
      const today = new Date();
      const diff = Math.floor((today - d) / 86400000);
      if (diff > freeze) {
        const err = new Error('Date is older than freeze window (' + freeze + ' days).');
        err.code = 'FREEZE_DAYS';
        throw err;
      }
    }
  }

  function normalizeLines(lines, accounts) {
    const out = [];
    for (const raw of lines || []) {
      const debit = Math.max(0, Number(raw.debit) || 0);
      const credit = Math.max(0, Number(raw.credit) || 0);
      if (debit === 0 && credit === 0) continue;
      let accountId = raw.accountId || null;
      let account = raw.account || raw.accountName || '';
      const found = findAccount(accounts || [], accountId || account);
      if (found) {
        accountId = found.id;
        account = found.name;
      }
      if (!account && !accountId) {
        const err = new Error('Each GL line needs accountId or account name');
        err.code = 'MISSING_ACCOUNT';
        throw err;
      }
      out.push({
        accountId: accountId || null,
        account: account || accountId,
        debit: fromPaise(toPaise(debit)),
        credit: fromPaise(toPaise(credit)),
        partyType: raw.partyType || null,
        partyId: raw.partyId || null,
        workOrderId: raw.workOrderId || null,
        site: raw.site || null,
        costCenterId: raw.costCenterId || null,
        companyId: raw.companyId || 'default',
      });
    }
    return out;
  }

  function assertBalanced(lines) {
    let dr = 0;
    let cr = 0;
    for (const e of lines) {
      dr += toPaise(e.debit);
      cr += toPaise(e.credit);
    }
    if (Math.abs(dr - cr) > 1) {
      const err = new Error(
        'Unbalanced journal: Dr ' + fromPaise(dr).toFixed(2) + ' vs Cr ' + fromPaise(cr).toFixed(2)
      );
      err.code = 'UNBALANCED';
      err.debitPaise = dr;
      err.creditPaise = cr;
      throw err;
    }
  }

  /**
   * Find prior active engine posts for (sourceType, sourceId).
   */
  function priorActivePosts(sourceType, sourceId) {
    const all = (deps.listJournals && deps.listJournals()) || [];
    return all.filter(
      (j) =>
        j &&
        j.glEngine === true &&
        j.sourceType === sourceType &&
        String(j.sourceId) === String(sourceId) &&
        !j.isReversed &&
        !j.IsReversed
    );
  }

  /**
   * Append-only reversal: new batch with swapped Dr/Cr; mark old isReversed.
   */
  function reverseJournal(oldJ, reason) {
    const now = new Date().toISOString();
    const revId = 'jnl_rev_' + (oldJ.id || Date.now()) + '_' + Date.now().toString(36);
    const entries = (oldJ.entries || []).map((e) => ({
      accountId: e.accountId || null,
      account: e.account,
      debit: Number(e.credit) || 0,
      credit: Number(e.debit) || 0,
      partyType: e.partyType || null,
      partyId: e.partyId || null,
      workOrderId: e.workOrderId || null,
      site: e.site || null,
      costCenterId: e.costCenterId || null,
      companyId: e.companyId || 'default',
    }));
    const reversal = {
      id: revId,
      date: oldJ.date,
      narration: 'Reversal: ' + (reason || 'repost') + ' — was ' + (oldJ.narration || oldJ.id),
      sourceType: oldJ.sourceType,
      sourceId: oldJ.sourceId,
      companyId: oldJ.companyId || 'default',
      entries,
      glEngine: true,
      isReversal: true,
      reversesId: oldJ.id,
      isReversed: false,
      updatedAt: now,
      createdAt: now,
    };
    deps.saveJournal(reversal);
    // Flag original — do NOT mutate narration text body beyond flag
    deps.saveJournal({
      ...oldJ,
      isReversed: true,
      IsReversed: true,
      reversedAt: now,
      reversedBy: revId,
      updatedAt: now,
    });
    return reversal;
  }

  /**
   * Core API.
   * @param {PostPayload} payload
   * @param {{ force?: boolean }} [opts]
   */
  function postDocument(payload, opts = {}) {
    if (!engineEnabled()) {
      return { ok: false, skipped: true, reason: 'engine_off' };
    }
    if (!payload || !payload.sourceType || !payload.sourceId) {
      const err = new Error('postDocument requires sourceType and sourceId');
      err.code = 'INVALID_PAYLOAD';
      throw err;
    }
    const date = String(payload.date || '').slice(0, 10);
    if (!date) {
      const err = new Error('postDocument requires date');
      err.code = 'INVALID_DATE';
      throw err;
    }
    assertPeriodOpen(date);

    const accounts = (deps.listAccounts && deps.listAccounts()) || [];
    const lines = normalizeLines(payload.lines, accounts);
    if (!lines.length) {
      const err = new Error('postDocument requires at least one non-zero line');
      err.code = 'EMPTY_LINES';
      throw err;
    }
    assertBalanced(lines);

    const lineHash = hashGlLines(lines);
    const priors = priorActivePosts(payload.sourceType, payload.sourceId);

    // SAME normalised lines already posted → skip (no reverse spam on re-save)
    const identical = priors.find((p) => p.lineHash && p.lineHash === lineHash);
    if (identical) {
      return {
        ok: true,
        skipped: true,
        reason: 'unchanged',
        journal: identical,
        reversedPrior: [],
      };
    }
    // Also compare live lines if older posts lack lineHash
    if (!identical && priors.length) {
      const sameLive = priors.find((p) => hashGlLines(p.entries || []) === lineHash);
      if (sameLive) {
        // Backfill hash on existing post for next time
        try {
          deps.saveJournal({ ...sameLive, lineHash: lineHash, updatedAt: new Date().toISOString() });
        } catch (_) { /* */ }
        return {
          ok: true,
          skipped: true,
          reason: 'unchanged',
          journal: sameLive,
          reversedPrior: [],
        };
      }
    }

    // Real change: reverse prior active posts, then append new
    const reversedIds = [];
    for (const p of priors) {
      const invLabel = payload.refLabel || payload.narration || payload.sourceId;
      reverseJournal(
        p,
        'amount/account change for ' + payload.sourceType + ' ' + invLabel
      );
      reversedIds.push(p.id);
    }

    const now = new Date().toISOString();
    const id =
      'jnl_gl_' +
      String(payload.sourceType).replace(/[^a-z0-9_]/gi, '_') +
      '_' +
      String(payload.sourceId).replace(/[^a-z0-9_-]/gi, '_').slice(0, 48);

    // Stable id per source — overwrite only the active batch file when needed;
    // reversals use separate jnl_rev_* ids from reverseJournal.
    // Reuse `accounts` from normalizeLines above (do not redeclare).
    const labelled = lines.map((e) => {
      const acc = accounts.find(
        (a) => a.id === e.accountId || a.code === e.accountId || a.name === e.account
      );
      const code = acc ? acc.code : '';
      const name = acc ? acc.name : (e.account || e.accountId || '');
      const label = code ? (code + ' — ' + name) : name;
      return {
        ...e,
        account: label || e.account || e.accountId,
        accountCode: code || e.accountCode || '',
        accountName: name,
      };
    });

    const journal = {
      id: id + (reversedIds.length ? '_' + Date.now().toString(36) : ''),
      date,
      narration: payload.narration || (payload.sourceType + ' ' + payload.sourceId),
      sourceType: payload.sourceType,
      sourceId: String(payload.sourceId),
      refType: payload.sourceType,
      refId: payload.refId || String(payload.sourceId),
      refLabel: payload.refLabel || null,
      companyId: payload.companyId || 'default',
      entries: labelled,
      lineHash: lineHash,
      glEngine: true,
      isReversed: false,
      IsReversed: false,
      updatedAt: now,
      createdAt: now,
    };
    deps.saveJournal(journal);
    return { ok: true, journal, reversedPrior: reversedIds, skipped: false };
  }

  /**
   * Helper: map Settings glMap + defaults → account id for a key.
   */
  function resolveMappedAccountId(key, meta) {
    const map = (meta && meta.glMap) || {};
    const id = map[key] || DEFAULT_GL_MAP[key];
    const accounts = (deps.listAccounts && deps.listAccounts()) || [];
    const found = findAccount(accounts, id);
    return found ? found.id : id;
  }

  return {
    engineEnabled,
    postDocument,
    reverseJournal,
    priorActivePosts,
    assertBalanced,
    normalizeLines,
    resolveMappedAccountId,
    toPaise,
    fromPaise,
  };
}

/**
 * Convenience: post a balanced manual journal (sourceType manual_journal).
 */
export function postManualJournal(engine, { id, date, narration, lines, companyId }) {
  return engine.postDocument({
    sourceType: 'manual_journal',
    sourceId: id || ('mj_' + Date.now()),
    date,
    narration: narration || 'Manual journal',
    lines,
    companyId: companyId || 'default',
  });
}

/**
 * Active (non-reversed) journals for TB / ledger — engine + legacy.
 * Prefer accountId when present; fall back to account name.
 */
export function activeGlJournals(journals) {
  const list = journals || [];
  const reversedIds = new Set(list.map((j) => j.reversesId).filter(Boolean));
  return list.filter((j) => {
    if (!j) return false;
    if (j.isReversed || j.IsReversed || j.reversed) return false;
    if (reversedIds.has(j.id)) return false;
    return true;
  });
}

/**
 * Trial balance from journals (accountId preferred, else name).
 * Returns rows: { accountId, account, debit, credit }
 */
export function trialBalanceFromJournals(journals, untilDate) {
  const map = Object.create(null);
  const until = untilDate ? String(untilDate).slice(0, 10) : null;
  for (const j of activeGlJournals(journals)) {
    if (until && j.date && String(j.date).slice(0, 10) > until) continue;
    for (const e of j.entries || []) {
      const key = e.accountId || e.account || 'UNKNOWN';
      if (!map[key]) {
        map[key] = {
          accountId: e.accountId || null,
          account: e.account || key,
          debit: 0,
          credit: 0,
        };
      }
      map[key].debit += Number(e.debit) || 0;
      map[key].credit += Number(e.credit) || 0;
    }
  }
  return Object.values(map)
    .map((r) => ({
      ...r,
      debit: fromPaise(toPaise(r.debit)),
      credit: fromPaise(toPaise(r.credit)),
    }))
    .sort((a, b) => String(a.account).localeCompare(String(b.account)));
}
