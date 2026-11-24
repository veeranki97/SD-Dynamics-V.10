// ============================================================================
// Thermal Print Settings — app-wide defaults, stored in localStorage.
// Consumed by InvoicePreview (as fallback under per-invoice options) and
// PrintSettings.jsx (as the UI form state).
// ============================================================================

import { INVOICE_TYPES } from '../utils.js';

export const DEFAULT_PRINT_SETTINGS = {
  // ==== Thermal-only ====
  fontFamily: 'mono',    // 'mono' | 'sans'
  fontSize: 'medium',    // 'small' | 'medium' | 'large' | 'xlarge'
  fontWeight: 'bold',    // 'normal' | 'bold' | 'ultra'
  allCaps: false,

  // Layout
  lineSpacing: 'normal', // 'compact' | 'normal' | 'comfortable'
  headerAlign: 'center', // 'left' | 'center'
  contrast: 'normal',    // 'normal' | 'high' | 'ultra'

  // Content
  showHSN: true,
  roundOffInvoiceTotals: true,
  showRateLine: true,
  showAmountWords: true,
  showUPI: true,
  qrSize: 'medium',
  showLogo: true,
  showBankDetails: true,

  // Footer
  footerMessage: 'Thank you for your business!',
  cutMark: true,
  feedLines: 2,

  // Header
  headerCaps: true,
  showTagline: false,
  tagline: '',

  // ==== v1.9.0 PDF & universal print features ====
  autoPrintOnSave: false,

  // -- Watermark --
  watermarkEnabled: false,
  watermarkText: 'DUPLICATE',
  watermarkOpacity: 15,
  watermarkAngle: -35,
  watermarkFontSize: 90,

  // -- Multi-copy print (GST rule 48) --
  multiCopyEnabled: false,
  multiCopyCount: 3,
  multiCopyLabels: ['ORIGINAL FOR RECIPIENT', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR SUPPLIER'],

  // -- Page numbers + header on subsequent pages --
  pageNumbersEnabled: true,
  pageHeaderEnabled: true,

  // -- Print margins (mm) --
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,

  // -- Font family (sheet PDFs) --
  pdfFontFamily: 'helvetica',

  // -- Barcode / QR of invoice number --
  invoiceBarcodeEnabled: false,
  invoiceQrEnabled: false,
  invoiceQrUrl: '',

  // -- Digital signature --
  signatureImage: '',
  signatureName: '',
  signatureShow: true,

  // -- T&C on separate page --
  termsSeparatePage: false,
  termsFormatMode: 'compact',

  // -- Feedback / Review QR --
  feedbackQrEnabled: false,
  feedbackQrUrl: '',
  feedbackQrLabel: 'Rate us · Give feedback',

  // -- Reprint indicator --
  reprintLabelEnabled: false,

  // ==== v1.9.1 additions ====
  pdfQuality: 'hd',

  // -- Dual currency display --
  dualCurrencyEnabled: false,
  dualCurrencyCode: 'USD',
  dualCurrencyRate: 83,
  dualCurrencyPosition: 'below',

  // -- PDF template style --
  pdfTemplate: 'saidurga',

  // -- Company letterhead --
  letterheadEnabled: false,
  letterheadImage: '',
  letterheadOpacity: 100,
  letterheadHideHeader: true,

  // -- Preview zoom --
  previewZoom: 100,

  // ==== v1.9.2 — full user control over PDF colours + font scale ====
  userColorsEnabled: false,
  pdfPrimaryText: '#0f172a',
  pdfMutedText: '#334155',
  pdfAccent: '#1e40af',
  pdfAccentText: '#ffffff',
  pdfHeaderBg: '#f8fafc',
  pdfDividerColor: '#334155',
  pdfFontScale: 1.0,
  pdfDarkenOnPrint: true,

  // ==== v1.9.3 — Custom section labels ====
  labelLanguage: 'en',
  labelBillTo: '',
  labelPlaceOfSupply: '',
  labelAmountInWords: '',
  labelBankDetails: '',
  labelTerms: '',
  labelNotes: '',

  // -- Layout density --
  rowDensity: 'normal',

  // -- Currency + Number formatting --
  currencyPosition: 'before',
  numberFormat: 'indian',
  decimalPlaces: 2,

  // -- Date format --
  dateFormat: 'dd-mon-yyyy',

  // -- Watermark: custom text option --
  watermarkUseCustomText: false,
  watermarkCustomText: '',

  // -- Custom tax rate presets --
  customTaxRates: [],

  // -- Saved custom PDF templates --
  savedTemplates: [],

  // -- Setup / onboarding --
  onboardingComplete: false,
  activePresetId: '',

  customPrefixes: {
    'tax-invoice': '',
    'quotation': '',
    'proforma': '',
    'bill-of-supply': '',
    'composition': '',
    'credit-note': '',
    'delivery-challan': '',
  },

  headerCompact: false,
  thermalPrintMode: 'direct',
  thermalBufferSafe: false,
  reminderEnabled: true,
};

export function getPrintSettings() {
  try {
    const raw = localStorage.getItem('gst_printSettings');
    if (!raw) return { ...DEFAULT_PRINT_SETTINGS };
    return { ...DEFAULT_PRINT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PRINT_SETTINGS };
  }
}

export function savePrintSettings(settings) {
  try {
    localStorage.setItem('gst_printSettings', JSON.stringify(settings));
    try {
      fetch('/api/meta/printSettings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ value: settings }),
      }).catch(function () {});
    } catch (e) { /* ignore network */ }
    return true;
  } catch {
    return false;
  }
}

export const LABEL_PRESETS = {
  en: {
    billTo: 'BILL TO',
    shipTo: 'SHIP TO',
    placeOfSupply: 'PLACE OF SUPPLY',
    amountInWords: 'AMOUNT IN WORDS',
    bankDetails: 'BANK DETAILS',
    terms: 'TERMS & CONDITIONS',
    notes: 'NOTES',
    authorizedSignatory: 'Authorized Signatory',
    subtotal: 'Subtotal',
    total: 'Total',
    invoice: 'TAX INVOICE',
  },
  hi: {
    billTo: 'क्रेता (BILL TO)',
    shipTo: 'शिपिंग पता (SHIP TO)',
    placeOfSupply: 'आपूर्ति स्थान',
    amountInWords: 'शब्दों में राशि',
    bankDetails: 'बैंक विवरण',
    terms: 'नियम एवं शर्तें',
    notes: 'टिप्पणी',
    authorizedSignatory: 'अधिकृत हस्ताक्षरकर्ता',
    subtotal: 'उप-कुल',
    total: 'कुल',
    invoice: 'कर चालान',
  },
  ta: {
    billTo: 'விற்பனையாளர்',
    shipTo: 'அனுப்பும் முகவரி',
    placeOfSupply: 'விநியோக இடம்',
    amountInWords: 'சொற்களில் தொகை',
    bankDetails: 'வங்கி விவரங்கள்',
    terms: 'விதிமுறைகள்',
    notes: 'குறிப்புகள்',
    authorizedSignatory: 'அங்கீகரிக்கப்பட்ட கையொப்பம்',
    subtotal: 'மொத்தம்',
    total: 'மொத்தத்தொகை',
    invoice: 'வரி விலைப்பட்டியல்',
  },
  mr: {
    billTo: 'खरेदीदार',
    shipTo: 'शिपिंग पत्ता',
    placeOfSupply: 'पुरवठ्याचे ठिकाण',
    amountInWords: 'शब्दात रक्कम',
    bankDetails: 'बँक तपशील',
    terms: 'नियम व अटी',
    notes: 'नोट्स',
    authorizedSignatory: 'अधिकृत स्वाक्षरीकर्ता',
    subtotal: 'उप-एकूण',
    total: 'एकूण',
    invoice: 'कर चलन',
  },
  bn: {
    billTo: 'ক্রেতা',
    shipTo: 'শিপিং ঠিকানা',
    placeOfSupply: 'সরবরাহের স্থান',
    amountInWords: 'কথায় পরিমাণ',
    bankDetails: 'ব্যাংক বিবরণ',
    terms: 'শর্তাবলী',
    notes: 'নোট',
    authorizedSignatory: 'অনুমোদিত স্বাক্ষরকারী',
    subtotal: 'উপ-মোট',
    total: 'মোট',
    invoice: 'কর চালান',
  },
};

export function getLabel(settings, key) {
  const overrideKey = 'label' + key.charAt(0).toUpperCase() + key.slice(1);
  if (settings[overrideKey]) return settings[overrideKey];
  const preset = LABEL_PRESETS[settings.labelLanguage] || LABEL_PRESETS.en;
  return preset[key] || LABEL_PRESETS.en[key] || '';
}

export function formatNumber(n, settings) {
  const num = Number(n) || 0;
  const decimals = Number(settings.decimalPlaces ?? 2);
  const fmt = settings.numberFormat || 'indian';
  const abs = Math.abs(num);
  const rounded = abs.toFixed(decimals);

  if (fmt === 'western') {
    const [int, dec] = rounded.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (num < 0 ? '-' : '') + (dec ? `${grouped}.${dec}` : grouped);
  }
  if (fmt === 'european') {
    const [int, dec] = rounded.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (num < 0 ? '-' : '') + (dec ? `${grouped},${dec}` : grouped);
  }
  const [int, dec] = rounded.split('.');
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return (num < 0 ? '-' : '') + (dec ? `${grouped}.${dec}` : grouped);
}

export function formatCurrencyEx(n, currencyCode, settings) {
  const symbolMap = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$', AUD: 'A$', JPY: '¥', CAD: 'C$' };
  const sym = symbolMap[currencyCode] || currencyCode;
  const num = formatNumber(n, settings);
  return settings.currencyPosition === 'after' ? `${num}${sym}` : `${sym}${num}`;
}

export function formatDate(dateStr, settings) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  const fmt = settings.dateFormat || 'dd-mon-yyyy';
  switch (fmt) {
    case 'dd-mm-yyyy': return `${dd}/${mm}/${yyyy}`;
    case 'mm-dd-yyyy': return `${mm}/${dd}/${yyyy}`;
    case 'yyyy-mm-dd': return `${yyyy}-${mm}-${dd}`;
    case 'iso': return d.toISOString().slice(0, 10);
    case 'dd-mmm-yyyy': return `${dd}-${mon}-${yyyy}`;
    case 'dd-mon-yyyy':
    default: return `${dd} ${mon} ${yyyy}`;
  }
}

