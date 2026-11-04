import { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { getAllJournals, getProfile, getAllClients } from '../store';
import { formatCurrency } from '../utils';
import { activeGlJournals } from '../utils/glPosting';
import { toast } from './Toast';
import { sendMailSmart, loadEmailTemplates, resolveEmailTemplate, promptForEmail } from '../utils/openMail';

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

  // Suggestions are sourced from names present in the loaded ledger, not the Clients master.
  const ledgerPartyOptions = useMemo(() => {
    const names = rows.map((row) => String(row.party || '').trim()).filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [rows]);

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
  const buildLedgerPdf = () => {
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
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      // Address on its own line(s) so GSTIN never overlaps the street block
      const addr = [profile?.address, profile?.city, profile?.state, profile?.pincode]
        .filter(Boolean)
        .join(', ');
      if (addr) {
        const addrLines = doc.splitTextToSize(addr, pageW - margin * 2);
        addrLines.slice(0, 3).forEach((line) => {
          doc.text(line, pageW / 2, y, { align: 'center' });
          y += 4;
        });
      }
      if (profile?.gstin) {
        y += 1;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('GSTIN: ' + String(profile.gstin), pageW / 2, y, { align: 'center' });
        y += 5;
        doc.setFont('helvetica', 'normal');
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

      // Landscape GL: give Narration more width; Debit/Credit stay right-aligned
      const colX = party
        ? [margin, margin + 22, margin + 100, margin + 132, margin + 162]
        : [margin, margin + 16, margin + 52, margin + 88, margin + 168, margin + 210, margin + 248];
      const narrMaxW = party ? 72 : 76; // mm available for narration before Ref
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

      // Page + grand totals: earlier builds only printed Totals on the last page
      // because ensureSpace never closed the previous page with running totals.
      let pageDr = 0;
      let pageCr = 0;
      const footerReserve = 22;

      const drawPageTotals = () => {
        y += 1;
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageW - margin, y);
        y += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        if (party) {
          doc.text('Page subtotal', pageW - margin - 70, y, { align: 'right' });
          doc.text(fmt(pageDr), pageW - margin - 55, y, { align: 'right' });
          doc.text(fmt(pageCr), pageW - margin - 28, y, { align: 'right' });
          y += 4;
          doc.setFontSize(7);
          doc.text('Balance carried forward: ' + fmt(Math.abs(run)) + (run > 0 ? ' Dr' : run < 0 ? ' Cr' : ''), pageW - margin, y, { align: 'right' });
        } else {
          doc.text('Page totals', pageW - margin - 70, y, { align: 'right' });
          doc.text(fmt(pageDr), pageW - margin - 35, y, { align: 'right' });
          doc.text(fmt(pageCr), pageW - margin, y, { align: 'right' });
        }
        pageDr = 0;
        pageCr = 0;
      };

      const ensureSpace = () => {
        if (y > pageH - footerReserve) {
          drawPageTotals();
          doc.addPage();
          y = margin;
          drawHeader();
        }
      };

      sorted.forEach((r) => {
        const dr = Number(r.debit) || 0;
        const cr = Number(r.credit) || 0;
        if (party) {
          // Determine wrapped row height first so the row and subtotal never split across pages.
          const narrFull = String(r.narration || r.account || '');
          const narrLines = doc.splitTextToSize(narrFull, narrMaxW).slice(0, 2);
          const rowH = Math.max(5, narrLines.length * 3.6);
          if (y + rowH + 10 > pageH - footerReserve) {
            drawPageTotals();
            doc.addPage();
            y = margin;
            drawHeader();
          }
          pageDr += dr;
          pageCr += cr;
          run += dr - cr;
          doc.setFontSize(8);
          doc.text(String(r.date || ''), colX[0], y);
          narrLines.forEach((ln, i) => doc.text(ln, colX[1], y + i * 3.6));
          if (dr) doc.text(fmt(dr), pageW - margin - 55, y, { align: 'right' });
          if (cr) doc.text(fmt(cr), pageW - margin - 28, y, { align: 'right' });
          doc.text(fmt(Math.abs(run)), pageW - margin, y, { align: 'right' });
          y += rowH;
        } else {
          const narrFull = String(r.narration || '');
          doc.setFontSize(7);
          const narrLines = doc.splitTextToSize(narrFull || '—', narrMaxW).slice(0, 3);
          const rowH = Math.max(5, narrLines.length * 3.4 + 0.5);
          // Need room for wrapped narration before page break
          if (y + rowH > pageH - footerReserve) {
            drawPageTotals();
            doc.addPage();
            y = margin;
            drawHeader();
          }
          pageDr += dr;
          pageCr += cr;
          doc.text(String(r.date || ''), colX[0], y);
          doc.text(String(r.account || '').slice(0, 24), colX[1], y);
          doc.text(String(r.party || '').slice(0, 20), colX[2], y);
          narrLines.forEach((ln, i) => doc.text(ln, colX[3], y + i * 3.4));
          doc.text(String(r.refId || '').slice(0, 18), colX[4], y);
          if (dr) doc.text(fmt(dr), pageW - margin - 38, y, { align: 'right' });
          if (cr) doc.text(fmt(cr), pageW - margin, y, { align: 'right' });
          y += rowH;
        }
      });

      // Close the final statement page with page subtotal and carried/closing balance.
      if (party) {
        if (y + 12 > pageH - footerReserve) {
          doc.addPage();
          y = margin;
          drawHeader();
        }
        drawPageTotals();
        y += 2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(
          'Closing balance: ' + fmt(Math.abs(run)) + (run > 0 ? ' Dr' : run < 0 ? ' Cr' : ' Nil'),
          pageW - margin,
          y,
          { align: 'right' },
        );
      }

      // Final page: page totals + grand totals. Start a fresh page if the summary band
      // would collide with the footer or with the final page's remaining rows.
      if (!party) {
        const grandTotalsReserve = 18;
        if (y + grandTotalsReserve > pageH - footerReserve) {
          if (pageDr || pageCr) drawPageTotals();
          doc.addPage();
          y = margin;
          drawHeader();
        } else if (pageDr || pageCr) {
          drawPageTotals();
        }
        y += 2;
        doc.setDrawColor(30, 58, 95);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageW - margin, y);
        y += 5;
        const sumDr = filtered.reduce((s, r) => s + (Number(r.debit) || 0), 0);
        const sumCr = filtered.reduce((s, r) => s + (Number(r.credit) || 0), 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('Grand totals', pageW - margin - 70, y, { align: 'right' });
        doc.text(fmt(sumDr), pageW - margin - 35, y, { align: 'right' });
        doc.text(fmt(sumCr), pageW - margin, y, { align: 'right' });
      }

      // Footer on every page (page number + brand line)
      const pageCount = doc.internal.getNumberOfPages();
      const genLine =
        'Computer-generated from ' +
        company +
        ' · ' +
        new Date().toLocaleDateString('en-IN');
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(genLine, pageW / 2, pageH - 8, { align: 'center' });
        doc.text('Page ' + p + ' of ' + pageCount, pageW - margin, pageH - 8, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      }

      const name = stem + '.pdf';
      return { doc, name, stem };
    } catch (e) {
      console.error(e);
      toast('PDF download failed: ' + (e.message || 'error'), 'error');
      return null;
    }
  };

  const downloadPdf = () => {
    const built = buildLedgerPdf();
    if (!built) return;
    built.doc.save(built.name);
    toast('Downloaded ' + built.name, 'success');
  };

  const emailStatement = async () => {
    if (!party || !String(party).trim()) {
      toast('Enter a party / client name in the filter first', 'warning');
      return;
    }
    let to = '';
    try {
      const list = await getAllClients().catch(() => []);
      const p = String(party).trim().toLowerCase();
      const match = (list || []).find((c) => {
        const n = String(c.name || '').trim().toLowerCase();
        const b = String(c.businessName || '').trim().toLowerCase();
        return n === p || b === p || n.includes(p) || b.includes(p);
      });
      to = String(match?.email || match?.Email || match?.mail || '').trim();
    } catch { /* */ }
    if (!to || !to.includes('@')) {
      to = String((await promptForEmail(to || '')) || '').trim();
    }
    if (!to || !to.includes('@')) {
      toast('No email for this party — add on Clients or enter when prompted', 'warning');
      return;
    }
    toast('Building statement PDF…', 'info', 2000);
    const built = buildLedgerPdf();
    if (!built) return;
    const dataUri = built.doc.output('datauristring');
    const b64 = dataUri.includes('base64,') ? dataUri.split('base64,')[1] : dataUri;
    let companyName = profile?.businessName || profile?.name || '';
    try {
      if (!companyName) {
        const pr = await getProfile();
        companyName = pr?.businessName || pr?.name || '';
      }
    } catch { /* */ }
    const templates = await loadEmailTemplates();
    const vars = {
      clientName: party,
      companyName: companyName || 'Company',
      invoiceNumber: '',
      amount: partyTotals ? String(partyTotals.bal) : '',
      dueDate: '',
      woNumber: '',
      poNumber: '',
    };
    const resolved = resolveEmailTemplate(templates, 'statement', vars, {
      subject: 'Account Statement – ' + party + ' | ' + (companyName || 'Company'),
      body: 'Dear ' + party + ',\n\nPlease find attached your account statement.\n\nBest regards,\n' + (companyName || ''),
    });
    // fix body newlines
    const body = resolved.body.replace(/\\n/g, '\n');
    toast('Sending statement…', 'info', 2000);
    const result = await sendMailSmart({
      to,
      subject: resolved.subject,
      body,
      attachments: [{ filename: built.name, content: b64, contentType: 'application/pdf' }],
      allowGmailFallback: true,
      businessName: companyName,
    });
    if ((result.via === 'smtp' || result.method === 'smtp') && result.ok) {
      toast('Statement emailed to ' + to, 'success');
    } else {
      toast((result.smtpError || result.error || 'SMTP not available') + '. Configure SMTP in Settings → Mail for PDF attachments.', 'warning', 9000);
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

  const viewDebit = filtered.reduce((sum, row) => sum + (Number(row.debit) || 0), 0);
  const viewCredit = filtered.reduce((sum, row) => sum + (Number(row.credit) || 0), 0);
  const viewNet = viewDebit - viewCredit;
  const controlStyle = {
    minWidth: 0,
    height: 34,
    padding: '0 11px',
    border: '1px solid var(--border, #dbe2ea)',
    borderRadius: 9,
    background: 'var(--bg-panel, #fff)',
    color: 'var(--text-primary, inherit)',
    fontSize: 13,
    boxSizing: 'border-box',
  };
  const panelStyle = {
    border: '1px solid var(--border, #e2e8f0)',
    borderRadius: 13,
    background: 'var(--bg-panel, #fff)',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.035)',
  };

  return (
    <div
      className="page gl-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 44px)',
        minHeight: 320,
        maxHeight: 'calc(100vh - 44px)',
        padding: '2px 2px 4px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        gap: 7,
      }}
    >
      {woFilter && (
        <div
          style={{
            ...panelStyle,
            flexShrink: 0,
            padding: '9px 13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 7,
            fontSize: 13,
            background: 'var(--bg-muted, #f8fafc)',
          }}
        >
          <span>
            <span style={{ color: 'var(--text-secondary, #64748b)' }}>Work Order filter</span>
            {' · '}
            <strong>{woFilter.woNumber || woFilter.workOrderId}</strong>
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
            Clear filter
          </button>
        </div>
      )}

      <header
        style={{
          ...panelStyle,
          flexShrink: 0,
          padding: '9px 13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              background: 'linear-gradient(145deg, #2563eb, #173a85)',
              boxShadow: '0 5px 12px rgba(37, 99, 235, .2)',
              fontSize: 17,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            GL
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: '0 0 3px', fontSize: 18, lineHeight: 1.2 }}>General Ledger</h2>
            <p className="page-subtitle" style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary, #64748b)' }}>
              Review journal postings, account activity, and party balances.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsv}>Export CSV</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={downloadPdf}>
            {party ? 'Download Statement PDF' : 'Download Ledger PDF'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={emailStatement}
            title="Email party statement PDF (set party filter; SMTP required for attachment)"
          >
            Email Statement
          </button>
        </div>
      </header>

      <section
        aria-label="Ledger summary"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
          gap: 7,
          flexShrink: 0,
        }}
      >
        {[
          { label: 'Filtered entries', value: filtered.length.toLocaleString('en-IN'), note: 'Journal lines in view' },
          { label: 'Total debit', value: formatCurrency(viewDebit), note: 'Debit movement' },
          { label: 'Total credit', value: formatCurrency(viewCredit), note: 'Credit movement' },
          {
            label: 'Net movement',
            value: formatCurrency(Math.abs(viewNet)),
            note: viewNet > 0 ? 'Debit balance movement' : viewNet < 0 ? 'Credit balance movement' : 'Debits and credits match',
          },
        ].map((item) => (
          <div key={item.label} style={{ ...panelStyle, padding: '8px 12px', minWidth: 0 }}>
            <div style={{ color: 'var(--text-secondary, #64748b)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>
              {item.label}
            </div>
            <div style={{ marginTop: 3, fontSize: 16, lineHeight: 1.3, fontWeight: 750, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>
              {item.value}
            </div>
            <div style={{ marginTop: 3, color: 'var(--text-secondary, #94a3b8)', fontSize: 11 }}>{item.note}</div>
          </div>
        ))}
      </section>

      <section style={{ ...panelStyle, flexShrink: 0, padding: '8px 11px' }} aria-label="Ledger filters">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 750 }}>Filters</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>
              Narrow entries by account, party, or posting date.
            </div>
          </div>
          {(account || party || mode !== 'all' || dateFrom || dateTo) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setAccount('');
                setParty('');
                setMode('all');
                setDateFrom('');
                setDateTo('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="gl-filter-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1.05fr) minmax(150px, 1.05fr) minmax(125px, .9fr) minmax(145px, 1fr) minmax(145px, 1fr)', gap: 7, alignItems: 'end' }}>
          <input
            className="form-input"
            style={controlStyle}
            aria-label="Filter account"
            placeholder="Search account…"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          />
          <input
            className="form-input"
            style={controlStyle}
            aria-label="Filter party or client ledger"
            placeholder="Party / client…"
            value={party}
            list="gl-ledger-party-options"
            autoComplete="off"
            onChange={(e) => setParty(e.target.value)}
          />
          <datalist id="gl-ledger-party-options">
            {ledgerPartyOptions.map((name) => <option key={name} value={name} />)}
          </datalist>
          <select className="form-input" style={controlStyle} aria-label="Entry view" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="all">All lines</option>
            <option value="party">Only party-tagged</option>
          </select>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, fontSize: 9, fontWeight: 700, color: 'var(--text-secondary, #64748b)' }}>
            FROM DATE
            <input type="date" className="form-input" style={controlStyle} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, fontSize: 9, fontWeight: 700, color: 'var(--text-secondary, #64748b)' }}>
            TO DATE
            <input type="date" className="form-input" style={controlStyle} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>
        {partyTotals && (
          <div
            style={{
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 9,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px 18px',
              alignItems: 'center',
              background: 'var(--bg-muted, #f4f7fb)',
              border: '1px solid var(--border, #e2e8f0)',
              fontSize: 12,
            }}
          >
            <span style={{ color: 'var(--text-secondary, #64748b)' }}>Party statement · <strong style={{ color: 'var(--text-primary, inherit)' }}>{party}</strong></span>
            <span>Dr <strong>{formatCurrency(partyTotals.dr)}</strong></span>
            <span>Cr <strong>{formatCurrency(partyTotals.cr)}</strong></span>
            <span>Closing <strong>{formatCurrency(Math.abs(partyTotals.bal))}</strong> ({partyTotals.bal > 0 ? 'Due' : partyTotals.bal < 0 ? 'Credit' : 'Paid'})</span>
          </div>
        )}
      </section>

      <div
        className="table-responsive gl-ledger-scroll"
        style={{
          flex: '1 1 0',
          minHeight: 0,
          overflow: 'auto',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: 12,
          background: 'var(--bg-panel, #fff)',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.035)',
        }}
      >
        <table className="data-table" style={{ width: '100%', minWidth: 850, margin: 0, borderCollapse: 'separate', borderSpacing: 0 }}>
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
              <th style={{ whiteSpace: 'nowrap', padding: '8px 10px' }}>Date</th>
              <th style={{ padding: '8px 10px' }}>Account</th>
              <th style={{ padding: '8px 10px' }}>Party</th>
              <th style={{ padding: '8px 10px', minWidth: 220 }}>Narration</th>
              <th style={{ padding: '8px 10px' }}>Reference</th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap', padding: '8px 10px' }}>Debit (₹)</th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap', padding: '8px 10px' }}>Credit (₹)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary, #94a3b8)', padding: '42px 20px' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>No journal lines found</div>
                  <div style={{ fontSize: 12 }}>Try adjusting the account, party, or date filters.</div>
                </td>
              </tr>
            )}
            {filtered.map((r, i) => (
              <tr key={i}>
                <td style={{ whiteSpace: 'nowrap', padding: '7px 10px', fontVariantNumeric: 'tabular-nums' }}>{r.date || '—'}</td>
                <td style={{ padding: '7px 10px', minWidth: 150 }}>{r.account || '—'}</td>
                <td style={{ padding: '7px 10px', minWidth: 130 }}>{r.party || '—'}</td>
                <td
                  title={r.narration || ''}
                  style={{ padding: '7px 10px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {r.narration || '—'}
                </td>
                <td style={{ whiteSpace: 'nowrap', padding: '7px 10px' }}>{r.refId || '—'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap', padding: '7px 10px', fontVariantNumeric: 'tabular-nums' }}>{r.debit ? formatCurrency(r.debit) : '—'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap', padding: '7px 10px', fontVariantNumeric: 'tabular-nums' }}>{r.credit ? formatCurrency(r.credit) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-secondary, #94a3b8)', padding: '0 2px' }}>
        <span>{filtered.length.toLocaleString('en-IN')} ledger line{filtered.length === 1 ? '' : 's'}{party ? ` · Party: ${party}` : ''}</span>
        <span>PDF filename: {fileStem(party)}.pdf</span>
      </div>
    </div>
  );
}
