# Why checklist / Edit-lock / PI payment disappeared

GL and WO patches replaced InvoiceGenerator.jsx with an older copy that did not
include your later UI rules. Features are restored in this file:

1. Pre-save Document checklist (tax invoices)
2. After save → form locked until Edit
3. PI payment remains on invoice list (isPaymentDocType must include proforma)

Dashboard isPaymentDocType should be:
```
const isPaymentDocType = (t) => {
  const s = String(t || "tax-invoice").toLowerCase();
  return s === "tax-invoice" || s.includes("proforma") || (s.includes("tax") && !s.includes("credit"));
};
```
Exclude only quotation / delivery-challan / credit-note from Mark paid.
