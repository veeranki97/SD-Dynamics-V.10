import { useState, useEffect } from 'react';
import { getAllAccounts, saveAccount } from '../store';
import { toast } from './Toast';

export default function ChartOfAccountsView() {
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('Expense');
  const [parentId, setParentId] = useState('');

  const load = () => getAllAccounts().then(setList).catch(() => toast('Failed to load accounts', 'error'));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim()) return toast('Name required', 'error');
    const id = 'acc_' + Date.now().toString(36);
    await saveAccount({ id, name: name.trim(), type, parentId: parentId || null, leaf: true });
    setName('');
    load();
    toast('Account added', 'success');
  };

  const roots = list.filter(a => !a.parentId);
  const children = (pid) => list.filter(a => a.parentId === pid);

  return (
    <div className="page">
      <h2>Chart of Accounts</h2>
      <p className="page-subtitle">Post only to leaf accounts. Seed groups load on first open.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="New account name" value={name} onChange={e => setName(e.target.value)} />
        <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
          {['Assets','Liabilities','Equity','Income','Expense'].map(x => <option key={x}>{x}</option>)}
        </select>
        <select className="form-input" value={parentId} onChange={e => setParentId(e.target.value)}>
          <option value="">Top level</option>
          {list.filter(a => !a.leaf).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button type="button" className="btn btn-primary" onClick={add}>Add</button>
      </div>
      <ul>
        {roots.map(r => (
          <li key={r.id} style={{ marginBottom: 8 }}>
            <strong>{r.name}</strong> ({r.type}){r.leaf ? ' · leaf' : ''}
            <ul>
              {children(r.id).map(c => (
                <li key={c.id}>{c.name}{c.leaf ? ' · leaf' : ''}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
