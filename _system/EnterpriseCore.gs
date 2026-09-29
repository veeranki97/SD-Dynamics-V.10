/**
 * ============================================================================
 *  EnterpriseCore.gs  —  drop-in module for your existing Code.gs
 * ============================================================================
 *  Add this as a NEW file in the Apps Script project (File > New > Script).
 *  It does NOT redefine any function that already exists in CodeGSV1, EXCEPT
 *  `validateSession` (see section 1) — delete the old one when you paste this.
 *
 *  Sections
 *   0. Constants & tiny helpers (money in paise, hashing, dates)
 *   1. Authentication: per-user e-mail OTP, hashed sessions, RBAC
 *   2. Tamper-evident, append-only audit trail (who / what / when / before-after)
 *   3. Server-authoritative GST calculation + GSTIN/HSN validation
 *   4. Gapless document numbering (Rule 46 CGST) per financial year
 *   5. Period control: Financial-Year master, GST month locks, freeze days
 *   6. Double-entry ledger engine (append-only, reversal-based, Chart of Accounts)
 *   7. Posting adapters (invoice / credit note / purchase / receipt / TDS / GST set-off)
 *   8. Financial statements: Trial Balance, P&L, Balance Sheet, Cash Flow
 *   9. Financial-year closing
 *  10. GSTR-1 / GSTR-3B JSON builders (+ number-gap detection)
 *  11. Public, token-protected API for the HTML client
 *
 *  Convention: functions ending with "_" are PRIVATE — Apps Script does not
 *  expose them to google.script.run, so the browser cannot call them.
 *  Everything the browser may call lives in section 11 and validates a token.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// 0. CONSTANTS & HELPERS
// ---------------------------------------------------------------------------
var EC_ = {
  SHEETS: {
    LEDGER: 'Ledger', COA: 'ChartOfAccounts', AUDIT: 'AuditTrail', USERS: 'Users',
    FY: 'FinancialYears', SEQ: 'Sequences', LOCKS: 'GST_LOCK', SETTINGS: 'Settings'
  },
  LEDGER_HEADERS: ['VoucherNo', 'SourceType', 'SourceID', 'TxnDate', 'FY', 'AccCode', 'Party',
    'CostHead', 'Site', 'Debit', 'Credit', 'Narration', 'ReversalOf', 'PostedBy', 'PostedAt'],
  AUDIT_HEADERS: ['Seq', 'Timestamp', 'UserEmail', 'Role', 'Module', 'Action', 'RecordID',
    'ChangedFields', 'BeforeJSON', 'AfterJSON', 'Reason', 'PrevHash', 'RowHash'],
  ROLE_RANK: { viewer: 1, user: 2, accountant: 2, admin: 3 },
  SESSION_TTL_SEC: 21600,          // CacheService hard maximum is 6 hours
  OTP_TTL_SEC: 300,
  OTP_MAX_TRIES: 5,
  // Rates in force on old + new documents. Keep a dated rate master in production;
  // GST slabs were restructured in Sept-2025, so verify against current notifications.
  ALLOWED_GST_RATES: [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40],
  B2CL_THRESHOLD: 100000           // inter-state unregistered invoice value limit for Table 5
};

/** Indian state / UT codes used in GSTIN prefix and Place of Supply. */
var STATE_CODES_ = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka',
  '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
  '96': 'Other Country', '97': 'Other Territory', '99': 'Centre Jurisdiction'
};

function stateCodeFromName_(name) {
  var n = String(name || '').trim().toLowerCase().replace(/&/g, 'and');
  if (!n) return '';
  if (/^\d{2}$/.test(n)) return n;
  if (n === 'jammu' || n === 'jammu & kashmir') n = 'jammu and kashmir';
  if (n === 'daman and diu' || n === 'dadra and nagar haveli') n = 'dadra and nagar haveli and daman and diu';
  if (n === 'andaman and nicobar') n = 'andaman and nicobar islands';
  if (n === 'orissa') n = 'odisha';
  for (var code in STATE_CODES_) if (STATE_CODES_[code].toLowerCase() === n) return code;
  return '';
}

/** Money helpers — never add floats directly; go through integer paise. */
function toPaise_(x) { var n = Number(x) || 0; return Math.round(n * 100 + (n >= 0 ? 1e-7 : -1e-7)); }
function fromPaise_(p) { return Math.round(p) / 100; }
function round2_(x) { return fromPaise_(toPaise_(x)); }
function num_(x, dflt) { var n = parseFloat(String(x === undefined || x === null ? '' : x).replace(/,/g, '')); return isNaN(n) ? (dflt === undefined ? 0 : dflt) : n; }

function sha256Hex_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)
    .map(function (b) { return ((b < 0 ? b + 256 : b)).toString(16).padStart(2, '0'); }).join('');
}
function hmacHex_(msg, key) {
  return Utilities.computeHmacSha256Signature(String(msg), String(key))
    .map(function (b) { return ((b < 0 ? b + 256 : b)).toString(16).padStart(2, '0'); }).join('');
}
function safeEq_(a, b) {                       // constant-time string compare
  a = String(a); b = String(b);
  var r = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0;
}
function serverSecret_() {
  var p = PropertiesService.getScriptProperties();
  var s = p.getProperty('SERVER_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SERVER_SECRET', s); }
  return s;
}

/** yyyy-MM-dd (no timezone drift) from Date | string. */
function ymd_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(v || '').trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);            // dd-mm-yyyy
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  var d = new Date(s);
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
/** Financial year label "26-27" for a yyyy-MM-dd date (April–March). */
function fyOf_(dateStr) {
  var y = parseInt(dateStr.substr(0, 4), 10), m = parseInt(dateStr.substr(5, 2), 10);
  var s = m >= 4 ? y : y - 1;
  return String(s).slice(-2) + '-' + String(s + 1).slice(-2);
}
function fyRange_(fy) {                        // "26-27" -> {start:'2026-04-01', end:'2027-03-31'}
  var s = 2000 + parseInt(fy.substr(0, 2), 10);
  return { start: s + '-04-01', end: (s + 1) + '-03-31' };
}
function ddmmyyyy_(ymd) { return ymd.substr(8, 2) + '-' + ymd.substr(5, 2) + '-' + ymd.substr(0, 4); }

function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (headers) sh.appendRow(headers);
    // Google Sheets auto-converts ISO strings/"26-27" to dates: force TEXT on everything except numeric money/sequence columns
    var numeric = { 'Ledger': [10, 11], 'AuditTrail': [1], 'Sequences': [2] }[name] || [];
    if (headers) for (var c = 1; c <= headers.length; c++) if (numeric.indexOf(c) < 0) sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@');
  }
  return sh;
}
function cfg_(key, dflt) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EC_.SHEETS.SETTINGS);
  if (!sh) return dflt;
  var d = sh.getDataRange().getValues();
  for (var i = 1; i < d.length; i++) if (String(d[i][0]).toUpperCase().trim() === key.toUpperCase()) return d[i][1];
  return dflt;
}

// ---------------------------------------------------------------------------
// 1. AUTHENTICATION  (replaces PIN + shared OTP; PIN login is removed)
// ---------------------------------------------------------------------------
/** Run ONCE from the editor after pasting this file. Creates Users sheet + first admin. */
function bootstrapSecurity() {
  serverSecret_();
  var sh = sheet_(EC_.SHEETS.USERS, ['UserID', 'Name', 'Email', 'Role', 'Active', 'CreatedAt', 'LastLogin']);
  var owner = Session.getEffectiveUser().getEmail();
  var rows = sh.getDataRange().getValues();
  var has = rows.some(function (r, i) { return i > 0 && String(r[2]).toLowerCase() === owner.toLowerCase(); });
  if (!has) sh.appendRow(['U-001', 'Owner', owner.toLowerCase(), 'admin', 'TRUE', new Date().toISOString(), '']);
  ensureLedgerInfrastructure_();
  return 'Security bootstrapped for ' + owner;
}

function findUser_(email) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EC_.SHEETS.USERS);
  if (!sh) return null;
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][2]).trim().toLowerCase() === email && String(rows[i][4]).toUpperCase() === 'TRUE') {
      return { row: i + 1, id: rows[i][0], name: rows[i][1], email: email, role: String(rows[i][3]).toLowerCase() };
    }
  }
  return null;
}

/** Step 1: browser sends an e-mail. Response is identical for known/unknown e-mails. */
function authRequestOtp(email) {
  var e = String(email || '').trim().toLowerCase();
  var cache = CacheService.getScriptCache();
  var challengeId = Utilities.getUuid();
  var generic = { ok: true, challengeId: challengeId, message: 'If this e-mail is registered, a 6-digit code has been sent.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return generic;

  var rateKey = 'OTPRATE_' + sha256Hex_(e);
  var n = parseInt(cache.get(rateKey) || '0', 10);
  if (n >= 5) return { ok: false, message: 'Too many requests. Try again in 15 minutes.' };
  cache.put(rateKey, String(n + 1), 900);

  var user = findUser_(e);
  if (!user) return generic;

  // 6-digit code from a CSPRNG-backed source (getUuid), not Math.random()
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid());
  var otpNum = ((digest[0] & 0xff) * 16777216 + (digest[1] & 0xff) * 65536 + (digest[2] & 0xff) * 256 + (digest[3] & 0xff)) % 1000000;
  var otp = String(otpNum).padStart(6, '0');

  cache.put('OTP_' + challengeId, JSON.stringify({ h: hmacHex_(otp + ':' + challengeId, serverSecret_()), email: e, tries: 0 }), EC_.OTP_TTL_SEC);
  MailApp.sendEmail({
    to: e, subject: 'Your login code',
    htmlBody: '<p>Your one-time code is <b style="font-size:20px;letter-spacing:4px">' + otp + '</b>. It expires in 5 minutes.</p>'
  });
  return generic;
}

