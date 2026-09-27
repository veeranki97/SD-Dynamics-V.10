import { useState } from 'react';
import { saveJournal, getNextInvoiceNumber } from '../store';
import { toast } from './Toast';

const TYPES = [
  { id: 'sales', label: 'Sales', def: [{ account: 'Sundry Debtors', debit: '', credit: '' }, { account: 'Sales', debit: '', credit: '' }] },
  { id: 'purchase', label: 'Purchase', def: [{ account: 'Direct Costs', debit: '', credit: '' }, { account: 'Sundry Creditors', debit: '', credit: '' }] },
  { id: 'payment', label: 'Payment', def: [{ account: 'Sundry Creditors', debit: '', credit: '' }, { account: 'Bank', debit: '', credit: '' }] },
  { id: 'receipt', label: 'Receipt', def: [{ account: 'Bank', debit: '', credit: '' }, { account: 'Sundry Debtors', debit: '', credit: '' }] },
  { id: 'journal', label: 'Journal', def: [{ account: '', debit: '', credit: '' }, { account: '', debit: '', credit: '' }] },
  { id: 'contra', label: 'Contra', def: [{ account: 'Cash', debit: '', credit: '' }, { account: 'Bank', debit: '', credit: '' }] },
];

export default function VoucherEntryView() {
  const [type, setType] = useState('receipt');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [party, setParty] = useState('');
  const [lines, setLines] = useState(TYPES.find(t => t.id === 'receipt').def);

  const pickType = (id) => {
    setType(id);
    setLines(TYPES.find(t => t.id === id).def.map(l => ({ ...l })));
  };

  const setLine = (i, field, val) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  };

  const addLine = () => setLines(prev => [...prev, { account: '', debit: '', credit: '' }]);

  const save = async () => {
    const entries = lines
      .filter(l => l.account && (Number(l.debit) || Number(l.credit)))
      .map(l => ({ account: l.account, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }));
    const dr = entries.reduce((s, e) => s + e.debit, 0);
    const cr = entries.reduce((s, e) => s + e.credit, 0);
    if (Math.abs(dr - cr) > 0.05) return toast(`Debit ${dr} ≠ Credit ${cr}`, 'error');
    if (!entries.length) return toast('Add at least one line', 'error');
    try {
      let ref = '';
      try { ref = await getNextInvoiceNumber(type === 'receipt' ? 'REC' : type === 'payment' ? 'PAY' : 'JV'); } catch { ref = type.toUpperCase() + '/' + Date.now(); }
      await saveJournal({
        id: 'jnl_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 9))),
        date, narration: narration || `${type} voucher`,
        refType: type, refId: ref, party: party || null,
        entries,
      });
      toast(`${type} voucher saved (${ref})`, 'success');
      setNarration('');
      setLines(TYPES.find(t => t.id === type).def.map(l => ({ ...l })));
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  return (
    <div className="page">
      <h2>Voucher Entry</h2>
      <p className="page-subtitle">Tally-style Sales / Purchase / Payment / Receipt / Journal / Contra — posts to ledger.</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {TYPES.map(t => (
          <button key={t.id} type="button" className={`btn btn-sm ${type === t.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => pickType(t.id)}>{t.label}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, maxWidth: 720, marginBottom: 12 }}>
        <div className="form-group"><label className="form-label">Date</label>
          <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Party / Client</label>
          <input className="form-input" value={party} onChange={e => setParty(e.target.value)} placeholder="Optional" /></div>
        <div className="form-group"><label className="form-label">Narration</label>
          <input className="form-input" value={narration} onChange={e => setNarration(e.target.value)} /></div>
      </div>
      <table className="data-table" style={{ width: '100%', maxWidth: 720 }}>
        <thead><tr><th>Account</th><th className="text-end">Debit</th><th className="text-end">Credit</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td><input className="form-input" value={l.account} onChange={e => setLine(i, 'account', e.target.value)} list="voucher-accts" /></td>
              <td><input className="form-input text-end" type="number" value={l.debit} onChange={e => setLine(i, 'debit', e.target.value)} /></td>
              <td><input className="form-input text-end" type="number" value={l.credit} onChange={e => setLine(i, 'credit', e.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <datalist id="voucher-accts">
        {['Bank','Cash','Sales','Sundry Debtors','Sundry Creditors','Direct Costs','Indirect Expenses','Output CGST','Output SGST','Output IGST','Input CGST','Input SGST','Input IGST','Capital','Retained Earnings'].map(a => <option key={a} value={a} />)}
      </datalist>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" className="btn btn-secondary" onClick={addLine}>+ Line</button>
        <button type="button" className="btn btn-primary" onClick={save}>Save Voucher</button>
      </div>
    </div>
  );
}
