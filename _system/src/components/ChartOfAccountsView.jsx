import { useState, useEffect } from 'react';
import { Pencil, Trash2, Plus, FolderTree, Leaf } from 'lucide-react';
import { toast } from './Toast';

const STORAGE_KEY = 'sd_chart_of_accounts';

const DEFAULT_TREE = [
  { id: 'assets', name: 'Assets', group: true, children: [
    { id: 'bank', name: 'Bank', leaf: true },
    { id: 'cash', name: 'Cash', leaf: true },
    { id: 'sundry-debtors', name: 'Sundry Debtors', leaf: true },
  ]},
  { id: 'liabilities', name: 'Liabilities', group: true, children: [
    { id: 'sundry-creditors', name: 'Sundry Creditors', leaf: true },
    { id: 'advance-customers', name: 'Advance from Customers', leaf: true },
    { id: 'output-cgst', name: 'Output CGST', leaf: true },
    { id: 'output-sgst', name: 'Output SGST', leaf: true },
    { id: 'output-igst', name: 'Output IGST', leaf: true },
  ]},
  { id: 'income', name: 'Income', group: true, children: [
    { id: 'sales', name: 'Sales', leaf: true },
  ]},
  { id: 'expense', name: 'Expenses', group: true, children: [
    { id: 'direct-expense', name: 'Direct Expenses', leaf: true },
    { id: 'indirect-expense', name: 'Indirect Expenses', leaf: true },
  ]},
];

function loadTree() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch { /* */ }
  return DEFAULT_TREE.map(g => ({ ...g, children: [...(g.children || [])] }));
}

function saveTree(tree) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tree)); } catch { /* */ }
}

export default function ChartOfAccountsView() {
  const [tree, setTree] = useState(loadTree);
  const [newName, setNewName] = useState('');
  const [parentId, setParentId] = useState('expense');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => { saveTree(tree); }, [tree]);

  const groups = tree.filter(n => n.group);

  const addLeaf = () => {
    const name = newName.trim();
    if (!name) { toast('Account name required', 'warning'); return; }
    const id = `acc_${Date.now().toString(36)}`;
    setTree(prev => prev.map(g => {
      if (g.id !== parentId) return g;
      const kids = [...(g.children || [])];
      if (kids.some(c => (c.name || '').toLowerCase() === name.toLowerCase())) {
        toast(`"${name}" already exists under ${g.name}`, 'error');
        return g;
      }
      kids.push({ id, name, leaf: true });
      return { ...g, children: kids };
    }));
    setNewName('');
    toast('Leaf account added', 'success');
  };

  const startEdit = (leaf) => {
    setEditId(leaf.id);
    setEditName(leaf.name);
  };

  const saveEdit = () => {
    const name = editName.trim();
    if (!name) { toast('Name required', 'warning'); return; }
    setTree(prev => prev.map(g => ({
      ...g,
      children: (g.children || []).map(c => c.id === editId ? { ...c, name } : c),
    })));
    setEditId(null);
    setEditName('');
    toast('Account renamed', 'success');
  };

  const removeLeaf = (leafId) => {
    setTree(prev => prev.map(g => ({
      ...g,
      children: (g.children || []).filter(c => c.id !== leafId),
    })));
    toast('Leaf account removed', 'success');
  };

  const card = {
    background: 'var(--card-bg, #fff)',
    border: '1px solid var(--border, #e2e8f0)',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
  };

  return (
    <div className="page" style={{ maxWidth: 880, paddingBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
        }}>
          <FolderTree size={20} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>Chart of Accounts</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
            Post only to <strong>leaf</strong> accounts. Groups are structure only.
          </p>
        </div>
      </div>

      {/* Add row — same surface as list */}
      <div style={{
        ...card,
        padding: '14px 16px',
        marginBottom: 16,
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr auto',
        gap: 12,
        alignItems: 'end',
      }}>
        <div>
          <label className="form-label" style={{ fontSize: 11, letterSpacing: 0.04, textTransform: 'uppercase', color: 'var(--text-muted, #64748b)' }}>
            New leaf account
          </label>
          <input
            className="form-input"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Account name"
            onKeyDown={e => e.key === 'Enter' && addLeaf()}
            style={{ background: 'var(--input-bg, #f8fafc)' }}
          />
        </div>
        <div>
          <label className="form-label" style={{ fontSize: 11, letterSpacing: 0.04, textTransform: 'uppercase', color: 'var(--text-muted, #64748b)' }}>
            Under group
          </label>
          <select
            className="form-input"
            value={parentId}
            onChange={e => setParentId(e.target.value)}
            style={{ background: 'var(--input-bg, #f8fafc)' }}
          >
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={addLeaf}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px' }}
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Tree */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tree.map(g => (
          <div key={g.id} style={{ ...card, overflow: 'hidden' }}>
            <div style={{
              padding: '10px 14px',
              background: 'var(--surface-2, #f1f5f9)',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: 0.02,
              color: 'var(--text-primary, #0f172a)',
            }}>
              {g.name}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {(g.children || []).map((c, i) => (
                <li
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderBottom: i < (g.children.length - 1) ? '1px solid var(--border, #e2e8f0)' : 'none',
                    background: 'var(--card-bg, #fff)',
                    fontSize: 13,
                  }}
                >
                  {editId === c.id ? (
                    <>
                      <input
                        className="form-input"
                        style={{ flex: 1, maxWidth: 320 }}
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveEdit()}
                      />
                      <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <Leaf size={14} style={{ color: 'var(--primary, #2563eb)', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontWeight: 500 }}>{c.name}</span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: 0.06,
                        color: 'var(--text-muted, #94a3b8)',
                        background: 'var(--surface-2, #f1f5f9)',
                        padding: '2px 8px',
                        borderRadius: 999,
                      }}>leaf</span>
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => startEdit(c)}
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          border: '1px solid var(--border, #e2e8f0)',
                          background: 'var(--card-bg, #fff)',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: 'var(--text-muted, #64748b)',
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => removeLeaf(c.id)}
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          border: '1px solid #fecaca',
                          background: '#fff',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: '#dc2626',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </li>
              ))}
              {!(g.children || []).length && (
                <li style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>No leaf accounts yet</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
