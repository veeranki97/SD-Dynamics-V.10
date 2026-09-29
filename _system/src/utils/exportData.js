/** CSV + print helpers for list screens */
export function downloadCsv(filename, rows, columns) {
  if (!rows?.length) return;
  const cols = columns || Object.keys(rows[0] || {});
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(',')];
  rows.forEach(r => {
    lines.push(cols.map(c => esc(typeof c === 'function' ? '' : r[c])).join(','));
  });
  // support { key, label, get }
  if (columns && columns[0] && typeof columns[0] === 'object') {
    const headers = columns.map(c => c.label || c.key);
    const body = rows.map(r => columns.map(c => {
      const v = c.get ? c.get(r) : r[c.key];
      return esc(v);
    }).join(','));
    const csv = [headers.join(','), ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function printHtmlTable(title, tableHtml) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body{font-family:Helvetica,Arial,sans-serif;font-size:12px;padding:16px}
      h1{font-size:18px;margin:0 0 12px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
      th{background:#f4f4f4}
      @media print{button{display:none}}
    </style></head><body>
    <h1>${title}</h1>
    ${tableHtml}
    <p style="margin-top:16px;font-size:10px;color:#666">Generated ${new Date().toLocaleString('en-IN')}</p>
    </body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 300);
}
