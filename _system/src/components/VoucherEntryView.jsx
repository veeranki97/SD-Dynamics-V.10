import { useState } from 'react';
import { toast } from './Toast';

/** Simple Journal / Contra entry — ΣDr must equal ΣCr */
export default function VoucherEntryView() {
  const [lines, setLines] = useState([
    { id: '1', account: '', debit: '', credit: '', narration: '' },
    { id: '2', account: '', debit: '', credit: '', narration: '' },
  ]);
  const [vtype, setVtype] = useState('journal');

  const dr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const cr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(dr - cr) < 0.02;

  const addLine = () => setLines((p) => [...p, { id: String(Date.now()), account: '', debit: '', credit: '', narration: '' }]);

  const save = async () => {
    if (!balanced) { toast('Debits must equal Credits', 'error'); return; }
    if (dr < 0.01) { toast('Enter amounts', 'warning'); return; }
    try {
      const body = {
        id: 'jnl_vch_' + Date.now().toString(36),
        type: vtype,
        date: new Date().toISOString().slice(0, 10),
        lines: lines.filter((l) => l.account || Number(l.debit) || Number(l.credit)),
        createdAt: new Date().toISOString(),
      };
      const res = await fetch('/api/journals?overwrite=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Save failed');
      toast('Voucher saved', 'success');
      setLines([
        { id: '1', account: '', debit: '', credit: '', narration: '' },
        { id: '2', account: '', debit: '', credit: '', narration: '' },
      ]);
    } catch (e) {
      toast(e.message || 'Failed', 'error');
    }
  };

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: '1.35rem' }}>Journal / Contra voucher</h1>
      <p className="text-muted" style={{ fontSize: 13 }}>Σ Debit must equal Σ Credit. FY close: use Books → Financial Books (dry-run retained earnings there).</p>
      <div style={{ marginBottom: 12 }}>
        <select className="form-input" style={{ maxWidth: 200 }} value={vtype} onChange={(e) => setVtype(e.target.value)}>
          <option value="journal">Journal</option>
          <option value="contra">Contra</option>
        </select>
      </div>
      <table className="data-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Account</th><th>Debit</th><th>Credit</th><th>Narration</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id}>
              <td><input className="form-input" value={l.account} onChange={(e) => setLines((p) => p.map((x, j) => j === i ? { ...x, account: e.target.value } : x))} /></td>
              <td><input className="form-input" type="number" value={l.debit} onChange={(e) => setLines((p) => p.map((x, j) => j === i ? { ...x, debit: e.target.value, credit: '' } : x))} /></td>
              <td><input className="form-input" type="number" value={l.credit} onChange={(e) => setLines((p) => p.map((x, j) => j === i ? { ...x, credit: e.target.value, debit: '' } : x))} /></td>
              <td><input className="form-input" value={l.narration} onChange={(e) => setLines((p) => p.map((x, j) => j === i ? { ...x, narration: e.target.value } : x))} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
        <button type="button" className="btn btn-secondary" onClick={addLine}>Add line</button>
        <span>Dr {dr.toFixed(2)} · Cr {cr.toFixed(2)} · {balanced ? '✓ Balanced' : '✗ Not balanced'}</span>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!balanced}>Save voucher</button>
      </div>
    </div>
  );
}
