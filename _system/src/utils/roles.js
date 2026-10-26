/**
 * Local single-PC roles (ERPNext-inspired, offline).
 * Owner: full · Accountant: post & edit financial · Viewer: read-only.
 * Stored in meta.localRole (and session mirror). Not multi-user auth.
 */

export const ROLES = [
  { id: 'owner', label: 'Owner', desc: 'Full access including settings & deletes' },
  { id: 'accountant', label: 'Accountant', desc: 'Invoices, payments, journals — limited settings' },
  { id: 'viewer', label: 'Viewer', desc: 'Read-only lists and reports' },
];

const KEY = 'sd_local_role';

export function getLocalRole() {
  try {
    const s = sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
    if (s && ['owner', 'accountant', 'viewer'].includes(s)) return s;
  } catch { /* */ }
  return 'owner';
}

export function setLocalRole(role) {
  const r = ['owner', 'accountant', 'viewer'].includes(role) ? role : 'owner';
  try {
    localStorage.setItem(KEY, r);
    sessionStorage.setItem(KEY, r);
  } catch { /* */ }
  try {
    window.dispatchEvent(new CustomEvent('sd-role-changed', { detail: r }));
  } catch { /* */ }
  return r;
}

export function canWrite(role = getLocalRole()) {
  return role === 'owner' || role === 'accountant';
}

export function canAdmin(role = getLocalRole()) {
  return role === 'owner';
}

export function canDelete(role = getLocalRole()) {
  return role === 'owner';
}