/** Step 2: browser sends challengeId + code. Bound to the challenge, attempts capped, single use. */
function authVerifyOtp(challengeId, code) {
  var cache = CacheService.getScriptCache();
  var key = 'OTP_' + String(challengeId || '');
  var raw = cache.get(key);
  if (!raw) return { ok: false, message: 'Code expired. Request a new one.' };
  var rec = JSON.parse(raw);
  if (rec.tries >= EC_.OTP_MAX_TRIES) { cache.remove(key); return { ok: false, message: 'Too many wrong attempts. Request a new code.' }; }
  var good = safeEq_(hmacHex_(String(code || '').trim() + ':' + challengeId, serverSecret_()), rec.h);
  if (!good) {
    rec.tries++; cache.put(key, JSON.stringify(rec), EC_.OTP_TTL_SEC);
    return { ok: false, message: 'Incorrect code.' };
  }
  cache.remove(key);
  var user = findUser_(rec.email);
  if (!user) return { ok: false, message: 'Account disabled.' };
  var token = Utilities.getUuid() + '-' + Utilities.getUuid();
  var sess = { email: user.email, name: user.name, role: user.role, uid: user.id, iat: Date.now() };
  cache.put('SES_' + sha256Hex_(token), JSON.stringify(sess), EC_.SESSION_TTL_SEC);   // key is a hash: cache dump != tokens
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EC_.SHEETS.USERS).getRange(user.row, 7).setValue(new Date().toISOString());
  var lk = LockService.getScriptLock(); lk.waitLock(5000);
  try { auditAppend_(sess, 'Auth', 'LOGIN', user.email, null, null, ''); } finally { lk.releaseLock(); }
  return { ok: true, token: token, role: user.role, name: user.name, email: user.email };
}

function authLogout(token) {
  CacheService.getScriptCache().remove('SES_' + sha256Hex_(String(token || '')));
  return { ok: true };
}

/**
 * REPLACES the old validateSession(token, requiredRole).
 * Returns the session OBJECT {email,name,role,uid}. Old callers ignore the return value,
 * and setGSTLock() already reads `session.email`, so this is backward compatible.
 */
function validateSession(token, requiredRole) {
  if (!token || String(token).length > 200) throw new Error('Security Block: No session token provided.');
  var cache = CacheService.getScriptCache();
  var key = 'SES_' + sha256Hex_(String(token));
  var raw = cache.get(key);
  if (!raw) throw new Error('Security Block: Session expired. Please log in again.');
  var sess = JSON.parse(raw);
  var need = EC_.ROLE_RANK[String(requiredRole || 'user').toLowerCase()] || 2;
  if ((EC_.ROLE_RANK[sess.role] || 0) < need) throw new Error('Access Denied: ' + requiredRole + ' privileges required.');
  cache.put(key, raw, EC_.SESSION_TTL_SEC);         // sliding expiry
  return sess;
}

// ---------------------------------------------------------------------------
// 2. AUDIT TRAIL  (append-only, hash-chained; Companies (Accounts) Rules, 2014 r.3(1))
// ---------------------------------------------------------------------------
function diffObjects_(before, after) {
  var changed = [], b = before || {}, a = after || {};
  var keys = {}; Object.keys(b).forEach(function (k) { keys[k] = 1; }); Object.keys(a).forEach(function (k) { keys[k] = 1; });
  Object.keys(keys).forEach(function (k) { if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) changed.push(k); });
  return changed;
}
function clip_(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 20) + '…[truncated ' + (s.length - n + 20) + ']' : s; }

/** Must be called while holding the script lock (all your save* functions already do). */
function auditAppend_(sess, module_, action, recordId, before, after, reason) {
  var sh = sheet_(EC_.SHEETS.AUDIT, EC_.AUDIT_HEADERS);
  var props = PropertiesService.getScriptProperties();
  var prev = props.getProperty('AUDIT_LAST_HASH') || 'GENESIS';
  var seq = parseInt(props.getProperty('AUDIT_SEQ') || '0', 10) + 1;
  var changed = diffObjects_(before, after);
  var pick = function (o) { if (!o) return ''; var r = {}; (changed.length ? changed : Object.keys(o)).forEach(function (k) { r[k] = o[k]; }); return clip_(JSON.stringify(r), 40000); };
  var ts = new Date().toISOString();
  var row = [seq, ts, (sess && sess.email) || 'system', (sess && sess.role) || '', module_, action, String(recordId),
    changed.join(','), pick(before), pick(after), reason || ''];
  var hash = sha256Hex_(prev + '|' + row.join('|'));
  sh.appendRow(row.concat([prev, hash]));
  props.setProperty('AUDIT_LAST_HASH', hash);
  props.setProperty('AUDIT_SEQ', String(seq));
  return hash;
}

/** Recomputes the chain. Run monthly (trigger) and e-mail the head hash to an outside party. */
function verifyAuditChain_() {
  var rows = sheet_(EC_.SHEETS.AUDIT, EC_.AUDIT_HEADERS).getDataRange().getValues();
  var prev = 'GENESIS';
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var body = r.slice(0, 11).join('|');
    if (String(r[11]) !== prev || String(r[12]) !== sha256Hex_(prev + '|' + body)) return { ok: false, brokenAtRow: i + 1 };
    prev = String(r[12]);
  }
  return { ok: true, rows: rows.length - 1, headHash: prev };
}

// ---------------------------------------------------------------------------
// 3. SERVER-AUTHORITATIVE GST CALCULATION & VALIDATION
// ---------------------------------------------------------------------------
function validateGstin_(gstin, expectedStateCode) {
  if (!gstin) return { valid: true, registered: false };
  var g = String(gstin).toUpperCase().trim();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return { valid: false, message: 'GSTIN format is invalid.' };
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', hash = 0;
  for (var i = 0; i < 14; i++) { var p = chars.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2); hash += Math.floor(p / 36) + (p % 36); }
  if (chars[(36 - (hash % 36)) % 36] !== g[14]) return { valid: false, message: 'GSTIN check-digit failed.' };
  var sc = g.substr(0, 2);
  if (!STATE_CODES_[sc]) return { valid: false, message: 'Unknown state code ' + sc + ' in GSTIN.' };
  if (expectedStateCode && expectedStateCode !== sc) return { valid: false, message: 'GSTIN state (' + STATE_CODES_[sc] + ') differs from selected state.' };
  return { valid: true, registered: true, stateCode: sc, pan: g.substr(2, 10) };
}

function validateHsnSac_(code, minDigits) {
  var c = String(code || '').trim();
  if (!/^\d+$/.test(c)) return { valid: false, message: 'HSN/SAC must be numeric.' };
  if ([2, 4, 6, 8].indexOf(c.length) < 0) return { valid: false, message: 'HSN/SAC must be 2/4/6/8 digits.' };
  if (c.length < (minDigits || 4)) return { valid: false, message: 'Minimum ' + (minDigits || 4) + ' digits required for your turnover band.' };
  return { valid: true, isService: c.indexOf('99') === 0 };
}

/**
 * The ONLY place tax is computed. The browser's numbers are a preview; this result is saved.
 * items: [{desc, hsn|sac, qty, rate, discount, amount, taxRate, uom}]
 * ctx  : {supplierStateCode, posStateCode, defaultRate, roundToRupee (default true)}
 */
