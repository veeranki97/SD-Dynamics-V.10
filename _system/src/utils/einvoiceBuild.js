/**
 * Offline e-invoice JSON builder (schema-oriented, no fake IRN).
 * Production IRN requires GSP + static IP — see EinvoiceSettingsPanel.
 */

function onlyDigits(s) {
  return String(s || '').replace(/\D/g, '');
}

export function validateEinvoiceBill(bill, profile) {
  const errors = [];
  const gstin = String(profile?.gstin || bill?.sellerGstin || '').toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
    errors.push('Supplier GSTIN invalid or missing');
  }
  const buyer = bill?.clientGstin || bill?.data?.client?.gstin || '';
  const items = bill?.data?.items || bill?.items || [];
  if (!items.length) errors.push('No line items');
  items.forEach((it, i) => {
    const hsn = onlyDigits(it.hsn || it.sac || '');
    if (buyer && hsn && ![4, 6, 8].includes(hsn.length)) {
      errors.push(`Line ${i + 1}: HSN/SAC must be 4, 6 or 8 digits for B2B`);
    }
  });
  const total = Number(bill?.totalAmount) || 0;
  if (total <= 0) errors.push('Grand total must be positive');
  return { ok: errors.length === 0, errors };
}

export function buildEinvoiceJson(bill, profile) {
  const v = validateEinvoiceBill(bill, profile);
  const items = bill?.data?.items || bill?.items || [];
  const client = bill?.data?.client || {};
  const doc = {
    Version: '1.1',
    TranDtls: { TaxSch: 'GST', SupTyp: 'B2B', RegRev: 'N', EcmGstin: null, IgstOnIntra: 'N' },
    DocDtls: {
      Typ: /credit/i.test(String(bill.invoiceType || '')) ? 'CRN' : 'INV',
      No: bill.invoiceNumber || bill.id,
      Dt: (bill.invoiceDate || '').slice(0, 10).split('-').reverse().join('/'),
    },
    SellerDtls: {
      Gstin: profile?.gstin || '',
      LglNm: profile?.businessName || profile?.name || '',
      Addr1: profile?.address || '',
      Loc: profile?.city || profile?.state || '',
      Pin: Number(onlyDigits(profile?.pincode || profile?.pin).slice(0, 6)) || 0,
      Stcd: onlyDigits(profile?.gstin).slice(0, 2) || '',
    },
    BuyerDtls: {
      Gstin: client.gstin || bill.clientGstin || '',
      LglNm: client.name || bill.clientName || '',
      Pos: (client.gstin || '').slice(0, 2) || '',
      Addr1: client.address || '',
      Loc: client.city || client.state || '',
      Pin: Number(onlyDigits(client.pincode || client.pin).slice(0, 6)) || 0,
      Stcd: (client.gstin || '').slice(0, 2) || '',
    },
    ItemList: items.map((it, i) => ({
      SlNo: String(i + 1),
      PrdDesc: it.name || it.description || '',
      HsnCd: onlyDigits(it.hsn || it.sac || ''),
      Qty: Number(it.quantity ?? it.qty) || 0,
      Unit: it.unit || 'NOS',
      UnitPrice: Number(it.rate) || 0,
      TotAmt: Number(it.amount) || (Number(it.quantity || it.qty || 0) * Number(it.rate || 0)),
      GstRt: Number(it.taxPercent || it.taxRate) || 0,
    })),
    ValDtls: {
      AssVal: Number(bill?.data?.totals?.taxable) || 0,
      CgstVal: Number(bill?.data?.totals?.cgst) || 0,
      SgstVal: Number(bill?.data?.totals?.sgst) || 0,
      IgstVal: Number(bill?.data?.totals?.igst) || 0,
      CesVal: 0,
      TotInvVal: Number(bill.totalAmount) || 0,
    },
    _sdMeta: {
      validated: v.ok,
      validationErrors: v.errors,
      note: 'Offline payload only — IRN requires configured GSP. Do not treat as filed.',
    },
  };
  return { json: doc, validation: v };
}
