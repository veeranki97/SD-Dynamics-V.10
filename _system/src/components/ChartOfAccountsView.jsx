/**
 * Chart of Accounts — server-backed (accounts collection + coaSeed).
 * Add + Edit (name, code, type) for non-system accounts including groups.
 * System accounts: view only (no delete/edit of core flags).
 */
import { useState, useEffect, useMemo } from 'react';
import { Pencil, Trash2, Plus, FolderTree, Leaf } from 'lucide-react';
import { toast } from './Toast';
import { getAllAccounts, saveAccount } from '../store';
import { COA_SEED } from '../utils/coaSeed';

const TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];

function normType(t) {
  const s = String(t || '').toLowerCase();
  if (TYPES.includes(s)) return s;
  if (/asset/i.test(s)) return 'asset';
  if (/liab/i.test(s)) return 'liability';
  if (/equity|capital/i.test(s)) return 'equity';
  if (/income|revenue|sales/i.test(s)) return 'income';
  if (/expense|cost/i.test(s)) return 'expense';
  return 'expense';
}

export default function ChartOfAccountsView() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newType, setNewType] = useState('expense');
  const [parentId, setParentId] = useState('');
  const [newIsGroup, setNewIsGroup] = useState(false);

  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editType, setEditType] = useState('expense');
  const [editParentId, setEditParentId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      let list = await getAllAccounts();
      if (!Array.isArray(list)) list = [];
      if (!list.length && Array.isArray(COA_SEED) && COA_SEED.length) {
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
      setAccounts(Array.isArray(list) ? list.filter((a) => a && a.isActive !== false) : []);
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

  const groups = (accounts || []).filter((a) => a.isGroup || a.leaf === false);

  const openEdit = (node) => {
    setEditId(node.id);
    setEditName(node.name || '');
    setEditCode(node.code || '');
    setEditType(normType(node.type));
    setEditParentId(node.parentId || '');
  };

  const saveEdit = async () => {
    const acc = accounts.find((a) => a.id === editId);
    if (!acc) return;
    if (acc.isSystem) {
      toast('System accounts cannot be edited', 'warning');
      return;
    }
    const name = editName.trim();
    if (!name) {
      toast('Name required', 'warning');
      return;
    }
    setSaving(true);
    try {
      await saveAccount({
        ...acc,
        name,
        code: (editCode || '').trim() || acc.code,
        type: editType,
        parentId: editParentId || null,
        updatedAt: new Date().toISOString(),
      });
      setEditId(null);
      toast('Account updated', 'success');
      await load();
    } catch (e) {
      toast(e.message || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderNode = (node, depth) => {
    const kids = roots[node.id] || [];
    const isGroup = !!(node.isGroup || node.leaf === false);
    const canEdit = !node.isSystem;
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
          {isGroup ? <FolderTree size={14} /> : <Leaf size={14} />}
          <span style={{ fontFamily: 'ui-monospace, monospace', width: 56, color: 'var(--text-muted)' }}>
            {node.code || '—'}
          </span>
          <span style={{ flex: 1, fontWeight: isGroup ? 600 : 400 }}>{node.name}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{normType(node.type)}</span>
          {node.isSystem ? (
            <span style={{ fontSize: 10, padding: '2px 6px', background: '#e2e8f0', borderRadius: 4 }}>system</span>
          ) : null}
          {canEdit ? (
            <>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                title="Edit account"
                onClick={() => openEdit(node)}
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                title="Deactivate"
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

  const addAccount = async () => {
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
      isGroup: !!newIsGroup,
      leaf: !newIsGroup,
      isSystem: false,
      isActive: true,
      companyId: 'default',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    try {
      await saveAccount(row);
      toast(newIsGroup ? 'Group added' : 'Account added', 'success');
      setNewName('');
      setNewCode('');
      setNewIsGroup(false);
      load();
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  return (
    <div className="page-content">
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Chart of Accounts</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Server-backed CoA. System accounts are protected. Use Edit (pencil) to rename / change code or type.
        </p>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="glass-panel" style={{ padding: 0, overflow: 'auto', maxHeight: 'min(55vh, 480px)' }}>
          {(topLevel.length ? topLevel : accounts.filter((a) => !a.parentId)).map((n) => renderNode(n, 0))}
          {!accounts.length ? (
            <p style={{ padding: 16, color: 'var(--text-muted)' }}>No accounts. Restart server after installing GL bridge to seed.</p>
          ) : null}
        </div>
      )}

      <div className="glass-panel" style={{ marginTop: 16, padding: 12 }}>
        <strong style={{ fontSize: 13 }}>Add account</strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 8 }}>
          <input className="form-input" placeholder="Code (optional)" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
          <input className="form-input" placeholder="Name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <select className="form-input" value={newType} onChange={(e) => setNewType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={newIsGroup} onChange={(e) => setNewIsGroup(e.target.checked)} />
            Group (folder)
          </label>
          <button type="button" className="btn btn-primary" onClick={addAccount}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {editId ? (
        <div className="modal-overlay" style={{ zIndex: 50 }} onClick={() => !saving && setEditId(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: 400, padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Edit account</h3>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Code</label>
            <input className="form-input" style={{ marginBottom: 10 }} value={editCode} onChange={(e) => setEditCode(e.target.value)} placeholder="e.g. 5100" />
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Name *</label>
            <input className="form-input" style={{ marginBottom: 10 }} value={editName} onChange={(e) => setEditName(e.target.value)} />
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Type</label>
            <select className="form-input" style={{ marginBottom: 10 }} value={editType} onChange={(e) => setEditType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Parent</label>
            <select className="form-input" style={{ marginBottom: 14 }} value={editParentId} onChange={(e) => setEditParentId(e.target.value)}>
              <option value="">— No parent —</option>
              {groups.filter((g) => g.id !== editId).map((g) => (
                <option key={g.id} value={g.id}>
                  {(g.code ? g.code + ' ' : '') + g.name}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setEditId(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={saveEdit}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