function computeInvoiceTax_(items, ctx) {
  var intra = String(ctx.supplierStateCode) === String(ctx.posStateCode);
  var groups = {}, lines = [], taxableP = 0;
  (items || []).forEach(function (it, idx) {
    var qty = num_(it.qty, 1), rate = num_(it.rate, 0), disc = num_(it.discount, 0);
    var base = (rate > 0) ? toPaise_(qty * rate) : toPaise_(num_(it.amount, 0));
    var net = base - toPaise_(disc);
    if (net < 0) throw new Error('Line ' + (idx + 1) + ': discount exceeds value.');
    var tr = it.taxRate !== undefined && it.taxRate !== '' ? num_(it.taxRate) : num_(ctx.defaultRate, 0);
    if (EC_.ALLOWED_GST_RATES.indexOf(tr) < 0) throw new Error('Line ' + (idx + 1) + ': GST rate ' + tr + '% is not an allowed slab.');
    var k = String(tr);
    if (!groups[k]) groups[k] = { rate: tr, taxableP: 0 };
    groups[k].taxableP += net; taxableP += net;
    lines.push({ desc: it.desc, hsn: it.hsn || it.sac || '', uom: it.uom || '', qty: qty, rate: rate, taxable: fromPaise_(net), taxRate: tr, costHead: it.costHead || '' });
  });
  var cg = 0, sg = 0, ig = 0, byRate = [];
  Object.keys(groups).forEach(function (k) {
    var g = groups[k], row = { rate: g.rate, taxable: fromPaise_(g.taxableP), cgst: 0, sgst: 0, igst: 0 };
    if (intra) {
      var half = Math.round(g.taxableP * g.rate / 200);       // paise; CGST == SGST always
      row.cgst = fromPaise_(half); row.sgst = fromPaise_(half); cg += half; sg += half;
    } else {
      var full = Math.round(g.taxableP * g.rate / 100);
      row.igst = fromPaise_(full); ig += full;
    }
    byRate.push(row);
  });
  var totalP = taxableP + cg + sg + ig, roundOff = 0;
  if (ctx.roundToRupee !== false) { var rounded = Math.round(totalP / 100) * 100; roundOff = rounded - totalP; totalP = rounded; }
  return {
    isInterState: !intra, lines: lines, byRate: byRate,
    taxable: fromPaise_(taxableP), cgst: fromPaise_(cg), sgst: fromPaise_(sg), igst: fromPaise_(ig),
    totalTax: fromPaise_(cg + sg + ig), roundOff: fromPaise_(roundOff), grandTotal: fromPaise_(totalP)
  };
}

/** Rejects a payload whose client-side totals disagree with the server's (tamper / stale-UI guard). */
function assertClientTotalsMatch_(d, calc, tolerance) {
  var tol = tolerance === undefined ? 1 : tolerance;
  [['subTotal', calc.taxable], ['igst', calc.igst], ['cgst', calc.cgst], ['sgst', calc.sgst], ['grandTotal', calc.grandTotal]].forEach(function (p) {
    if (Math.abs(num_(d[p[0]]) - p[1]) > tol) throw new Error('Tax mismatch on ' + p[0] + ': screen shows ' + num_(d[p[0]]) + ', server computed ' + p[1] + '. Refresh and retry.');
  });
}

/**
 * Call inside saveInvoice() right after `const d = JSON.parse(formStr)` (see PATCH 1).
 * Mutates d: fixes tax fields, validates GSTIN/HSN/POS, assigns a server invoice number for new docs.
 */
function prepareInvoiceServerSide_(d, sess) {
  var home = String(cfg_('HOME_STATE_CODE', '37'));
  var gs = validateGstin_(d.gstin, '');
  if (!gs.valid) throw new Error(gs.message);
  var pos = d.posStateCode || (gs.registered ? gs.stateCode : stateCodeFromName_(d.clientState));
  if (!pos) throw new Error('Place of Supply (state) is required.');
  var items = JSON.parse(d.itemsJson || '[]');
  if (!items.length) throw new Error('At least one line item is required.');
  var minDigits = parseInt(cfg_('HSN_MIN_DIGITS', 4), 10);
  items.forEach(function (it, i) { var v = validateHsnSac_(it.hsn || it.sac, minDigits); if (!v.valid) throw new Error('Line ' + (i + 1) + ': ' + v.message); });
  var calc = computeInvoiceTax_(items, { supplierStateCode: home, posStateCode: pos, defaultRate: num_(d.gstRate, 0) });
  assertClientTotalsMatch_(d, calc, 1);
  d.posStateCode = pos; d.isInterState = calc.isInterState;
  d.subTotal = calc.taxable; d.igst = calc.igst; d.cgst = calc.cgst; d.sgst = calc.sgst;
  d.roundOff = calc.roundOff; d.grandTotal = calc.grandTotal; d.taxByRate = calc.byRate;
  d.reverseCharge = d.reverseCharge === true || d.reverseCharge === 'Y' ? 'Y' : 'N';
  return calc;
}

// ---------------------------------------------------------------------------
// 4. GAPLESS DOCUMENT NUMBERING  (Rule 46: <=16 chars, unique, consecutive per FY)
// ---------------------------------------------------------------------------
/** Lock-free helpers: call ONLY while the script lock is held. */
function nextDocNumber_(docType, dateStr) {
  var fy = fyOf_(ymd_(dateStr));
  var prefix = String(cfg_('PREFIX_' + docType, { INV: 'SD', CN: 'CN', DN: 'DN', PI: 'PI', QUO: 'QUO', DC: 'DC', PO: 'PO', JV: 'JV' }[docType] || docType));
  var key = prefix + '|' + fy;
  var sh = sheet_(EC_.SHEETS.SEQ, ['Key', 'LastNo', 'UpdatedAt']);
  var rows = sh.getDataRange().getValues(), last = 0, rowIdx = -1;
  for (var i = 1; i < rows.length; i++) if (rows[i][0] === key) { last = parseInt(rows[i][1], 10) || 0; rowIdx = i + 1; break; }
  var seq = last + 1;
  var number = prefix + '/' + fy + '/' + String(seq).padStart(3, '0');
  if (number.length > 16) throw new Error('Document number "' + number + '" exceeds the 16-character GST limit; shorten the prefix.');
  return { number: number, seq: seq, key: key, rowIdx: rowIdx };
}
function commitDocNumber_(n) {
  var sh = sheet_(EC_.SHEETS.SEQ, ['Key', 'LastNo', 'UpdatedAt']);
  if (n.rowIdx > 0) sh.getRange(n.rowIdx, 2, 1, 2).setValues([[n.seq, new Date().toISOString()]]);
  else sh.appendRow([n.key, n.seq, new Date().toISOString()]);
}
/** One-off: seed counters from your existing Invoices sheet so numbering continues seamlessly. */
function seedSequencesFromInvoices() {
  var inv = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Invoices').getDataRange().getDisplayValues();
  var max = {};
  for (var i = 1; i < inv.length; i++) {
    var m = String(inv[i][6]).trim().match(/^([A-Za-z]+)\/(\d{2}-\d{2})\/(\d+)$/);
    if (!m) continue;
    var k = m[1].toUpperCase() + '|' + m[2]; max[k] = Math.max(max[k] || 0, parseInt(m[3], 10));
  }
  var sh = sheet_(EC_.SHEETS.SEQ, ['Key', 'LastNo', 'UpdatedAt']);
  Object.keys(max).forEach(function (k) { sh.appendRow([k, max[k], new Date().toISOString()]); });
  return max;
}

// ---------------------------------------------------------------------------
// 5. PERIOD CONTROL
// ---------------------------------------------------------------------------
/** Pure decision function (unit-testable). */
function periodDecision_(dateStr, st) {
  var d = ymd_(dateStr);
  if (!d) return { ok: false, reason: 'Invalid date.' };
  var fy = fyOf_(d);
  if (st.closedFYs.indexOf(fy) >= 0) return { ok: false, reason: 'Financial year ' + fy + ' is CLOSED. Post an adjustment in the open year or ask an admin to re-open with a reason.' };
  if (st.lockedMonths.indexOf(d.substr(0, 7)) >= 0) return { ok: false, reason: 'GST period ' + d.substr(0, 7) + ' is locked. Issue a credit/debit note in the current period instead.' };
  if (st.freezeDays > 0) {
    var age = Math.floor((Date.parse(st.today) - Date.parse(d)) / 86400000);
    if (age > st.freezeDays) return { ok: false, reason: 'Entries older than ' + st.freezeDays + ' days are frozen.' };
  }
  if (d > st.today) return { ok: false, reason: 'Future-dated entries are not allowed.' };
  return { ok: true };
}
function periodState_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var closed = [], locked = [];
  var fy = ss.getSheetByName(EC_.SHEETS.FY);
  if (fy) fy.getDataRange().getValues().slice(1).forEach(function (r) { if (String(r[3]).toUpperCase() === 'CLOSED') closed.push(String(r[0])); });
  var lk = ss.getSheetByName(EC_.SHEETS.LOCKS);
  if (lk) lk.getDataRange().getDisplayValues().slice(1).forEach(function (r) { if (r[1] === 'TRUE') locked.push(r[0]); });
  return { closedFYs: closed, lockedMonths: locked, freezeDays: parseInt(cfg_('FREEZE_DAYS', 0), 10) || 0, today: ymd_(new Date()) };
}
function assertPeriodOpen_(dateStr) {
  var r = periodDecision_(dateStr, periodState_());
  if (!r.ok) throw new Error(r.reason);
}

// ---------------------------------------------------------------------------
// 6. DOUBLE-ENTRY LEDGER ENGINE
// ---------------------------------------------------------------------------
/**
 * type: ASSET | LIABILITY | EQUITY | INCOME | EXPENSE
 * grp : presentation group (Schedule-III style)     cf: cash-flow bucket
 * cf  : CASH | WC (working capital) | INVESTING | FINANCING | NONCASH | PL
 */
