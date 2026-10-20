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

/** Skip legacy journal write when engine posts on the server. */
export async function saveJournalIfLegacy(saveJournalFn, jnl, opts) {
  if (await isGlEngineOn()) return { skipped: true, reason: 'gl_engine' };
  if (typeof saveJournalFn === 'function' && jnl) {
    return saveJournalFn(jnl, opts);
  }
  return null;
}
