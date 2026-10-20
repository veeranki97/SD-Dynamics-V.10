/**
 * Client-side: detect meta.useGlEngine so UI skips legacy saveJournal when
 * the server GL spine already posts the same economic event.
 */
let _cache = null;
let _ts = 0;

export async function isGlEngineOn() {
  const now = Date.now();
  if (_cache !== null && now - _ts < 30000) return _cache;
  try {
    const base = (typeof window !== 'undefined' && window.__SD_API__) || '';
    const r = await fetch((base || '') + '/api/meta/useGlEngine', { credentials: 'include' });
    if (!r.ok) {
      _cache = false;
      _ts = now;
      return false;
    }
    const j = await r.json();
    _cache = !!(j && (j.value === true || j.value === 'true'));
    _ts = now;
    return _cache;
  } catch {
    _cache = false;
    _ts = now;
    return false;
  }
}

/** Skip legacy journal write when engine posts on the server. */
export async function saveJournalIfLegacy(saveJournalFn, jnl, opts) {
  if (await isGlEngineOn()) return { skipped: true, reason: 'gl_engine' };
  if (typeof saveJournalFn === 'function' && jnl) {
    return saveJournalFn(jnl, opts);
  }
  return null;
}