var DEFAULT_COA_ = [
  ['1000', 'Cash in Hand', 'ASSET', 'Cash & Bank', 'CASH'],
  ['1010', 'Bank Accounts', 'ASSET', 'Cash & Bank', 'CASH'],
  ['1100', 'Trade Receivables (Sundry Debtors)', 'ASSET', 'Current Assets', 'WC'],
  ['1110', 'Advances to Suppliers', 'ASSET', 'Current Assets', 'WC'],
  ['1150', 'TDS / TCS Receivable', 'ASSET', 'Current Assets', 'WC'],
  ['1200', 'GST Input Credit - CGST', 'ASSET', 'Current Assets', 'WC'],
  ['1201', 'GST Input Credit - SGST', 'ASSET', 'Current Assets', 'WC'],
  ['1202', 'GST Input Credit - IGST', 'ASSET', 'Current Assets', 'WC'],
  ['1300', 'Inventory (Stock in Hand)', 'ASSET', 'Current Assets', 'WC'],
  ['1500', 'Fixed Assets (Gross Block)', 'ASSET', 'Non-Current Assets', 'INVESTING'],
  ['1590', 'Accumulated Depreciation', 'ASSET', 'Non-Current Assets', 'NONCASH'],
  ['2000', 'Trade Payables (Sundry Creditors)', 'LIABILITY', 'Current Liabilities', 'WC'],
  ['2010', 'Advances from Customers', 'LIABILITY', 'Current Liabilities', 'WC'],
  ['2100', 'GST Output - CGST', 'LIABILITY', 'Current Liabilities', 'WC'],
  ['2101', 'GST Output - SGST', 'LIABILITY', 'Current Liabilities', 'WC'],
  ['2102', 'GST Output - IGST', 'LIABILITY', 'Current Liabilities', 'WC'],
  ['2110', 'GST Payable under RCM', 'LIABILITY', 'Current Liabilities', 'WC'],
  ['2150', 'TDS Payable', 'LIABILITY', 'Current Liabilities', 'WC'],
  ['2500', 'Loans & Borrowings', 'LIABILITY', 'Non-Current Liabilities', 'FINANCING'],
  ['3000', "Owner's / Partners' Capital", 'EQUITY', 'Capital', 'FINANCING'],
  ['3100', 'Drawings', 'EQUITY', 'Capital', 'FINANCING'],
  ['3900', 'Retained Earnings', 'EQUITY', 'Reserves', 'FINANCING'],
  ['3950', 'Opening Balance Equity', 'EQUITY', 'Reserves', 'FINANCING'],
  ['4000', 'Sales / Service Revenue', 'INCOME', 'Revenue from Operations', 'PL'],
  ['4010', 'Sales Returns & Credit Notes', 'INCOME', 'Revenue from Operations', 'PL'],
  ['4900', 'Other Income', 'INCOME', 'Other Income', 'PL'],
  ['5000', 'Direct Expenses / Purchases', 'EXPENSE', 'Direct Expenses', 'PL'],
  ['6000', 'Indirect / Administrative Expenses', 'EXPENSE', 'Indirect Expenses', 'PL'],
  ['6800', 'Depreciation', 'EXPENSE', 'Indirect Expenses', 'PL'],
  ['6900', 'Round Off', 'EXPENSE', 'Indirect Expenses', 'PL']
];
function coaMap_(rows) {
  var m = {};
  (rows || DEFAULT_COA_).forEach(function (r) { m[String(r[0])] = { code: String(r[0]), name: r[1], type: r[2], grp: r[3], cf: r[4] }; });
  return m;
}
function ensureLedgerInfrastructure_() {
  var coa = sheet_(EC_.SHEETS.COA, ['Code', 'Name', 'Type', 'Group', 'CashFlow']);
  if (coa.getLastRow() < 2) coa.getRange(2, 1, DEFAULT_COA_.length, 5).setValues(DEFAULT_COA_);
  sheet_(EC_.SHEETS.LEDGER, EC_.LEDGER_HEADERS);
  sheet_(EC_.SHEETS.AUDIT, EC_.AUDIT_HEADERS);
  var fy = sheet_(EC_.SHEETS.FY, ['FY', 'Start', 'End', 'Status', 'ClosedBy', 'ClosedAt']);
  if (fy.getLastRow() < 2) { var f = fyOf_(ymd_(new Date())), r = fyRange_(f); fy.appendRow([f, r.start, r.end, 'OPEN', '', '']); }
}
function loadCoa_() {
  var rows = sheet_(EC_.SHEETS.COA, ['Code', 'Name', 'Type', 'Group', 'CashFlow']).getDataRange().getValues().slice(1).filter(function (r) { return r[0] !== ''; });
  return coaMap_(rows.length ? rows : null);
}
function loadLedger_() {
  var rows = sheet_(EC_.SHEETS.LEDGER, EC_.LEDGER_HEADERS).getDataRange().getValues().slice(1);
  return rows.filter(function (r) { return r[0] !== ''; }).map(function (r) {
    return { voucher: String(r[0]), srcType: r[1], srcId: String(r[2]), date: ymd_(r[3]), fy: r[4], acc: String(r[5]), party: r[6],
      costHead: r[7], site: r[8], dr: num_(r[9]), cr: num_(r[10]), narration: r[11], reversalOf: String(r[12] || '') };
  });
}

/** Pure: validates & normalises a voucher; throws on any double-entry violation. */
function validateVoucher_(v, coa) {
  if (!v.lines || v.lines.length < 2) throw new Error('A voucher needs at least two lines.');
  var dr = 0, cr = 0, out = [];
  v.lines.forEach(function (l, i) {
    var acc = String(l.acc);
    if (!coa[acc]) throw new Error('Line ' + (i + 1) + ': unknown account code ' + acc + '.');
    var d = toPaise_(l.dr), c = toPaise_(l.cr);
    if (d < 0 || c < 0) throw new Error('Line ' + (i + 1) + ': negative amounts are not allowed (use the opposite side).');
    if (d > 0 && c > 0) throw new Error('Line ' + (i + 1) + ': a line cannot be both debit and credit.');
    if (d === 0 && c === 0) return;                                  // silently drop zero lines
    dr += d; cr += c;
    out.push({ acc: acc, party: l.party || '', costHead: l.costHead || '', site: l.site || '', dr: fromPaise_(d), cr: fromPaise_(c), narration: l.narration || v.narration || '' });
  });
  if (out.length < 2) throw new Error('Voucher collapses to fewer than two non-zero lines.');
  if (dr !== cr) throw new Error('Unbalanced voucher: Dr ' + fromPaise_(dr) + ' vs Cr ' + fromPaise_(cr) + '. Nothing was posted.');
  return out;
}

/** Vouchers for (srcType, srcId) that are live = not themselves reversals and not yet reversed. */
function activeVouchers_(rows, srcType, srcId) {
  var reversed = {}; rows.forEach(function (r) { if (r.reversalOf) reversed[r.reversalOf] = 1; });
  var seen = {}, list = [];
  rows.forEach(function (r) {
    if (r.srcType === srcType && r.srcId === String(srcId) && !r.reversalOf && !reversed[r.voucher] && !seen[r.voucher]) { seen[r.voucher] = 1; list.push(r.voucher); }
  });
  return list;
}

/**
 * Posts a balanced voucher. MUST be called while holding the script lock.
 * v = {sourceType, sourceId, date, narration, lines:[{acc,dr,cr,party,costHead,site}], repost:true|false}
 * repost:true first reverses every live voucher of the same source (edit / re-save), then posts.
 */
function postVoucher_(sess, v) {
  var date = ymd_(v.date);
  assertPeriodOpen_(date);
  var coa = loadCoa_(), lines = validateVoucher_(v, coa);
  var sh = sheet_(EC_.SHEETS.LEDGER, EC_.LEDGER_HEADERS);
  var by = (sess && sess.email) || 'system', at = new Date().toISOString(), out = [];

  if (v.repost) {
    var existing = loadLedger_();
    activeVouchers_(existing, v.sourceType, v.sourceId).forEach(function (vn) {
      var origLines = existing.filter(function (r) { return r.voucher === vn; });
      assertPeriodOpen_(origLines[0].date);          // cannot silently rewrite a locked / closed period
      var jn = nextDocNumber_('JV', date); commitDocNumber_(jn);
      origLines.forEach(function (r) {
        out.push([jn.number, v.sourceType, v.sourceId, r.date, fyOf_(r.date), r.acc, r.party, r.costHead, r.site, r.cr, r.dr, 'Reversal of ' + vn, vn, by, at]);
      });
    });
  }
  var no = nextDocNumber_('JV', date); commitDocNumber_(no);
  lines.forEach(function (l) {
    out.push([no.number, v.sourceType, v.sourceId, date, fyOf_(date), l.acc, l.party, l.costHead, l.site, l.dr, l.cr, l.narration, '', by, at]);
  });
  sh.getRange(sh.getLastRow() + 1, 1, out.length, EC_.LEDGER_HEADERS.length).setValues(out);
  return no.number;
}
/** Cancels a source (e.g. cancelled invoice) by posting contra entries; never edits history. */
function reverseSource_(sess, srcType, srcId, reason) {
  var rows = loadLedger_(), live = activeVouchers_(rows, srcType, srcId);
  if (!live.length) return 0;
  var sh = sheet_(EC_.SHEETS.LEDGER, EC_.LEDGER_HEADERS), out = [], by = (sess && sess.email) || 'system', at = new Date().toISOString();
  live.forEach(function (vn) {
    var orig = rows.filter(function (r) { return r.voucher === vn; });
    assertPeriodOpen_(orig[0].date);
    var jn = nextDocNumber_('JV', orig[0].date); commitDocNumber_(jn);
    orig.forEach(function (r) { out.push([jn.number, srcType, srcId, r.date, r.fy, r.acc, r.party, r.costHead, r.site, r.cr, r.dr, 'Reversal: ' + (reason || ''), vn, by, at]); });
  });
  sh.getRange(sh.getLastRow() + 1, 1, out.length, EC_.LEDGER_HEADERS.length).setValues(out);
  return live.length;
}

