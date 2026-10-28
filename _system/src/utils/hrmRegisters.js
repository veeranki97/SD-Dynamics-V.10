/**
 * CLRA / Telangana-style labour registers as Excel 2003 XML (SpreadsheetML).
 * Opens in Microsoft Excel / LibreOffice; Save As .xlsx if needed.
 * No extra npm dependency.
 */
function xmlEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cell(v, opts = {}) {
  const t = opts.num ? 'Number' : 'String';
  const style = opts.bold ? ' s="sBold"' : opts.head ? ' s="sHead"' : opts.title ? ' s="sTitle"' : '';
  const val = opts.num && v !== '' && v != null && !Number.isNaN(Number(v)) ? Number(v) : xmlEsc(v);
  if (opts.num && (v === '' || v == null)) return '<Cell' + style + '><Data ss:Type="String"></Data></Cell>';
  return '<Cell' + style + '><Data ss:Type="' + t + '">' + val + '</Data></Cell>';
}

function row(cells) {
  return '<Row>' + cells.join('') + '</Row>';
}

function mergeCell(ref) {
  return '<MergeCell ss:Reference="' + ref + '"/>';
}

/**
 * Build SpreadsheetML workbook string from sheet definitions.
 * sheets: [{ name, rows: string[][] | cell objects, merges?: string[] }]
 */
export function buildSpreadsheetMl(sheets) {
  const styles = `
  <Styles>
    <Style ss:ID="Default"><Font ss:FontName="Calibri" ss:Size="11"/></Style>
    <Style ss:ID="sTitle"><Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1"/><Alignment ss:Horizontal="Center" ss:WrapText="1"/></Style>
    <Style ss:ID="sHead"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1"/><Alignment ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
    <Style ss:ID="sBold"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/></Style>
  </Styles>`;
  let body = '';
  for (const sh of sheets) {
    const merges = (sh.merges || []).map(mergeCell).join('');
    const rowsXml = (sh.rows || []).map((r) => {
      const cells = (r || []).map((c) => {
        if (c && typeof c === 'object' && !Array.isArray(c)) return cell(c.v, c);
        return cell(c);
      });
      return row(cells);
    }).join('\n');
    body += `<Worksheet ss:Name="${xmlEsc(sh.name || 'Sheet1')}"><Table>${rowsXml}</Table>`
      + (merges ? `<WorksheetOptions/><MergedCells>${merges}</MergedCells>` : '')
      + `</Worksheet>`;
  }
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${styles}
${body}
</Workbook>`;
}

export function sendExcelXml(res, filename, sheets) {
  const xml = buildSpreadsheetMl(sheets);
  res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="' + filename.replace(/"/g, '') + '"');
  res.send(xml);
}

export function hrmSiteHeader(cfg, site) {
  const s = site || {};
  const contractor = s.contractorNameAddress || cfg.contractorNameAddress || cfg.employerName || '';
  const nature = s.natureLocationOfWork || cfg.natureLocationOfWork || '';
  const establishment = s.contractEstablishmentNameAddress || cfg.contractEstablishmentNameAddress || '';
  const principal = s.principalEmployerNameAddress || cfg.principalEmployerNameAddress || '';
  return { contractor, nature, establishment, principal, siteName: s.name || '' };
}

export function monthLabel(month, year) {
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (names[month - 1] || month) + ' ' + year;
}
