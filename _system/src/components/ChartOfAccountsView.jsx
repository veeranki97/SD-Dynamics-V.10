import { useState, useEffect } from 'react';
import { getAllAccounts, saveAccount } from '../store';
import { toast } from './Toast';

export default function ChartOfAccountsView() {
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('Expense');
  const [parentId, setParentId] = useState('');

  const SEED_GROUPS = [
    { id: 'grp_assets', name: 'Assets', type: 'Assets', parentId: null, leaf: false },
    { id: 'grp_liab', name: 'Liabilities', type: 'Liabilities', parentId: null, leaf: false },
    { id: 'grp_equity', name: 'Equity', type: 'Equity', parentId: null, leaf: false },
    { id: 'grp_income', name: 'Income', type: 'Income', parentId: null, leaf: false },
    { id: 'grp_expense', name: 'Expense', type: 'Expense', parentId: null, leaf: false },
    { id: 'acc_bank', name: 'Bank', type: 'Assets', parentId: 'grp_assets', leaf: true },
    { id: 'acc_cash', name: 'Cash', type: 'Assets', parentId: 'grp_assets', leaf: true },
    { id: 'acc_ar', name: 'Accounts Receivable', type: 'Assets', parentId: 'grp_assets', leaf: true },
    { id: 'acc_ap', name: 'Accounts Payable', type: 'Liabilities', parentId: 'grp_liab', leaf: true },
    { id: 'acc_sales', name: 'Sales', type: 'Income', parentId: 'grp_income', leaf: true },
    { id: 'acc_cogs', name: 'Direct Costs', type: 'Expense', parentId: 'grp_expense', leaf: true },
  ];

  const load = async () => {
    try {
      let rows = await getAllAccounts();
      if (!rows || !rows.length) {
        for (const s of SEED_GROUPS) {
          try { await saveAccount(s); } catch { /* */ }
        }
        rows = await getAllAccounts();
      }
      setList(rows || []);
    } catch {
      toast('Failed to load accounts', 'error');
    }
  };
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
      <p className="page-subtitle">Post only to leaf accounts (child rows marked · leaf). Parent groups (Assets, Income, …) are for structure only — journal entries must use leaves like Bank, Sales, Direct Costs. Seed groups load automatically the first time you open this screen.</p>
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