// ---------------------------------------------------------------------------
// 7. POSTING ADAPTERS  (call these instead of the old manageJournalEntry blocks)
// ---------------------------------------------------------------------------
function taxLines_(calc, side) {          // side 'cr' for output tax, 'dr' for input tax
  var out = [], mk = function (acc, amt) { if (amt > 0) { var l = { acc: acc, dr: 0, cr: 0 }; l[side] = amt; out.push(l); } };
  if (side === 'cr') { mk('2100', calc.cgst); mk('2101', calc.sgst); mk('2102', calc.igst); }
  else { mk('1200', calc.cgst); mk('1201', calc.sgst); mk('1202', calc.igst); }
  return out;
}
function invoiceVoucher_(d, calc) {
  var ro = calc.roundOff, lines = [
    { acc: '1100', party: d.clientName, dr: calc.grandTotal, cr: 0, site: d.siteName },
    { acc: '4000', cr: calc.taxable, dr: 0, site: d.siteName }
  ].concat(taxLines_(calc, 'cr'));
  if (ro !== 0) lines.push({ acc: '6900', dr: ro < 0 ? -ro : 0, cr: ro > 0 ? ro : 0 });
  // NOTE: roundOff>0 means customer pays MORE than taxable+tax -> extra credit; <0 -> debit
  return { sourceType: 'INVOICE', sourceId: d.invNum, date: d.date, narration: 'Tax Invoice ' + d.invNum, lines: lines, repost: true };
}
function creditNoteVoucher_(d, calc) {
  var ro = calc.roundOff, lines = [
    { acc: '4010', dr: calc.taxable, cr: 0 }
  ];
  ['2100', '2101', '2102'].forEach(function (a, i) { var amt = [calc.cgst, calc.sgst, calc.igst][i]; if (amt > 0) lines.push({ acc: a, dr: amt, cr: 0 }); });
  lines.push({ acc: '1100', party: d.clientName, dr: 0, cr: calc.grandTotal });
  if (ro !== 0) lines.push({ acc: '6900', dr: ro > 0 ? ro : 0, cr: ro < 0 ? -ro : 0 });
  return { sourceType: 'CREDIT_NOTE', sourceId: d.invNum, date: d.date, narration: 'Credit Note ' + d.invNum, lines: lines, repost: true };
}
/**
 * p = {id, date, vendor, costHead, site, taxable, cgst, sgst, igst, total, itcEligible(bool), rcm(bool), category:'DIRECT'|'INDIRECT'}
 * No silent "auto-correct": if taxable+tax != total the voucher is rejected.
 */
function purchaseVoucher_(p) {
  var tax = toPaise_(p.cgst) + toPaise_(p.sgst) + toPaise_(p.igst);
  if (toPaise_(p.taxable) + tax !== toPaise_(p.total) && !p.rcm) throw new Error('Purchase total must equal taxable value + tax. Correct the entry; the system will not auto-adjust it.');
  var exp = p.category === 'INDIRECT' ? '6000' : '5000';
  var itc = p.itcEligible !== false;
  var lines = [{ acc: exp, dr: fromPaise_(toPaise_(p.taxable) + (itc ? 0 : tax)), cr: 0, costHead: p.costHead, site: p.site }];
  if (itc) taxLines_({ cgst: num_(p.cgst), sgst: num_(p.sgst), igst: num_(p.igst) }, 'dr').forEach(function (l) { lines.push(l); });
  if (p.rcm) {                                                     // vendor gets taxable only; tax goes to RCM payable
    lines.push({ acc: '2000', party: p.vendor, cr: p.taxable, dr: 0 }, { acc: '2110', cr: fromPaise_(tax), dr: 0 });
  } else lines.push({ acc: '2000', party: p.vendor, cr: p.total, dr: 0 });
  return { sourceType: 'PURCHASE', sourceId: p.id, date: p.date, narration: 'Purchase ' + (p.invNo || p.id), lines: lines, repost: true };
}
/** Receipt from customer. sourceId = PAYMENT ID (unique) — NOT the invoice number (old bug). */
function receiptVoucher_(pay) {
  var adv = pay.isAdvance === true;
  return {
    sourceType: 'RECEIPT', sourceId: pay.id, date: pay.date, narration: 'Receipt ' + pay.id + (pay.ref ? ' vs ' + pay.ref : ''), repost: true,
    lines: [{ acc: pay.mode === 'Cash' ? '1000' : '1010', dr: pay.amount, cr: 0 },
    { acc: adv ? '2010' : '1100', party: pay.clientName, dr: 0, cr: pay.amount }]
  };
}
function vendorPaymentVoucher_(pay) {
  return {
    sourceType: 'PAYMENT', sourceId: pay.id, date: pay.date, narration: 'Payment ' + pay.id, repost: true,
    lines: [{ acc: '2000', party: pay.vendor, dr: pay.amount, cr: 0 }, { acc: pay.mode === 'Cash' ? '1000' : '1010', dr: 0, cr: pay.amount }]
  };
}
function tdsReceivableVoucher_(t) {
  return {
    sourceType: 'TDS', sourceId: t.id, date: t.date, narration: 'TDS deducted by customer on ' + t.invNum, repost: true,
    lines: [{ acc: '1150', dr: t.amount, cr: 0 }, { acc: '1100', party: t.clientName, dr: 0, cr: t.amount }]
  };
}
/**
 * Month-end GST set-off: nets ITC against output tax in the statutory order and books the cash payable.
 * Balances are passed in (from the ledger) so this stays pure & testable.
 * bal = {outCgst,outSgst,outIgst,inCgst,inSgst,inIgst}  (all >=0)
 * Utilisation order (Sec 49A/49B): IGST credit -> IGST, CGST, SGST ; CGST credit -> CGST, IGST ; SGST credit -> SGST, IGST.
 */
function gstSetOff_(bal) {
  var P = function (x) { return toPaise_(x); };
  var oC = P(bal.outCgst), oS = P(bal.outSgst), oI = P(bal.outIgst), iC = P(bal.inCgst), iS = P(bal.inSgst), iI = P(bal.inIgst);
  var use = function (avail, need) { var u = Math.min(avail, need); return u; };
  var res = { iToI: 0, iToC: 0, iToS: 0, cToC: 0, cToI: 0, sToS: 0, sToI: 0 };
  res.iToI = use(iI, oI); iI -= res.iToI; oI -= res.iToI;
  res.iToC = use(iI, oC); iI -= res.iToC; oC -= res.iToC;
  res.iToS = use(iI, oS); iI -= res.iToS; oS -= res.iToS;
  res.cToC = use(iC, oC); iC -= res.cToC; oC -= res.cToC;
  res.cToI = use(iC, oI); iC -= res.cToI; oI -= res.cToI;
  res.sToS = use(iS, oS); iS -= res.sToS; oS -= res.sToS;
  res.sToI = use(iS, oI); iS -= res.sToI; oI -= res.sToI;
  var dr = {}, cr = {};
  dr['2102'] = res.iToI + res.cToI + res.sToI; dr['2100'] = res.iToC + res.cToC; dr['2101'] = res.iToS + res.sToS;
  cr['1202'] = res.iToI + res.iToC + res.iToS; cr['1200'] = res.cToC + res.cToI; cr['1201'] = res.sToS + res.sToI;
  var lines = [];
  Object.keys(dr).forEach(function (a) { if (dr[a] > 0) lines.push({ acc: a, dr: fromPaise_(dr[a]), cr: 0 }); });
  Object.keys(cr).forEach(function (a) { if (cr[a] > 0) lines.push({ acc: a, dr: 0, cr: fromPaise_(cr[a]) }); });
  return { lines: lines, cashPayable: { cgst: fromPaise_(oC), sgst: fromPaise_(oS), igst: fromPaise_(oI) }, totalCash: fromPaise_(oC + oS + oI), carryForwardITC: { cgst: fromPaise_(iC), sgst: fromPaise_(iS), igst: fromPaise_(iI) } };
}

// ---------------------------------------------------------------------------
// 8. FINANCIAL STATEMENTS  (pure functions over ledger rows — feed them any period)
// ---------------------------------------------------------------------------
function inRange_(r, from, to) { return (!from || r.date >= from) && (!to || r.date <= to); }
function signedBal_(type, dr, cr) { return (type === 'ASSET' || type === 'EXPENSE') ? dr - cr : cr - dr; }

