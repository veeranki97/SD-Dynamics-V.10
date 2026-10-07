/**
 * Soft-delete helpers for SD-Dynamics JSON records.
 * Works with file-backed storage (data/<entity>/*.json).
 * Physical "trash" moves in server.js remain supported; is_deleted is an extra flag.
 */
export const DOCSTATUS = {
  DRAFT: 0,
  SUBMITTED: 1,
  CANCELLED: 2,
};

export function withSoftDelete(record) {
  if (!record || typeof record !== 'object') return record;
  return {
    ...record,
    is_deleted: !!record.is_deleted,
    deleted_at: record.deleted_at || null,
    deleted_by: record.deleted_by || null,
  };
}

export function isSoftDeleted(record) {
  if (!record) return true;
  return !!(record.is_deleted || record.deleted_at);
}

export function filterActiveRecords(items = []) {
  return (Array.isArray(items) ? items : []).filter((item) => !isSoftDeleted(item));
}

export function softDeleteRecord(record, deletedBy = 'system') {
  return {
    ...record,
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: deletedBy,
    docstatus: DOCSTATUS.CANCELLED,
  };
}

export function restoreSoftDeletedRecord(record) {
  return {
    ...record,
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
    docstatus: record?.docstatus === DOCSTATUS.CANCELLED ? DOCSTATUS.DRAFT : (record?.docstatus ?? DOCSTATUS.DRAFT),
  };
}

/** Submitted (docstatus === 1) documents should be treated as read-only in UI. */
export function isSubmitted(record) {
  return Number(record?.docstatus) === DOCSTATUS.SUBMITTED;
}

export function withReadOnlyGuard(record, options = {}) {
  const submittedDocstatus = options.submittedDocstatus ?? DOCSTATUS.SUBMITTED;
  const docstatus = Number(record?.docstatus ?? 0);
  const readOnly = docstatus === submittedDocstatus || isSoftDeleted(record);
  return {
    ...record,
    is_read_only: readOnly,
    readonly: readOnly,
  };
}

export function assertCanEdit(record, { force = false } = {}) {
  if (force) return;
  if (isSoftDeleted(record)) {
    const err = new Error('Record is deleted and cannot be edited');
    err.code = 'DELETED';
    throw err;
  }
  if (isSubmitted(record)) {
    const err = new Error('Submitted document is locked. Cancel or use force=1 for system repairs only.');
    err.code = 'LOCKED';
    throw err;
  }
}
