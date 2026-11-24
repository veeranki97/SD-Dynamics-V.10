// ============================================================================
// Thermal Print Settings — app-wide defaults, stored in localStorage.
// Consumed by InvoicePreview (as fallback under per-invoice options) and
// PrintSettings.jsx (as the UI form state).
// ============================================================================

export const DEFAULT_PRINT_SETTINGS = {
  // ==== Thermal-only ====
  // Typography
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
  /** v1.10.75 — round grand total to nearest rupee on PDF */
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

  // ============================================================
  // ==== v1.9.0 PDF & universal print features ==================
  // ============================================================
  // Every one below is TOGGLEABLE. Users pick which they want.

  // -- Auto-print --
  autoPrintOnSave: false,   // send to default printer immediately after Save & PDF Download

  // -- Watermark --
  watermarkEnabled: false,
  watermarkText: 'DUPLICATE', // 'PAID' | 'DUPLICATE' | 'DRAFT' | 'OVERDUE' | 'COPY' | (custom text)
  watermarkOpacity: 15,       // 0-100 (percent)
  watermarkAngle: -35,        // degrees; -35 is the diagonal classic
  watermarkFontSize: 90,      // pt

  // -- Multi-copy print (GST rule 48) --
  multiCopyEnabled: false,
  multiCopyCount: 3,          // 1|2|3 — Original / Duplicate / Triplicate
  multiCopyLabels: ['ORIGINAL FOR RECIPIENT', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR SUPPLIER'],

  // -- Page numbers + header on subsequent pages --
  pageNumbersEnabled: true,
  pageHeaderEnabled: true,    // shows business name at top of pages 2+

  // -- Print margins (mm) --
  marginTop: 0,      // 0 = no margin (existing behaviour). Users on printers with
  marginBottom: 0,   // built-in margins can dial these UP; letterhead users set them
  marginLeft: 0,     // to shift content away from pre-printed logo.
  marginRight: 0,

  // -- Font family (sheet PDFs) --
  pdfFontFamily: 'helvetica',  // 'helvetica' | 'times' | 'courier'

  // -- Barcode / QR of invoice number --
  invoiceBarcodeEnabled: false,   // barcode of invoice # (Code128-style, printed via jsPDF text)
  invoiceQrEnabled: false,        // QR of invoice # (or verify URL if configured)
  invoiceQrUrl: '',               // e.g. https://mycompany.com/verify/{invoice_number}

  // -- Digital signature --
  signatureImage: '',        // base64 data URL (uploaded in Print Settings)
  signatureName: '',         // "Authorized Signatory Name"
  signatureShow: true,       // show on invoice? (defaults to on)

  // -- T&C on separate page --
  termsSeparatePage: false,  // put terms + notes on their own page 2

  // v1.10.37 — T&C rendering mode. Reported: PDF was showing terms as
  // a compact all-caps run-together block that was hard to read.
  // Now:
  //   'compact'   → historical behaviour: tiny 0.6rem font, honours the
  //                 global allCaps setting. Saves paper on multi-item
  //                 invoices where terms are just legal boilerplate.
  //   'formatted' → 0.78rem readable font, line breaks preserved,
  //                 mixed case regardless of allCaps. For terms users
  //                 actually want customers to read.
  termsFormatMode: 'compact',

  // -- Feedback / Review QR --
  feedbackQrEnabled: false,
  feedbackQrUrl: '',         // Google Reviews / feedback form / any URL
  feedbackQrLabel: 'Rate us · Give feedback',

  // -- Reprint indicator (automatic) --
  // v1.10.41 — Default flipped from true to false. Reported: user was
  // surprised by "REPRINT · Copy #2" stamp appearing on their invoice's
  // top-left, overlapping the logo, the second time they downloaded it.
  // Freelancer / services / manufacturing users have no need for POS
  // reprint tracking — it's a retail-counter feature (customer asks for
  // a duplicate bill). The Print Settings toggle is already gated to
  // retail/restaurant business presets (v1.10.36) so those users can
  // opt in; every other user gets the badge OFF unless they turn it on.
  reprintLabelEnabled: false, // when true, a "REPRINT · Copy #N" badge appears on any invoice
                              // whose printedCount > 0 (based on bill.printedCount field)

  // ============================================================
  // v1.9.1 additions — all dynamic (on/off toggles)
  // ============================================================

  // -- Print quality (PDF file size / render sharpness trade-off) --
  // v1.10.27 — default flipped from 'standard' to 'hd' after user report:
  // "make sure print is full 100% hd quality in pdf". HD uses PNG @ scale
  // capped at 6 (dpr × 2.5), which is 3-5× larger file than standard's
  // JPEG @ scale ≤ 4 but crisp on high-res prints. Users who prefer
  // email-friendly files can switch to 'standard' or 'draft' in Print
  // Settings.
  pdfQuality: 'hd',    // 'draft' (email-friendly) | 'standard' | 'hd' (default, crispest)

  // -- Dual currency display (for foreign clients) --
  dualCurrencyEnabled: false,
  dualCurrencyCode: 'USD',   // 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD' | 'AUD' — the "≈" secondary
  dualCurrencyRate: 83,      // 1 INR = 1/rate secondary — user maintains manually (or per-invoice)
  dualCurrencyPosition: 'below', // 'below' (line under primary) | 'inline' (same line, in parens)

  // -- PDF template style. See InvoicePreview.jsx pdfStyleRaw mapping.
  // tally | tally-v2 | boxed-grid share the ruled-grid render path (v1 denser CSS variants).
  // corporate → classic + CSS; minimalist → minimal + CSS.
  pdfTemplate: 'saidurga',   // 'saidurga' | 'tally' | 'tally-v2' | 'boxed-grid' | 'modern' | 'classic' | 'minimal' | 'corporate' | 'minimalist'

  // -- Company letterhead --
  letterheadEnabled: false,
  letterheadImage: '',       // base64 data URL — full-page A4 background (renders behind content)
  letterheadOpacity: 100,    // 0-100 (typically 100 for pre-designed letterhead)
  letterheadHideHeader: true, // when using letterhead, most users hide the generated header block

  // -- Preview zoom (app-only, saved for user's preference) --
  previewZoom: 100,          // 50-200 percent

  // ============================================================
  // v1.9.2 — full user control over PDF colours + font scale
  // ============================================================
  // When userColorsEnabled = true, the following colours override any
  // template defaults. Users can tune every aspect of the visual output
  // without needing developer changes. Live preview updates instantly.
  userColorsEnabled: false,
  pdfPrimaryText: '#0f172a',    // main body text (dark)
  pdfMutedText: '#334155',      // secondary text (labels, addresses) — v1.9.2 default darkened from #64748b
  pdfAccent: '#1e40af',         // section labels + table header background
  pdfAccentText: '#ffffff',     // text on accent-coloured backgrounds
  pdfHeaderBg: '#f8fafc',       // invoice header block background (modern template)
  pdfDividerColor: '#334155',   // hairlines between sections (darkened default)

  // Font size scale multiplier — 0.8 to 1.4. Applied via CSS transform to the
  // whole invoice-preview-container, so everything scales proportionally.
  pdfFontScale: 1.0,            // 1.0 = default; 0.85 = compact; 1.15 = large

  // Print-mode text darkening — turn off if user has a modern high-quality
  // printer and prefers the on-screen greys.
  pdfDarkenOnPrint: true,

  // ============================================================
  // v1.9.3 — Full user control. Every hardcoded string / format
  // / preset now overridable so no developer changes are ever
  // needed for personalisation. The "easiest tool to use"
  // philosophy: 55+ settings, all discoverable, all persistent.
  // ============================================================

  // -- Custom section labels (multi-language) --
  // Users can rename every visible label to match their brand or language.
  // Pre-loaded presets: English (default), Hindi, Tamil, Marathi, Bengali.
  // Users can override any individual label without picking a language preset.
  labelLanguage: 'en',           // 'en' | 'hi' | 'ta' | 'mr' | 'bn' | 'custom'
  labelBillTo: '',               // '' → use language preset; anything else → override
  labelPlaceOfSupply: '',
  labelAmountInWords: '',
  labelBankDetails: '',
  labelTerms: '',
  labelNotes: '',
  // v1.10.36 — Removed labelShipTo / labelAuthorizedSignatory /
  // labelSubtotal / labelTotal / labelInvoice. All five were declared
  // as overridable label fields, but grep-verified they were never
  // consumed — InvoicePreview.jsx calls getLabel() only for billTo,
  // placeOfSupply, amountInWords, bankDetails, terms, notes. The
  // dead ones just added noise to every localStorage payload and
  // gave users controls that did nothing when they tried to rename.

  // -- Layout density --
  rowDensity: 'normal',          // 'compact' | 'normal' | 'comfortable'

  // -- Currency + Number formatting --
  currencyPosition: 'before',    // 'before' (₹100) | 'after' (100₹)
  numberFormat: 'indian',        // 'indian' (1,00,000) | 'western' (100,000) | 'european' (100.000,00)
  decimalPlaces: 2,              // 0 | 2 | 3 | 4

  // -- Date format --
  dateFormat: 'dd-mon-yyyy',     // 'dd-mon-yyyy' (02-Apr-2026) | 'dd-mm-yyyy' | 'mm-dd-yyyy' | 'yyyy-mm-dd' | 'dd-mmm-yyyy' | 'iso'

  // -- Watermark: custom text option --
  watermarkUseCustomText: false, // when true, watermarkCustomText overrides watermarkText preset
  watermarkCustomText: '',

  // -- Custom tax rate presets (user adds beyond 5/12/18/28) --
  // Additive to the built-in list. User adds/removes via UI.
  customTaxRates: [],            // [0.1, 0.25, 3, 7.5] etc.

  // v1.10.36 — Removed customInvoiceFields[] and columnWidths{}.
  // Both had "NOT YET WIRED" comments dating to v1.10.5, and nine
  // months later they still aren't consumed anywhere. Kept the door
  // open too long — deleting to trim every user's localStorage payload
  // and prevent settings-migration false positives.

  // -- Saved custom PDF templates --
  // Each saved template snapshot is a full settings object under a user-given
  // name. Users tune → save as "Retail Template" → recall any time.
  savedTemplates: [],            // [{ name: 'Retail v1', settings: {...} }]

  // -- Setup / onboarding --
  onboardingComplete: false,     // set to true after user finishes the setup wizard

  // v1.9.13 — Tracks which design preset the user last clicked, so the
  // preset picker can highlight it correctly. Multiple presets share the
  // same pdfTemplate value, so pdfTemplate alone is ambiguous.
  activePresetId: '',            // '' | 'modern' | 'classic' | 'corporate' | 'minimalist' | 'colorful' | 'minimal' | 'enterprise' | 'itservices' | 'retail'

  // v1.10.10 — Per-invoice-type prefix overrides. Empty string = fall
  // back to the built-in default from `INVOICE_TYPES[type].prefix`.
  // Users can now brand each series independently: `RTL` for retail
  // tax invoices, `RPT` for repeat customers, `QTE` for quotes,
  // whatever fits their internal numbering. Report request:
  // "every type should have special code to starts with because it
  // will mismatch". Each type gets its own atomic counter (already
  // the case — the server-side counter is per-prefix), so switching
  // Tax Invoice → 'INV' to 'RTL' resets the counter for RTL.
  customPrefixes: {
    'tax-invoice': '',      // default 'INV'
    'quotation': '',        // default 'QUO'
    'proforma': '',         // default 'PI'
    'bill-of-supply': '',   // default 'BOS'
    'composition': '',      // default 'COMP'
    'credit-note': '',      // default 'CN'
    'delivery-challan': '', // default 'DC'
  },

  // v1.10.11 — Compact upper-header mode. Reduces the padding + spacing
  // in the header / parties / place-of-supply blocks so users can fit
  // more product rows on page 1 before the invoice spills to page 2.
  // Reported: "upper header portion till before product rows make it
  // more compact so other details can feed thr". Off by default so
  // existing users don't see their invoices unexpectedly restyled.
  headerCompact: false,

  // v1.10.42 — Thermal print delivery mode. Reported (session-follow-up
  // to the v1.10.36 revert): "phir se laiye — direct print without
  // creating PDF wala".
  //   'direct' → invoice HTML is written into a hidden iframe with an
  //              @page size matching the roll width and printed via
  //              window.print(). Text stays VECTOR all the way to the
  //              driver → 203-dpi thermal rasterises at native resolution
  //              → sharp glyphs, small print jobs, fast buffer fill.
  //              This is what the v1.10.35 vector-HTML path did; we
  //              lost it in v1.10.36's revert.
  //   'pdf'    → invoice is rendered with html2canvas → JPEG → jsPDF,
  //              then the PDF is printed via iframe. Safer fallback when
  //              a printer / browser combo mis-handles CSS @page on the
  //              iframe path. This is the current (post-v1.10.36)
  //              behaviour, and remains the default for A4/A5/Letter.
  // Direct is the default because vector-to-thermal is measurably
  // sharper for the 95% of users on standard 58/80mm rolls; anyone hit
  // by an edge case can flip to 'pdf' without a code change.
  thermalPrintMode: 'direct',   // 'direct' | 'pdf'

  // v1.10.11 — Thermal buffer-safe mode. Old thermal printers with
  // small internal buffers (< 128 KB is common on ₹800-₹2000 units)
  // get stuck when the browser sends a colour or high-DPI receipt.
  // Enabling this switches the thermal render to grayscale + smaller
  // font baseline so the transmitted image data drops sharply.
  // Reported: "some old printers will not stuck in b/w print. Because
  // in market low beffer size printer available".
  thermalBufferSafe: false,

  // ============================================================
  // v1.9.4 — Payment reminder auto-scheduling + accessibility opts
  // ============================================================
  // Reminders are advisory: when the notification centre polls upcoming
  // filings + low stock, it also checks overdue invoices and surfaces
  // them here. Users get a bell-badge count; clicking opens the affected
  // bill's WhatsApp share prefilled with a reminder message.
  reminderEnabled: true,             // consumed by notification bell (overdue count)
  // v1.10.36 — Removed reminderDaysBeforeDue / reminderDaysAfterOverdue /
  // reminderTemplate. All three had "NOT YET WIRED" comments from
  // v1.10.5 and nine months later still aren't consumed anywhere.
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
    // Persist to server meta (SQLite + meta.json) so settings survive port/profile changes
    try {
      fetch('/api/meta/printSettings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: settings }),
      }).catch(function () {});
    } catch (e) { /* ignore network */ }
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// v1.9.3 — Multi-language section labels
// Presets for major Indian languages. User can override any individual label
// via labelXxx field regardless of preset.
// ============================================================================
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

// Resolve a label — priority: user override → language preset → English default
export function getLabel(settings, key) {
  const overrideKey = 'label' + key.charAt(0).toUpperCase() + key.slice(1);
  if (settings[overrideKey]) return settings[overrideKey];
  const preset = LABEL_PRESETS[settings.labelLanguage] || LABEL_PRESETS.en;
  return preset[key] || LABEL_PRESETS.en[key] || '';
}

// ============================================================================
// v1.9.3 — Number + date formatting
// ============================================================================
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
  // indian (default): 1,00,000 grouping
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

// ============================================================================
// v1.9.3 — Business type presets (one-click configuration)
// Each preset patches printSettings with a common baseline for that vertical.
// User can still tweak everything afterwards.
// ============================================================================
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
      pdfTemplate: 'classic' /* or saidurga */,
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
      pdfTemplate: 'classic' /* or saidurga */,
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

// Sample invoice for the Test Print button — uses the user's real business
// profile when available so the receipt looks realistic on their printer.
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
    const res = await fetch('/api/meta/printSettings', { cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json();
    const value = body && body.value;
    if (!value || typeof value !== 'object') return null;
    let local = {};
    try { local = JSON.parse(localStorage.getItem('gst_printSettings') || '{}'); } catch (e) { local = {}; }
    const merged = Object.assign({}, local, value, {
      customPrefixes: Object.assign({}, local.customPrefixes || {}, value.customPrefixes || {}),
    });
    localStorage.setItem('gst_printSettings', JSON.stringify(merged));
    return merged;
  } catch (e) {
    return null;
  }
}
// ============================================================================
// Native Vector PDF Builder (Sai Durga / Tally / Boxed GST Invoice)
// Produces crisp vector lines, selectable text, full wrapped T&C, and UPI QR
// without html2canvas rasterization.
// ============================================================================
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
}) {
  const { jsPDF } = await import('jspdf');
  let QRCodeMod = null;
  try { QRCodeMod = (await import('qrcode')).default; } catch { /* optional */ }

  const ps = printSettings || getPrintSettings();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = 210;
  const pageH = 297;
  const marginX = Math.max(8, Number(ps.marginLeft) || 10);
  const marginTop = Math.max(8, Number(ps.marginTop) || 10);
  const marginBottom = Math.max(8, Number(ps.marginBottom) || 10);
  const boxW = pageW - marginX * 2;
  const fontFam = ['helvetica', 'times', 'courier'].includes(ps.pdfFontFamily) ? ps.pdfFontFamily : 'helvetica';

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

  // Resolve payment account snapshot or active account
  const acct = invoiceOptions.paymentAccountSnapshot
    || (Array.isArray(profile.paymentAccounts)
      ? (profile.paymentAccounts.find(a => a.id === invoiceOptions.selectedAccountId) || profile.paymentAccounts.find(a => a.isDefault) || profile.paymentAccounts[0])
      : null)
    || {};

  const setStroke = () => {
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.28);
  };

  let y = marginTop;

  // Title banner
  doc.setFont(fontFam, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(docTitle, pageW / 2, y + 4, { align: 'center' });
  y += 6.5;

  const topStart = y;
  const leftW = boxW * 0.52;
  const rightW = boxW - leftW;
  const midX = marginX + leftW;

  // ---- TOP LEFT: Seller + Buyer ----
  let ly = y + 4.5;
  const lx = marginX + 2.5;
  const lMaxW = leftW - 5;

  // Optional logo
  let logoOffset = 0;
  if (invoiceOptions.showLogo !== false && ps.showLogo !== false && profile.logo && String(profile.logo).startsWith('data:image/')) {
    try {
      const fmt = String(profile.logo).includes('png') ? 'PNG' : 'JPEG';
      doc.addImage(profile.logo, fmt, lx, ly - 2, 16, 12);
      logoOffset = 18;
    } catch { /* skip invalid logo */ }
  }

  doc.setFont(fontFam, 'bold');
  doc.setFontSize(10.5);
  doc.text(String(profile.businessName || 'Business Name'), lx + logoOffset, ly + 1.5);
  ly += 5;

  doc.setFont(fontFam, 'normal');
  doc.setFontSize(8);
  const sellerAddr = [profile.address, [profile.city, profile.pin].filter(Boolean).join(' - ')].filter(Boolean).join(', ');
  if (sellerAddr) {
    const lines = doc.splitTextToSize(sellerAddr, lMaxW - logoOffset);
    doc.text(lines, lx + logoOffset, ly);
    ly += lines.length * 3.6;
  }
  const sellerState = profile.state || '';
  const sellerCode = stateCodeOf(sellerState, profile.gstin);
  if (profile.gstin) {
    doc.setFont(fontFam, 'bold');
    doc.text(`GSTIN/UIN: ${profile.gstin}`, lx, ly);
    ly += 3.6;
    doc.setFont(fontFam, 'normal');
  }
  if (sellerState) {
    doc.text(`State Name: ${sellerState}${sellerCode ? `, Code: ${sellerCode}` : ''}`, lx, ly);
    ly += 3.6;
  }
  const contactLine = [
    profile.phone ? `Mobile: ${profile.phone}` : '',
    profile.pan ? `PAN: ${profile.pan}` : '',
  ].filter(Boolean).join(' | ');
  if (contactLine) { doc.text(contactLine, lx, ly); ly += 3.6; }
  if (profile.email) { doc.text(`E-Mail: ${profile.email}`, lx, ly); ly += 3.6; }

  ly += 1.5;
  const buyerDividerY = ly;
  ly += 4;

  // Buyer (Bill To)
  doc.setFont(fontFam, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(getLabel(ps, 'billTo') || 'Buyer (Bill to)', lx, ly);
  ly += 3.8;

  doc.setFont(fontFam, 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(String(client.name || ''), lx, ly);
  ly += 4;

  doc.setFont(fontFam, 'normal');
  doc.setFontSize(8);
  const buyerAddr = [client.address, [client.city, client.pin].filter(Boolean).join(' - ')].filter(Boolean).join(', ');
  if (buyerAddr) {
    const bLines = doc.splitTextToSize(buyerAddr, lMaxW);
    doc.text(bLines, lx, ly);
    ly += bLines.length * 3.6;
  }
  const buyerState = client.state || details.placeOfSupply || '';
  const buyerCode = stateCodeOf(buyerState, client.gstin);
  if (client.gstin) {
    doc.setFont(fontFam, 'bold');
    doc.text(`GSTIN/UIN: ${client.gstin}`, lx, ly);
    ly += 3.6;
    doc.setFont(fontFam, 'normal');
  }
  if (buyerState) {
    doc.text(`State Name: ${buyerState}${buyerCode ? `, Code: ${buyerCode}` : ''}`, lx, ly);
    ly += 3.6;
  }
  if (details.workDetails) {
    const wdLines = doc.splitTextToSize(`Work Details: ${details.workDetails}`, lMaxW);
    doc.text(wdLines, lx, ly);
    ly += wdLines.length * 3.6;
  }

  // ---- TOP RIGHT: Tally 2-column Metadata Grid ----
  const rColW = rightW / 2;
  const rMidX = midX + rColW;
  const posVal = details.placeOfSupply || buyerState || '';
  const posCode = stateCodeOf(posVal, client.gstin);
  const periodStr = (details.periodStart || details.periodEnd)
    ? `${details.periodStart || '—'} to ${details.periodEnd || '—'}`
    : '';

  const metaRows = [
    [
      { label: 'Invoice No.', val: details.invoiceNumber || '', bold: true },
      { label: 'Dated', val: formatDate(details.invoiceDate, ps), bold: true },
    ],
    [
      { label: 'Delivery Note', val: details.deliveryNote || '' },
      { label: 'Mode/Terms of Payment', val: details.paymentTerms || '' },
    ],
    [
      { label: 'Reference No. & Date', val: details.workOrderNo || details.referenceNo || '' },
      { label: 'Service Period', val: periodStr },
    ],
    [
      { label: "Buyer's Order No.", val: details.buyerOrderNo || '' },
      { label: 'Due Date', val: details.dueDate ? formatDate(details.dueDate, ps) : '' },
    ],
    [
      { label: 'Reverse Charge', val: invoiceOptions.reverseCharge ? 'Yes' : 'No' },
      { label: 'Place of Supply', val: posVal ? `${posVal}${posCode ? `, Code: ${posCode}` : ''}` : '' },
    ],
  ];

  const metaRowH = 9.2;
  const rightTotalH = metaRows.length * metaRowH;
  const topBoxH = Math.max(ly - topStart + 2, rightTotalH);

  // Draw outer top box + vertical split + horizontal dividers
  setStroke();
  doc.rect(marginX, topStart, boxW, topBoxH);
  doc.line(midX, topStart, midX, topStart + topBoxH);
  doc.line(marginX, buyerDividerY, midX, buyerDividerY);
  doc.line(rMidX, topStart, rMidX, topStart + rightTotalH);

  metaRows.forEach((pair, idx) => {
    const ry = topStart + idx * metaRowH;
    if (idx > 0) doc.line(midX, ry, marginX + boxW, ry);
    pair.forEach((cell, cIdx) => {
      const cx = (cIdx === 0 ? midX : rMidX) + 2;
      doc.setFont(fontFam, 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(cell.label, cx, ry + 3.2);
      doc.setFont(fontFam, cell.bold ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      const valLines = doc.splitTextToSize(String(cell.val || ''), rColW - 4);
      doc.text(valLines[0] || '', cx, ry + 7.2);
    });
  });
  if (rightTotalH < topBoxH) {
    doc.line(midX, topStart + rightTotalH, marginX + boxW, topStart + rightTotalH);
  }

  y = topStart + topBoxH;

  // ---- LINE ITEMS TABLE ----
  const showGst = invoiceOptions.showGST !== false && INVOICE_TYPES[invoiceType]?.showGST !== false;
  const cols = [
    { key: 'sno', label: 'SI No.', w: 11, align: 'center' },
    { key: 'desc', label: 'Description of Services / Goods', w: showGst ? 79 : 93, align: 'left' },
    { key: 'hsn', label: 'HSN/SAC', w: 20, align: 'center' },
    { key: 'qty', label: 'Quantity', w: 22, align: 'right' },
    { key: 'rate', label: 'Rate', w: 24, align: 'right' },
    { key: 'per', label: 'per', w: 12, align: 'center' },
    { key: 'amt', label: 'Amount', w: 22, align: 'right' },
  ];
  const rawColSum = cols.reduce((s, c) => s + c.w, 0);
  cols.forEach(c => { c.w = (c.w / rawColSum) * boxW; });

  const drawTableHeader = (startY) => {
    const hH = 7.5;
    setStroke();
    doc.setFillColor(248, 250, 252);
    doc.rect(marginX, startY, boxW, hH, 'FD');
    let cx = marginX;
    doc.setFont(fontFam, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    cols.forEach((c, idx) => {
      if (idx > 0) doc.line(cx, startY, cx, startY + hH);
      const tx = c.align === 'right' ? cx + c.w - 1.5 : (c.align === 'center' ? cx + c.w / 2 : cx + 1.5);
      doc.text(c.label, tx, startY + 4.8, { align: c.align });
      cx += c.w;
    });
    return startY + hH;
  };

  y = drawTableHeader(y);
  let tableStartY = y;

  const drawColVerts = (fromY, toY) => {
    setStroke();
    doc.rect(marginX, fromY, boxW, toY - fromY);
    let cx = marginX;
    cols.forEach((c, idx) => {
      if (idx > 0) doc.line(cx, fromY, cx, toY);
      cx += c.w;
    });
  };

  doc.setFont(fontFam, 'normal');
  doc.setFontSize(8);

  const validItems = (items || []).filter(it => (it.name || '').trim() || (Number(it.quantity) || 0) * (Number(it.rate) || 0) > 0);
  validItems.forEach((it, idx) => {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.rate) || 0;
    const unit = it.unit || 'Nos';
    const lineAmt = qty * rate;
    const descCol = cols[1];
    const descLines = doc.splitTextToSize(String(it.name || ''), descCol.w - 3);
    const rowH = Math.max(6.5, descLines.length * 3.8 + 2.5);

    if (y + rowH > pageH - marginBottom - 65) {
      drawColVerts(tableStartY, y);
      doc.addPage();
      y = marginTop;
      y = drawTableHeader(y);
      tableStartY = y;
    }

    const rowVals = [
      String(idx + 1),
      descLines,
      String(it.hsn || ''),
      `${qty} ${unit}`,
      fmtAmt(rate),
      unit,
      fmtAmt(lineAmt),
    ];

    let cx = marginX;
    cols.forEach((c, cIdx) => {
      const val = rowVals[cIdx];
      doc.setFont(fontFam, cIdx === 1 || cIdx === 6 ? 'bold' : 'normal');
      const tx = c.align === 'right' ? cx + c.w - 1.5 : (c.align === 'center' ? cx + c.w / 2 : cx + 1.5);
      doc.text(val, tx, y + 4.2, { align: c.align });
      cx += c.w;
    });
    y += rowH;
  });

  // Tax & Totals rows inside item table (Tally style)
  const subTotal = Number(totals.subtotal ?? totals.subTotal) || 0;
  const cgst = Number(totals.cgst) || 0;
  const sgst = Number(totals.sgst) || 0;
  const igst = Number(totals.igst) || 0;
  const cess = Number(totals.cess) || 0;
  const roundOff = Number(totals.roundOff) || 0;
  const grandTotal = Number(totals.total) || 0;

  const summaryRows = [
    { label: 'Subtotal', val: fmtAmt(subTotal), bold: false },
  ];
  if (showGst) {
    if (igst > 0) summaryRows.push({ label: 'Output IGST', val: fmtAmt(igst), bold: true });
    if (cgst > 0) summaryRows.push({ label: 'Output CGST', val: fmtAmt(cgst), bold: true });
    if (sgst > 0) summaryRows.push({ label: 'Output SGST', val: fmtAmt(sgst), bold: true });
    if (cess > 0) summaryRows.push({ label: 'GST Cess', val: fmtAmt(cess), bold: false });
  }
  if (Math.abs(roundOff) >= 0.005) {
    summaryRows.push({ label: 'Round Off', val: fmtAmt(roundOff), bold: false });
  }

  y += 2;
  const descCol = cols[1];
  const descRightX = marginX + cols[0].w + descCol.w - 2;
  const amtRightX = marginX + boxW - 1.5;

  summaryRows.forEach((sr) => {
    doc.setFont(fontFam, sr.bold ? 'bold' : 'normal');
    doc.setFontSize(8);
    doc.text(sr.label, descRightX, y + 3.5, { align: 'right' });
    doc.text(sr.val, amtRightX, y + 3.5, { align: 'right' });
    y += 5;
  });

  drawColVerts(tableStartY, y);

  // Grand Total row
  const totRowH = 7.5;
  setStroke();
  doc.setFillColor(248, 250, 252);
  doc.rect(marginX, y, boxW, totRowH, 'FD');
  let cx = marginX;
  cols.forEach((c, idx) => {
    if (idx > 0) doc.line(cx, y, cx, y + totRowH);
    cx += c.w;
  });
  doc.setFont(fontFam, 'bold');
  doc.setFontSize(8.5);
  doc.text('Total', descRightX, y + 5, { align: 'right' });
  const totalQty = validItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const firstUnit = validItems[0]?.unit || '';
  const qtyRightX = marginX + cols[0].w + cols[1].w + cols[2].w + cols[3].w - 1.5;
  if (totalQty > 0) doc.text(`${totalQty} ${firstUnit}`, qtyRightX, y + 5, { align: 'right' });
  doc.text(`₹ ${fmtAmt(grandTotal)}`, amtRightX, y + 5, { align: 'right' });
  y += totRowH;

  // ---- AMOUNT IN WORDS + PAN ----
  const wordsText = wordsOf(grandTotal);
  const wordsLines = doc.splitTextToSize(wordsText, boxW * 0.68);
  const wordsBoxH = Math.max(11, wordsLines.length * 4 + 7);
  setStroke();
  doc.rect(marginX, y, boxW, wordsBoxH);
  doc.setFont(fontFam, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Amount Chargeable (in words)', marginX + 2, y + 3.8);
  doc.text('E. & O.E', marginX + boxW - 2, y + 3.8, { align: 'right' });

  doc.setFont(fontFam, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(wordsLines, marginX + 2, y + 8);

  if (profile.pan) {
    doc.setFont(fontFam, 'normal');
    doc.setFontSize(7.5);
    doc.text(`Company's PAN: ${profile.pan}`, marginX + boxW - 2, y + wordsBoxH - 2.2, { align: 'right' });
  }
  y += wordsBoxH;

  // ---- FOOTER: Terms & Conditions (Left, FULL auto-wrapped) + Bank/UPI & Signatory (Right) ----
  const termsPlain = invoiceOptions.showTerms !== false ? stripHtml(customTerms) : '';
  const notesPlain = invoiceOptions.showNotes !== false ? stripHtml(customNotes) : '';
  const leftFooterParts = [];
  if (termsPlain) leftFooterParts.push({ title: 'Terms & Conditions', body: termsPlain });
  if (notesPlain) leftFooterParts.push({ title: 'Notes', body: notesPlain });

  const fLeftW = boxW * 0.56;
  const fMidX = marginX + fLeftW;

  let leftFooterLines = [];
  leftFooterParts.forEach((sec) => {
    leftFooterLines.push({ bold: true, text: sec.title });
    doc.splitTextToSize(sec.body, fLeftW - 4).forEach((ln) => leftFooterLines.push({ bold: false, text: ln }));
  });

  // Bank details text on right
  const bankLines = [];
  if (invoiceOptions.showBankDetails !== false && ps.showBankDetails !== false) {
    const bName = acct.bankName || profile.bankName;
    const bAcc = acct.accountNumber || profile.bankAccount || profile.accountNumber;
    const bIfsc = acct.ifsc || profile.ifsc;
    const bBranch = acct.branch || profile.branch;
    if (bName || bAcc) {
      bankLines.push("Company's Bank Details");
      if (bName) bankLines.push(`Bank Name: ${bName}`);
      if (bAcc) bankLines.push(`A/c No.: ${bAcc}`);
      if (bIfsc) bankLines.push(`IFSC: ${bIfsc}${bBranch ? ` · ${bBranch}` : ''}`);
    }
  }

  const leftNeedH = Math.max(34, leftFooterLines.length * 3.6 + 6);
  const rightNeedH = Math.max(34, bankLines.length * 3.6 + 24);
  const footerBoxH = Math.max(leftNeedH, rightNeedH);

  if (y + footerBoxH > pageH - marginBottom - 6) {
    doc.addPage();
    y = marginTop;
  }

  setStroke();
  doc.rect(marginX, y, boxW, footerBoxH);
  doc.line(fMidX, y, fMidX, y + footerBoxH);

  // Render full wrapped Terms & Notes on left (no clipping!)
  let fy = y + 4;
  leftFooterLines.forEach((item) => {
    doc.setFont(fontFam, item.bold ? 'bold' : 'normal');
    doc.setFontSize(item.bold ? 7.8 : 7.2);
    doc.setTextColor(item.bold ? 15 : 51, item.bold ? 23 : 65, item.bold ? 42 : 85);
    doc.text(item.text, marginX + 2, fy);
    fy += 3.6;
  });

  // Render Bank Details + UPI QR + Authorized Signatory on right
  let ry = y + 4;
  bankLines.forEach((ln, idx) => {
    doc.setFont(fontFam, idx === 0 ? 'bold' : 'normal');
    doc.setFontSize(idx === 0 ? 7.8 : 7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(ln, fMidX + 2, ry);
    ry += 3.5;
  });

  // UPI QR Code
  const upiId = acct.upiId || profile.upiId;
  if (QRCodeMod && invoiceOptions.showUPI !== false && ps.showUPI !== false && upiId && grandTotal > 0) {
    try {
      const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(profile.businessName || '')}&am=${grandTotal.toFixed(2)}&cu=INR`;
      const qrUrl = await QRCodeMod.toDataURL(upiUri, { errorCorrectionLevel: 'M', margin: 0, width: 180 });
      const qrSize = 15;
      doc.addImage(qrUrl, 'PNG', fMidX + 2, y + footerBoxH - qrSize - 5, qrSize, qrSize);
      doc.setFont(fontFam, 'normal');
      doc.setFontSize(6.2);
      doc.text('Scan to pay (UPI)', fMidX + 2, y + footerBoxH - 1.5);
    } catch { /* skip QR on error */ }
  }

  // Authorized Signatory block
  if (invoiceOptions.showSignature !== false && ps.signatureShow !== false) {
    doc.setFont(fontFam, 'bold');
    doc.setFontSize(7.5);
    doc.text(`For ${profile.businessName || ''}`, marginX + boxW - 2, y + 4.5, { align: 'right' });

    if (ps.signatureImage && String(ps.signatureImage).startsWith('data:image/')) {
      try {
        const sFmt = String(ps.signatureImage).includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(ps.signatureImage, sFmt, marginX + boxW - 28, y + footerBoxH - 16, 25, 10);
      } catch { /* skip */ }
    }
    doc.setFont(fontFam, 'normal');
    doc.setFontSize(7.2);
    doc.text(ps.signatureName || 'Authorized Signatory', marginX + boxW - 2, y + footerBoxH - 2, { align: 'right' });
  }

  y += footerBoxH + 4;
  doc.setFont(fontFam, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('This is a Computer Generated Invoice', pageW / 2, y, { align: 'center' });

  // Extra sections on subsequent pages if present
  for (const sec of (extraSections || [])) {
    const body = stripHtml(sec?.content || '');
    if (!sec?.title && !body) continue;
    doc.addPage();
    let ey = marginTop + 4;
    doc.setFont(fontFam, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(String(sec.title || 'Annexure'), marginX, ey);
    ey += 6;
    doc.setFont(fontFam, 'normal');
    doc.setFontSize(8.5);
    const eLines = doc.splitTextToSize(body, boxW);
    doc.text(eLines, marginX, ey);
  }

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  if (ps.pageNumbersEnabled && totalPages > 1) {
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont(fontFam, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${p} of ${totalPages}`, pageW - marginX, pageH - 4, { align: 'right' });
    }
  }

  return doc;
}