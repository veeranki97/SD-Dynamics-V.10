import { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { getAllJournals, getProfile } from '../store';
import { formatCurrency } from '../utils';
import { activeGlJournals } from '../utils/glPosting';
import { toast } from './Toast';

/** Prefer human voucher (PUR/EXP/REC/SD) over internal ids. */
function humanGlRef(j) {
  const label = j.refLabel || j.refId || '';
  const narr = String(j.narration || '');
  const fromNarr = narr.match(/\b((?:PUR|EXP|REC|PAY|SD|INV|PO|WO|CN|DC)\/[\d-]+\/\d+)\b/i);
  if (label && !/^(pur_|exp_|pay_|rcpt_|jnl_|rcp_)/i.test(String(label))) return String(label);
  if (fromNarr) return fromNarr[1];
  return label || '';
}

function fileStem(party) {
  if (party) {
    return ('Statement-' + String(party).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()).slice(0, 48);
  }
  return 'General-Ledger';
}

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
      if (raw) setWoFilter(JSON.parse(raw));
    } catch { /* */ }
    getProfile().then((p) => setProfile(p || null)).catch(() => {});
    getAllJournals()
      .then((js) => {
        const flat = [];
        const activeRaw = activeGlJournals(js || []);
        const hasEngine = activeRaw.some((j) => j.glEngine === true);
        const active = hasEngine ? activeRaw.filter((j) => j.glEngine === true) : activeRaw;
        active.forEach((j) => {
          if (j.isReversed || j.IsReversed) return;
          (j.entries || []).forEach((e) => {
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
              refId: humanGlRef(j),
              party: j.party || j.clientName || e.partyId || '',
              site: j.site || e.site || '',
              workOrderId: j.workOrderId || e.workOrderId || '',
              woNumber: j.woNumber || j.workOrderNo || '',
            });
          });
        });
        setRows(flat);
      })
      .catch(() => toast('Failed to load journals', 'error'));
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (woFilter) {
        const wid = String(woFilter.workOrderId || '');
        const wno = String(woFilter.woNumber || '');
        const hit =
          (wid && (String(r.workOrderId || '') === wid || (r.narration || '').includes(wid))) ||
          (wno &&
            ((r.woNumber || '') === wno ||
              (r.narration || '').includes(wno) ||
              (r.refId || '').includes(wno)));
        if (!hit) return false;
      }
      if (account && !(r.account || '').toLowerCase().includes(account.toLowerCase())) return false;
      if (
        party &&
        !(r.party || '').toLowerCase().includes(party.toLowerCase()) &&
        !(r.narration || '').toLowerCase().includes(party.toLowerCase())
      )
        return false;
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

  const companyName = () =>
    profile?.businessName || profile?.name || 'SAI DURGA';

  /** Direct download PDF with forced filename (jsPDF) — no print dialog name issue. */
  const downloadPdf = () => {
    try {
      const stem = fileStem(party);
      const landscape = !party;
      const doc = new jsPDF({
        orientation: landscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;
      let y = margin;

      const company = companyName();
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(String(company).toUpperCase(), pageW / 2, y, { align: 'center' });
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const addr = [profile?.address, profile?.city, profile?.state, profile?.pincode]
        .filter(Boolean)
        .join(', ');
      if (addr) {
        doc.text(addr, pageW / 2, y, { align: 'center' });
        y += 5;
      }
      if (profile?.gstin) {
        doc.text('GSTIN: ' + profile.gstin, pageW / 2, y, { align: 'center' });
        y += 5;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(party ? 'STATEMENT OF ACCOUNT' : 'GENERAL LEDGER', pageW / 2, y, { align: 'center' });
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      if (party) {
        doc.text('Party: ' + party, margin, y);
        if (partyTotals) {
          const balTxt =
            'Closing: ₹' +
            Math.abs(partyTotals.bal).toLocaleString('en-IN', { minimumFractionDigits: 2 }) +
            (partyTotals.bal > 0 ? ' Due' : partyTotals.bal < 0 ? ' Credit' : ' Paid');
          doc.text(balTxt, pageW - margin, y, { align: 'right' });
        }
        y += 6;
      }
      doc.setDrawColor(30, 58, 95);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageW - margin, y);
      y += 5;

      const colX = party
        ? [margin, margin + 22, margin + 95, margin + 125, margin + 155]
        : [margin, margin + 18, margin + 55, margin + 95, margin + 145, margin + 185, margin + 220];
      const headers = party
        ? ['Date', 'Particulars', 'Debit', 'Credit', 'Balance']
        : ['Date', 'Account', 'Party', 'Narration', 'Ref', 'Debit', 'Credit'];

      const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        headers.forEach((h, i) => {
          const align = i >= headers.length - (party ? 3 : 2) ? 'right' : 'left';
          const x = align === 'right' ? (i === headers.length - 1 ? pageW - margin : colX[i] + 28) : colX[i];
          doc.text(h, x, y, { align });
        });
        y += 4;
        doc.setDrawColor(148, 163, 184);
        doc.line(margin, y, pageW - margin, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
      };
      drawHeader();

      const sorted = party
        ? [...filtered].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
        : filtered;
      let run = 0;
      const fmt = (n) =>
        Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const ensureSpace = () => {
        if (y > pageH - 18) {
          doc.addPage();
          y = margin;
          drawHeader();
        }
      };

      sorted.forEach((r) => {
        ensureSpace();
        const dr = Number(r.debit) || 0;
        const cr = Number(r.credit) || 0;
        if (party) {
          run += dr - cr;
          const narr = String(r.narration || r.account || '').slice(0, 48);
          doc.setFontSize(8);
          doc.text(String(r.date || ''), colX[0], y);
          doc.text(narr, colX[1], y);
          if (dr) doc.text(fmt(dr), pageW - margin - 55, y, { align: 'right' });
          if (cr) doc.text(fmt(cr), pageW - margin - 28, y, { align: 'right' });
          doc.text(fmt(Math.abs(run)), pageW - margin, y, { align: 'right' });
        } else {
          doc.setFontSize(7);
          doc.text(String(r.date || ''), colX[0], y);
          doc.text(String(r.account || '').slice(0, 22), colX[1], y);
          doc.text(String(r.party || '').slice(0, 18), colX[2], y);
          doc.text(String(r.narration || '').slice(0, 28), colX[3], y);
          doc.text(String(r.refId || '').slice(0, 16), colX[4], y);
          if (dr) doc.text(fmt(dr), pageW - margin - 35, y, { align: 'right' });
          if (cr) doc.text(fmt(cr), pageW - margin, y, { align: 'right' });
        }
        y += 5;
      });

      if (!party) {
        ensureSpace();
        y += 2;
        doc.setDrawColor(148, 163, 184);
        doc.line(margin, y, pageW - margin, y);
        y += 5;
        const sumDr = filtered.reduce((s, r) => s + (Number(r.debit) || 0), 0);
        const sumCr = filtered.reduce((s, r) => s + (Number(r.credit) || 0), 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('Totals', pageW - margin - 70, y, { align: 'right' });
        doc.text(fmt(sumDr), pageW - margin - 35, y, { align: 'right' });
        doc.text(fmt(sumCr), pageW - margin, y, { align: 'right' });
      }

      y = pageH - 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'Computer-generated from ' + company + ' · ' + new Date().toLocaleDateString('en-IN'),
        pageW / 2,
        y,
        { align: 'center' }
      );
      doc.setTextColor(0, 0, 0);

      const name = stem + '.pdf';
      doc.save(name);
      toast('Downloaded ' + name, 'success');
    } catch (e) {
      console.error(e);
      toast('PDF download failed: ' + (e.message || 'error'), 'error');
    }
  };

  const exportCsv = () => {
    const headers = ['Date', 'Account', 'Party', 'Narration', 'Ref', 'Debit', 'Credit'];
    const lines = filtered.map((r) =>
      [r.date, r.account, r.party || '', r.narration || '', r.refId || '', r.debit || 0, r.credit || 0]
        .map((x) => '"' + String(x).replace(/"/g, '""') + '"')
        .join(',')
    );
    const blob = new Blob([[headers.join(',')].concat(lines).join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileStem(party) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div
      className="page gl-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 52px)',
        minHeight: 320,
        maxHeight: 'calc(100vh - 52px)',
        paddingBottom: 4,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {woFilter && (
        <div
          style={{
            margin: '0 0 6px',
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-muted, #f8fafc)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.85rem',
            flexShrink: 0,
          }}
        >
          <span>
            Filtered by Work Order: <strong>{woFilter.woNumber || woFilter.workOrderId}</strong>
          </span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              setWoFilter(null);
              try {
                sessionStorage.removeItem('sd_ledger_wo_filter');
              } catch {}
            }}
          >
            Clear
          </button>
        </div>
      )}

      <div style={{ flexShrink: 0 }}>
        <h2 style={{ margin: '0 0 2px', fontSize: 18 }}>General Ledger</h2>
        <p className="page-subtitle" style={{ margin: '0 0 8px', fontSize: 12 }}>
          Filter by account or party · Download PDF uses a fixed file name (no blank Save-as)
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ maxWidth: 180 }}
            placeholder="Filter account"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          />
          <input
            className="form-input"
            style={{ maxWidth: 180 }}
            placeholder="Party / client ledger"
            value={party}
            onChange={(e) => setParty(e.target.value)}
          />
          <select className="form-input" style={{ maxWidth: 140 }} value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="all">All lines</option>
            <option value="party">Only party-tagged</option>
          </select>
          <input type="date" className="form-input" style={{ maxWidth: 130 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="date" className="form-input" style={{ maxWidth: 130 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsv}>
            Export CSV
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={downloadPdf}>
            {party ? 'Download Statement PDF' : 'Download PDF'}
          </button>
        </div>
        {partyTotals && (
          <div className="glass-panel" style={{ maxWidth: 520, fontSize: 13, padding: '8px 12px', marginBottom: 6 }}>
            Party <strong>{party}</strong> — Dr {formatCurrency(partyTotals.dr)} · Cr {formatCurrency(partyTotals.cr)} ·
            Closing <strong>{formatCurrency(Math.abs(partyTotals.bal))}</strong>{' '}
            ({partyTotals.bal > 0 ? 'Due' : partyTotals.bal < 0 ? 'Credit' : 'Paid'})
          </div>
        )}
      </div>

      <div
        className="table-responsive gl-ledger-scroll"
        style={{
          flex: '1 1 0',
          minHeight: 0,
          overflow: 'auto',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: 8,
          background: 'var(--bg-panel, #fff)',
        }}
      >
        <table className="data-table" style={{ width: '100%', margin: 0, borderCollapse: 'collapse' }}>
          <thead
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              background: 'var(--bg-muted, #f1f5f9)',
              boxShadow: '0 1px 0 var(--border, #e2e8f0)',
            }}
          >
            <tr>
              <th>Date</th>
              <th>Account</th>
              <th>Party</th>
              <th>Narration</th>
              <th>Ref</th>
              <th style={{ textAlign: 'right' }}>Debit</th>
              <th style={{ textAlign: 'right' }}>Credit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>
                  No journal lines
                </td>
              </tr>
            )}
            {filtered.map((r, i) => (
              <tr key={i}>
                <td style={{ whiteSpace: 'nowrap' }}>{r.date || '—'}</td>
                <td>{r.account || '—'}</td>
                <td>{r.party || '—'}</td>
                <td
                  title={r.narration || ''}
                  style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {r.narration || '—'}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{r.refId || '—'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{r.debit ? formatCurrency(r.debit) : ''}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{r.credit ? formatCurrency(r.credit) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ flexShrink: 0, fontSize: 11, color: '#94a3b8', marginTop: 4, lineHeight: 1.3 }}>
        {filtered.length} line{filtered.length === 1 ? '' : 's'}
        {party ? ' · party: ' + party : ''} · PDF downloads as {fileStem(party)}.pdf
      </div>
    </div>
  );
}