export const BUSINESS_PRESETS = {
  retail_shop: {
    label: '🛒 Retail Shop / Kirana',
    hint: 'Small retail counter · thermal receipt · quick print',
    patch: {
      pdfTemplate: 'modern',
      fontSize: 'medium', fontWeight: 'bold', allCaps: true,
      autoPrintOnSave: true,
      showRateLine: true, showHSN: false,
      footerMessage: 'Thank you! Visit again!',
      cutMark: true, feedLines: 2,
      labelLanguage: 'en',
    },
  },
  freelancer: {
    label: '💻 Freelancer / Consultant',
    hint: 'A4 PDF · monthly retainer · professional feel',
    patch: {
      pdfTemplate: 'minimalist',
      showHSN: true, showAmountWords: true, showRateLine: true,
      pageNumbersEnabled: true, pageHeaderEnabled: true,
      pdfFontFamily: 'helvetica',
      pdfQuality: 'standard',
      labelLanguage: 'en',
    },
  },
  restaurant: {
    label: '🍽 Restaurant / Cafe / Bar',
    hint: '80mm thermal · compact receipt · UPI QR prominent',
    patch: {
      pdfTemplate: 'modern',
      fontSize: 'medium', fontWeight: 'bold', allCaps: false,
      autoPrintOnSave: true,
      showHSN: false, showRateLine: false, showAmountWords: false,
      showUPI: true, qrSize: 'large',
      cutMark: true, feedLines: 3,
      footerMessage: 'Thanks for dining with us!',
    },
  },
  wholesale: {
    label: '📦 Wholesale / Trading',
    hint: 'A5 landscape · multi-copy · GST rule 48 compliant',
    patch: {
      pdfTemplate: 'classic',
      multiCopyEnabled: true, multiCopyCount: 3,
      showHSN: true, showAmountWords: true,
      pdfDarkenOnPrint: true,
      pdfQuality: 'standard',
      labelLanguage: 'en',
    },
  },
  manufacturer: {
    label: '🏭 Manufacturing',
    hint: 'A4 · detailed items · e-Way Bill ready · multi-page headers',
    patch: {
      pdfTemplate: 'corporate',
      showHSN: true, showAmountWords: true, showRateLine: true,
      pageNumbersEnabled: true, pageHeaderEnabled: true,
      invoiceQrEnabled: true,
      multiCopyEnabled: true, multiCopyCount: 3,
    },
  },
  service: {
    label: '🛠 Service / Repair Shop',
    hint: 'A5 portrait · single copy · signature line prominent',
    patch: {
      pdfTemplate: 'classic',
      showHSN: false, showAmountWords: true,
      signatureShow: true,
      pdfFontFamily: 'helvetica',
      labelLanguage: 'en',
    },
  },
};

export function applyBusinessPreset(currentSettings, presetKey) {
  const preset = BUSINESS_PRESETS[presetKey];
  if (!preset) return currentSettings;
  return { ...currentSettings, ...preset.patch };
}

export const buildSampleInvoice = (profile) => ({
  profile: profile || {
    businessName: 'Your Business Name',
    address: 'Sample Street, Sample City',
    city: 'Sample City', state: 'Maharashtra', pin: '400001',
    phone: '+91-9999999999',
    gstin: '27AAAAA0000A1Z5',
    country: 'India',
  },
  client: { name: 'SAMPLE CUSTOMER', phone: '+91-9876543210', gstin: '', country: 'India' },
  details: { invoiceNumber: 'TEST/PRINT/0001', invoiceDate: new Date().toISOString().split('T')[0], placeOfSupply: '' },
  items: [
    { name: 'Sample Product One', hsn: '4820', quantity: 2, unit: 'Pcs', rate: 100, taxPercent: 18, discount: 0, cessPercent: 0 },
    { name: 'Sample Product Two', hsn: '9987', quantity: 1, unit: 'Nos', rate: 250, taxPercent: 12, discount: 0, cessPercent: 0 },
    { name: 'Sample Service Item', hsn: '9983', quantity: 1, unit: 'Hrs', rate: 500, taxPercent: 18, discount: 0, cessPercent: 0 },
  ],
  totals: {
    subtotal: 950, totalDiscount: 0, taxableAmount: 950,
    cgst: 90, sgst: 90, igst: 0, cess: 0,
    tcsAmount: 0, tdsAmount: 0, roundOff: 0,
    total: 1130,
  },
  invoiceType: 'tax-invoice',
});

export async function hydratePrintSettingsFromServer() {
  try {
    const res = await fetch('/api/meta/printSettings', { cache: 'no-store', credentials: 'same-origin' });
    if (!res.ok) return null;
    const body = await res.json();
    const value = body && body.value;
    if (!value || typeof value !== 'object') return null;
    let local = {};
    try { local = JSON.parse(localStorage.getItem('gst_printSettings') || '{}'); } catch (e) { local = {}; }
    const merged = {
      ...DEFAULT_PRINT_SETTINGS,
      ...local,
      ...value,
      customPrefixes: {
        ...(DEFAULT_PRINT_SETTINGS.customPrefixes || {}),
        ...(local.customPrefixes || {}),
        ...(value.customPrefixes || {}),
      },
    };
    localStorage.setItem('gst_printSettings', JSON.stringify(merged));
    try { window.dispatchEvent(new CustomEvent('sd-print-settings-hydrated', { detail: merged })); } catch (_) {}
    return merged;
  } catch (e) {
    return null;
  }
}

// ============================================================================
// Multi-Template, Option-Reactive Native Vector PDF Builder
// Supports: 'saidurga' | 'tally' | 'boxed' | 'classic' | 'modern' | 'minimal'
// Honors every Customize toggle, accent color, paper size, and signature block.
// ============================================================================
function pdfCurrencySymbol(code) {
  const c = String(code || 'INR').toUpperCase();
  const map = { INR: 'Rs.', USD: '$', EUR: '\u20AC', GBP: '\u00A3', JPY: '\u00A5', AED: 'AED', SGD: 'S$', AUD: 'A$', CAD: 'C$' };
  return map[c] || c;
}

