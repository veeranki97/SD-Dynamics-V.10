import { useState, useEffect } from 'react';
import { toast } from './Toast';

const STORAGE_KEY = 'sd_chart_of_accounts';

const DEFAULT_COA = [
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

function loadCoa() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (_) {}
  return JSON.parse(JSON.stringify(DEFAULT_COA));
}

function saveCoa(tree) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
}

export default function ChartOfAccountsView() {
  const [tree, setTree] = useState(() => loadCoa());
  const [newName, setNewName] = useState('');
  const [parentId, setParentId] = useState('expense');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    // Seed defaults once
    if (!localStorage.getItem(STORAGE_KEY)) saveCoa(tree);
  }, []);

  const groups = tree.filter(n => n.group);

  const addLeaf = () => {
    const name = newName.trim();
    if (!name) { toast('Enter account name', 'error'); return; }
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
    const next = tree.map(g => {
      if (g.id !== parentId) return g;
      const kids = [...(g.children || []), { id, name, leaf: true }];
      return { ...g, children: kids };
    });
    setTree(next);
    saveCoa(next);
    setNewName('');
    toast('Account added', 'success');
  };

  const startEdit = (leaf) => {
    setEditId(leaf.id);
    setEditName(leaf.name);
  };

  const saveEdit = () => {
    if (!editId) return;
    const name = editName.trim();
    if (!name) { toast('Name required', 'error'); return; }
    const next = tree.map(g => ({
      ...g,
      children: (g.children || []).map(c => c.id === editId ? { ...c, name } : c),
    }));
    setTree(next);
    saveCoa(next);
    setEditId(null);
    setEditName('');
    toast('Account renamed', 'success');
  };

  const removeLeaf = (leafId) => {
    if (!confirm('Remove this account from the chart? (Historical journals are not deleted.)')) return;
    const next = tree.map(g => ({
      ...g,
      children: (g.children || []).filter(c => c.id !== leafId),
    }));
    setTree(next);
    saveCoa(next);
    toast('Account removed', 'success');
  };

  return (
    <div className="page">
      <h2>Chart of Accounts</h2>
      <p className="page-subtitle">
        Post only to <strong>leaf</strong> accounts. Groups are for structure only. You can rename or remove leaf accounts anytime.
      </p>
      <div className="glass-panel p-3 mb-3" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', maxWidth: 720 }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label className="form-label">New leaf account</label>
          <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Account name" />
        </div>
        <div style={{ minWidth: 160 }}>
          <label className="form-label">Under group</label>
          <select className="form-input" value={parentId} onChange={e => setParentId(e.target.value)}>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={addLeaf}>Add</button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {tree.map(g => (
          <li key={g.id} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>{g.name}</div>
            <ul style={{ listStyle: 'none', paddingLeft: 12, margin: 0 }}>
              {(g.children || []).map(c => (
                <li key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                  borderBottom: '1px solid var(--border, #e2e8f0)', fontSize: 13,
                }}>
                  {editId === c.id ? (
                    <>
                      <input className="form-input" style={{ maxWidth: 280 }} value={editName} onChange={e => setEditName(e.target.value)} />
                      <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1 }}>{c.name}{c.leaf ? ' · leaf' : ''}</span>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(c)}>Edit</button>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removeLeaf(c.id)}>Delete</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
