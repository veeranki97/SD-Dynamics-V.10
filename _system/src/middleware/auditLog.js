/**
 * Audit log: JSON diff + file writer + Express middleware for POST upserts.
 * Logs land in data/activity-logs/
 */
import fs from 'fs';
import path from 'path';

export function jsonDiff(before = {}, after = {}) {
  const walk = (a, b, parent = '') => {
    const result = {};
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const key of keys) {
      // Skip noisy / large fields
      if (key === 'paymentAccountSnapshot' || key === 'profile' || key === '_pdf') continue;
      const p = parent ? `${parent}.${key}` : key;
      const av = a?.[key];
      const bv = b?.[key];
      if (JSON.stringify(av) === JSON.stringify(bv)) continue;
      if (
        av && bv &&
        typeof av === 'object' && typeof bv === 'object' &&
        !Array.isArray(av) && !Array.isArray(bv)
      ) {
        const nested = walk(av, bv, p);
        if (Object.keys(nested).length) Object.assign(result, nested);
      } else {
        result[p] = { before: av, after: bv };
      }
    }
    return result;
  };
  return walk(before, after);
}

export function writeAuditLog(logEntry, baseDir) {
  const dir = baseDir || path.join(process.cwd(), 'data', 'activity-logs');
  fs.mkdirSync(dir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safe = (s) => String(s || 'x').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40);
  const fileName = `${timestamp}_${safe(logEntry?.entityType)}_${safe(logEntry?.entityId)}.json`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(logEntry, null, 2), 'utf8');
  return filePath;
}

/**
 * Call after a successful write when you have before/after objects.
 */
export function auditChange({ entityType, entityId, action, before, after, user, baseDir }) {
  try {
    const diff = action === 'create' || action === 'soft_delete'
      ? { note: action }
      : jsonDiff(before || {}, after || {});
    // Always log creates/deletes; for updates log even small changes to status/paid
    if (action === 'update' && Object.keys(diff).length === 0) {
      return writeAuditLog({
        entityType,
        entityId,
        action: 'update',
        user: user || 'local',
        at: new Date().toISOString(),
        diff: { touched: true },
      }, baseDir);
    }
    return writeAuditLog({
      entityType,
      entityId,
      action,
      user: user || 'local',
      at: new Date().toISOString(),
      diff,
    }, baseDir);
  } catch (e) {
    console.warn('[audit]', e.message);
    return null;
  }
}

/**
 * Express middleware factory — attaches res.locals.auditHelper.
 * Does not replace handlers; call auditChange from routes.
 */
export function auditMiddleware() {
  return (req, res, next) => {
    res.locals.audit = {
      log: (opts) => auditChange(opts),
    };
    next();
  };
}