export async function buildVectorInvoicePdf({
  profile = {},
  client = {},
  details = {},
  items = [],
  totals = {},
  invoiceType = 'tax-invoice',
  customTerms = '',
  customNotes = '',
  extraSections = [],
  invoiceOptions = {},
  printSettings = null,
  doc: existingDoc = null,
}) {
  const { jsPDF } = await import('jspdf');
  let QRCodeMod = null;
  try { QRCodeMod = (await import('qrcode')).default; } catch { /* optional */ }

  const ps = printSettings || getPrintSettings();

  // Paper size & orientation mapping
  const pKey = String(invoiceOptions.paperSize || 'a4');
  const isLandscape = pKey.toLowerCase().includes('landscape');
  const isA5 = pKey.toLowerCase().startsWith('a5');
  const format = isA5 ? 'a5' : 'a4';
  const orientation = isLandscape ? 'landscape' : 'portrait';

  const doc = existingDoc || new jsPDF({ orientation, unit: 'mm', format, compress: true });
  if (existingDoc) doc.addPage(format, orientation);
  const startPage = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const baseMargin = isA5 ? 7 : 10;
  const marginX = Math.max(6, Number(ps.marginLeft) || baseMargin);
  const marginTop = Math.max(6, Number(ps.marginTop) || baseMargin);
  const marginBottom = Math.max(6, Number(ps.marginBottom) || baseMargin);
  const boxW = pageW - marginX * 2;
  const fontFam = ['helvetica', 'times', 'courier'].includes(ps.pdfFontFamily) ? ps.pdfFontFamily : 'helvetica';

  // Resolve active template style
  const rawStyle = String(invoiceOptions.pdfStyle || ps.pdfTemplate || 'saidurga').toLowerCase();
  const style = (rawStyle === 'boxed-grid' || rawStyle === 'boxed') ? 'boxed'
    : (rawStyle === 'tally-v2' || rawStyle === 'tally') ? 'tally'
    : (rawStyle === 'corporate') ? 'classic'
    : (rawStyle === 'minimalist') ? 'minimal'
    : ['saidurga', 'classic', 'modern', 'minimal'].includes(rawStyle) ? rawStyle : 'saidurga';

  // Resolve Customize option flags (matches InvoicePreview.jsx opt())
  const isDeliveryChallan = /challan|delivery/i.test(String(invoiceType || ''));
  const typeConfig = INVOICE_TYPES[invoiceType] || INVOICE_TYPES['tax-invoice'];
  const opt = (key, fallback = true) => invoiceOptions[key] !== undefined ? invoiceOptions[key] : fallback;

  const showLogo = opt('showLogo', true);
  const showBusinessName = opt('showBusinessName', true);
  const showBusinessAddress = opt('showBusinessAddress', true);
  const showBusinessPhone = opt('showBusinessPhone', true);
  const showBusinessEmail = opt('showBusinessEmail', true);
  const showState = opt('showState', true);
  const showGSTIN = opt('showGSTIN', true);
  const showClientAddress = opt('showClientAddress', true);
  const showClientPhone = opt('showClientPhone', true);
  const showClientEmail = opt('showClientEmail', true);
  const showPlaceOfSupply = opt('showPlaceOfSupply', true);
  const showInvoiceNumber = opt('showInvoiceNumber', true);
  const showInvoiceDate = opt('showInvoiceDate', true);
  const showDueDate = opt('showDueDate', true);
  const showHSN = opt('showHSN', true);
  const showItemQty = opt('showItemQty', true);
  const showItemUnit = opt('showItemUnit', true);
  const showRateColumn = isDeliveryChallan ? false : opt('showRateColumn', true);
  const showAmountCol = !isDeliveryChallan;
  const showGST = isDeliveryChallan ? false : opt('showGST', typeConfig.showGST !== false);
  const showSubtotal = isDeliveryChallan ? false : opt('showSubtotal', true);
  const showAmountWords = isDeliveryChallan ? false : opt('showAmountWords', true);
  const showRoundOff = isDeliveryChallan ? false : opt('showRoundOff', false);
  const showBankDetails = isDeliveryChallan ? false : opt('showBankDetails', true);
  const showAccountLabel = opt('showAccountLabel', false);
  const showUPI = isDeliveryChallan ? false : opt('showUPI', true);
  const showSignature = opt('showSignature', true);
  const showSignatoryText = opt('showSignatoryText', true);
  const showTerms = opt('showTerms', true);
  const showNotes = opt('showNotes', true);

  const isIndia = (profile?.country || 'India') === 'India';
  const businessState = (profile?.state || '').trim().toLowerCase();
  const clientState = (client?.state || '').trim().toLowerCase();
  const isInterstate = typeof totals?.isInterstate === 'boolean'
    ? totals.isInterstate
    : ((Number(totals?.igst) || 0) > 0
      || !!client?.isSEZ
      || (details?.placeOfSupply && businessState && details.placeOfSupply.toLowerCase() !== businessState)
      || (businessState && clientState && businessState !== clientState));

  const hexToRgb = (hex, fallback = [30, 64, 175]) => {
    const m = String(hex || '').replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : fallback;
  };
  const typeDefaultColors = {
    'tax-invoice': [30, 64, 175],
    'proforma': [124, 58, 237],
    'bill-of-supply': [15, 118, 110],
    'credit-note': [190, 18, 60],
  };
  const accentRgb = invoiceOptions.accentColor
    ? hexToRgb(invoiceOptions.accentColor)
    : (ps.userColorsEnabled && ps.pdfAccent ? hexToRgb(ps.pdfAccent) : (typeDefaultColors[invoiceType] || [30, 64, 175]));
  const headerBgRgb = ps.userColorsEnabled ? hexToRgb(ps.pdfHeaderBg, [241, 245, 249]) : [241, 245, 249];

  const STATE_CODES = {
    'jammu and kashmir': '01', 'himachal pradesh': '02', 'punjab': '03', 'chandigarh': '04',
    'uttarakhand': '05', 'haryana': '06', 'delhi': '07', 'rajasthan': '08', 'uttar pradesh': '09',
    'bihar': '10', 'sikkim': '11', 'arunachal pradesh': '12', 'nagaland': '13', 'manipur': '14',
    'mizoram': '15', 'tripura': '16', 'meghalaya': '17', 'assam': '18', 'west bengal': '19',
    'jharkhand': '20', 'odisha': '21', 'chhattisgarh': '22', 'madhya pradesh': '23', 'gujarat': '24',
    'maharashtra': '27', 'karnataka': '29', 'goa': '30', 'kerala': '32', 'tamil nadu': '33',
    'puducherry': '34', 'telangana': '36', 'andhra pradesh': '37', 'ladakh': '38',
  };
  const stateCodeOf = (st, gstin) => {
    const g = String(gstin || '').trim();
    if (/^\d{2}/.test(g)) return g.slice(0, 2);
    return STATE_CODES[String(st || '').trim().toLowerCase()] || '';
  };

  const stripHtml = (html) => {
    if (!html) return '';
    return String(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const fmtAmt = (n) => formatNumber(Number(n) || 0, { ...ps, decimalPlaces: ps.decimalPlaces ?? 2 });
  const curSym = pdfCurrencySymbol(invoiceOptions.currency);

  const wordsOf = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const under1000 = (v) => {
      const out = [];
      if (v >= 100) { out.push(ones[Math.floor(v / 100)], 'Hundred'); v %= 100; }
      if (v >= 10 && v < 20) out.push(ones[v]);
      else {
        if (v >= 20) out.push(tens[Math.floor(v / 10)]);
        if (v % 10) out.push(ones[v % 10]);
      }
      return out.filter(Boolean).join(' ');
    };
    const abs = Math.abs(Number(num) || 0);
    let major = Math.floor(abs + 0.0001);
    const minor = Math.round((abs - major) * 100) % 100;
    if (!major && !minor) return 'Zero Rupees Only';
    const parts = [];
    [['Crore', 10000000], ['Lakh', 100000], ['Thousand', 1000]].forEach(([label, sz]) => {
      if (major >= sz) {
        parts.push(`${under1000(Math.floor(major / sz))} ${label}`);
        major %= sz;
      }
    });
    if (major) parts.push(under1000(major));
    const curName = (invoiceOptions.currency || 'INR') === 'INR' ? 'Rupees' : (invoiceOptions.currency || 'INR');
    const paiseName = (invoiceOptions.currency || 'INR') === 'INR' ? 'Paise' : 'Cents';
    return `${parts.join(' ')} ${curName}${minor ? ` and ${under1000(minor)} ${paiseName}` : ''} Only`;
  };

  const titleMap = {
    'tax-invoice': 'TAX INVOICE',
    'proforma': 'PROFORMA INVOICE',
    'quotation': 'QUOTATION',
    'bill-of-supply': 'BILL OF SUPPLY',
    'credit-note': 'CREDIT NOTE',
    'debit-note': 'DEBIT NOTE',
    'delivery-challan': 'DELIVERY CHALLAN',
  };
  const docTitle = (invoiceOptions.customTitle || titleMap[invoiceType] || 'TAX INVOICE').toUpperCase();

  const acct = invoiceOptions.paymentAccountSnapshot
    || (Array.isArray(profile.paymentAccounts)
      ? (profile.paymentAccounts.find(a => a.id === invoiceOptions.selectedAccountId) || profile.paymentAccounts.find(a => a.isDefault) || profile.paymentAccounts[0])
      : null)
    || {};

  // Compute SHA-256 fingerprint for digital verification
  let shaHex = '';
  try {
    const rawFp = JSON.stringify({
      inv: details?.invoiceNumber, date: details?.invoiceDate,
      client: client?.name, gstin: client?.gstin, total: totals?.total,
      items: (items || []).map(i => [i.name, i.quantity, i.rate, i.hsn]),
    });
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = new TextEncoder().encode(rawFp);
      const hash = await crypto.subtle.digest('SHA-256', buf);
      shaHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* fallback empty */ }

  const setStroke = (w = 0.28) => {
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(w);
  };

  // Helper: Draw Signature + Digital Verification Box
  const drawSignatureBlock = (rightX, topY, boxHeight) => {
    if (!showSignature || ps.signatureShow === false) return;
    doc.setFont(fontFam, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`For ${profile.businessName || 'Company'}`, rightX, topY + 4, { align: 'right' });

    const sigImg = profile?.signature || ps.signatureImage;
    if (sigImg && String(sigImg).startsWith('data:image/')) {
      try {
        const sFmt = String(sigImg).includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(sigImg, sFmt, rightX - 26, topY + 5.5, 25, 8.5);
      } catch { /* skip */ }
    }

    const sigBoxW = 46;
    const sigBoxH = 14;
    const sigBoxX = rightX - sigBoxW;
    const sigBoxY = topY + Math.max(15, boxHeight - sigBoxH - 5.5);
    doc.setDrawColor(22, 163, 74);
    doc.setFillColor(240, 253, 244);
    doc.setLineWidth(0.25);
    doc.rect(sigBoxX, sigBoxY, sigBoxW, sigBoxH, 'FD');

    doc.setFont(fontFam, 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(21, 128, 61);
    doc.text('Signature Valid', sigBoxX + 1.8, sigBoxY + 3.1);

    doc.setFont(fontFam, 'normal');
    doc.setFontSize(5.4);
    doc.setTextColor(51, 65, 85);
    const stampDt = new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    doc.text(`Digitally signed by: ${String(profile.businessName || '').slice(0, 24)}`, sigBoxX + 1.8, sigBoxY + 6.1);
    doc.text(`Date: ${stampDt}`, sigBoxX + 1.8, sigBoxY + 9.0);
    doc.text(`Location: ${profile.state || 'India'}`, sigBoxX + 1.8, sigBoxY + 11.8);

    if (showSignatoryText) {
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      doc.text(ps.signatureName || 'Authorised Signatory', rightX, sigBoxY + sigBoxH + 3.8, { align: 'right' });
    }
  };

  // Helper: Draw UPI QR Code
  const drawUpiQr = async (x, yPos, size = 15) => {
    const upiId = acct.upiId || profile.upiId;
    const grandTotal = Number(totals.total) || 0;
    if (!QRCodeMod || !showUPI || ps.showUPI === false || !upiId || grandTotal <= 0 || isDeliveryChallan) return false;
    try {
      const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(profile.businessName || '')}&am=${grandTotal.toFixed(2)}&cu=INR`;
      const qrUrl = await QRCodeMod.toDataURL(upiUri, { errorCorrectionLevel: 'M', margin: 0, width: 180 });
      doc.addImage(qrUrl, 'PNG', x, yPos, size, size);
      doc.setFont(fontFam, 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(51, 65, 85);
      doc.text(`UPI: ${upiId}`, x + size + 2, yPos + 5);
      doc.text(`Scan to pay (${curSym} ${fmtAmt(grandTotal)})`, x + size + 2, yPos + 9);
      return true;
    } catch { return false; }
  };

  const validItems = (items || []).filter(it => (it.name || '').trim() || (Number(it.quantity) || 0) * (Number(it.rate) || 0) > 0);
  const subTotal = Number(totals.subtotal ?? totals.subTotal) || 0;
  const cgst = Number(totals.cgst) || 0;
  const sgst = Number(totals.sgst) || 0;
  const igst = Number(totals.igst) || 0;
  const cess = Number(totals.cess) || 0;
  const roundOff = Number(totals.roundOff) || 0;
  const grandTotal = Number(totals.total) || 0;

  let y = marginTop;

  // ==========================================================================
  // TEMPLATE 1: SAI DURGA & BOXED GRID (Matches InvoicePreview Sai Durga / Boxed)
  // ==========================================================================
  if (style === 'saidurga' || style === 'boxed') {
    const borderW = style === 'boxed' ? 0.45 : 0.35;

    // 1. Centered Company + Document Banner Box
    let bannerH = 9;
    let logoOffset = 0;
    if (showLogo && profile.logo && String(profile.logo).startsWith('data:image/')) {
      bannerH = 14;
      logoOffset = 18;
    }
    if (showBusinessName) bannerH += 5;

    setStroke(borderW);
    if (style === 'boxed') {
      doc.setFillColor(...headerBgRgb);
      doc.rect(marginX, y, boxW, bannerH, 'FD');
    } else {
      doc.rect(marginX, y, boxW, bannerH);
    }

    let by = y + 5.5;
    if (logoOffset > 0) {
      try {
        const fmt = String(profile.logo).includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(profile.logo, fmt, marginX + 3, y + 2, 16, 11);
      } catch { /* skip */ }
    }
    if (showBusinessName) {
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(13.5);
      doc.setTextColor(...(style === 'boxed' ? accentRgb : [15, 23, 42]));
      doc.text(String(profile.businessName || 'SAI DURGA'), pageW / 2, by, { align: 'center' });
      by += 5.5;
    }
    doc.setFont(fontFam, 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...(invoiceType === 'credit-note' ? [185, 28, 28] : accentRgb));
    doc.text(docTitle, pageW / 2, by, { align: 'center' });
    doc.setTextColor(15, 23, 42);
    y += bannerH;

    // 2. Seller (Left 55%) + Invoice Meta (Right 45%)
    const metaStart = y;
    const splitX = marginX + boxW * 0.55;
    let sy = y + 4.2;
    const sx = marginX + 2.5;
    const sMaxW = boxW * 0.55 - 5;

    if (showBusinessName) {
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(9);
      doc.text(`M/s ${profile.businessName || ''}`, sx, sy);
      sy += 3.8;
    }
    doc.setFont(fontFam, 'normal');
    doc.setFontSize(7.8);
    if (showBusinessAddress) {
      const sAddr = [profile.address, [profile.city, profile.state, profile.pin].filter(Boolean).join(', ')].filter(Boolean).join(', ');
      if (sAddr) {
        const lines = doc.splitTextToSize(sAddr, sMaxW);
        doc.text(lines, sx, sy);
        sy += lines.length * 3.5;
      }
    }
    if (showGSTIN && profile.gstin) {
      doc.setFont(fontFam, 'bold');
      doc.text(`GSTIN: ${profile.gstin}`, sx, sy);
      sy += 3.5;
      doc.setFont(fontFam, 'normal');
    }
    if (profile.pan && isIndia) { doc.text(`PAN: ${profile.pan}`, sx, sy); sy += 3.5; }
    const sContact = [
      showBusinessPhone && profile.phone ? `Mobile: ${profile.phone}` : '',
      showBusinessEmail && profile.email ? `E-Mail: ${profile.email}` : '',
    ].filter(Boolean).join(' | ');
    if (sContact) { doc.text(sContact, sx, sy); sy += 3.5; }

    // Right side metadata rows
    const metaItems = [];
    if (showInvoiceDate && details.invoiceDate) metaItems.push(['Date:', formatDate(details.invoiceDate, ps)]);
    if (showInvoiceNumber && details.invoiceNumber) metaItems.push([invoiceType.includes('credit') ? 'No:' : 'Invoice No:', details.invoiceNumber]);
    if (showDueDate && details.dueDate) metaItems.push(['Due Date:', formatDate(details.dueDate, ps)]);
    if (details.periodStart || details.periodEnd) metaItems.push(['Bill Period:', `${details.periodStart || '—'} to ${details.periodEnd || '—'}`]);
    if (details.workOrderNo || details.orderNo) metaItems.push(['Order No:', details.workOrderNo || details.orderNo]);
    if (isIndia && showGST && (invoiceType === 'tax-invoice' || invoiceType === 'credit-note')) {
      metaItems.push(['Reverse Charge:', invoiceOptions.reverseCharge ? 'Yes' : 'No']);
    }
    if (metaItems.length === 0) metaItems.push(['Date:', formatDate(details.invoiceDate, ps)]);

    const mRowH = 5.4;
    const metaBoxH = Math.max(sy - metaStart + 2, metaItems.length * mRowH);
    const actualMRowH = metaBoxH / metaItems.length;

    setStroke(borderW);
    doc.rect(marginX, metaStart, boxW, metaBoxH);
    doc.line(splitX, metaStart, splitX, metaStart + metaBoxH);

    metaItems.forEach(([k, v], idx) => {
      const ry = metaStart + idx * actualMRowH;
      if (idx > 0) doc.line(splitX, ry, marginX + boxW, ry);
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(7.8);
      doc.text(k, splitX + 2.5, ry + actualMRowH * 0.68);
      doc.setFont(fontFam, idx <= 1 ? 'bold' : 'normal');
      doc.text(String(v || ''), splitX + 26, ry + actualMRowH * 0.68);
    });
    y = metaStart + metaBoxH;

    // 3. Billing To (Left 50%) & Shipping To (Right 50%)
    const partyStart = y;
    const pMidX = marginX + boxW * 0.50;
    const pColW = boxW * 0.50 - 5;

    setStroke(borderW);
    doc.setFillColor(...headerBgRgb);
    doc.rect(marginX, partyStart, boxW * 0.50, 5.5, 'FD');
    doc.rect(pMidX, partyStart, boxW * 0.50, 5.5, 'FD');
    doc.setFont(fontFam, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...accentRgb);
    doc.text(`${getLabel(ps, 'billTo') || 'Billing To'}:`, marginX + 2.5, partyStart + 3.8);
    doc.text(`${getLabel(ps, 'shipTo') || 'Shipping To'}:`, pMidX + 2.5, partyStart + 3.8);
    doc.setTextColor(15, 23, 42);

    let bY = partyStart + 9.2;
    doc.setFont(fontFam, 'bold');
    doc.setFontSize(8.8);
    doc.text(String(client.name || '—'), marginX + 2.5, bY);
    bY += 3.8;
    doc.setFont(fontFam, 'normal');
    doc.setFontSize(7.8);
    if (showClientAddress) {
      const bAddr = [client.address, [client.city, client.pin].filter(Boolean).join(' - ')].filter(Boolean).join(', ');
      if (bAddr) {
        const lines = doc.splitTextToSize(bAddr, pColW);
        doc.text(lines, marginX + 2.5, bY);
        bY += lines.length * 3.5;
      }
    }
    if (showState && client.state) {
      const bCode = stateCodeOf(client.state, client.gstin);
      doc.text(`State: ${client.state}${bCode ? `, Code: ${bCode}` : ''}`, marginX + 2.5, bY);
      bY += 3.5;
    }
    if (showGSTIN && client.gstin) {
      doc.setFont(fontFam, 'bold');
      doc.text(`GSTIN: ${client.gstin}`, marginX + 2.5, bY);
      bY += 3.5;
      doc.setFont(fontFam, 'normal');
    }
    if (showClientPhone && client.phone) { doc.text(`Mobile: ${client.phone}`, marginX + 2.5, bY); bY += 3.5; }
    if (showClientEmail && client.email) { doc.text(`E-Mail: ${client.email}`, marginX + 2.5, bY); bY += 3.5; }

    // Shipping To column
    let shY = partyStart + 9.2;
    const shipDiff = details.shipToSameAsBilling === false && (details.shippingAddress || details.shippingCity || details.shippingState);
    doc.setFont(fontFam, 'bold');
    doc.setFontSize(8.8);
    doc.text(String(shipDiff ? (details.shippingName || client.name || '—') : (client.name || '—')), pMidX + 2.5, shY);
    shY += 3.8;
    doc.setFont(fontFam, 'normal');
    doc.setFontSize(7.8);
    if (shipDiff) {
      const shAddr = [details.shippingAddress, [details.shippingCity, details.shippingPin].filter(Boolean).join(' - ')].filter(Boolean).join(', ');
      if (shAddr) {
        const lines = doc.splitTextToSize(shAddr, pColW);
        doc.text(lines, pMidX + 2.5, shY);
        shY += lines.length * 3.5;
      }
      if (details.shippingState) { doc.text(`State: ${details.shippingState}`, pMidX + 2.5, shY); shY += 3.5; }
    } else if (showClientAddress) {
      const bAddr = [client.address, [client.city, client.pin].filter(Boolean).join(' - ')].filter(Boolean).join(', ');
      if (bAddr) {
        const lines = doc.splitTextToSize(bAddr, pColW);
        doc.text(lines, pMidX + 2.5, shY);
        shY += lines.length * 3.5;
      }
      if (showState && client.state) { doc.text(`State: ${client.state}`, pMidX + 2.5, shY); shY += 3.5; }
    }
    if (showPlaceOfSupply) {
      const pos = details.placeOfSupply || client.state || '—';
      const pCode = stateCodeOf(pos, client.gstin);
      doc.setFont(fontFam, 'bold');
      doc.text(`Place of Supply: ${pos}${pCode ? ` (Code: ${pCode})` : ''}`, pMidX + 2.5, shY);
      shY += 3.5;
      doc.setFont(fontFam, 'normal');
    }

    const partyBoxH = Math.max(bY - partyStart + 2, shY - partyStart + 2, 22);
    setStroke(borderW);
    doc.rect(marginX, partyStart, boxW, partyBoxH);
    doc.line(pMidX, partyStart, pMidX, partyStart + partyBoxH);
    y = partyStart + partyBoxH;

    // Work Details bar (if filled)
    if (details.workDetails) {
      const wdLines = doc.splitTextToSize(`Work Details: ${details.workDetails}`, boxW - 5);
      const wdH = Math.max(6.5, wdLines.length * 3.6 + 2.5);
      setStroke(borderW);
      doc.rect(marginX, y, boxW, wdH);
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(7.8);
      doc.text(wdLines, marginX + 2.5, y + 4.2);
      y += wdH;
    }

    // 4. Itemized GST Table (Dynamically respects Customize toggles!)
    const cols = [{ key: 'sno', label: '#', w: 8, align: 'center' }];
    cols.push({ key: 'desc', label: 'Description of Goods / Services', w: 54, align: 'left' });
    if (showHSN) cols.push({ key: 'hsn', label: 'HSN/SAC', w: 17, align: 'center' });
    if (showItemQty) cols.push({ key: 'qty', label: 'Qty', w: 16, align: 'center' });
    if (showRateColumn) cols.push({ key: 'rate', label: 'Rate', w: 20, align: 'right' });
    if (showAmountCol) cols.push({ key: 'taxable', label: 'Taxable', w: 21, align: 'right' });
    if (showGST && isIndia && !isInterstate) {
      cols.push({ key: 'cgstPct', label: 'CGST%', w: 12, align: 'center' });
      cols.push({ key: 'cgstAmt', label: 'CGST', w: 16, align: 'right' });
      cols.push({ key: 'sgstPct', label: 'SGST%', w: 12, align: 'center' });
      cols.push({ key: 'sgstAmt', label: 'SGST', w: 16, align: 'right' });
    } else if (showGST) {
      cols.push({ key: 'igstPct', label: isIndia ? 'IGST%' : 'Tax%', w: 13, align: 'center' });
      cols.push({ key: 'igstAmt', label: isIndia ? 'IGST Amt' : 'Tax Amt', w: 19, align: 'right' });
    }
    if (showAmountCol) cols.push({ key: 'total', label: 'Amount', w: 22, align: 'right' });

    const sumW = cols.reduce((s, c) => s + c.w, 0);
    cols.forEach(c => { c.w = (c.w / sumW) * boxW; });

    const drawHeader = (startY) => {
      const hH = 7;
      setStroke(borderW);
      doc.setFillColor(...headerBgRgb);
      doc.rect(marginX, startY, boxW, hH, 'FD');
      let cx = marginX;
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(...accentRgb);
      cols.forEach((c, idx) => {
        if (idx > 0) doc.line(cx, startY, cx, startY + hH);
        const tx = c.align === 'right' ? cx + c.w - 1.2 : (c.align === 'center' ? cx + c.w / 2 : cx + 1.5);
        doc.text(c.label, tx, startY + 4.6, { align: c.align });
        cx += c.w;
      });
      doc.setTextColor(15, 23, 42);
      return startY + hH;
    };

    y = drawHeader(y);
    let tblStart = y;

    validItems.forEach((item, idx) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const lineAmt = qty * rate;
      const taxRate = Number(item.taxPercent) || 0;
      const isTaxInc = totals.taxInclusive;
      const taxable = isTaxInc && showGST ? lineAmt / (1 + taxRate / 100) : lineAmt;
      const taxAmt = isTaxInc && showGST ? lineAmt - taxable : taxable * taxRate / 100;
      const lineTot = taxable + (showGST ? taxAmt : 0);

      const descCol = cols.find(c => c.key === 'desc');
      const fullDesc = item.description ? `${item.name || ''}\n${item.description}` : String(item.name || '');
      const descLines = doc.splitTextToSize(fullDesc, descCol.w - 2.5);
      const rH = Math.max(6.2, descLines.length * 3.5 + 2.4);

      if (y + rH > pageH - marginBottom - 62) {
        setStroke(borderW);
        doc.rect(marginX, tblStart, boxW, y - tblStart);
        let vx = marginX;
        cols.forEach((c, i) => { if (i > 0) doc.line(vx, tblStart, vx, y); vx += c.w; });
        doc.addPage();
        y = marginTop + 5;
        y = drawHeader(y);
        tblStart = y;
      }

      const cellMap = {
        sno: String(idx + 1),
        desc: descLines,
        hsn: String(item.hsn || '-'),
        qty: `${qty}${showItemUnit && item.unit ? ` ${item.unit}` : ''}`,
        rate: fmtAmt(rate),
        taxable: fmtAmt(taxable),
        cgstPct: `${taxRate / 2}%`,
        cgstAmt: fmtAmt(taxAmt / 2),
        sgstPct: `${taxRate / 2}%`,
        sgstAmt: fmtAmt(taxAmt / 2),
        igstPct: `${taxRate}%`,
        igstAmt: fmtAmt(taxAmt),
        total: fmtAmt(lineTot),
      };

      let cx = marginX;
      setStroke(0.2);
      doc.line(marginX, y + rH, marginX + boxW, y + rH);
      cols.forEach((c) => {
        doc.setFont(fontFam, c.key === 'total' ? 'bold' : 'normal');
        doc.setFontSize(7.4);
        const tx = c.align === 'right' ? cx + c.w - 1.2 : (c.align === 'center' ? cx + c.w / 2 : cx + 1.5);
        doc.text(cellMap[c.key] ?? '', tx, y + 4.1, { align: c.align });
        cx += c.w;
      });
      y += rH;
    });

    // Empty filler rows for 'boxed' pad style
    if (style === 'boxed' && validItems.length < 4) {
      const fillCount = 4 - validItems.length;
      for (let f = 0; f < fillCount; f++) {
        setStroke(0.2);
        doc.line(marginX, y + 6, marginX + boxW, y + 6);
        y += 6;
      }
    }

    setStroke(borderW);
    doc.rect(marginX, tblStart, boxW, y - tblStart);
    let vx = marginX;
    cols.forEach((c, i) => { if (i > 0) doc.line(vx, tblStart, vx, y); vx += c.w; });

    // 5. Totals + Amount in Words Box
    const totStart = y;
    const tSplitX = marginX + boxW * 0.58;
    const tRows = [];
    if (showSubtotal && showAmountCol) tRows.push(['Taxable Value', fmtAmt(subTotal), false]);
    if (showGST && isIndia && isInterstate) {
      tRows.push(['IGST', `${curSym} ${fmtAmt(igst)}`, false]);
    } else if (showGST && isIndia) {
      tRows.push(['CGST', `${curSym} ${fmtAmt(cgst)}`, false]);
      tRows.push(['SGST', `${curSym} ${fmtAmt(sgst)}`, false]);
    } else if (showGST) {
      tRows.push(['Tax', `${curSym} ${fmtAmt(cgst + sgst + igst)}`, false]);
    }
    if (cess > 0) tRows.push(['GST Cess', `${curSym} ${fmtAmt(cess)}`, false]);
    if (showRoundOff && Math.abs(roundOff) >= 0.005) tRows.push(['Round Off', `${curSym} ${fmtAmt(roundOff)}`, false]);
    if (showAmountCol) tRows.push([invoiceType === 'credit-note' ? 'Credit Amount' : 'Grand Total', `${curSym} ${fmtAmt(grandTotal)}`, true]);
    if (tRows.length === 0) tRows.push(['Status', '— End of list —', true]);

    const wordsLines = showAmountWords ? doc.splitTextToSize(wordsOf(grandTotal), boxW * 0.58 - 5) : [];
    const leftTotH = (showAmountWords ? (wordsLines.length * 3.8 + 8) : 6) + (showUPI && !isDeliveryChallan ? 18 : 0);
    const rightTotH = tRows.length * 5.8;
    const totBoxH = Math.max(leftTotH, rightTotH, 16);
    const tStep = totBoxH / tRows.length;

    setStroke(borderW);
    doc.rect(marginX, totStart, boxW, totBoxH);
    doc.line(tSplitX, totStart, tSplitX, totStart + totBoxH);

    if (showAmountWords) {
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(7.5);
      doc.text(`${getLabel(ps, 'amountInWords') || 'Amount in Words'}:`, marginX + 2.5, totStart + 4);
      doc.setFont(fontFam, 'italic');
      doc.setFontSize(7.8);
      doc.text(wordsLines, marginX + 2.5, totStart + 8);
    }

    if (showUPI && !isDeliveryChallan) {
      await drawUpiQr(marginX + 2.5, totStart + totBoxH - 16.5, 14.5);
    }

    tRows.forEach(([lbl, val, isBold], idx) => {
      const ry = totStart + idx * tStep;
      if (idx > 0) doc.line(tSplitX, ry, marginX + boxW, ry);
      if (isBold) {
        doc.setFillColor(...headerBgRgb);
        doc.rect(tSplitX, ry, boxW * 0.42, tStep, 'F');
        doc.rect(tSplitX, ry, boxW * 0.42, tStep, 'S');
      }
      doc.setFont(fontFam, isBold ? 'bold' : 'normal');
      doc.setFontSize(isBold ? 8.5 : 7.8);
      doc.setTextColor(isBold ? accentRgb[0] : 15, isBold ? accentRgb[1] : 23, isBold ? accentRgb[2] : 42);
      doc.text(lbl, tSplitX + 2.5, ry + tStep * 0.68);
      doc.text(val, marginX + boxW - 2, ry + tStep * 0.68, { align: 'right' });
    });
    doc.setTextColor(15, 23, 42);
    y = totStart + totBoxH;

    // 6. Bank Details Box (if enabled)
    if (showBankDetails && ps.showBankDetails !== false && (acct.bankName || profile.bankName)) {
      const bStart = y;
      const bLines = [];
      if (showAccountLabel && acct.label) bLines.push(`Pay via: ${acct.label}`);
      bLines.push(`A/C Name: ${acct.accountHolderName || profile.businessName || ''}`);
      bLines.push(`Bank: ${acct.bankName || profile.bankName || ''}  ·  A/C No: ${acct.accountNumber || profile.accountNumber || ''}`);
      const ifscStr = [
        (acct.ifsc || profile.ifsc) ? `IFSC: ${acct.ifsc || profile.ifsc}` : '',
        (profile.pan && isIndia) ? `PAN: ${profile.pan}` : '',
      ].filter(Boolean).join('  ·  ');
      if (ifscStr) bLines.push(ifscStr);

      const bBoxH = bLines.length * 3.6 + 6.5;
      setStroke(borderW);
      doc.rect(marginX, bStart, boxW, bBoxH);
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(7.6);
      doc.setTextColor(...accentRgb);
      doc.text(getLabel(ps, 'bankDetails') || 'Bank Details', marginX + 2.5, bStart + 4);
      doc.setFont(fontFam, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      bLines.forEach((ln, i) => doc.text(ln, marginX + 2.5, bStart + 7.8 + i * 3.6));
      y = bStart + bBoxH;
    }

    // 7. Terms, Notes, Declaration & Signature Box
    const termsPlain = showTerms ? stripHtml(customTerms) : '';
    const notesPlain = showNotes ? stripHtml(customNotes) : '';
    const fStart = y;
    const fSplitX = marginX + boxW * 0.62;
    const fLeftW = boxW * 0.62 - 5;

    const leftLines = [];
    if (termsPlain) {
      leftLines.push({ bold: true, text: `${getLabel(ps, 'terms') || 'Terms & Conditions'}:` });
      doc.splitTextToSize(termsPlain, fLeftW).forEach(l => leftLines.push({ bold: false, text: l }));
    }
    if (notesPlain) {
      leftLines.push({ bold: true, text: `${getLabel(ps, 'notes') || 'Notes'}:` });
      doc.splitTextToSize(notesPlain, fLeftW).forEach(l => leftLines.push({ bold: false, text: l }));
    }
    if (isIndia && showGST) {
      leftLines.push({ bold: true, text: 'Declaration:' });
      doc.splitTextToSize('Certified that the particulars given above are true and correct and the amount indicated represents the price actually charged.', fLeftW)
        .forEach(l => leftLines.push({ bold: false, text: l }));
    }

    const leftH = Math.max(36, leftLines.length * 3.4 + 10);
    const fBoxH = Math.max(leftH, 36);

    if (y + fBoxH > pageH - marginBottom - 6) {
      doc.addPage();
      y = marginTop + 5;
    }

    const actualFStart = y;
    setStroke(borderW);
    doc.rect(marginX, actualFStart, boxW, fBoxH);
    doc.line(fSplitX, actualFStart, fSplitX, actualFStart + fBoxH);

    let lyPos = actualFStart + 4;
    leftLines.forEach(item => {
      doc.setFont(fontFam, item.bold ? 'bold' : 'normal');
      doc.setFontSize(item.bold ? 7.4 : 6.9);
      doc.setTextColor(item.bold ? accentRgb[0] : 51, item.bold ? accentRgb[1] : 65, item.bold ? accentRgb[2] : 85);
      doc.text(item.text, marginX + 2.5, lyPos);
      lyPos += 3.4;
    });

    if (shaHex) {
      doc.setFont(fontFam, 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(100, 116, 139);
      doc.text(`SHA-256: ${shaHex}`, marginX + 2.5, actualFStart + fBoxH - 2);
    }

    drawSignatureBlock(marginX + boxW - 2.5, actualFStart, fBoxH);
    y = actualFStart + fBoxH + 3.5;

    doc.setFont(fontFam, 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Not a certificate-based digital signature. This is a Computer Generated ${typeConfig.label || 'Document'}.`, pageW / 2, y, { align: 'center' });

  } else {
    // ==========================================================================
    // TEMPLATE 2: TALLY / CLASSIC / MODERN / MINIMAL
    // ==========================================================================
    const isModern = style === 'modern';
    const isMinimal = style === 'minimal';
    const isClassic = style === 'classic';

    if (isModern) {
      doc.setFillColor(...accentRgb);
      doc.rect(marginX, y, boxW, 20, 'F');
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text(docTitle, marginX + 4, y + 9);
      if (showBusinessName) {
        doc.setFontSize(10.5);
        doc.text(String(profile.businessName || ''), marginX + boxW - 4, y + 7, { align: 'right' });
      }
      doc.setFont(fontFam, 'normal');
      doc.setFontSize(7.5);
      const sSub = [
        showBusinessAddress ? [profile.address, profile.city, profile.pin].filter(Boolean).join(', ') : '',
        showGSTIN && profile.gstin ? `GSTIN: ${profile.gstin}` : '',
      ].filter(Boolean);
      sSub.forEach((ln, i) => doc.text(ln, marginX + boxW - 4, y + 11.5 + i * 3.6, { align: 'right' }));
      y += 22;
    } else if (isClassic) {
      doc.setFillColor(...accentRgb);
      doc.rect(marginX, y, boxW, 2, 'F');
      y += 4;
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...accentRgb);
      doc.text(docTitle, marginX, y + 4);
      if (showBusinessName) {
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        doc.text(String(profile.businessName || ''), marginX + boxW, y + 4, { align: 'right' });
      }
      y += 7;
      doc.setFont(fontFam, 'normal');
      doc.setFontSize(7.8);
      if (showInvoiceNumber) { doc.text(`No: ${details.invoiceNumber || ''}`, marginX, y + 3); }
      if (showInvoiceDate) { doc.text(`Date: ${formatDate(details.invoiceDate, ps)}`, marginX, y + 7); }
      if (showBusinessAddress) {
        doc.text([profile.address, profile.city, profile.state, profile.pin].filter(Boolean).join(', '), marginX + boxW, y + 3, { align: 'right' });
      }
      if (showGSTIN && profile.gstin) {
        doc.text(`GSTIN: ${profile.gstin}`, marginX + boxW, y + 7, { align: 'right' });
      }
      y += 11;
      doc.setDrawColor(...accentRgb);
      doc.setLineWidth(0.35);
      doc.line(marginX, y, marginX + boxW, y);
      y += 3;
    } else if (isMinimal) {
      if (showBusinessName) {
        doc.setFont(fontFam, 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        doc.text(String(profile.businessName || ''), marginX, y + 4);
      }
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...accentRgb);
      doc.text(docTitle, marginX + boxW, y + 4, { align: 'right' });
      y += 7;
      doc.setFont(fontFam, 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(71, 85, 105);
      if (showBusinessAddress) doc.text([profile.address, profile.city, profile.pin].filter(Boolean).join(', '), marginX, y + 3);
      if (showInvoiceNumber) doc.text(`${details.invoiceNumber || ''} · ${formatDate(details.invoiceDate, ps)}`, marginX + boxW, y + 3, { align: 'right' });
      y += 6;
      doc.setDrawColor(...accentRgb);
      doc.setLineWidth(0.4);
      doc.line(marginX, y, marginX + boxW, y);
      y += 4;
    } else {
      // TALLY ruled-grid style
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(...accentRgb);
      doc.text(docTitle, pageW / 2, y + 4, { align: 'center' });
      y += 6.5;

      const tStart = y;
      const midX = marginX + boxW * 0.52;
      let ly = y + 4.5;
      if (showBusinessName) {
        doc.setFont(fontFam, 'bold'); doc.setFontSize(10); doc.setTextColor(15, 23, 42);
        doc.text(String(profile.businessName || ''), marginX + 2.5, ly);
        ly += 4.5;
      }
      doc.setFont(fontFam, 'normal'); doc.setFontSize(7.8);
      if (showBusinessAddress) {
        const lines = doc.splitTextToSize([profile.address, profile.city, profile.pin].filter(Boolean).join(', '), boxW * 0.52 - 5);
        doc.text(lines, marginX + 2.5, ly);
        ly += lines.length * 3.5;
      }
      if (showGSTIN && profile.gstin) { doc.setFont(fontFam, 'bold'); doc.text(`GSTIN/UIN: ${profile.gstin}`, marginX + 2.5, ly); ly += 3.5; doc.setFont(fontFam, 'normal'); }
      if (showState && profile.state) { doc.text(`State Name: ${profile.state}`, marginX + 2.5, ly); ly += 3.5; }

      const divY = ly + 1;
      ly = divY + 4;
      doc.setFont(fontFam, 'bold'); doc.setFontSize(7.5); doc.setTextColor(...accentRgb);
      doc.text(getLabel(ps, 'billTo') || 'Buyer (Bill to)', marginX + 2.5, ly);
      ly += 3.8;
      doc.setFont(fontFam, 'bold'); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
      doc.text(String(client.name || ''), marginX + 2.5, ly);
      ly += 4;
      doc.setFont(fontFam, 'normal'); doc.setFontSize(7.8);
      if (showClientAddress) {
        const bLines = doc.splitTextToSize([client.address, client.city, client.pin].filter(Boolean).join(', '), boxW * 0.52 - 5);
        doc.text(bLines, marginX + 2.5, ly);
        ly += bLines.length * 3.5;
      }
      if (showGSTIN && client.gstin) { doc.setFont(fontFam, 'bold'); doc.text(`GSTIN/UIN: ${client.gstin}`, marginX + 2.5, ly); ly += 3.5; doc.setFont(fontFam, 'normal'); }

      const rRows = [
        ['Invoice No.', showInvoiceNumber ? (details.invoiceNumber || '') : ''],
        ['Dated', showInvoiceDate ? formatDate(details.invoiceDate, ps) : ''],
        ['Order / Ref No.', details.workOrderNo || details.referenceNo || ''],
        ['Due Date', showDueDate && details.dueDate ? formatDate(details.dueDate, ps) : ''],
        ['Place of Supply', showPlaceOfSupply ? (details.placeOfSupply || client.state || '') : ''],
      ];
      const topH = Math.max(ly - tStart + 2, rRows.length * 8.5);
      const rStep = topH / rRows.length;
      setStroke(0.28);
      doc.rect(marginX, tStart, boxW, topH);
      doc.line(midX, tStart, midX, tStart + topH);
      doc.line(marginX, divY, midX, divY);
      rRows.forEach(([k, v], idx) => {
        const ry = tStart + idx * rStep;
        if (idx > 0) doc.line(midX, ry, marginX + boxW, ry);
        doc.setFont(fontFam, 'normal'); doc.setFontSize(7); doc.setTextColor(71, 85, 105);
        doc.text(k, midX + 2, ry + 3.2);
        doc.setFont(fontFam, 'bold'); doc.setFontSize(8); doc.setTextColor(15, 23, 42);
        doc.text(String(v), midX + 2, ry + 6.8);
      });
      y = tStart + topH;
    }

    // Parties block for Classic / Modern / Minimal
    if (!style.includes('tally')) {
      doc.setFont(fontFam, 'bold'); doc.setFontSize(7.5); doc.setTextColor(...accentRgb);
      doc.text(getLabel(ps, 'billTo') || 'BILL TO', marginX, y + 3.5);
      if (showPlaceOfSupply) doc.text(getLabel(ps, 'placeOfSupply') || 'PLACE OF SUPPLY', marginX + boxW, y + 3.5, { align: 'right' });
      y += 7;
      doc.setFont(fontFam, 'bold'); doc.setFontSize(9.5); doc.setTextColor(15, 23, 42);
      doc.text(String(client.name || ''), marginX, y);
      if (showPlaceOfSupply) doc.text(String(details.placeOfSupply || client.state || '—'), marginX + boxW, y, { align: 'right' });
      y += 4;
      doc.setFont(fontFam, 'normal'); doc.setFontSize(8);
      if (showClientAddress) {
        const bAddr = [client.address, client.city, client.state, client.pin].filter(Boolean).join(', ');
        if (bAddr) { doc.text(bAddr, marginX, y); y += 3.8; }
      }
      if (showGSTIN && client.gstin) { doc.text(`GSTIN: ${client.gstin}`, marginX, y); y += 3.8; }
      y += 3;
    }

    // Items table (Tally / Classic / Modern / Minimal)
    const cols = [{ key: 'sno', label: 'SI', w: 10, align: 'center' }];
    cols.push({ key: 'desc', label: 'Description', w: 80, align: 'left' });
    if (showHSN) cols.push({ key: 'hsn', label: 'HSN/SAC', w: 20, align: 'center' });
    if (showItemQty) cols.push({ key: 'qty', label: 'Qty', w: 22, align: 'right' });
    if (showRateColumn) cols.push({ key: 'rate', label: 'Rate', w: 24, align: 'right' });
    if (showAmountCol) cols.push({ key: 'amt', label: 'Amount', w: 26, align: 'right' });
    const sumW = cols.reduce((s, c) => s + c.w, 0);
    cols.forEach(c => { c.w = (c.w / sumW) * boxW; });

    setStroke(0.28);
    if (isModern) {
      doc.setFillColor(...accentRgb);
      doc.rect(marginX, y, boxW, 7.5, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setFillColor(...headerBgRgb);
      doc.rect(marginX, y, boxW, 7.5, isMinimal ? 'F' : 'FD');
      doc.setTextColor(...accentRgb);
    }
    let cx = marginX;
    doc.setFont(fontFam, 'bold'); doc.setFontSize(7.5);
    cols.forEach((c, i) => {
      if (!isMinimal && !isModern && i > 0) doc.line(cx, y, cx, y + 7.5);
      const tx = c.align === 'right' ? cx + c.w - 1.5 : (c.align === 'center' ? cx + c.w / 2 : cx + 1.5);
      doc.text(c.label, tx, y + 4.8, { align: c.align });
      cx += c.w;
    });
    doc.setTextColor(15, 23, 42);
    y += 7.5;
    const bodyStart = y;

    validItems.forEach((it, idx) => {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.rate) || 0;
      const dCol = cols.find(c => c.key === 'desc');
      const dLines = doc.splitTextToSize(String(it.name || ''), dCol.w - 3);
      const rH = Math.max(6.5, dLines.length * 3.8 + 2.4);
      const map = {
        sno: String(idx + 1),
        desc: dLines,
        hsn: String(it.hsn || ''),
        qty: `${qty}${showItemUnit && it.unit ? ` ${it.unit}` : ''}`,
        rate: fmtAmt(rate),
        amt: fmtAmt(qty * rate),
      };
      let x0 = marginX;
      cols.forEach(c => {
        doc.setFont(fontFam, c.key === 'amt' ? 'bold' : 'normal');
        doc.setFontSize(8);
        const tx = c.align === 'right' ? x0 + c.w - 1.5 : (c.align === 'center' ? x0 + c.w / 2 : x0 + 1.5);
        doc.text(map[c.key] ?? '', tx, y + 4.2, { align: c.align });
        x0 += c.w;
      });
      if (!style.includes('tally')) {
        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, y + rH, marginX + boxW, y + rH);
      }
      y += rH;
    });

    if (style === 'tally') {
      setStroke(0.28);
      doc.rect(marginX, bodyStart, boxW, y - bodyStart);
      let vx = marginX;
      cols.forEach((c, i) => { if (i > 0) doc.line(vx, bodyStart, vx, y); vx += c.w; });
    }

    // Totals
    y += 2;
    const tX = marginX + boxW * 0.58;
    const tRows = [];
    if (showSubtotal && showAmountCol) tRows.push(['Subtotal', fmtAmt(subTotal), false]);
    if (showGST && igst > 0) tRows.push(['IGST', fmtAmt(igst), false]);
    if (showGST && cgst > 0) tRows.push(['CGST', fmtAmt(cgst), false]);
    if (showGST && sgst > 0) tRows.push(['SGST', fmtAmt(sgst), false]);
    if (showRoundOff && Math.abs(roundOff) >= 0.005) tRows.push(['Round Off', fmtAmt(roundOff), false]);
    if (showAmountCol) tRows.push(['Grand Total', `${curSym} ${fmtAmt(grandTotal)}`, true]);

    tRows.forEach(([k, v, bold]) => {
      if (bold) {
        doc.setFillColor(...headerBgRgb);
        doc.rect(tX, y, boxW * 0.42, 7, 'F');
      }
      doc.setFont(fontFam, bold ? 'bold' : 'normal');
      doc.setFontSize(bold ? 9 : 8);
      doc.setTextColor(bold ? accentRgb[0] : 15, bold ? accentRgb[1] : 23, bold ? accentRgb[2] : 42);
      doc.text(k, tX + 2, y + 4.8);
      doc.text(v, marginX + boxW - 2, y + 4.8, { align: 'right' });
      y += bold ? 7.5 : 5.2;
    });
    doc.setTextColor(15, 23, 42);

    if (showAmountWords) {
      doc.setFont(fontFam, 'bold'); doc.setFontSize(7.5);
      doc.text(`${getLabel(ps, 'amountInWords') || 'Amount in Words'}: `, marginX, y + 4);
      doc.setFont(fontFam, 'italic');
      doc.text(wordsOf(grandTotal), marginX + 32, y + 4);
      y += 7;
    }

    // Footer: Bank + Terms + Signature
    const fY = y + 2;
    let lY = fY;
    if (showBankDetails && (acct.bankName || profile.bankName)) {
      doc.setFont(fontFam, 'bold'); doc.setFontSize(7.8); doc.setTextColor(...accentRgb);
      doc.text(getLabel(ps, 'bankDetails') || 'Bank Details', marginX, lY + 3);
      lY += 4.2;
      doc.setFont(fontFam, 'normal'); doc.setFontSize(7.5); doc.setTextColor(15, 23, 42);
      doc.text(`Bank: ${acct.bankName || profile.bankName} · A/C: ${acct.accountNumber || profile.accountNumber || ''} · IFSC: ${acct.ifsc || profile.ifsc || ''}`, marginX, lY + 3);
      lY += 5;
    }
    if (showTerms && stripHtml(customTerms)) {
      doc.setFont(fontFam, 'bold'); doc.setFontSize(7.5); doc.setTextColor(...accentRgb);
      doc.text(getLabel(ps, 'terms') || 'Terms & Conditions', marginX, lY + 3);
      lY += 4;
      doc.setFont(fontFam, 'normal'); doc.setFontSize(7); doc.setTextColor(51, 65, 85);
      const tLines = doc.splitTextToSize(stripHtml(customTerms), boxW * 0.6);
      doc.text(tLines, marginX, lY + 3);
      lY += tLines.length * 3.4 + 3;
    }
    if (showUPI && !isDeliveryChallan) {
      await drawUpiQr(marginX, lY + 1, 14);
      lY += 17;
    }

    drawSignatureBlock(marginX + boxW, fY, Math.max(36, lY - fY));
    y = Math.max(lY, fY + 38) + 4;
    doc.setFont(fontFam, 'normal'); doc.setFontSize(6.5); doc.setTextColor(100, 116, 139);
    doc.text(`Not a certificate-based digital signature. This is a Computer Generated ${typeConfig.label || 'Document'}.`, pageW / 2, y, { align: 'center' });
  }

  // Extra sections on subsequent pages
  for (const sec of (extraSections || [])) {
    const body = stripHtml(sec?.content || '');
    if (!sec?.title && !body) continue;
    doc.addPage();
    let ey = marginTop + 8;
    doc.setFont(fontFam, 'bold'); doc.setFontSize(11); doc.setTextColor(...accentRgb);
    doc.text(String(sec.title || 'Annexure'), marginX, ey);
    ey += 6;
    doc.setFont(fontFam, 'normal'); doc.setFontSize(8.5); doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(body, boxW), marginX, ey);
  }

  // Page-2+ Business Header & Page Numbers
  const totalPages = doc.getNumberOfPages() - startPage + 1;
  for (let p = startPage; p < startPage + totalPages; p++) {
    doc.setPage(p);
    if (p > startPage && ps.pageHeaderEnabled && profile.businessName) {
      doc.setFont(fontFam, 'bold'); doc.setFontSize(8.5); doc.setTextColor(...accentRgb);
      doc.text(`${profile.businessName} — ${docTitle} (${details.invoiceNumber || ''})`, marginX, 6.5);
      doc.setDrawColor(...accentRgb); doc.setLineWidth(0.25);
      doc.line(marginX, 8, pageW - marginX, 8);
    }
    if (ps.pageNumbersEnabled && totalPages > 1) {
      doc.setFont(fontFam, 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
      doc.text(`Page ${p - startPage + 1} of ${totalPages}`, pageW - marginX, pageH - 4, { align: 'right' });
    }
  }

  return doc;
}