function buildTrialBalance_(rows, coa, asOf, opts) {
  opts = opts || {};
  var acc = {};
  rows.forEach(function (r) {
    if (asOf && r.date > asOf) return;
    if (opts.from && r.date < opts.from && !opts.cumulative) return;
    var k = r.acc; if (!acc[k]) acc[k] = { dr: 0, cr: 0 };
    acc[k].dr += toPaise_(r.dr); acc[k].cr += toPaise_(r.cr);
  });
  var list = [], tDr = 0, tCr = 0;
  Object.keys(acc).sort().forEach(function (k) {
    var net = acc[k].dr - acc[k].cr, c = coa[k] || { name: 'Unknown ' + k, type: '?', grp: '?' };
    var drBal = net > 0 ? net : 0, crBal = net < 0 ? -net : 0;
    if (drBal === 0 && crBal === 0) return;
    tDr += drBal; tCr += crBal;
    list.push({ code: k, name: c.name, type: c.type, group: c.grp, debit: fromPaise_(drBal), credit: fromPaise_(crBal) });
  });
  return { asOf: asOf, rows: list, totalDebit: fromPaise_(tDr), totalCredit: fromPaise_(tCr), balanced: tDr === tCr, difference: fromPaise_(tDr - tCr) };
}

function buildProfitAndLoss_(rows, coa, from, to) {
  var by = {}, ex = { FY_CLOSE: 1, OPENING: 1 };
  rows.forEach(function (r) {
    if (!inRange_(r, from, to) || ex[r.srcType]) return;
    var c = coa[r.acc]; if (!c || (c.type !== 'INCOME' && c.type !== 'EXPENSE')) return;
    if (!by[r.acc]) by[r.acc] = 0;
    by[r.acc] += c.type === 'INCOME' ? (toPaise_(r.cr) - toPaise_(r.dr)) : (toPaise_(r.dr) - toPaise_(r.cr));
  });
  var rev = [], cogs = [], opx = [], oth = [], rP = 0, dP = 0, iP = 0, oP = 0;
  Object.keys(by).sort().forEach(function (k) {
    var c = coa[k], item = { code: k, name: c.name, amount: fromPaise_(by[k]) };
    if (c.type === 'INCOME' && c.grp === 'Revenue from Operations') { rev.push(item); rP += by[k]; }
    else if (c.type === 'INCOME') { oth.push(item); oP += by[k]; }
    else if (c.grp === 'Direct Expenses') { cogs.push(item); dP += by[k]; }
    else { opx.push(item); iP += by[k]; }
  });
  var gross = rP - dP, net = gross + oP - iP;
  return {
    from: from, to: to, revenue: rev, totalRevenue: fromPaise_(rP), directExpenses: cogs, totalDirect: fromPaise_(dP),
    grossProfit: fromPaise_(gross), otherIncome: oth, totalOtherIncome: fromPaise_(oP),
    indirectExpenses: opx, totalIndirect: fromPaise_(iP), netProfit: fromPaise_(net),
    profitBeforeDepreciation: fromPaise_(net + (by['6800'] || 0))
  };
}

function buildBalanceSheet_(rows, coa, asOf) {
  var bal = {};
  rows.forEach(function (r) {
    if (asOf && r.date > asOf) return;
    if (!bal[r.acc]) bal[r.acc] = { dr: 0, cr: 0 };
    bal[r.acc].dr += toPaise_(r.dr); bal[r.acc].cr += toPaise_(r.cr);
  });
  var A = {}, L = {}, E = {}, aP = 0, lP = 0, eP = 0, plNet = 0;
  Object.keys(bal).sort().forEach(function (k) {
    var c = coa[k]; if (!c) return;
    var s = signedBal_(c.type, bal[k].dr, bal[k].cr);
    if (c.type === 'INCOME' || c.type === 'EXPENSE') { plNet += (bal[k].cr - bal[k].dr); return; }
    if (s === 0) return;
    var item = { code: k, name: c.name, amount: fromPaise_(s) };
    var bucket = c.type === 'ASSET' ? A : c.type === 'LIABILITY' ? L : E;
    (bucket[c.grp] = bucket[c.grp] || { name: c.grp, items: [], total: 0 });
    bucket[c.grp].items.push(item); bucket[c.grp].total += s;
    if (c.type === 'ASSET') aP += s; else if (c.type === 'LIABILITY') lP += s; else eP += s;
  });
  if (plNet !== 0) {                                              // profit not yet transferred by a closing voucher
    (E['Reserves'] = E['Reserves'] || { name: 'Reserves', items: [], total: 0 });
    E['Reserves'].items.push({ code: 'P&L', name: 'Profit & Loss Account (current / unclosed years)', amount: fromPaise_(plNet) });
    E['Reserves'].total += plNet; eP += plNet;
  }
  var fmt = function (o) { return Object.keys(o).map(function (k) { o[k].total = fromPaise_(o[k].total); return o[k]; }); };
  return {
    asOf: asOf, assets: fmt(A), liabilities: fmt(L), equity: fmt(E),
    totalAssets: fromPaise_(aP), totalLiabilities: fromPaise_(lP), totalEquity: fromPaise_(eP),
    balanced: aP === lP + eP, difference: fromPaise_(aP - (lP + eP))
  };
}

/** Indirect-method cash flow. Every non-cash account's period movement is bucketed; sum == change in cash (proved by the check). */
function buildCashFlow_(rows, coa, from, to) {
  var openCash = 0, closeCash = 0, mov = {};
  rows.forEach(function (r) {
    var c = coa[r.acc]; if (!c) return;
    var net = toPaise_(r.dr) - toPaise_(r.cr);
    if (c.cf === 'CASH') {
      if (r.date < from) openCash += net;
      if (r.date <= to) closeCash += net;
      return;
    }
    if (r.date >= from && r.date <= to) {
      if (r.srcType === 'FY_CLOSE') return;                       // closing entries are internal transfers
      mov[r.acc] = (mov[r.acc] || 0) + (-net);                    // cash effect = -(dr-cr)
    }
  });
  var op = [], inv = [], fin = [], profit = 0, wc = 0, nc = 0, iv = 0, fn = 0;
  Object.keys(mov).sort().forEach(function (k) {
    var c = coa[k], v = mov[k], item = { code: k, name: c.name, amount: fromPaise_(v) };
    if (c.cf === 'PL') { profit += v; }
    else if (c.cf === 'NONCASH') { nc += v; op.push(item); }
    else if (c.cf === 'WC') { wc += v; op.push(item); }
    else if (c.cf === 'INVESTING') { iv += v; inv.push(item); }
    else { fn += v; fin.push(item); }
  });
  var net = profit + nc + wc + iv + fn;
  return {
    from: from, to: to, openingCash: fromPaise_(openCash),
    netProfit: fromPaise_(profit), nonCashAdjustments: fromPaise_(nc), workingCapitalChanges: fromPaise_(wc),
    operating: { items: op, netProfit: fromPaise_(profit), total: fromPaise_(profit + nc + wc) },
    investing: { items: inv, total: fromPaise_(iv) }, financing: { items: fin, total: fromPaise_(fn) },
    netChangeInCash: fromPaise_(net), closingCash: fromPaise_(closeCash),
    reconciled: openCash + net === closeCash
  };
}

// ---------------------------------------------------------------------------
// 9. FINANCIAL-YEAR CLOSING
// ---------------------------------------------------------------------------
/** Pure: builds the closing voucher lines that zero every P&L account into Retained Earnings. */
function buildClosingLines_(rows, coa, fy) {
  var r = fyRange_(fy), bal = {};
  rows.forEach(function (x) {
    if (x.date < r.start || x.date > r.end) return;
    var c = coa[x.acc]; if (!c || (c.type !== 'INCOME' && c.type !== 'EXPENSE')) return;
    bal[x.acc] = (bal[x.acc] || 0) + (toPaise_(x.dr) - toPaise_(x.cr));
  });
  var lines = [], net = 0;
  Object.keys(bal).sort().forEach(function (k) {
    if (bal[k] === 0) return;
    net += bal[k];                                               // dr-cr positive => expense-heavy
    lines.push(bal[k] > 0 ? { acc: k, dr: 0, cr: fromPaise_(bal[k]) } : { acc: k, dr: fromPaise_(-bal[k]), cr: 0 });
  });
  lines.push(net > 0 ? { acc: '3900', dr: fromPaise_(net), cr: 0 } : { acc: '3900', dr: 0, cr: fromPaise_(-net) });
  return { lines: lines, netProfit: fromPaise_(-net) };
}

// ---------------------------------------------------------------------------
// 10. GSTR-1 / GSTR-3B JSON
// ---------------------------------------------------------------------------
var UQC_ = { 'NOS': 'NOS', 'NO': 'NOS', 'NUMBERS': 'NOS', 'KG': 'KGS', 'KGS': 'KGS', 'MTR': 'MTR', 'M': 'MTR', 'LTR': 'LTR', 'L': 'LTR', 'BOX': 'BOX', 'SET': 'SET', 'SQM': 'SQM', 'SQFT': 'SQF', 'MW': 'OTH', 'ACRE': 'OTH', 'HRS': 'OTH', 'DAY': 'OTH' };
function uqc_(u, isService) { if (isService) return 'NA'; return UQC_[String(u || '').toUpperCase()] || 'OTH'; }

