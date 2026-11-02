/**
 * Client-side: detect meta.useGlEngine so UI skips legacy saveJournal when
 * the server GL spine already posts the same economic event.
 */
let _cache = null;
let _ts = 0;

async function probeEngine() {
  const paths = ['/api/meta/useGlEngine', '/api/meta?key=useGlEngine'];
  for (const path of paths) {
    try {
      const r = await fetch(path, { credentials: 'include' });
      if (!r.ok) continue;
      const j = await r.json();
      if (j && typeof j.value !== 'undefined') {
        return !!(j.value === true || j.value === 'true' || j.value === 1);
      }
      if (j && typeof j.useGlEngine !== 'undefined') {
        return !!(j.useGlEngine === true || j.useGlEngine === 'true');
      }
    } catch (_) { /* try next */ }
  }
  // If CoA accounts exist, engine is almost certainly on (fresh GL install)
  try {
    const r = await fetch('/api/accounts', { credentials: 'include' });
    if (r.ok) {
      const acc = await r.json();
      if (Array.isArray(acc) && acc.length >= 5) return true;
    }
  } catch (_) {}
  return false;
}

export async function isGlEngineOn() {
  const now = Date.now();
  if (_cache !== null && now - _ts < 60000) return _cache;
  _cache = await probeEngine();
  _ts = now;
  return _cache;
}

/** Stable idempotency key: one economic event → one journal row. */
export function buildIdempotencyKey(refType, refId, eventId = 'main') {
  const a = String(refType || 'doc').replace(/\s+/g, '_');
  const b = String(refId || 'na').replace(/\s+/g, '_');
  const c = String(eventId || 'main').replace(/\s+/g, '_');
  return `gl:${a}:${b}:${c}`;
}

/** Ensure journal has stable id + idempotencyKey. */
export function ensureJournalIdentity(jnl) {
  if (!jnl || typeof jnl !== 'object') return jnl;
  const refType = jnl.refType || 'journal';
  const refId = jnl.refId || jnl.id || 'na';
  const eventId = jnl.eventId || jnl.paymentId || 'main';
  if (!jnl.idempotencyKey) {
    jnl.idempotencyKey = buildIdempotencyKey(refType, refId, eventId);
  }
  if (!jnl.id) {
    jnl.id = 'jnl_' + String(jnl.idempotencyKey).replace(/^gl:/, '').replace(/[^A-Za-z0-9._-]/g, '_');
  }
  return jnl;
}

/**
 * Post a document journal safely.
 * Engine ON → server owns post (skip client write, not a failure).
 * Engine OFF → overwrite on stable id (idempotent retry).
 * @returns {{ ok: boolean, skipped?: boolean, reason?: string, error?: string, journal?: object }}
 */
export async function postDocumentJournal(saveJournalFn, jnl, opts = {}) {
  if (!jnl) return { ok: true, skipped: true, reason: 'no-journal' };
  ensureJournalIdentity(jnl);
  if (await isGlEngineOn()) {
    return { ok: true, skipped: true, reason: 'gl_engine', journal: jnl };
  }
  if (typeof saveJournalFn !== 'function') {
    return { ok: false, error: 'saveJournal not available', journal: jnl };
  }
  try {
    const overwrite = opts.overwrite !== false;
    await saveJournalFn(jnl, { ...opts, overwrite });
    return { ok: true, journal: jnl };
  } catch (e) {
    const msg = (e && e.body && e.body.error) || (e && e.message) || String(e);
    return { ok: false, error: msg, journal: jnl };
  }
}

/** Back-compat: skip when engine on; throw on real failure. */
export async function saveJournalIfLegacy(saveJournalFn, jnl, opts) {
  const result = await postDocumentJournal(saveJournalFn, jnl, opts);
  if (result.skipped) return result;
  if (!result.ok) {
    const err = new Error(result.error || 'Journal post failed');
    err.glResult = result;
    throw err;
  }
  return result;
}
