/** Busy / Zoho-style sales & purchase registers (local CSV only). */
function esc(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function isRevenueBill(b) {
  const t = String(b.invoiceType || b.type || "").toLowerCase();
  if (t.includes("quotation") || t.includes("proforma") || t.includes("challan") || t.includes("delivery")) return false;
  if (String(b.status || "").toLowerCase() === "cancelled") return false;
  return true;
}

function billTotals(b) {
  const tot = b.data?.totals || b.totals || {};
  const cgst = Number(tot.cgst ?? tot.CGST ?? 0) || 0;
  const sgst = Number(tot.sgst ?? tot.SGST ?? 0) || 0;
  const igst = Number(tot.igst ?? tot.IGST ?? 0) || 0;
  const grand = Number(b.totalAmount ?? tot.grandTotal ?? tot.total ?? 0) || 0;
  let taxable = tot.taxable ?? tot.taxableValue ?? tot.subTotal ?? tot.subtotal;
  if (taxable == null || taxable === "") {
    const tax = cgst + sgst + igst;
    taxable = tax > 0 && grand > 0 ? Math.round((grand - tax) * 100) / 100 : Number(tot.subTotal) || 0;
  }
  return { taxable: Number(taxable) || 0, cgst, sgst, igst, grand };
}

/** Columns: Date, Party, GSTIN, VchNo, Taxable, CGST, SGST, IGST, Total, PlaceOfSupply, Type */
export function buildBusySalesRegisterCsv(bills) {
  const headers = ["Date", "Party", "GSTIN", "VchNo", "Taxable", "CGST", "SGST", "IGST", "Total", "PlaceOfSupply", "Type"];
  const lines = [headers.join(",")];
  for (const b of bills || []) {
    if (!isRevenueBill(b)) continue;
    const d = b.data?.details || {};
    const c = b.data?.client || {};
    const t = billTotals(b);
    lines.push([
      b.invoiceDate || d.invoiceDate || "",
      b.clientName || c.name || "",
      c.gstin || b.clientGstin || "",
      b.invoiceNumber || "",
      t.taxable.toFixed(2),
      t.cgst.toFixed(2),
      t.sgst.toFixed(2),
      t.igst.toFixed(2),
      t.grand.toFixed(2),
      d.placeOfSupply || c.state || "",
      b.invoiceType || "tax-invoice",
    ].map(esc).join(","));
  }
  return lines.join("\n");
}

export function buildBusyPurchaseRegisterCsv(purchases) {
  const headers = ["Date", "Party", "GSTIN", "VchNo", "Taxable", "CGST", "SGST", "IGST", "Total", "OurVoucher", "Status"];
  const lines = [headers.join(",")];
  for (const p of purchases || []) {
    const taxable = Number(p.taxableAmount ?? p.taxable ?? 0) || 0;
    const tax = Number(p.totalTax ?? p.gstAmount ?? 0) || 0;
    const total = Number(p.totalAmount ?? p.grandTotal ?? taxable + tax) || 0;
    const interstate = !!p.interstate;
    const cgst = interstate ? 0 : tax / 2;
    const sgst = interstate ? 0 : tax / 2;
    const igst = interstate ? tax : 0;
    lines.push([
      p.date || p.billDate || "",
      p.supplierName || p.vendorName || "",
      p.supplierGstin || p.vendorGstin || "",
      p.invoiceNumber || "",
      taxable.toFixed(2),
      cgst.toFixed(2),
      sgst.toFixed(2),
      igst.toFixed(2),
      total.toFixed(2),
      p.purchaseNumber || p.voucherNo || "",
      p.paymentStatus || "",
    ].map(esc).join(","));
  }
  return lines.join("\n");
}
