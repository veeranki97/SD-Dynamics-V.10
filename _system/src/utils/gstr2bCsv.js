/**
 * Parse flexible GSTR-2B style CSV into portal-like { b2b: [...] } for buildReconciliation.
 * Headers (any case): GSTIN/CTIN, Invoice, Date, Taxable, IGST, CGST, SGST, Total, Name.
 */
function splitCsvLine(line) {
  const cols = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === "," && !inQ) { cols.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  cols.push(cur.trim());
  return cols;
}

function num(v) {
  return parseFloat(String(v || "0").replace(/,/g, "")) || 0;
}

export function parseGstr2bCsv(text) {
  const lines = String(text || "").trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.replace(/"/g, "").toLowerCase());
  const findCol = (...names) => {
    for (const n of names) {
      const i = headers.findIndex((h) => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const iGstin = findCol("gstin", "ctin");
  const iName = findCol("trade name", "legal name", "supplier", "name");
  const iInv = findCol("invoice number", "invoice no", "inum", "inv");
  const iDate = findCol("invoice date", "date", "idt");
  const iTaxable = findCol("taxable", "txval", "taxable value");
  const iIgst = findCol("igst");
  const iCgst = findCol("cgst");
  const iSgst = findCol("sgst");
  const iTotal = findCol("invoice value", "total", "val", "invoice amount");
  const rows = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = splitCsvLine(lines[li]);
    const gstin = (iGstin >= 0 ? cols[iGstin] : "").replace(/\s/g, "").toUpperCase();
    const invNo = iInv >= 0 ? cols[iInv] : "";
    if (!gstin && !invNo) continue;
    const taxable = num(iTaxable >= 0 ? cols[iTaxable] : 0);
    const igst = num(iIgst >= 0 ? cols[iIgst] : 0);
    const cgst = num(iCgst >= 0 ? cols[iCgst] : 0);
    const sgst = num(iSgst >= 0 ? cols[iSgst] : 0);
    let val = num(iTotal >= 0 ? cols[iTotal] : 0);
    if (!val) val = taxable + igst + cgst + sgst;
    rows.push({
      gstin,
      name: iName >= 0 ? cols[iName] : "",
      invNo,
      date: iDate >= 0 ? cols[iDate] : "",
      taxable,
      igst,
      cgst,
      sgst,
      val,
    });
  }
  return rows;
}

/** Convert flat CSV rows → structure expected by GSTReturns buildReconciliation */
export function csvRowsTo2bData(rows) {
  const by = Object.create(null);
  for (const r of rows || []) {
    const ctin = String(r.gstin || "").toUpperCase();
    if (!by[ctin]) by[ctin] = { ctin, trdnm: r.name || "", inv: [] };
    by[ctin].inv.push({
      inum: r.invNo,
      idt: r.date,
      val: r.val,
      items: [{ txval: r.taxable, igst: r.igst, cgst: r.cgst, sgst: r.sgst }],
    });
  }
  return { b2b: Object.values(by) };
}