// ============================================================================
// Native Vector Purchase Order PDF Builder
// Includes CGST/SGST vs IGST split, invoice-style signature block, and footer SHA-256
// ============================================================================
export async function buildVectorPurchaseOrderPdf({ po = {}, profile = {}, printSettings = null }) {
  const { jsPDF } = await import('jspdf');
  const ps = printSettings || getPrintSettings();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = 210, pageH = 297, marginX = 10, boxW = pageW - marginX * 2;
  const fontFam = ['helvetica', 'times', 'courier'].includes(ps.pdfFontFamily) ? ps.pdfFontFamily : 'helvetica';
  const fmtAmt = (n) => formatNumber(Number(n) || 0, { ...ps, decimalPlaces: 2 });

  const hexToRgb = (hex, fallback = [30, 64, 175]) => {
    const m = String(hex || '').replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : fallback;
  };
  const accentHex = ps.userColorsEnabled ? ps.pdfAccent : '#1e40af';
  const accentRgb = hexToRgb(accentHex, [30, 64, 175]);
  const headerBgRgb = ps.userColorsEnabled ? hexToRgb(ps.pdfHeaderBg, [241, 245, 249]) : [241, 245, 249];

  let y = 10;
  doc.setFillColor(...accentRgb);
  doc.rect(marginX, y, boxW, 2, 'F');
  y += 2.5;
  doc.setFillColor(...headerBgRgb);
  doc.rect(marginX, y, boxW, 8, 'F');
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.28);
  doc.rect(marginX, y, boxW, 8);
  doc.setFont(fontFam, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...accentRgb);
  doc.text('PURCHASE ORDER', pageW / 2, y + 5.5, { align: 'center' });
  y += 8;

  const topStart = y, midX = marginX + boxW * 0.54;
  let ly = y + 4.5;
  doc.setFont(fontFam, 'bold'); doc.setFontSize(10); doc.setTextColor(15, 23, 42);
  doc.text(String(profile.businessName || 'Buyer'), marginX + 2.5, ly);
  ly += 4.2;
  doc.setFont(fontFam, 'normal'); doc.setFontSize(8);
  const bAddr = [profile.address, [profile.city, profile.state, profile.pin].filter(Boolean).join(', ')].filter(Boolean).join(', ');
  if (bAddr) {
    const lines = doc.splitTextToSize(bAddr, boxW * 0.54 - 5);
    doc.text(lines, marginX + 2.5, ly);
    ly += lines.length * 3.6;
  }
  if (profile.gstin) { doc.setFont(fontFam, 'bold'); doc.text(`GSTIN: ${profile.gstin}`, marginX + 2.5, ly); ly += 3.6; doc.setFont(fontFam, 'normal'); }
  if (profile.phone || profile.email) { doc.text([profile.phone, profile.email].filter(Boolean).join(' · '), marginX + 2.5, ly); ly += 3.6; }

  const meta = [
    ['PO Number', po.poNumber || po.id || ''],
    ['PO Date', formatDate(po.date || po.poDate, ps)],
    ['Delivery Date', po.deliveryDate ? formatDate(po.deliveryDate, ps) : '—'],
    ['Status', String(po.status || 'issued').toUpperCase()],
  ];
  const metaH = meta.length * 6.5;
  const topH = Math.max(ly - topStart + 2, metaH);
  doc.rect(marginX, topStart, boxW, topH);
  doc.line(midX, topStart, midX, topStart + topH);
  meta.forEach(([k, v], i) => {
    const ry = topStart + i * 6.5;
    if (i > 0) doc.line(midX, ry, marginX + boxW, ry);
    doc.setFont(fontFam, 'normal'); doc.setFontSize(7.2); doc.setTextColor(71, 85, 105);
    doc.text(k, midX + 2, ry + 4.3);
    doc.setFont(fontFam, 'bold'); doc.setFontSize(8); doc.setTextColor(15, 23, 42);
    doc.text(String(v), marginX + boxW - 2, ry + 4.3, { align: 'right' });
  });
  y = topStart + topH;

  const partyStart = y;
  let sy = y + 4, dy = y + 4;
  doc.setFont(fontFam, 'bold'); doc.setFontSize(7.5); doc.setTextColor(...accentRgb);
  doc.text('SUPPLIER DETAILS (TO)', marginX + 2.5, sy);
  doc.text('DELIVERY DETAILS (SHIP TO)', midX + 2.5, dy);
  sy += 4; dy += 4;
  doc.setFont(fontFam, 'bold'); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
  doc.text(String(po.vendorName || po.supplierName || ''), marginX + 2.5, sy);
  doc.text(String(po.shipToName || profile.businessName || ''), midX + 2.5, dy);
  sy += 4; dy += 4;
  doc.setFont(fontFam, 'normal'); doc.setFontSize(8);
  const sLines = doc.splitTextToSize([po.vendorAddress, po.vendorPhone ? `Phone: ${po.vendorPhone}` : '', po.vendorGstin ? `GSTIN: ${po.vendorGstin}` : ''].filter(Boolean).join('\n'), boxW * 0.54 - 5);
  const dLines = doc.splitTextToSize([po.site ? `Site: ${po.site}` : '', po.deliveryAddress || bAddr].filter(Boolean).join('\n'), boxW * 0.46 - 5);
  doc.text(sLines, marginX + 2.5, sy);
  doc.text(dLines, midX + 2.5, dy);
  const partyH = Math.max(sy + sLines.length * 3.6 - partyStart + 2, dy + dLines.length * 3.6 - partyStart + 2);
  doc.rect(marginX, partyStart, boxW, partyH);
  doc.line(midX, partyStart, midX, partyStart + partyH);
  y = partyStart + partyH;

  if (po.subject) {
    doc.rect(marginX, y, boxW, 6.5);
    doc.setFont(fontFam, 'bold'); doc.setFontSize(8);
    doc.text(`Subject: ${po.subject}`, marginX + 2.5, y + 4.3);
    y += 6.5;
  }

  const cols = [
    { label: 'SL', w: 10, align: 'center' },
    { label: 'DESCRIPTION / MATERIAL', w: 76, align: 'left' },
    { label: 'HSN/SAC', w: 20, align: 'center' },
    { label: 'UNIT', w: 14, align: 'center' },
    { label: 'QTY', w: 16, align: 'right' },
    { label: 'UNIT RATE', w: 26, align: 'right' },
    { label: 'AMOUNT (Rs.)', w: 28, align: 'right' },
  ];
  const sumW = cols.reduce((s, c) => s + c.w, 0);
  cols.forEach(c => { c.w = (c.w / sumW) * boxW; });

  doc.setFillColor(...headerBgRgb);
  doc.rect(marginX, y, boxW, 7.5, 'FD');
  let cx = marginX;
  doc.setFont(fontFam, 'bold'); doc.setFontSize(7.2); doc.setTextColor(...accentRgb);
  cols.forEach((c, idx) => {
    if (idx > 0) doc.line(cx, y, cx, y + 7.5);
    const tx = c.align === 'right' ? cx + c.w - 1.5 : (c.align === 'center' ? cx + c.w / 2 : cx + 1.5);
    doc.text(c.label, tx, y + 4.8, { align: c.align });
    cx += c.w;
  });
  doc.setTextColor(15, 23, 42);
  y += 7.5;
  const bodyStart = y;

  (po.items || []).forEach((it, idx) => {
    const qty = Number(it.quantity ?? it.qty) || 0;
    const rate = Number(it.rate) || 0;
    const amt = Number(it.amount) || qty * rate;
    const dLines = doc.splitTextToSize(String(it.description || it.name || ''), cols[1].w - 3);
    const rH = Math.max(6.5, dLines.length * 3.8 + 2.5);
    const vals = [String(idx + 1), dLines, String(it.hsn || it.sac || ''), String(it.unit || 'Nos'), String(qty), fmtAmt(rate), fmtAmt(amt)];
    let x0 = marginX;
    cols.forEach((c, ci) => {
      doc.setFont(fontFam, ci === 1 || ci === 6 ? 'bold' : 'normal');
      doc.setFontSize(8);
      const tx = c.align === 'right' ? x0 + c.w - 1.5 : (c.align === 'center' ? x0 + c.w / 2 : x0 + 1.5);
      doc.text(vals[ci], tx, y + 4.2, { align: c.align });
      x0 += c.w;
    });
    y += rH;
  });

  doc.rect(marginX, bodyStart, boxW, y - bodyStart);
  cx = marginX;
  cols.forEach((c, idx) => { if (idx > 0) doc.line(cx, bodyStart, cx, y); cx += c.w; });

  const sub = Number(po.subtotal) || (po.items || []).reduce((s, it) => s + (Number(it.quantity ?? it.qty) || 0) * (Number(it.rate) || 0), 0);
  const gst = Number(po.taxAmount ?? po.gstAmount) || 0;
  const grand = Number(po.totalAmount ?? po.grandTotal) || (sub + gst);
  const rate = Number(po.taxRate) || 0;
  const vState = String(po.vendorState || '').trim().toLowerCase();
  const hState = String(profile.state || '').trim().toLowerCase();
  const isSameState = Boolean(vState && hState && vState === hState);

  const totRows = [['Subtotal', fmtAmt(sub), false]];
  if (isSameState && gst > 0) {
    const cgst = +(gst / 2).toFixed(2);
    const sgst = +(gst - cgst).toFixed(2);
    totRows.push([`CGST (${rate / 2}%)`, `Rs. ${fmtAmt(cgst)}`, false]);
    totRows.push([`SGST (${rate / 2}%)`, `Rs. ${fmtAmt(sgst)}`, false]);
  } else {
    totRows.push([`IGST (${rate}%)`, `Rs. ${fmtAmt(gst)}`, false]);
  }
  totRows.push(['Grand Total', `Rs. ${fmtAmt(grand)}`, true]);

  const fStart = y;
  const fLeftW = boxW * 0.58;
  const fMidX = marginX + fLeftW;
  const termsText = po.terms || '1. Please quote PO number on all invoices and delivery challans.\n2. Goods/services subject to inspection and approval.\n3. Payment as per agreed terms.';
  const tLines = doc.splitTextToSize(termsText, fLeftW - 4);
  const rowStep = 6.5;
  const fH = Math.max(totRows.length * rowStep, tLines.length * 3.6 + 8);
  const actualStep = fH / totRows.length;

  doc.rect(marginX, fStart, boxW, fH);
  doc.line(fMidX, fStart, fMidX, fStart + fH);
  doc.setFont(fontFam, 'bold'); doc.setFontSize(7.5); doc.setTextColor(...accentRgb);
  doc.text('Terms & Conditions', marginX + 2, fStart + 4);
  doc.setFont(fontFam, 'normal'); doc.setFontSize(7.2); doc.setTextColor(51, 65, 85);
  doc.text(tLines, marginX + 2, fStart + 8);

  totRows.forEach(([lbl, val, isBold], idx) => {
    const ry = fStart + idx * actualStep;
    if (idx > 0) doc.line(fMidX, ry, marginX + boxW, ry);
    if (isBold) {
      doc.setFillColor(...headerBgRgb);
      doc.rect(fMidX, ry, boxW - fLeftW, actualStep, 'F');
      doc.rect(fMidX, ry, boxW - fLeftW, actualStep, 'S');
    }
    doc.setFont(fontFam, isBold ? 'bold' : 'normal');
    doc.setFontSize(isBold ? 8.5 : 8);
    doc.setTextColor(isBold ? accentRgb[0] : 15, isBold ? accentRgb[1] : 23, isBold ? accentRgb[2] : 42);
    doc.text(lbl, fMidX + 2, ry + actualStep * 0.68);
    doc.text(val, marginX + boxW - 2, ry + actualStep * 0.68, { align: 'right' });
  });
  y = fStart + fH + 5;

  if (ps.signatureShow !== false) {
    doc.setFont(fontFam, 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(15, 23, 42);
    doc.text(`For ${profile.businessName || ''}`, marginX + boxW - 2, y + 3, { align: 'right' });

    if (ps.signatureImage && String(ps.signatureImage).startsWith('data:image/')) {
      try {
        const sFmt = String(ps.signatureImage).includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(ps.signatureImage, sFmt, marginX + boxW - 28, y + 5, 25, 9);
      } catch { /* skip */ }
    }

    const sigBoxW = 48;
    const sigBoxH = 14.5;
    const sigBoxX = marginX + boxW - sigBoxW - 2;
    const sigBoxY = y + 15.5;
    doc.setDrawColor(22, 163, 74);
    doc.setFillColor(240, 253, 244);
    doc.setLineWidth(0.25);
    doc.rect(sigBoxX, sigBoxY, sigBoxW, sigBoxH, 'FD');

    doc.setFont(fontFam, 'bold');
    doc.setFontSize(6.3);
    doc.setTextColor(21, 128, 61);
    doc.text('Signature Valid', sigBoxX + 1.8, sigBoxY + 3.2);

    doc.setFont(fontFam, 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(51, 65, 85);
    const stampDt = new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    doc.text(`Digitally signed by: ${String(profile.businessName || '').slice(0, 24)}`, sigBoxX + 1.8, sigBoxY + 6.3);
    doc.text(`Date: ${stampDt}`, sigBoxX + 1.8, sigBoxY + 9.2);
    doc.text(`Location: ${profile.state || 'India'}`, sigBoxX + 1.8, sigBoxY + 12.0);

    doc.setFont(fontFam, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(ps.signatureName || 'Authorized Signatory', marginX + boxW - 2, sigBoxY + sigBoxH + 4, { align: 'right' });
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageH - 13, pageW - marginX, pageH - 13);

    doc.setFont(fontFam, 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(100, 116, 139);
    doc.text('Not a certificate-based digital signature. This is a Computer Generated Purchase Order.', pageW / 2, pageH - 9.5, { align: 'center' });
    if (po.fingerprint) {
      doc.text(`SHA-256: ${po.fingerprint}`, pageW / 2, pageH - 6, { align: 'center' });
    }
    if (ps.pageNumbersEnabled && totalPages > 1) {
      doc.text(`Page ${p} of ${totalPages}`, pageW - marginX, pageH - 6, { align: 'right' });
    }
  }

  return doc;
}