/**
 * Normalises a row of the legacy `Invoices` sheet (display values) to a document object.
 * Returns null for non-GST documents / cancelled / deleted rows.
 */
function normalizeSalesRow_(r) {
  var type = String(r[2] || r[1]).trim();
  if (['Tax Invoice', 'Credit Note', 'Debit Note'].indexOf(type) < 0) return null;
  if (String(r[38]).toUpperCase() === 'TRUE') return null;
  var cancelled = /CANCELLED/.test(String(r[36]) + String(r[34]));
  var items = []; try { items = JSON.parse(r[32] || '[]'); } catch (e) { }
  return {
    type: type, cancelled: cancelled, num: String(r[6]).trim(), date: ymd_(r[7]), gstin: String(r[12] || '').trim().toUpperCase(),
    client: r[5], stateName: r[3], defaultRate: num_(r[13], 0), items: items,
    igst: num_(r[25]), cgst: num_(r[26]), sgst: num_(r[27]), taxable: num_(r[28]), total: num_(r[29])
  };
}

/**
 * docs: normalised documents (see above); opts: {gstin, period:'MMYYYY', homeStateCode, grossTurnover, curGrossTurnover, hsnLegacy}
 * Returns {json, warnings[], summary}. Validate the file in the GST Offline Tool / your GSP sandbox before filing.
 */
