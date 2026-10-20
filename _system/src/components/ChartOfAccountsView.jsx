/**
 * Chart of Accounts — server-backed (accounts collection + coaSeed).
 * Replaces localStorage-only tree. System accounts cannot be deleted if isSystem.
 * No template literals in JSX strings (Vite-safe concatenation).
 */
import { useState, useEffect, useMemo } from 'react';
import { Pencil, Trash2, Plus, FolderTree, Leaf } from 'lucide-react';
import { toast } from './Toast';
import { getAllAccounts, saveAccount } from '../store';
import { COA_SEED, ensureCoaSeeded } from '../utils/coaSeed';

const TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];

export default function ChartOfAccountsView() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newType, setNewType] = useState('expense');
  const [parentId, setParentId] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      let list = await getAllAccounts();
      if (!Array.isArray(list)) list = [];
      if (!list.length) {
        // Client-side seed via API if server returned empty (before bridge boot)
        const now = new Date().toISOString();
        for (const row of COA_SEED) {
          try {
            await saveAccount({
              ...row,
              isActive: true,
              companyId: 'default',
              updatedAt: now,
              createdAt: now,
            });
          } catch (_) { /* */ }
        }
        list = await getAllAccounts();
      }
      setAccounts(Array.isArray(list) ? list : []);
    } catch (e) {
      toast('Failed to load Chart of Accounts', 'error');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const roots = useMemo(() => {
    const byParent = {};
    (accounts || []).forEach((a) => {
      const p = a.parentId || '';
      if (!byParent[p]) byParent[p] = [];
      byParent[p].push(a);
    });
    Object.keys(byParent).forEach((k) => {
      byParent[k].sort((a, b) => String(a.code || a.name).localeCompare(String(b.code || b.name)));
    });
    return byParent;
  }, [accounts]);

  const groups = (accounts || []).filter((a) => a.isGroup);

  const renderNode = (node, depth) => {
    const kids = roots[node.id] || [];
    return (
      <div key={node.id}>
        <div
          className="coa-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            paddingLeft: 8 + depth * 16,
            borderBottom: '1px solid var(--border, #e2e8f0)',
            fontSize: 13,
          }}
        >
          {node.isGroup ? <FolderTree size={14} /> : <Leaf size={14} />}
          <span style={{ fontFamily: 'ui-monospace, monospace', width: 48, color: 'var(--text-muted)' }}>
            {node.code || '—'}
          </span>
          <span style={{ flex: 1, fontWeight: node.isGroup ? 600 : 400 }}>{node.name}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{node.type}</span>
          {node.isSystem ? (
            <span style={{ fontSize: 10, padding: '2px 6px', background: '#e2e8f0', borderRadius: 4 }}>system</span>
          ) : null}
          {!node.isGroup && !node.isSystem ? (
            <>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                title="Edit"
                onClick={() => {
                  setEditId(node.id);
                  setEditName(node.name);
                }}
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                title="Delete"
                onClick={async () => {
                  if (!window.confirm('Deactivate account ' + node.name + '?')) return;
                  try {
                    await saveAccount({ ...node, isActive: false, updatedAt: new Date().toISOString() });
                    toast('Account deactivated', 'success');
                    load();
                  } catch (e) {
                    toast(e.message || 'Delete failed', 'error');
                  }
                }}
              >
                <Trash2 size={12} />
              </button>
            </>
          ) : null}
        </div>
        {kids.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  const topLevel = roots[''] || roots[null] || [];

  const addLeaf = async () => {
    const name = newName.trim();
    if (!name) {
      toast('Account name required', 'warning');
      return;
    }
    const id = 'acc_user_' + Date.now().toString(36);
    const row = {
      id,
      code: (newCode || '').trim() || undefined,
      name,
      parentId: parentId || null,
      type: newType,
      accountType: 'user',
      isGroup: false,
      isSystem: false,
      isActive: true,
      companyId: 'default',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    try {
      await saveAccount(row);
      toast('Account added', 'success');
      setNewName('');
      setNewCode('');
      load();
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  const saveEdit = async () => {
    const acc = accounts.find((a) => a.id === editId);
    if (!acc) return;
    try {
      await saveAccount({ ...acc, name: editName.trim() || acc.name, updatedAt: new Date().toISOString() });
      setEditId(null);
      toast('Updated', 'success');
      load();
    } catch (e) {
      toast(e.message || 'Update failed', 'error');
    }
  };

  return (
    <div className="page-content">
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Chart of Accounts</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Server-backed CoA. System accounts are protected. GL engine maps use these codes when enabled.
        </p>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          {(topLevel.length ? topLevel : accounts.filter((a) => !a.parentId)).map((n) => renderNode(n, 0))}
          {!accounts.length ? (
            <p style={{ padding: 16, color: 'var(--text-muted)' }}>No accounts. Restart server after installing gl bridge to seed.</p>
          ) : null}
        </div>
      )}

      <div className="glass-panel" style={{ marginTop: 16, padding: 12 }}>
        <strong style={{ fontSize: 13 }}>Add leaf account</strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 8 }}>
          <input className="form-input" placeholder="Code (optional)" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
          <input className="form-input" placeholder="Name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <select className="form-input" value={newType} onChange={(e) => setNewType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select className="form-input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— No parent —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {(g.code ? g.code + ' ' : '') + g.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" onClick={addLeaf}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {editId ? (
        <div className="modal-overlay" style={{ zIndex: 50 }} onClick={() => setEditId(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: 360, padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Rename account</h3>
            <input className="form-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditId(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={saveEdit}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
