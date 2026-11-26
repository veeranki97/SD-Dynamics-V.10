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

export async function buildVectorInvoicePdf({ // SD_VECTOR_GRID_V3

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

  // Resolve active template style — each of the 6 UI templates maps to its own layout.
  // Per-invoice Customize (pdfStyle) wins when set; else Print Settings pdfTemplate.
  const invStyle = String(invoiceOptions.pdfStyle || invoiceOptions.pdfTemplate || '').toLowerCase();
  const settingsStyle = String(ps.pdfTemplate || '').toLowerCase();
  const allKnown = ['saidurga', 'tally', 'tally-v2', 'boxed', 'boxed-grid', 'classic', 'modern', 'minimal', 'corporate', 'minimalist'];
  const rawStyle = (allKnown.includes(invStyle) ? invStyle : (allKnown.includes(settingsStyle) ? settingsStyle : 'saidurga')).toLowerCase();
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

  // Always reset stroke colour before any line/rect (jsPDF keeps last drawColour —
  // signature block uses green and used to leave later borders invisible/wrong).
  // PO-style thin rules (was 0.4–0.65 → looked double/thick on invoice)
  const setStroke = (w = 0.28) => {
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(Math.max(0.22, Math.min(0.4, Number(w) || 0.28)));
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
    // Green digital-signature box leaves drawColour green; restore for following borders
    setStroke(0.28);
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
      setStroke(0.28);
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

  const LINE = [30, 41, 59];
  const stroke = (w = 0.28) => { doc.setDrawColor(...LINE); doc.setLineWidth(Math.max(0.22, Math.min(0.35, Number(w) || 0.28))); };
  const cellText = (txt, x, yy, opts = {}) => {
    doc.setFont(fontFam, opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size || 7.6);
    doc.setTextColor(...(opts.color || [15, 23, 42]));
    const o = {};
    if (opts.align) o.align = opts.align;
    doc.text(String(txt ?? ''), x, yy, Object.keys(o).length ? o : undefined);
  };
  const shortDate = (d) => formatDate(d, ps);
  const shipTo = invoiceOptions.shipTo || details.shipTo || null;
  const orderFields = [
    ['deliveryNote', details.deliveryNote],
    ['paymentTerms', details.paymentTerms || details.modeOfPayment],
    ['referenceNo', details.referenceNo || details.reference],
    ['otherReferences', details.otherReferences],
    ['buyerOrderNo', details.buyerOrderNo || details.poNumber],
    ['buyerOrderDate', details.buyerOrderDate || details.poDate],
    ['dispatchDocNo', details.dispatchDocNo],
    ['deliveryNoteDate', details.deliveryNoteDate],
    ['dispatchedThrough', details.dispatchedThrough || details.transporterName],
    ['destination', details.destination],
    ['vehicleNo', details.vehicleNo],
    ['workDetails', details.workDetails],
    ['deliveryTerms', details.deliveryTerms],
    ['periodFrom', details.periodStart || details.periodFrom],
    ['periodTo', details.periodEnd || details.periodTo],
  ].filter(([, v]) => v != null && String(v).trim() !== '');
  const orderMap = Object.fromEntries(orderFields);

  // isInterstate already resolved once at top of buildVectorInvoicePdf (do not redeclare)

  // HSN summary (India GST) — matches InvoiceGridLayout HsnSummaryTable
  const drawHsnSummary = (startY) => {
    if (invoiceOptions.hideHsnSummary === true || !showHSN || !showGST || !isIndia || isDeliveryChallan) return startY;
    const map = {};
    validItems.forEach((it) => {
      const hsn = String(it.hsn || '-');
      const rate = Number(it.taxPercent) || 0;
      const qty = Number(it.quantity) || 0;
      const line = qty * (Number(it.rate) || 0);
      const taxable = totals.taxInclusive ? line / (1 + rate / 100) : line;
      const tax = totals.taxInclusive ? line - taxable : taxable * rate / 100;
      const key = hsn + '|' + rate;
      if (!map[key]) map[key] = { hsn, rate, taxable: 0, tax: 0 };
      map[key].taxable += taxable;
      map[key].tax += tax;
    });
    const rows = Object.values(map);
    if (!rows.length) return startY;
    let yy = startY;
    const colW = isInterstate
      ? [boxW * 0.22, boxW * 0.22, boxW * 0.14, boxW * 0.20, boxW * 0.22]
      : [boxW * 0.18, boxW * 0.18, boxW * 0.10, boxW * 0.14, boxW * 0.10, boxW * 0.14, boxW * 0.16];
    const headers = isInterstate
      ? ['HSN/SAC', 'Taxable Value', 'Rate', 'IGST Amt', 'Total Tax']
      : ['HSN/SAC', 'Taxable Value', 'CGST %', 'CGST Amt', 'SGST %', 'SGST Amt', 'Total Tax'];
    const rh = 6.2;
    stroke(0.28);
    doc.setFillColor(...headerBgRgb);
    doc.rect(marginX, yy, boxW, rh, 'FD');
    let x = marginX;
    headers.forEach((h, i) => {
      if (i > 0) doc.line(x, yy, x, yy + rh);
      cellText(h, x + 1.2, yy + 4.2, { bold: true, size: 6.5 });
      x += colW[i];
    });
    yy += rh;
    const body0 = yy;
    rows.forEach((r) => {
      stroke(0.3);
      doc.line(marginX, yy + rh, marginX + boxW, yy + rh);
      const vals = isInterstate
        ? [r.hsn, fmtAmt(r.taxable), r.rate + '%', fmtAmt(r.tax), fmtAmt(r.tax)]
        : [r.hsn, fmtAmt(r.taxable), (r.rate / 2) + '%', fmtAmt(r.tax / 2), (r.rate / 2) + '%', fmtAmt(r.tax / 2), fmtAmt(r.tax)];
      x = marginX;
      vals.forEach((v, i) => {
        cellText(v, x + 1.2, yy + 4.2, { size: 6.5 });
        x += colW[i];
      });
      yy += rh;
    });
    stroke(0.28);
    doc.rect(marginX, body0 - rh, boxW, yy - (body0 - rh));
    x = marginX;
    colW.forEach((w, i) => { if (i > 0) doc.line(x, body0 - rh, x, yy); x += w; });
    return yy + 2;
  };

  // ==========================================================================

  // Single-edge boxes: avoid double lines where sections stack (shared edge drawn twice).
  // Only internal horizontal rules. Outer left/right/top/bottom drawn once at end.
  const sectionFrame = (x, yy, w, h, { drawTop = false, drawBottom = true } = {}) => {
    stroke(0.28);
    if (drawTop) doc.line(x, yy, x + w, yy);
    if (drawBottom) doc.line(x, yy + h, x + w, yy + h);
  };
  const hRule = (yy, x0 = marginX, x1 = marginX + boxW) => { stroke(0.28); doc.line(x0, yy, x1, yy); };
  const vRule = (xx, y0, y1) => { stroke(0.28); doc.line(xx, y0, xx, y1); };

  // SAIDURGA — traditional Indian tax invoice (GST columns in items table)
  // Matches InvoicePreview saidurga / live preview structure in QUO samples
  // ==========================================================================
  if (style === 'saidurga') {
    const borderW = 0.28;
    stroke(borderW);
    const outerTop = y;

    // Banner
    let bannerH = 14;
    stroke(borderW);
    doc.setFillColor(232, 240, 254);
    doc.rect(marginX, y, boxW, bannerH, 'F'); // fill only — stroke from outer frame
    if (showBusinessName) {
      cellText(profile.businessName || 'Company', pageW / 2, y + 5.5, { bold: true, size: 13, color: accentRgb, align: 'center' });
    }
    cellText(docTitle, pageW / 2, y + 11, { bold: true, size: 10, color: accentRgb, align: 'center' });
    y += bannerH;
    hRule(y); // single line under banner

    // Seller | Meta
    const metaStart = y;
    const splitX = marginX + boxW * 0.58;
    let sy = y + 4;
    const sx = marginX + 2.5;
    if (showBusinessName) { cellText(`M/s ${profile.businessName || ''}`, sx, sy, { bold: true, size: 9 }); sy += 3.6; }
    if (showBusinessAddress) {
      const addr = [profile.address, [profile.city, profile.state, profile.pin].filter(Boolean).join(', ')].filter(Boolean).join(', ');
      const al = doc.splitTextToSize(addr, boxW * 0.55 - 5);
      doc.setFont(fontFam, 'normal'); doc.setFontSize(7.4); doc.setTextColor(15, 23, 42);
      doc.text(al, sx, sy); sy += al.length * 3.3;
    }
    if (showGSTIN && profile.gstin) { cellText(`GSTIN: ${profile.gstin}`, sx, sy, { bold: true, size: 7.4 }); sy += 3.3; }
    if (profile.pan && isIndia) { cellText(`PAN: ${profile.pan}`, sx, sy, { size: 7.4 }); sy += 3.3; }
    if (showBusinessPhone && profile.phone) { cellText(`Mobile: ${profile.phone}`, sx, sy, { size: 7.3 }); sy += 3.2; }
    if (showBusinessEmail && profile.email) { cellText(`E-Mail: ${profile.email}`, sx, sy, { size: 7.3 }); sy += 3.2; }

    const metaRows = [];
    if (showInvoiceDate) metaRows.push(['Date', shortDate(details.invoiceDate)]);
    if (showInvoiceNumber) metaRows.push(['Invoice No', details.invoiceNumber || '']);
    if (showDueDate && details.dueDate) metaRows.push(['Due Date', shortDate(details.dueDate)]);
    if (details.orderNo || details.workOrderNo) metaRows.push(['Order / Ref No', details.orderNo || details.workOrderNo]);
    let my = y;
    metaRows.forEach(([k, v], i) => {
      if (i > 0) { stroke(0.28); doc.line(splitX, my, marginX + boxW, my); }
      cellText(k + ':', splitX + 2, my + 3.2, { bold: true, size: 7 });
      cellText(String(v || ''), splitX + 2, my + 6.8, { size: 8 });
      my += 9;
    });
    const metaH = Math.max(sy - metaStart + 2, my - metaStart, 20);
    sectionFrame(marginX, metaStart, boxW, metaH, { drawTop: false }); // shared top edge skipped
    doc.line(splitX, metaStart, splitX, metaStart + metaH);
    y = metaStart + metaH;

    // BILL TO | SHIP TO
    const partyStart = y;
    const midX = marginX + boxW * 0.5;
    stroke(borderW);
    doc.setFillColor(...headerBgRgb);
    doc.rect(marginX, y, boxW * 0.5, 5, 'F');
    doc.rect(midX, y, boxW * 0.5, 5, 'F');
    cellText('BILL TO:', marginX + 2.5, y + 3.5, { bold: true, size: 7.5, color: accentRgb });
    cellText('SHIP TO:', midX + 2.5, y + 3.5, { bold: true, size: 7.5, color: accentRgb });
    let py = y + 8, qy = y + 8;
    cellText(client.name || '', marginX + 2.5, py, { bold: true, size: 9 }); py += 3.5;
    if (showClientAddress && client.address) {
      const cl = doc.splitTextToSize(String(client.address), boxW * 0.48 - 4);
      doc.setFont(fontFam, 'normal'); doc.setFontSize(7.4); doc.text(cl, marginX + 2.5, py); py += cl.length * 3.2;
    }
    if (client.city || client.pin) { cellText([client.city, client.pin].filter(Boolean).join(' - '), marginX + 2.5, py, { size: 7.4 }); py += 3.2; }
    if (showState && client.state) { cellText(`State: ${client.state}`, marginX + 2.5, py, { size: 7.3 }); py += 3.2; }
    if (showGSTIN && client.gstin) { cellText(`GSTIN: ${client.gstin}`, marginX + 2.5, py, { bold: true, size: 7.3 }); py += 3.2; }

    if (shipTo && (shipTo.name || shipTo.address)) {
      cellText(shipTo.name || client.name || '', midX + 2.5, qy, { bold: true, size: 8.5 }); qy += 3.5;
      if (shipTo.address) {
        const sl = doc.splitTextToSize(String(shipTo.address), boxW * 0.48 - 4);
        doc.setFont(fontFam, 'normal'); doc.setFontSize(7.4); doc.text(sl, midX + 2.5, qy); qy += sl.length * 3.2;
      }
      if (shipTo.state) { cellText(`State: ${shipTo.state}`, midX + 2.5, qy, { size: 7.3 }); qy += 3.2; }
    } else {
      cellText('Same as billing address', midX + 2.5, qy, { size: 7.5 }); qy += 3.5;
    }
    if (showPlaceOfSupply && details.placeOfSupply) {
      cellText(`Place of Supply: ${details.placeOfSupply}`, midX + 2.5, qy, { bold: true, size: 7.3 }); qy += 3.5;
    }
    const partyH = Math.max(py, qy) - partyStart + 2;
    sectionFrame(marginX, partyStart, boxW, partyH, { drawTop: false }); // shared top edge skipped
    doc.line(midX, partyStart, midX, partyStart + partyH);
    y = partyStart + partyH;

    if (orderMap.workDetails) {
      sectionFrame(marginX, y, boxW, 7, { drawTop: false }); // shared top edge skipped
      cellText(`Work Details: ${orderMap.workDetails}`, marginX + 2.5, y + 4.5, { size: 7.8 });
      y += 7;
    }

    // GST item columns (saidurga hallmark)
    const cols = [{ key: 'sno', label: '#', w: 8, align: 'center' }, { key: 'desc', label: 'Description of Goods / Services', w: 48, align: 'left' }];
    if (showHSN) cols.push({ key: 'hsn', label: 'HSN/SAC', w: 16, align: 'center' });
    if (showItemQty) cols.push({ key: 'qty', label: 'Qty', w: 14, align: 'right' });
    if (showRateColumn) cols.push({ key: 'rate', label: 'Rate', w: 16, align: 'right' });
    if (showAmountCol) cols.push({ key: 'taxable', label: 'Taxable', w: 18, align: 'right' });
    if (showGST && showAmountCol) {
      if (isInterstate) {
        cols.push({ key: 'igstPct', label: 'IGST%', w: 12, align: 'center' });
        cols.push({ key: 'igstAmt', label: 'IGST Amt', w: 16, align: 'right' });
      } else {
        cols.push({ key: 'cgstPct', label: 'CGST%', w: 11, align: 'center' });
        cols.push({ key: 'cgstAmt', label: 'CGST', w: 14, align: 'right' });
        cols.push({ key: 'sgstPct', label: 'SGST%', w: 11, align: 'center' });
        cols.push({ key: 'sgstAmt', label: 'SGST', w: 14, align: 'right' });
      }
    }
    if (showAmountCol) cols.push({ key: 'amt', label: 'Amount', w: 18, align: 'right' });
    const sumW = cols.reduce((s, c) => s + c.w, 0);
    cols.forEach(c => { c.w = (c.w / sumW) * boxW; });

    const hH = 7;
    doc.setFillColor(...headerBgRgb);
    doc.rect(marginX, y, boxW, hH, 'F');
    let cx = marginX;
    cols.forEach((c, i) => {
      if (i > 0) doc.line(cx, y, cx, y + hH);
      const tx = c.align === 'right' ? cx + c.w - 1.2 : (c.align === 'center' ? cx + c.w / 2 : cx + 1.2);
      cellText(c.label, tx, y + 4.6, { bold: true, size: 6.5, color: accentRgb, align: c.align });
      cx += c.w;
    });
    y += hH;
    const tblStart = y;

    validItems.forEach((it, idx) => {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.rate) || 0;
      const taxRate = Number(it.taxPercent) || 0;
      const line = qty * rate;
      const taxable = totals.taxInclusive && showGST ? line / (1 + taxRate / 100) : line;
      const taxAmt = totals.taxInclusive && showGST ? line - taxable : taxable * taxRate / 100;
      const lineTot = taxable + (showGST ? taxAmt : 0);
      const dCol = cols.find(c => c.key === 'desc');
      const full = it.description ? `${it.name || ''}\n${it.description}` : String(it.name || '');
      const dLines = doc.splitTextToSize(full, dCol.w - 2.5);
      const rH = Math.max(6.5, dLines.length * 3.4 + 2);
      const map = {
        sno: String(idx + 1), desc: dLines, hsn: String(it.hsn || ''),
        qty: `${qty}${showItemUnit && it.unit ? ` ${it.unit}` : ''}`,
        rate: fmtAmt(rate), taxable: fmtAmt(taxable),
        igstPct: `${taxRate}%`, igstAmt: fmtAmt(taxAmt),
        cgstPct: `${taxRate / 2}%`, cgstAmt: fmtAmt(taxAmt / 2),
        sgstPct: `${taxRate / 2}%`, sgstAmt: fmtAmt(taxAmt / 2),
        amt: fmtAmt(lineTot),
      };
      let x0 = marginX;
      cols.forEach(c => {
        const tx = c.align === 'right' ? x0 + c.w - 1.2 : (c.align === 'center' ? x0 + c.w / 2 : x0 + 1.2);
        cellText(map[c.key] ?? '', tx, y + 4.2, { bold: c.key === 'amt', size: 7, align: c.align });
        x0 += c.w;
      });
      stroke(0.3);
      doc.line(marginX, y + rH, marginX + boxW, y + rH);
      y += rH;
    });
    sectionFrame(marginX, tblStart, boxW, y - tblStart, { drawTop: false }); // shared top edge skipped
    let vx = marginX;
    cols.forEach((c, i) => { if (i > 0) doc.line(vx, tblStart, vx, y); vx += c.w; });

    // Amount words + totals
    const totStart = y;
    const tSplit = marginX + boxW * 0.55;
    const tRows = [];
    if (showSubtotal) tRows.push(['Taxable Value', fmtAmt(subTotal), false]);
    if (showGST && igst > 0) tRows.push(['IGST', fmtAmt(igst), false]);
    if (showGST && cgst > 0) tRows.push(['CGST', fmtAmt(cgst), false]);
    if (showGST && sgst > 0) tRows.push(['SGST', fmtAmt(sgst), false]);
    if (showAmountCol) tRows.push(['Grand Total', `${curSym} ${fmtAmt(grandTotal)}`, true]);
    const wordsLines = showAmountWords ? doc.splitTextToSize(wordsOf(grandTotal), boxW * 0.52 - 4) : [];
    const totH = Math.max((showAmountWords ? wordsLines.length * 3.5 + 8 : 6), tRows.length * 6.2, 14);
    sectionFrame(marginX, totStart, boxW, totH, { drawTop: false }); // shared top edge skipped
    doc.line(tSplit, totStart, tSplit, totStart + totH);
    if (showAmountWords) {
      cellText('AMOUNT IN WORDS:', marginX + 2.5, totStart + 4, { bold: true, size: 7 });
      doc.setFont(fontFam, 'italic'); doc.setFontSize(7.5); doc.setTextColor(15, 23, 42);
      doc.text(wordsLines, marginX + 2.5, totStart + 8);
    }
    const step = totH / Math.max(tRows.length, 1);
    tRows.forEach(([k, v, bold], idx) => {
      const ry = totStart + idx * step;
      if (idx > 0) { stroke(0.3); doc.line(tSplit, ry, marginX + boxW, ry); }
      if (bold) { doc.setFillColor(...headerBgRgb); doc.rect(tSplit, ry, boxW * 0.45, step, 'F'); }
      cellText(k, tSplit + 2, ry + step * 0.65, { bold, size: bold ? 8.2 : 7.4 });
      cellText(v, marginX + boxW - 2, ry + step * 0.65, { bold, size: bold ? 8.2 : 7.4, align: 'right' });
    });
    y = totStart + totH;
    y = drawHsnSummary(y);

    // Bank
    if (showBankDetails && (acct.bankName || profile.bankName)) {
      const bH = 14;
      sectionFrame(marginX, y, boxW, bH, { drawTop: false });
      cellText('BANK DETAILS', marginX + 2.5, y + 4, { bold: true, size: 7.4, color: accentRgb });
      cellText(`A/C Name: ${acct.accountHolderName || profile.businessName || ''}   Bank: ${acct.bankName || profile.bankName || ''}`, marginX + 2.5, y + 8, { size: 7.2 });
      cellText(`A/C No: ${acct.accountNumber || profile.accountNumber || ''}   IFSC: ${acct.ifsc || profile.ifsc || ''}${profile.pan && isIndia ? `   PAN: ${profile.pan}` : ''}`, marginX + 2.5, y + 11.5, { size: 7.2 });
      y += bH;
    }

    // Terms | Signature + customer seal
    const fStart = y;
    const fH = 38;
    sectionFrame(marginX, fStart, boxW, fH, { drawTop: false }); // shared top edge skipped
    doc.line(marginX + boxW * 0.58, fStart, marginX + boxW * 0.58, fStart + fH);
    if (showTerms && stripHtml(customTerms)) {
      cellText('TERMS & CONDITIONS:', marginX + 2.5, fStart + 4, { bold: true, size: 7.2, color: accentRgb });
      const tl = doc.splitTextToSize(stripHtml(customTerms), boxW * 0.55);
      doc.setFont(fontFam, 'normal'); doc.setFontSize(6.5); doc.setTextColor(51, 65, 85);
      doc.text(tl.slice(0, 8), marginX + 2.5, fStart + 8);
    }
    cellText("Customer's Seal and Signature", marginX + 2.5, fStart + fH - 4, { size: 6.8, color: [100, 116, 139] });
    drawSignatureBlock(marginX + boxW - 2, fStart + 2, fH - 4);
    if (showUPI && !isDeliveryChallan) {
      await drawUpiQr(marginX + 2.5, fStart + fH - 18, 12);
    }
    y = fStart + fH + 3;
    y += 2;
    // One outer border only (sections use shared edges — no double lines)
    stroke(0.28);
    doc.rect(marginX, outerTop, boxW, Math.max(4, y - outerTop));
    // Page footer (PO style): thin rule + disclaimer + SHA at bottom of page — not mid-body
    const footY = pageH - Math.max(8, marginBottom);
    setStroke(0.22);
    doc.line(marginX, footY - 5, marginX + boxW, footY - 5);
    cellText(`Not a certificate-based digital signature. This is a Computer Generated ${typeConfig.label || 'Document'}.`, pageW / 2, footY - 2.2, { size: 6.0, color: [100, 116, 139], align: 'center' });
    if (shaHex) cellText(`SHA-256: ${shaHex}`, pageW / 2, footY + 1.2, { size: 5.5, color: [100, 116, 139], align: 'center' });
    // Single section borders only — no second outer frame (was causing double/thick borders)
  }

  // ==========================================================================
  // BOXED — InvoiceGridLayout BoxedLayout columns (UNIT / QTY, filler rows)
  // ==========================================================================
  else if (style === 'boxed') {
    const borderW = 0.28;
    stroke(borderW);
    const outerTop = y;
    let bannerH = 12;
    if (showBusinessName) bannerH += 4;
    doc.setFillColor(...headerBgRgb);
    doc.rect(marginX, y, boxW, bannerH, 'FD');
    if (showBusinessName) cellText(profile.businessName || 'Company', pageW / 2, y + 5.5, { bold: true, size: 14, color: accentRgb, align: 'center' });
    cellText(docTitle, pageW / 2, y + bannerH - 3, { bold: true, size: 10, align: 'center' });
    y += bannerH;

    // Seller | Meta (same structure as before)
    const metaStart = y;
    const splitX = marginX + boxW * 0.55;
    let sy = y + 4;
    if (showBusinessName) { cellText(profile.businessName || '', marginX + 2.5, sy, { bold: true, size: 9 }); sy += 3.5; }
    if (showBusinessAddress) {
      const al = doc.splitTextToSize([profile.address, profile.city, profile.pin].filter(Boolean).join(', '), boxW * 0.52);
      doc.setFont(fontFam, 'normal'); doc.setFontSize(7.4); doc.text(al, marginX + 2.5, sy); sy += al.length * 3.2;
    }
    if (showGSTIN && profile.gstin) { cellText(`GSTIN: ${profile.gstin}`, marginX + 2.5, sy, { bold: true, size: 7.4 }); sy += 3.2; }
    const metaRows = [];
    if (showInvoiceDate) metaRows.push(['Date', shortDate(details.invoiceDate)]);
    if (showInvoiceNumber) metaRows.push([`${typeConfig.label || 'Doc'} No`, details.invoiceNumber || '']);
    if (showDueDate && details.dueDate) metaRows.push(['Due Date', shortDate(details.dueDate)]);
    let my = y;
    metaRows.forEach(([k, v], i) => {
      if (i) { stroke(0.28); doc.line(splitX, my, marginX + boxW, my); }
      cellText(`${k}: ${v}`, splitX + 2, my + 4.5, { size: 7.5 });
      my += 8;
    });
    const metaH = Math.max(sy - metaStart + 2, my - metaStart, 18);
    stroke(borderW); doc.rect(marginX, metaStart, boxW, metaH); doc.line(splitX, metaStart, splitX, metaStart + metaH);
    y = metaStart + metaH;

    // BILL TO | SHIP TO
    const partyStart = y; const midX = marginX + boxW * 0.5;
    stroke(borderW); doc.setFillColor(...headerBgRgb);
    doc.rect(marginX, y, boxW * 0.5, 5, 'FD'); doc.rect(midX, y, boxW * 0.5, 5, 'FD');
    cellText('Billing To:', marginX + 2.5, y + 3.5, { bold: true, size: 7.5, color: accentRgb });
    cellText('Shipping To:', midX + 2.5, y + 3.5, { bold: true, size: 7.5, color: accentRgb });
    let py = y + 8, qy = y + 8;
    cellText(client.name || '', marginX + 2.5, py, { bold: true, size: 9 }); py += 3.5;
    if (showClientAddress && client.address) {
      const cl = doc.splitTextToSize(String(client.address), boxW * 0.48);
      doc.setFont(fontFam, 'normal'); doc.setFontSize(7.4); doc.text(cl, marginX + 2.5, py); py += cl.length * 3.2;
    }
    if (showGSTIN && client.gstin) { cellText(`GSTIN: ${client.gstin}`, marginX + 2.5, py, { bold: true, size: 7.3 }); py += 3.2; }
    cellText(shipTo?.name || 'Same as billing address', midX + 2.5, qy, { size: 8 }); qy += 3.5;
    if (showPlaceOfSupply && details.placeOfSupply) { cellText(`Place of Supply: ${details.placeOfSupply}`, midX + 2.5, qy, { bold: true, size: 7.3 }); qy += 3.5; }
    const partyH = Math.max(py, qy) - partyStart + 2;
    stroke(borderW); doc.rect(marginX, partyStart, boxW, partyH); doc.line(midX, partyStart, midX, partyStart + partyH);
    y = partyStart + partyH;
    if (orderMap.workDetails) {
      stroke(borderW); doc.rect(marginX, y, boxW, 7);
      cellText(`Work Details: ${orderMap.workDetails}`, marginX + 2.5, y + 4.5, { size: 7.8 }); y += 7;
    }

    // Columns: SI Description HSN UNIT QTY Rate Amount
    const cols = [{ key: 'sno', label: 'SI', w: 10, align: 'center' }, { key: 'desc', label: 'Description', w: 70, align: 'left' }];
    if (showHSN) cols.push({ key: 'hsn', label: 'HSN/SAC', w: 20, align: 'center' });
    if (showItemQty) { cols.push({ key: 'unit', label: 'UNIT', w: 16, align: 'center' }); cols.push({ key: 'qty', label: 'QTY', w: 16, align: 'center' }); }
    if (showRateColumn) cols.push({ key: 'rate', label: 'Rate', w: 22, align: 'right' });
    if (showAmountCol) cols.push({ key: 'amt', label: 'Amount', w: 26, align: 'right' });
    const sumW = cols.reduce((s, c) => s + c.w, 0); cols.forEach(c => { c.w = (c.w / sumW) * boxW; });
    const hH = 7.5;
    stroke(borderW); doc.setFillColor(...headerBgRgb); doc.rect(marginX, y, boxW, hH, 'FD');
    let cx = marginX;
    cols.forEach((c, i) => {
      if (i) doc.line(cx, y, cx, y + hH);
      const tx = c.align === 'right' ? cx + c.w - 1.5 : (c.align === 'center' ? cx + c.w / 2 : cx + 1.5);
      cellText(c.label, tx, y + 5, { bold: true, size: 7.2, color: accentRgb, align: c.align });
      cx += c.w;
    });
    y += hH; const tblStart = y;
    validItems.forEach((it, idx) => {
      const qty = Number(it.quantity) || 0, rate = Number(it.rate) || 0;
      const dCol = cols.find(c => c.key === 'desc');
      const dLines = doc.splitTextToSize(String(it.name || ''), dCol.w - 3);
      const rH = Math.max(6.5, dLines.length * 3.5 + 2);
      const map = { sno: String(idx + 1), desc: dLines, hsn: String(it.hsn || ''), unit: String(it.unit || ''), qty: String(qty), rate: fmtAmt(rate), amt: fmtAmt(qty * rate) };
      let x0 = marginX;
      cols.forEach(c => {
        const tx = c.align === 'right' ? x0 + c.w - 1.5 : (c.align === 'center' ? x0 + c.w / 2 : x0 + 1.5);
        cellText(map[c.key] ?? '', tx, y + 4.2, { bold: c.key === 'amt', size: 7.6, align: c.align });
        x0 += c.w;
      });
      stroke(0.28); doc.line(marginX, y + rH, marginX + boxW, y + rH); y += rH;
    });
    if (validItems.length < 4) {
      for (let f = 0; f < 4 - validItems.length; f++) { stroke(0.3); doc.line(marginX, y + 6, marginX + boxW, y + 6); y += 6; }
    }
    stroke(borderW); doc.rect(marginX, tblStart, boxW, y - tblStart);
    let vx = marginX; cols.forEach((c, i) => { if (i) doc.line(vx, tblStart, vx, y); vx += c.w; });

    // Bank left + totals right
    const totStart = y; const tSplit = marginX + boxW * 0.58;
    const tRows = [];
    if (showSubtotal) tRows.push(['Subtotal', fmtAmt(subTotal), false]);
    if (showGST && igst > 0) tRows.push(['IGST', fmtAmt(igst), false]);
    if (showGST && cgst > 0) tRows.push(['CGST', fmtAmt(cgst), false]);
    if (showGST && sgst > 0) tRows.push(['SGST', fmtAmt(sgst), false]);
    if (showAmountCol) tRows.push(['Grand Total', `${curSym} ${fmtAmt(grandTotal)}`, true]);
    const bankLines = (showBankDetails && (acct.bankName || profile.bankName)) ? 4 : 0;
    const leftH = bankLines * 3.8 + 6 + (showUPI && !isDeliveryChallan ? 16 : 0);
    const totH = Math.max(leftH, tRows.length * 6.2, 16);
    stroke(borderW); doc.rect(marginX, totStart, boxW, totH); doc.line(tSplit, totStart, tSplit, totStart + totH);
    if (bankLines) {
      cellText('Bank Details', marginX + 2.5, totStart + 4, { bold: true, size: 7.5, color: accentRgb });
      cellText(`Bank: ${acct.bankName || profile.bankName || ''}`, marginX + 2.5, totStart + 8, { size: 7.2 });
      cellText(`A/C: ${acct.accountNumber || profile.accountNumber || ''}`, marginX + 2.5, totStart + 11.5, { size: 7.2 });
      cellText(`IFSC: ${acct.ifsc || profile.ifsc || ''}`, marginX + 2.5, totStart + 15, { size: 7.2 });
    }
    if (showUPI && !isDeliveryChallan) await drawUpiQr(marginX + 2.5, totStart + totH - 15, 13);
    const step = totH / Math.max(tRows.length, 1);
    tRows.forEach(([k, v, bold], idx) => {
      const ry = totStart + idx * step;
      if (idx) { stroke(0.3); doc.line(tSplit, ry, marginX + boxW, ry); }
      if (bold) { doc.setFillColor(...headerBgRgb); doc.rect(tSplit, ry, boxW * 0.42, step, 'F'); }
      cellText(k, tSplit + 2, ry + step * 0.65, { bold, size: bold ? 8.5 : 7.6 });
      cellText(v, marginX + boxW - 2, ry + step * 0.65, { bold, size: bold ? 8.5 : 7.6, align: 'right' });
    });
    y = totStart + totH;
    if (showAmountWords) {
      stroke(borderW); doc.rect(marginX, y, boxW, 8);
      cellText('Amount in words: ' + wordsOf(grandTotal), marginX + 2.5, y + 5, { size: 7.5 }); y += 8;
    }
    y = drawHsnSummary(y);
    const fStart = y; const fH = 36;
    stroke(borderW); doc.rect(marginX, fStart, boxW, fH);
    doc.line(marginX + boxW * 0.55, fStart, marginX + boxW * 0.55, fStart + fH);
    if (showTerms && stripHtml(customTerms)) {
      cellText('Terms & Conditions:', marginX + 2.5, fStart + 4, { bold: true, size: 7.2, color: accentRgb });
      const tl = doc.splitTextToSize(stripHtml(customTerms), boxW * 0.5);
      doc.setFont(fontFam, 'normal'); doc.setFontSize(6.5); doc.setTextColor(51, 65, 85);
      doc.text(tl.slice(0, 7), marginX + 2.5, fStart + 8);
    }
    cellText("Customer's Seal and Signature", marginX + 2.5, fStart + fH - 3, { size: 6.8, color: [100, 116, 139] });
    drawSignatureBlock(marginX + boxW - 2, fStart + 2, fH - 4);
    y = fStart + fH + 3;
    // Page footer (thin, single — match PO; no double outer frame)
    const footY = pageH - Math.max(8, marginBottom);
    setStroke(0.22);
    doc.line(marginX, footY - 5, marginX + boxW, footY - 5);
    cellText('This is a computer generated document.', pageW / 2, footY - 2.2, { size: 6.0, color: [100, 116, 139], align: 'center' });
    if (typeof shaHex === 'string' && shaHex) cellText('SHA-256: ' + shaHex, pageW / 2, footY + 1.2, { size: 5.5, color: [100, 116, 139], align: 'center' });
  }

  // ==========================================================================
  // TALLY — ref/dispatch grid (InvoiceGridLayout TallyLayout)
  // ==========================================================================
  else if (style === 'tally') {
    const borderW = 0.28;
    stroke(borderW);
    cellText(docTitle, pageW / 2, y + 4, { bold: true, size: 12, color: accentRgb, align: 'center' });
    y += 7;
    const tStart = y; const midX = marginX + boxW * 0.5; const refW = boxW * 0.25;
    let ly = y + 4;
    if (showBusinessName) { cellText(profile.businessName || '', marginX + 2.5, ly, { bold: true, size: 10 }); ly += 4; }
    if (showBusinessAddress && profile.address) {
      const al = doc.splitTextToSize(String(profile.address), boxW * 0.48 - 4);
      doc.setFont(fontFam, 'normal'); doc.setFontSize(7.4); doc.text(al, marginX + 2.5, ly); ly += al.length * 3.2;
    }
    if (showGSTIN && profile.gstin) { cellText(`GSTIN/UIN: ${profile.gstin}`, marginX + 2.5, ly, { bold: true, size: 7.4 }); ly += 3.2; }
    if (showState && profile.state) { cellText(`State Name: ${profile.state}`, marginX + 2.5, ly, { size: 7.4 }); ly += 3.2; }
    if (showBusinessPhone && profile.phone) { cellText(`Mobile: ${profile.phone}${profile.pan ? ` | PAN: ${profile.pan}` : ''}`, marginX + 2.5, ly, { size: 7.3 }); ly += 3.2; }
    const refPairs = [
      ['Invoice No.', details.invoiceNumber || '', 'Dated', shortDate(details.invoiceDate)],
      ['Delivery Note', orderMap.deliveryNote || '', 'Mode/Terms of Payment', orderMap.paymentTerms || ''],
      ['Reference No. & Date.', orderMap.referenceNo || '', 'Other References', orderMap.otherReferences || ''],
      ["Buyer's Order No.", orderMap.buyerOrderNo || '', 'Dated', orderMap.buyerOrderDate ? shortDate(orderMap.buyerOrderDate) : ''],
      ['Dispatch Doc No.', orderMap.dispatchDocNo || '', 'Delivery Note Date', orderMap.deliveryNoteDate ? shortDate(orderMap.deliveryNoteDate) : ''],
      ['Dispatched through', orderMap.dispatchedThrough || '', 'Destination', orderMap.destination || ''],
    ];
    const headerRows = 4; const headerH = Math.max(ly - tStart + 2, headerRows * 9);
    stroke(borderW); doc.rect(marginX, tStart, boxW * 0.5, headerH);
    for (let r = 0; r < headerRows; r++) {
      const ry = tStart + r * (headerH / headerRows); const cellH = headerH / headerRows;
      const [k1, v1, k2, v2] = refPairs[r];
      stroke(0.4); doc.rect(midX, ry, refW, cellH); doc.rect(midX + refW, ry, refW, cellH);
      cellText(k1, midX + 1.5, ry + 3, { size: 6.5, color: [71, 85, 105] });
      cellText(v1 || '', midX + 1.5, ry + 6.5, { bold: true, size: 7.5 });
      cellText(k2, midX + refW + 1.5, ry + 3, { size: 6.5, color: [71, 85, 105] });
      cellText(v2 || '', midX + refW + 1.5, ry + 6.5, { bold: true, size: 7.5 });
    }
    y = tStart + headerH;
    const bStart = y; let by = y + 4;
    cellText('Buyer (Bill to)', marginX + 2.5, by, { bold: true, size: 7.5, color: accentRgb }); by += 3.5;
    cellText(client.name || '', marginX + 2.5, by, { bold: true, size: 9 }); by += 3.5;
    if (showClientAddress && client.address) {
      const cl = doc.splitTextToSize(String(client.address), boxW * 0.48 - 4);
      doc.setFont(fontFam, 'normal'); doc.setFontSize(7.4); doc.text(cl, marginX + 2.5, by); by += cl.length * 3.2;
    }
    if (showGSTIN && client.gstin) { cellText(`GSTIN/UIN: ${client.gstin}`, marginX + 2.5, by, { bold: true, size: 7.3 }); by += 3.2; }
    const buyerH = Math.max(by - bStart + 2, 18);
    for (let r = 0; r < 2; r++) {
      const ry = bStart + r * (buyerH / 2); const cellH = buyerH / 2;
      const [k1, v1, k2, v2] = refPairs[4 + r];
      stroke(0.4); doc.rect(midX, ry, refW, cellH); doc.rect(midX + refW, ry, refW, cellH);
      cellText(k1, midX + 1.5, ry + 3, { size: 6.5, color: [71, 85, 105] });
      cellText(v1 || '', midX + 1.5, ry + 6.5, { bold: true, size: 7.4 });
      cellText(k2, midX + refW + 1.5, ry + 3, { size: 6.5, color: [71, 85, 105] });
      cellText(v2 || '', midX + refW + 1.5, ry + 6.5, { bold: true, size: 7.4 });
    }
    stroke(borderW); doc.rect(marginX, bStart, boxW * 0.5, buyerH);
    y = bStart + buyerH;
    if (orderMap.workDetails) {
      stroke(borderW); doc.rect(marginX, y, boxW, 7);
      cellText(`Work Details: ${orderMap.workDetails}`, marginX + 2.5, y + 4.5, { size: 7.6 }); y += 7;
    }
    // Items
    const cols = [{ key: 'sno', label: 'Sl No.', w: 12, align: 'center' }, { key: 'desc', label: 'Description of Services / Goods', w: 72, align: 'left' }];
    if (showHSN) cols.push({ key: 'hsn', label: 'HSN/SAC', w: 22, align: 'center' });
    if (showItemQty) cols.push({ key: 'qty', label: 'Quantity', w: 22, align: 'right' });
    if (showRateColumn) cols.push({ key: 'rate', label: 'Rate', w: 24, align: 'right' });
    if (showAmountCol) cols.push({ key: 'amt', label: 'Amount', w: 28, align: 'right' });
    const sumW = cols.reduce((s, c) => s + c.w, 0); cols.forEach(c => { c.w = (c.w / sumW) * boxW; });
    const hH = 7.5;
    stroke(borderW); doc.setFillColor(...headerBgRgb); doc.rect(marginX, y, boxW, hH, 'FD');
    let cx = marginX;
    cols.forEach((c, i) => {
      if (i) doc.line(cx, y, cx, y + hH);
      const tx = c.align === 'right' ? cx + c.w - 1.5 : (c.align === 'center' ? cx + c.w / 2 : cx + 1.5);
      cellText(c.label, tx, y + 5, { bold: true, size: 7.2, align: c.align });
      cx += c.w;
    });
    y += hH; const bodyStart = y;
    validItems.forEach((it, idx) => {
      const qty = Number(it.quantity) || 0, rate = Number(it.rate) || 0;
      const dCol = cols.find(c => c.key === 'desc');
      const dLines = doc.splitTextToSize(String(it.name || ''), dCol.w - 3);
      const rH = Math.max(7, dLines.length * 3.5 + 2.5);
      const map = { sno: String(idx + 1), desc: dLines, hsn: String(it.hsn || ''), qty: `${qty}${showItemUnit && it.unit ? ` ${it.unit}` : ''}`, rate: fmtAmt(rate), amt: fmtAmt(qty * rate) };
      let x0 = marginX;
      cols.forEach(c => {
        const tx = c.align === 'right' ? x0 + c.w - 1.5 : (c.align === 'center' ? x0 + c.w / 2 : x0 + 1.5);
        cellText(map[c.key] ?? '', tx, y + 4.5, { bold: c.key === 'amt' || c.key === 'desc', size: 7.6, align: c.align });
        x0 += c.w;
      });
      y += rH;
    });
    if (showAmountCol && !isDeliveryChallan) {
      const taxLines = [['', fmtAmt(subTotal)]];
      if (showGST && igst > 0) taxLines.push(['IGST', fmtAmt(igst)]);
      if (showGST && cgst > 0) taxLines.push(['CGST', fmtAmt(cgst)]);
      if (showGST && sgst > 0) taxLines.push(['SGST', fmtAmt(sgst)]);
      taxLines.forEach(([lab, val]) => {
        if (lab) cellText(lab, marginX + cols[0].w + cols[1].w - 2, y + 4.5, { bold: true, size: 7.5, align: 'right' });
        cellText(val, marginX + boxW - 2, y + 4.5, { bold: true, size: 7.6, align: 'right' });
        y += 6.5;
      });
      stroke(0.28); doc.line(marginX, y, marginX + boxW, y);
      cellText('Total', marginX + cols[0].w + cols[1].w - 2, y + 5, { bold: true, size: 8.5, align: 'right' });
      cellText(`${curSym} ${fmtAmt(grandTotal)}`, marginX + boxW - 2, y + 5, { bold: true, size: 9, align: 'right' });
      y += 8;
    }
    stroke(borderW); doc.rect(marginX, bodyStart, boxW, y - bodyStart);
    let vx = marginX; cols.forEach((c, i) => { if (i) doc.line(vx, bodyStart, vx, y); vx += c.w; });
    if (showAmountWords) {
      stroke(borderW); doc.rect(marginX, y, boxW, 9);
      cellText('Amount Chargeable (in words)', marginX + 2.5, y + 3.5, { size: 6.8, color: [71, 85, 105] });
      cellText(wordsOf(grandTotal), marginX + 2.5, y + 7, { bold: true, size: 8 });
      cellText('E. & O.E', marginX + boxW - 2, y + 7, { size: 7, align: 'right' });
      y += 9;
    }
    y = drawHsnSummary(y);
    const fStart = y; const fH = 40;
    stroke(borderW); doc.rect(marginX, fStart, boxW, fH);
    doc.line(marginX + boxW * 0.5, fStart, marginX + boxW * 0.5, fStart + fH);
    doc.line(marginX, fStart + fH * 0.55, marginX + boxW, fStart + fH * 0.55);
    if (showBankDetails && (acct.bankName || profile.bankName)) {
      cellText("Company's Bank Details", marginX + boxW * 0.5 + 2, fStart + 3.5, { bold: true, size: 7.4, color: accentRgb });
      cellText(`Bank Name: ${acct.bankName || profile.bankName}`, marginX + boxW * 0.5 + 2, fStart + 7.5, { size: 7.2 });
      cellText(`A/c No.: ${acct.accountNumber || profile.accountNumber || ''}`, marginX + boxW * 0.5 + 2, fStart + 11, { size: 7.2 });
      cellText(`Branch & IFS: ${acct.ifsc || profile.ifsc || ''}`, marginX + boxW * 0.5 + 2, fStart + 14.5, { size: 7.2 });
    }
    if (showUPI && !isDeliveryChallan) await drawUpiQr(marginX + boxW * 0.5 + 2, fStart + 17, 12);
    if (showTerms && stripHtml(customTerms)) {
      cellText('Terms & Conditions', marginX + 2.5, fStart + 3.5, { bold: true, size: 7.4, color: accentRgb });
      const tl = doc.splitTextToSize(stripHtml(customTerms), boxW * 0.48 - 4);
      doc.setFont(fontFam, 'normal'); doc.setFontSize(6.6); doc.setTextColor(51, 65, 85);
      doc.text(tl.slice(0, 6), marginX + 2.5, fStart + 7.5);
    }
    cellText("Customer's Seal and Signature", marginX + 2.5, fStart + fH * 0.55 + 4, { size: 7.2 });
    drawSignatureBlock(marginX + boxW - 2, fStart + fH * 0.55 + 1, fH * 0.45 - 2);
    y = fStart + fH + 3;
    cellText('This is a Computer Generated Invoice', pageW / 2, y, { size: 6.5, color: [100, 116, 139], align: 'center' });
  }

  // ==========================================================================
  // CLASSIC / MODERN / MINIMAL
  // ==========================================================================
  else {
    const isModern = style === 'modern';
    const isMinimal = style === 'minimal';
    if (isModern) {
      doc.setFillColor(...accentRgb); doc.rect(0, 0, pageW, 28, 'F');
      cellText(docTitle, marginX, 12, { bold: true, size: 14, color: [255, 255, 255] });
      if (showBusinessName) cellText(profile.businessName || '', pageW - marginX, 10, { bold: true, size: 10, color: [255, 255, 255], align: 'right' });
      y = 32;
    } else if (isMinimal) {
      if (showBusinessName) cellText(profile.businessName || '', marginX, y + 4, { bold: true, size: 11 });
      cellText(docTitle, marginX + boxW, y + 4, { bold: true, size: 11, color: accentRgb, align: 'right' });
      y += 8; stroke(0.5); doc.line(marginX, y, marginX + boxW, y); y += 4;
    } else {
      doc.setFillColor(...accentRgb); doc.rect(marginX, y, boxW, 2.2, 'F'); y += 5;
      if (showBusinessName) cellText(profile.businessName || '', marginX, y + 3, { bold: true, size: 12 });
      cellText(docTitle, marginX + boxW, y + 3, { bold: true, size: 11, color: accentRgb, align: 'right' });
      y += 8;
      if (showBusinessAddress) { cellText([profile.address, profile.city, profile.pin].filter(Boolean).join(', '), marginX, y, { size: 7.5 }); y += 4; }
      if (showGSTIN && profile.gstin) { cellText(`GSTIN: ${profile.gstin}`, marginX, y, { size: 7.5 }); y += 4; }
      y += 2; stroke(0.28); doc.line(marginX, y, marginX + boxW, y); y += 4;
    }
    const metaBits = [];
    if (showInvoiceNumber) metaBits.push(`No: ${details.invoiceNumber || ''}`);
    if (showInvoiceDate) metaBits.push(`Date: ${shortDate(details.invoiceDate)}`);
    cellText(metaBits.join('   ·   '), marginX, y + 3, { size: 8 }); y += 7;
    cellText(`Bill To: ${client.name || ''}`, marginX, y + 3, { bold: true, size: 9 }); y += 6;
    const cols = [{ key: 'sno', label: 'SI', w: 10, align: 'center' }, { key: 'desc', label: 'Description', w: 80, align: 'left' }];
    if (showHSN) cols.push({ key: 'hsn', label: 'HSN', w: 20, align: 'center' });
    if (showItemQty) cols.push({ key: 'qty', label: 'Qty', w: 20, align: 'right' });
    if (showRateColumn) cols.push({ key: 'rate', label: 'Rate', w: 24, align: 'right' });
    if (showAmountCol) cols.push({ key: 'amt', label: 'Amount', w: 26, align: 'right' });
    const sumW = cols.reduce((s, c) => s + c.w, 0); cols.forEach(c => { c.w = (c.w / sumW) * boxW; });
    stroke(0.5);
    if (isModern) { doc.setFillColor(...accentRgb); doc.rect(marginX, y, boxW, 7, 'F'); }
    else { doc.setFillColor(...headerBgRgb); doc.rect(marginX, y, boxW, 7, 'FD'); }
    let cx = marginX;
    cols.forEach((c, i) => {
      if (i) doc.line(cx, y, cx, y + 7);
      const tx = c.align === 'right' ? cx + c.w - 1.5 : (c.align === 'center' ? cx + c.w / 2 : cx + 1.5);
      cellText(c.label, tx, y + 4.6, { bold: true, size: 7.4, color: isModern ? [255, 255, 255] : accentRgb, align: c.align });
      cx += c.w;
    });
    y += 7; const bodyStart = y;
    validItems.forEach((it, idx) => {
      const qty = Number(it.quantity) || 0, rate = Number(it.rate) || 0;
      const dCol = cols.find(c => c.key === 'desc');
      const dLines = doc.splitTextToSize(String(it.name || ''), dCol.w - 3);
      const rH = Math.max(6.5, dLines.length * 3.6 + 2);
      const map = { sno: String(idx + 1), desc: dLines, hsn: String(it.hsn || ''), qty: String(qty), rate: fmtAmt(rate), amt: fmtAmt(qty * rate) };
      let x0 = marginX;
      cols.forEach(c => {
        const tx = c.align === 'right' ? x0 + c.w - 1.5 : (c.align === 'center' ? x0 + c.w / 2 : x0 + 1.5);
        cellText(map[c.key] ?? '', tx, y + 4, { size: 7.6, align: c.align, bold: c.key === 'amt' });
        x0 += c.w;
      });
      stroke(0.3); doc.line(marginX, y + rH, marginX + boxW, y + rH); y += rH;
    });
    stroke(0.5); doc.rect(marginX, bodyStart, boxW, y - bodyStart);
    let vx = marginX; cols.forEach((c, i) => { if (i) doc.line(vx, bodyStart, vx, y); vx += c.w; });
    y += 3;
    const tX = marginX + boxW * 0.58;
    const tRows = [];
    if (showSubtotal) tRows.push(['Subtotal', fmtAmt(subTotal), false]);
    if (showGST && igst > 0) tRows.push(['IGST', fmtAmt(igst), false]);
    if (showGST && cgst > 0) tRows.push(['CGST', fmtAmt(cgst), false]);
    if (showGST && sgst > 0) tRows.push(['SGST', fmtAmt(sgst), false]);
    if (showAmountCol) tRows.push(['Grand Total', `${curSym} ${fmtAmt(grandTotal)}`, true]);
    const totH = tRows.length * 6.5;
    stroke(0.5); doc.rect(tX, y, boxW * 0.42, totH);
    tRows.forEach(([k, v, bold], idx) => {
      const ry = y + idx * 6.5;
      if (idx) doc.line(tX, ry, marginX + boxW, ry);
      if (bold) { doc.setFillColor(...headerBgRgb); doc.rect(tX, ry, boxW * 0.42, 6.5, 'F'); }
      cellText(k, tX + 2, ry + 4.3, { bold, size: bold ? 8.5 : 7.6 });
      cellText(v, marginX + boxW - 2, ry + 4.3, { bold, size: bold ? 8.5 : 7.6, align: 'right' });
    });
    y += totH + 3;
    if (showAmountWords) { cellText(`Amount in Words: ${wordsOf(grandTotal)}`, marginX, y + 3, { size: 7.5 }); y += 7; }
    if (showTerms && stripHtml(customTerms)) {
      cellText('Terms & Conditions', marginX, y + 3, { bold: true, size: 7.5, color: accentRgb });
      const tl = doc.splitTextToSize(stripHtml(customTerms), boxW * 0.55);
      doc.setFont(fontFam, 'normal'); doc.setFontSize(7); doc.setTextColor(51, 65, 85);
      doc.text(tl.slice(0, 8), marginX, y + 7); y += Math.min(tl.length, 8) * 3.2 + 8;
    }
    drawSignatureBlock(marginX + boxW, y, 36); y += 40;
    cellText(`Computer Generated ${typeConfig.label || 'Document'}`, pageW / 2, y, { size: 6.5, color: [100, 116, 139], align: 'center' });
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