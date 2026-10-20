import { useState, useEffect, useMemo } from 'react';
import { getAllJournals, getProfile } from '../store';
import { formatCurrency } from '../utils';
import { activeGlJournals } from '../utils/glPosting';
import { toast } from './Toast';

/** General Ledger + Party Statement of Account (letterhead PDF). */
export default function GeneralLedgerView() {
  const [rows, setRows] = useState([]);
  const [account, setAccount] = useState('');
  const [party, setParty] = useState('');
  const [mode, setMode] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [woFilter, setWoFilter] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('sd_ledger_wo_filter');
      if (raw) {
        setWoFilter(JSON.parse(raw));
        // keep until cleared by user
      }
    } catch { /* */ }
    getProfile().then(p => setProfile(p || null)).catch(() => {});
    getAllJournals().then(js => {
      const flat = [];
      // Active only — hide reversed originals and pure reverse batches from audit list
      const active = activeGlJournals(js || []);
      active.forEach(j => {
        if (j.isReversed || j.IsReversed) return;
        (j.entries || []).forEach(e => {
          const accLabel =
            e.account ||
            (e.accountCode && e.accountName
              ? e.accountCode + ' — ' + e.accountName
              : e.accountId || '');
          flat.push({
            date: j.date,
            narration: j.narration,
            account: accLabel,
            debit: e.debit,
            credit: e.credit,
            refId: j.refLabel || j.refId,
            refType: j.refType || j.sourceType,
            party: j.party || j.clientName || e.partyId || '',
            site: j.site || e.site || '',
            workOrderId: j.workOrderId || e.workOrderId || '',
            woNumber: j.woNumber || j.workOrderNo || '',
          });
        });
      });
      setRows(flat);
    }).catch(() => toast('Failed to load journals', 'error'));
  }, []);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (woFilter) {
        const wid = String(woFilter.workOrderId || '');
        const wno = String(woFilter.woNumber || '');
        const hit =
          (wid && (String(r.workOrderId || '') === wid || (r.narration || '').includes(wid))) ||
          (wno && ((r.woNumber || '') === wno || (r.narration || '').includes(wno) || (r.refId || '').includes(wno)));
        if (!hit) return false;
      }
      if (account && !(r.account || '').toLowerCase().includes(account.toLowerCase())) return false;
      if (party && !(r.party || '').toLowerCase().includes(party.toLowerCase())
        && !(r.narration || '').toLowerCase().includes(party.toLowerCase())) return false;
      if (mode === 'party' && !r.party) return false;
      if (dateFrom && r.date && r.date < dateFrom) return false;
      if (dateTo && r.date && r.date > dateTo) return false;
      return true;
    });
  }, [rows, account, party, mode, dateFrom, dateTo, woFilter]);

  const partyTotals = useMemo(() => {
    if (!party) return null;
    const dr = filtered.reduce((s, r) => s + (Number(r.debit) || 0), 0);
    const cr = filtered.reduce((s, r) => s + (Number(r.credit) || 0), 0);
    return { dr, cr, bal: dr - cr };
  }, [filtered, party]);

  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inr = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const exportPdf = () => {
    const w = window.open('', '_blank');
    if (!w) {
      toast('Pop-up blocked — allow pop-ups to export PDF', 'error');
      return;
    }
    const company = esc(profile?.businessName || profile?.name || 'SAI DURGA');
    const addr = esc([profile?.address, profile?.city, profile?.state, profile?.pincode].filter(Boolean).join(', '));
    const gstin = esc(profile?.gstin || '');
    const phone = esc(profile?.phone || profile?.mobile || '');
    const email = esc(profile?.email || '');

    if (party) {
      // Sort by date for running balance
      const sorted = [...filtered].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      let run = 0;
      const bodyRows = sorted.map(r => {
        const dr = Number(r.debit) || 0;
        const cr = Number(r.credit) || 0;
        run += dr - cr;
        const desc = esc(r.narration || r.account || '');
        const ref = esc(r.refId || '');
        const site = esc(r.site || '');
        const extra = [ref && `Ref: ${ref}`, site && `Site: ${site}`].filter(Boolean).join(' · ');
        return `<tr>
          <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap">${esc(r.date)}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${desc}${extra ? `<div style="color:#64748b;font-size:9px;margin-top:2px">${extra}</div>` : ''}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${dr ? '₹' + inr(dr) : '—'}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${cr ? '₹' + inr(cr) : '—'}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">₹${inr(Math.abs(run))} <span style="font-weight:500;color:#64748b">(${run >= 0 ? 'Due' : 'Credit'})</span></td>
        </tr>`;
      }).join('');
      const closing = partyTotals ? partyTotals.bal : run;
      const closeTxt = `₹${inr(Math.abs(closing))} (${closing > 0 ? 'Due' : closing < 0 ? 'Credit' : 'Paid'})`;
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Statement of Account — ${esc(party)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #0f172a; font-size: 11px; margin: 0; }
  .hdr { text-align: center; border-bottom: 2.5px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 14px; }
  .hdr h1 { margin: 0; font-size: 22px; letter-spacing: 0.12em; color: #1e3a5f; font-weight: 700; }
  .hdr .sub { margin: 5px 0 0; font-size: 10px; color: #64748b; line-height: 1.4; }
  .hdr .title { margin-top: 10px; font-size: 13px; font-weight: 700; letter-spacing: 0.14em; color: #334155; }
  .meta { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; gap: 16px; }
  .meta .party { font-size: 12px; }
  .meta .party b { font-size: 14px; }
  .close-bal { text-align: right; min-width: 160px; }
  .close-bal .lbl { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
  .close-bal .amt { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #f1f5f9; text-align: left; padding: 8px; border-bottom: 2px solid #94a3b8; font-size: 9px; text-transform: uppercase; color: #475569; letter-spacing: 0.04em; }
  thead th.r { text-align: right; }
  .foot { margin-top: 20px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
</style></head><body>
  <div class="hdr">
    <h1>${company.toUpperCase()}</h1>
    <div class="sub">${addr}${gstin ? (addr ? ' · ' : '') + 'GSTIN: ' + gstin : ''}${(phone || email) ? '<br/>' + [phone, email].filter(Boolean).join(' · ') : ''}</div>
    <div class="title">STATEMENT OF ACCOUNT</div>
  </div>
  <div class="meta">
    <div class="party">Party: <b>${esc(party)}</b><br/>
      <span style="color:#64748b;font-size:10px">Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
    </div>
    <div class="close-bal"><div class="lbl">Closing Balance</div><div class="amt">${closeTxt}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:11%">Date</th>
        <th>Description</th>
        <th class="r" style="width:14%">Debit (₹)</th>
        <th class="r" style="width:14%">Credit (₹)</th>
        <th class="r" style="width:18%">Balance (₹)</th>
      </tr>
    </thead>
    <tbody>${bodyRows || '<tr><td colspan="5" style="padding:16px;text-align:center;color:#94a3b8">No entries for this party</td></tr>'}</tbody>
  </table>
  <div class="foot">This is a computer-generated document from ${company}. No signature is required.</div>
  <script>setTimeout(function(){ window.print(); }, 250);</script>
</body></html>`);
    } else {
      const sumDr = filtered.reduce((s, r) => s + (Number(r.debit) || 0), 0);
      const sumCr = filtered.reduce((s, r) => s + (Number(r.credit) || 0), 0);
      const bodyRows = filtered.map(r => `<tr>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap">${esc(r.date)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${esc(r.account)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${esc(r.party)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${esc(r.narration)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${esc(r.refId)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${r.debit ? '₹' + inr(Number(r.debit)) : '—'}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${r.credit ? '₹' + inr(Number(r.credit)) : '—'}</td>
      </tr>`).join('');
      const genDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>General-Ledger</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #0f172a; font-size: 11px; margin: 0; }
  .hdr { text-align: center; border-bottom: 2.5px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 14px; }
  .hdr h1 { margin: 0; font-size: 18px; color: #1e3a5f; letter-spacing: 0.04em; }
  .hdr .sub { margin: 5px 0 0; font-size: 10px; color: #64748b; line-height: 1.4; }
  .hdr .title { margin-top: 10px; font-size: 13px; font-weight: 700; letter-spacing: 0.14em; color: #334155; }
  .meta { margin-bottom: 12px; font-size: 10px; color: #64748b; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #f1f5f9; text-align: left; padding: 8px; border-bottom: 2px solid #94a3b8; font-size: 9px; text-transform: uppercase; color: #475569; letter-spacing: 0.04em; }
  thead th.r { text-align: right; }
  tfoot td { font-weight: 700; padding: 8px; border-top: 2px solid #94a3b8; background: #f8fafc; }
  .foot { margin-top: 20px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
</style></head><body>
  <div class="hdr">
    <h1>${company.toUpperCase()}</h1>
    <div class="sub">${addr}${gstin ? (addr ? ' · ' : '') + 'GSTIN: ' + gstin : ''}${(phone || email) ? '<br/>' + [phone, email].filter(Boolean).join(' · ') : ''}</div>
    <div class="title">GENERAL LEDGER</div>
  </div>
  <div class="meta">Generated on: ${genDate}</div>
  <table>
    <thead>
      <tr>
        <th style="width:11%">Date</th>
        <th>Account</th>
        <th>Party</th>
        <th>Narration</th>
        <th>Ref</th>
        <th class="r" style="width:12%">Debit (₹)</th>
        <th class="r" style="width:12%">Credit (₹)</th>
      </tr>
    </thead>
    <tbody>${bodyRows || '<tr><td colspan="7" style="padding:16px;text-align:center;color:#94a3b8">No entries</td></tr>'}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align:right">Totals</td>
        <td style="text-align:right">₹${inr(sumDr)}</td>
        <td style="text-align:right">₹${inr(sumCr)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="foot">This is a computer-generated document from ${company}. No signature is required.</div>
  <script>
    try { document.title = 'General-Ledger'; } catch(e) {}
    setTimeout(function(){ window.print(); }, 250);
  </script>
</body></html>`);
    }
    try { toast('In the print dialog: turn Headers and footers OFF', 'info'); } catch (_) {}
    w.document.close();
  };

  return (
    <div className="page">
      {woFilter && (
        <div style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-muted, #f8fafc)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
          <span>Filtered by Work Order: <strong>{woFilter.woNumber || woFilter.workOrderId}</strong></span>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setWoFilter(null); try { sessionStorage.removeItem('sd_ledger_wo_filter'); } catch {} }}>Clear</button>
        </div>
      )}
      <h2>General Ledger</h2>
      <p className="page-subtitle">
        Account ledger · Party / client ledger — filter by party name, then Export PDF for Statement of Account on letterhead
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <input className="form-input" style={{ maxWidth: 220 }}
          placeholder="Filter account" value={account} onChange={e => setAccount(e.target.value)} />
        <input className="form-input" style={{ maxWidth: 220 }}
          placeholder="Party / client ledger" value={party} onChange={e => setParty(e.target.value)} />
        <select className="form-input" style={{ maxWidth: 160 }} value={mode} onChange={e => setMode(e.target.value)}>
          <option value="all">All lines</option>
          <option value="party">Only party-tagged</option>
        </select>
        <input type="date" className="form-input" style={{ maxWidth: 150 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From" />
        <input type="date" className="form-input" style={{ maxWidth: 150 }} value={dateTo} onChange={e => setDateTo(e.target.value)} title="To" />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
          const headers = ['Date', 'Account', 'Party', 'Narration', 'Ref', 'Debit', 'Credit'];
          const lines = filtered.map(r => [r.date, r.account, r.party || '', r.narration || '', r.refId || '', r.debit || 0, r.credit || 0]
            .map(x => `"${String(x).replace(/"/g, '""')}"`).join(','));
          const blob = new Blob([[headers.join(',')].concat(lines).join('\n')], { type: 'text/csv' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'general-ledger.csv'; a.click();
        }}>Export CSV</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={exportPdf}>
          {party ? 'Export Statement PDF' : 'Export PDF'}
        </button>
      </div>
      {partyTotals && (
        <div className="glass-panel p-3 mb-3" style={{ maxWidth: 520, fontSize: 13 }}>
          Party <strong>{party}</strong> — Dr {formatCurrency(partyTotals.dr)} · Cr {formatCurrency(partyTotals.cr)} ·
          Closing <strong>{formatCurrency(Math.abs(partyTotals.bal))}</strong> ({partyTotals.bal > 0 ? 'Due' : partyTotals.bal < 0 ? 'Credit' : 'Paid'})
        </div>
      )}
      <div className="table-responsive">
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Date</th><th>Account</th><th>Party</th><th>Narration</th><th>Ref</th>
              <th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8' }}>No journal lines</td></tr>
            )}
            {filtered.map((r, i) => (
              <tr key={i}>
                <td>{r.date || '—'}</td>
                <td>{r.account || '—'}</td>
                <td>{r.party || '—'}</td>
                <td>{r.narration || '—'}</td>
                <td>{r.refId || '—'}</td>
                <td style={{ textAlign: 'right' }}>{r.debit ? formatCurrency(r.debit) : ''}</td>
                <td style={{ textAlign: 'right' }}>{r.credit ? formatCurrency(r.credit) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