function buildGSTR1Json_(docs, opts) {
  var warnings = [], home = opts.homeStateCode, mm = opts.period.substr(0, 2), yyyy = opts.period.substr(2, 4);
  var prefix = yyyy + '-' + mm;
  var b2b = {}, b2cl = {}, b2cs = {}, cdnr = {}, cdnur = [], hsnB2B = {}, hsnB2C = {}, series = {};
  var totals = { taxable: 0, igst: 0, cgst: 0, sgst: 0 };

  docs.forEach(function (d) {
    if (!d) return;
    // number-series bookkeeping covers cancelled docs too (they must appear in Table 13)
    var m = d.num.match(/^(.*?)(\d+)$/);
    if (d.type === 'Tax Invoice' && m && d.date.substr(0, 7) === prefix) {
      var sk = m[1]; (series[sk] = series[sk] || []).push({ n: parseInt(m[2], 10), num: d.num, cancelled: d.cancelled });
    }
    if (d.cancelled || d.date.substr(0, 7) !== prefix) return;

    var gs = validateGstin_(d.gstin, '');
    if (d.gstin && !gs.valid) { warnings.push(d.num + ': ' + gs.message); return; }
    var registered = !!d.gstin;
    var pos = registered ? d.gstin.substr(0, 2) : stateCodeFromName_(d.stateName);
    if (!pos) { warnings.push(d.num + ': place of supply missing.'); return; }
    var calc; try { calc = computeInvoiceTax_(d.items, { supplierStateCode: home, posStateCode: pos, defaultRate: d.defaultRate, roundToRupee: false }); } catch (ex) { warnings.push(d.num + ': ' + ex.message); return; }
    if (Math.abs(calc.igst - d.igst) + Math.abs(calc.cgst - d.cgst) + Math.abs(calc.sgst - d.sgst) > 1) warnings.push(d.num + ': tax recomputed from lines (' + calc.igst + '/' + calc.cgst + '/' + calc.sgst + ') differs from stored (' + d.igst + '/' + d.cgst + '/' + d.sgst + ').');
    var itms = calc.byRate.map(function (g, i) { return { num: i + 1, itm_det: { rt: g.rate, txval: g.taxable, iamt: g.igst, camt: g.cgst, samt: g.sgst, csamt: 0 } }; });
    var sign = d.type === 'Credit Note' ? -1 : 1;
    totals.taxable += sign * calc.taxable; totals.igst += sign * calc.igst; totals.cgst += sign * calc.cgst; totals.sgst += sign * calc.sgst;

    // HSN summary (Table 12, split B2B / B2C)
    var target = registered ? hsnB2B : hsnB2C;
    calc.lines.forEach(function (ln) {
      var tax = ln.taxable * ln.taxRate / 100, k = ln.hsn + '|' + ln.taxRate + '|' + ln.uom;
      var isSvc = String(ln.hsn).indexOf('99') === 0;
      var h = target[k] = target[k] || { hsn_sc: ln.hsn, desc: String(ln.desc || '').slice(0, 30), uqc: uqc_(ln.uom, isSvc), qty: 0, val: 0, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0, rt: ln.taxRate };
      h.qty += (h.uqc === 'NA' ? 0 : sign * ln.qty); h.txval += sign * ln.taxable; h.val += sign * (ln.taxable + tax);
      if (calc.isInterState) h.iamt += sign * tax; else { h.camt += sign * tax / 2; h.samt += sign * tax / 2; }
    });

    if (d.type === 'Tax Invoice') {
      var inv = { inum: d.num, idt: ddmmyyyy_(d.date), val: calc.grandTotal, pos: pos, rchrg: 'N', inv_typ: 'R', itms: itms };
      if (registered) { (b2b[d.gstin] = b2b[d.gstin] || []).push(inv); }
      else if (calc.isInterState && calc.grandTotal > EC_.B2CL_THRESHOLD) { (b2cl[pos] = b2cl[pos] || []).push({ inum: d.num, idt: ddmmyyyy_(d.date), val: calc.grandTotal, itms: itms.map(function (x) { return { num: x.num, itm_det: { rt: x.itm_det.rt, txval: x.itm_det.txval, iamt: x.itm_det.iamt, csamt: 0 } }; }) }); }
      else {
        calc.byRate.forEach(function (g) {
          var k = pos + '|' + g.rate, s = b2cs[k] = b2cs[k] || { sply_ty: calc.isInterState ? 'INTER' : 'INTRA', pos: pos, typ: 'OE', rt: g.rate, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
          s.txval += g.taxable; s.iamt += g.igst; s.camt += g.cgst; s.samt += g.sgst;
        });
      }
    } else {
      var nt = { ntty: d.type === 'Credit Note' ? 'C' : 'D', nt_num: d.num, nt_dt: ddmmyyyy_(d.date), val: calc.grandTotal, pos: pos, rchrg: 'N', inv_typ: 'R', itms: itms };
      if (registered) (cdnr[d.gstin] = cdnr[d.gstin] || []).push(nt);
      else cdnur.push({ typ: calc.isInterState && calc.grandTotal > EC_.B2CL_THRESHOLD ? 'B2CL' : 'B2CS', ntty: nt.ntty, nt_num: nt.nt_num, nt_dt: nt.nt_dt, val: nt.val, pos: pos, itms: itms });
    }
  });

  var r2 = function (o) { Object.keys(o).forEach(function (k) { if (typeof o[k] === 'number') o[k] = round2_(o[k]); }); return o; };
  var docIssue = [];
  Object.keys(series).forEach(function (pfx) {
    var s = series[pfx].sort(function (a, b) { return a.n - b.n; }), cancel = s.filter(function (x) { return x.cancelled; }).length;
    for (var i = 1; i < s.length; i++) if (s[i].n - s[i - 1].n > 1) warnings.push('GAP in series "' + pfx + '": ' + (s[i - 1].n + 1) + ' … ' + (s[i].n - 1) + ' missing between ' + s[i - 1].num + ' and ' + s[i].num + '. Explain or cancel-report each missing number (Table 13).');
    docIssue.push({ num: 1, from: s[0].num, to: s[s.length - 1].num, totnum: s[s.length - 1].n - s[0].n + 1, cancel: cancel, net_issue: s[s.length - 1].n - s[0].n + 1 - cancel });
  });

  var hsnOut = function (m) { return Object.keys(m).map(function (k, i) { var h = r2(m[k]); h.num = i + 1; return h; }); };
  var json = {
    gstin: opts.gstin, fp: opts.period, gt: opts.grossTurnover || 0, cur_gt: opts.curGrossTurnover || 0,
    b2b: Object.keys(b2b).map(function (c) { return { ctin: c, inv: b2b[c] }; }),
    b2cl: Object.keys(b2cl).map(function (p) { return { pos: p, inv: b2cl[p] }; }),
    b2cs: Object.keys(b2cs).map(function (k) { return r2(b2cs[k]); }),
    cdnr: Object.keys(cdnr).map(function (c) { return { ctin: c, nt: cdnr[c] }; }),
    cdnur: cdnur, exp: [], at: [], atadj: [], exemp: { inv: [] },
    hsn: opts.hsnLegacy ? { data: hsnOut(hsnB2B).concat(hsnOut(hsnB2C)) } : { hsn_b2b: hsnOut(hsnB2B), hsn_b2c: hsnOut(hsnB2C) },
    doc_issue: { doc_det: docIssue.length ? [{ doc_num: 1, doc_typ: 'Invoices for outward supply', docs: docIssue }] : [] }
  };
  return { json: json, warnings: warnings, summary: r2(totals) };
}

/**
 * GSTR-3B (tables 3.1, 4) built from the LEDGER so returns always tie to the books.
 * ITC: only what you booked as eligible ITC (accounts 12xx). Also reconcile with GSTR-2B before filing.
 */
function buildGSTR3BFromLedger_(rows, period, gstin) {
  var mm = period.substr(0, 2), yyyy = period.substr(2, 4), from = yyyy + '-' + mm + '-01';
  var to = yyyy + '-' + mm + '-31', S = function (acc, side) { var t = 0; rows.forEach(function (r) { if (r.acc === acc && r.date >= from && r.date <= to && r.srcType !== 'GST_SETOFF') t += toPaise_(side === 'cr' ? r.cr - r.dr : r.dr - r.cr); }); return t; };
  var f = fromPaise_;
  return {
    gstin: gstin, ret_period: period,
    sup_details: {
      osup_det: { txval: f(S('4000', 'cr') + S('4010', 'cr')), iamt: f(S('2102', 'cr')), camt: f(S('2100', 'cr')), samt: f(S('2101', 'cr')), csamt: 0 },
      osup_zero: { txval: 0, iamt: 0, csamt: 0 }, osup_nil_exmp: { txval: 0 },
      isup_rev: { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 }, osup_nongst: { txval: 0 }
    },
    itc_elg: {
      itc_avl: [{ ty: 'OTH', iamt: f(S('1202', 'dr')), camt: f(S('1200', 'dr')), samt: f(S('1201', 'dr')), csamt: 0 }],
      itc_rev: [{ ty: 'RUL', iamt: 0, camt: 0, samt: 0, csamt: 0 }],
      itc_net: { iamt: f(S('1202', 'dr')), camt: f(S('1200', 'dr')), samt: f(S('1201', 'dr')), csamt: 0 },
      itc_inelg: [{ ty: 'RUL', iamt: 0, camt: 0, samt: 0, csamt: 0 }]
    }
  };
}

// ---------------------------------------------------------------------------
// 11. PUBLIC API FOR THE BROWSER  (every function validates a token)
// ---------------------------------------------------------------------------
function api_getTrialBalance(token, asOf) {
  validateSession(token, 'accountant');
  return JSON.stringify(buildTrialBalance_(loadLedger_(), loadCoa_(), ymd_(asOf)));
}
function api_getProfitAndLoss(token, from, to) {
  validateSession(token, 'accountant');
  return JSON.stringify(buildProfitAndLoss_(loadLedger_(), loadCoa_(), ymd_(from), ymd_(to)));
}
function api_getBalanceSheet(token, asOf) {
  validateSession(token, 'accountant');
  return JSON.stringify(buildBalanceSheet_(loadLedger_(), loadCoa_(), ymd_(asOf)));
}
function api_getCashFlow(token, from, to) {
  validateSession(token, 'accountant');
  return JSON.stringify(buildCashFlow_(loadLedger_(), loadCoa_(), ymd_(from), ymd_(to)));
}
function api_getGSTR1Json(token, month, year) {
  validateSession(token, 'accountant');
  var inv = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Invoices').getDataRange().getDisplayValues().slice(1);
  var docs = inv.map(normalizeSalesRow_).filter(Boolean);
  var res = buildGSTR1Json_(docs, {
    gstin: String(cfg_('GSTIN', '')), period: String(month).padStart(2, '0') + year,
    homeStateCode: String(cfg_('HOME_STATE_CODE', '37')), grossTurnover: num_(cfg_('PREV_FY_TURNOVER', 0)), curGrossTurnover: num_(cfg_('CUR_FY_TURNOVER', 0))
  });
  return JSON.stringify(res);
}
function api_getGSTR3BJson(token, month, year) {
  validateSession(token, 'accountant');
  var p = String(month).padStart(2, '0') + year;
  return JSON.stringify(buildGSTR3BFromLedger_(loadLedger_(), p, String(cfg_('GSTIN', ''))));
}
function api_closeFinancialYear(token, fy) {
  var sess = validateSession(token, 'admin');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var coa = loadCoa_(), rows = loadLedger_(), r = fyRange_(fy);
    var tb = buildTrialBalance_(rows, coa, r.end);
    if (!tb.balanced) throw new Error('Trial Balance is out of balance by ' + tb.difference + '. Fix before closing.');
    var st = periodState_(), m = parseInt(r.start.substr(0, 4), 10), missing = [];
    for (var i = 0; i < 12; i++) { var y = m + (i + 3 >= 12 ? 1 : 0), mo = ((i + 3) % 12) + 1, key = y + '-' + String(mo).padStart(2, '0'); if (st.lockedMonths.indexOf(key) < 0) missing.push(key); }
    if (missing.length) throw new Error('Lock GST for all months first. Unlocked: ' + missing.join(', '));
    var cl = buildClosingLines_(rows, coa, fy);
    var no = null;
    if (cl.lines.length > 1) {
      var no0 = nextDocNumber_('JV', r.end); commitDocNumber_(no0);
      var sh = sheet_(EC_.SHEETS.LEDGER, EC_.LEDGER_HEADERS), out = [];
      cl.lines.forEach(function (l) { out.push([no0.number, 'FY_CLOSE', fy, r.end, fy, l.acc, '', '', '', l.dr, l.cr, 'Year-end closing ' + fy, '', sess.email, new Date().toISOString()]); });
      sh.getRange(sh.getLastRow() + 1, 1, out.length, EC_.LEDGER_HEADERS.length).setValues(out); no = no0.number;
    }
    var fys = sheet_(EC_.SHEETS.FY, ['FY', 'Start', 'End', 'Status', 'ClosedBy', 'ClosedAt']), d = fys.getDataRange().getValues(), done = false;
    for (var j = 1; j < d.length; j++) if (String(d[j][0]) === fy) { fys.getRange(j + 1, 4, 1, 3).setValues([['CLOSED', sess.email, new Date().toISOString()]]); done = true; }
    if (!done) fys.appendRow([fy, r.start, r.end, 'CLOSED', sess.email, new Date().toISOString()]);
    var nx = String(parseInt(fy.substr(0, 2), 10) + 1).padStart(2, '0') + '-' + String(parseInt(fy.substr(3, 2), 10) + 1).padStart(2, '0'), nr = fyRange_(nx);
    if (!fys.getDataRange().getValues().some(function (x) { return String(x[0]) === nx; })) fys.appendRow([nx, nr.start, nr.end, 'OPEN', '', '']);
    auditAppend_(sess, 'FinancialYear', 'CLOSE', fy, { status: 'OPEN' }, { status: 'CLOSED', netProfit: cl.netProfit, voucher: no }, '');
    return JSON.stringify({ status: 'success', netProfit: cl.netProfit, closingVoucher: no });
  } catch (e) { return JSON.stringify({ status: 'error', message: e.message }); }
  finally { lock.releaseLock(); }
}
/** Admin-only, reason mandatory, fully audited. */
function api_reopenFinancialYear(token, fy, reason) {
  var sess = validateSession(token, 'admin');
  if (!reason || String(reason).trim().length < 10) return JSON.stringify({ status: 'error', message: 'A written reason (10+ chars) is mandatory.' });
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = sheet_(EC_.SHEETS.FY), d = sh.getDataRange().getValues();
    for (var j = 1; j < d.length; j++) if (String(d[j][0]) === fy) { sh.getRange(j + 1, 4).setValue('OPEN'); auditAppend_(sess, 'FinancialYear', 'REOPEN', fy, { status: 'CLOSED' }, { status: 'OPEN' }, reason); return JSON.stringify({ status: 'success' }); }
    return JSON.stringify({ status: 'error', message: 'FY not found' });
  } finally { lock.releaseLock(); }
}
function api_monthEndGstSetOff(token, month, year) {
  var sess = validateSession(token, 'accountant');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var rows = loadLedger_(), to = year + '-' + String(month).padStart(2, '0') + '-31';
    var bal = function (acc, side) { var t = 0; rows.forEach(function (r) { if (r.acc === acc && r.date <= to) t += toPaise_(side === 'cr' ? r.cr - r.dr : r.dr - r.cr); }); return fromPaise_(Math.max(0, t)); };
    var so = gstSetOff_({ outCgst: bal('2100', 'cr'), outSgst: bal('2101', 'cr'), outIgst: bal('2102', 'cr'), inCgst: bal('1200', 'dr'), inSgst: bal('1201', 'dr'), inIgst: bal('1202', 'dr') });
    if (!so.lines.length) return JSON.stringify({ status: 'success', message: 'Nothing to set off.', setoff: so });
    var date = year + '-' + String(month).padStart(2, '0') + '-' + new Date(year, month, 0).getDate();
    var no = postVoucher_(sess, { sourceType: 'GST_SETOFF', sourceId: year + '-' + month, date: date, narration: 'GST ITC set-off', lines: so.lines, repost: true });
    auditAppend_(sess, 'GST', 'SETOFF', year + '-' + month, null, so, '');
    return JSON.stringify({ status: 'success', voucher: no, setoff: so });
  } catch (e) { return JSON.stringify({ status: 'error', message: e.message }); }
  finally { lock.releaseLock(); }
}
