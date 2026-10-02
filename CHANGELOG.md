# Changelog — SD Dynamics V.10

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.1.0] — 2026-10-02

### 🔴 **Critical Fixes**

#### Ledger & Journal Integrity

- **Fixed: Double-posting of Payment Ledger Entries (B1)**
  - Payment journal entries were posting with invoice number as sourceId, causing all live entries with the same source to be marked redundant when a new payment was saved.
  - **Fix:** Payment source tracking now correctly uses payment reference or ID, preventing duplicate ledger posts.
  - **Impact:** Ledger accuracy restored; no more phantom double-entries.

- **Fixed: Invoice Ledger Disconnection (B2)**
  - Journal entry failures were silently caught (`console.error()`) after invoice row and PDF were already saved, leaving invoices without corresponding ledger entries.
  - **Fix:** Save transaction is now atomic: all-or-nothing. If journal posting fails, the invoice row is rolled back.
  - **Impact:** Accounts Receivable and Sales GL accounts now always reconcile.

- **Fixed: Bulk Payments Posted Without Journal (B3)**
  - Bulk payment processor wrote Payment rows but never posted corresponding journal entries, leaving receivables unrecorded in the ledger.
  - **Fix:** Payment records now trigger complete double-entry journal posting before commit.
  - **Impact:** Bulk operations no longer create GL gaps.

- **Fixed: Restored Invoices Unbalanced in Ledger (B4)**
  - Invoice restoration omitted the Round-Off line from reconstructed journals, causing imbalanced entries and exception-handling swallows.
  - **Fix:** Round-off calculation is now preserved during restoration from backup.
  - **Impact:** Restored invoices post cleanly; audit trail intact.

- **Fixed: Purchase Entry Data Loss (B5)**
  - Auto-correction of `taxable + tax ≠ total` silently altered user input; `appendRow` had mismatched column counts (13 vs 14); internal `Utilities.sleep(1500)` inside lock caused timeout cascades.
  - **Fix:** User is prompted to verify tax totals; column counts aligned across create/edit paths; I/O moved outside critical section.
  - **Impact:** No more silent data modifications; faster concurrent saves.

#### Financial Statements

- **Fixed: P&L Double-Counted Expenses (B6)**
  - Purchases **and** Vendor Payments were both counted as expenses; credit notes ignored; no date range applied to operational sheets.
  - **Fix:** P&L now reconciles to the Ledger with unified expense posting and credit-note netting.
  - **Impact:** Profit now matches tax books.

- **Fixed: Balance Sheet Account Misclassification (B7)**
  - Expense payments booked to `"<vendor> (AP/Expense)"` incorrectly landed under Assets instead of Liabilities.
  - **Fix:** Chart of Accounts now enforces Account Type and Statutory Group; Balance Sheet equation validation (A = L + E) enforced before save.
  - **Impact:** Lender-ready Balance Sheet; passes audit verification.

---

### 📋 **Data Integrity & Compliance**

#### Sequential Invoicing

- **Fixed: Duplicate Invoice Numbers (Sequential)**
  - Invoice numbers were client-typed, cached for 5 minutes, and reusable after deletion—enabling the same number to be assigned to multiple invoices.
  - **Fix:** Server-side monotonic counter per document type per fiscal year; conflict detection; no gaps; immutable once issued.
  - **Affected Flows:** Create Invoice, Create Purchase, Create Payment → all now post gapless sequences.

#### Tax Invoice Editing

- **Fixed: Tax Invoice Post-Issue Overwrites**
  - Tax invoices could be overwritten in place after issue, violating GST Rule 34 and Companies Act retention rules.
  - **Fix:** After issue, all changes now require Credit Note or Debit Note; edits only permitted in DRAFT state.
  - **Enforcement:** UI lock; server-side state check; audit log capture.

#### Credit Note GST Reporting

- **Fixed: Credit Notes Added Instead of Subtracted (HSN)**
  - Credit notes added to HSN summary instead of subtracted; GSTR-1 reports counted them as positive supply (inflation).
  - **Fix:** Separate CDNR/CDNUR sections now track credit/debit notes; negative netting applied to GSTR-1/3B JSON exports.
  - **GSTR Compliance:** Now matches GST portal format exactly.

#### GSTR-3B Row Label

- **Fixed: GSTR-3B Row 3.1(c) Label & Double-Counting**
  - Row 3.1(c) had inconsistent label; nil-rated and exempted exports double-counted in 3.1(a) (B2C table) AND 3.1(b), with IGST added twice to tax payable.
  - **Fix:** 3.1(c) now reads "Other outward supplies (nil rated, exempted)"; exports counted once in 3.1(b) only; IGST posted once.
  - **Audit Impact:** Exports reconcile to GST return; no tax overpayment.

---

### ✅ **GST Accuracy & Validation**

- **Fixed: HSN Code Validation**
  - HSN accepted free text; no minimum-digit enforcement based on turnover.
  - **Fix:** HSN now validated as 4/6/8-digit numeric; minimum enforced per notified threshold (4 digits up to ₹5 Cr, 6 above); mandatory in GSTR-1 Table 12.

- **Fixed: GSTIN Format & State Map**
  - GSTIN checksum validated but state map had duplicate keys and missing codes (26, 97, 99; "Jammu" label error).
  - **Fix:** State map updated to all 36 codes; checksums validated against independent sample GSTINs.

- **Fixed: Per-Line Tax Rates**
  - One `GSTRate` per invoice applied uniformly to all items; mixed supplies incorrectly taxed.
  - **Fix:** Per-line `taxRate` field added; rate validated against notified slab list on each save.
  - **Example:** Invoice can now contain 5% (service) + 12% (supply) + 18% (labor) in one document.

---

### 🔐 **Session & Security**

#### Session Management

- **Fixed: Silent Session Timeout (S1)**
  - Sessions cached with 28,800 s TTL but Google Cache API max is 21,600 s (6 h); sessions died silently after 6 hours.
  - **Fix:** Cache TTL clamped to 6 h (21600 s); fallback to Properties Service with explicit timeout warnings.
  - **User Impact:** Logout warning appears before session expires; no unexpected re-login mid-work.

#### Authorization

- **Fixed: 22 Functions Without Token Checks (Auth-Critical)**
  - ~22 server functions had zero token validation: `getFinancialStatements`, `saveManualJournal`, `executeYearEndRollover`, `createBackup`, `toggleInvoiceGST`, `runFullSystemDiagnostic`, etc.
  - **Fix:** All API functions now require valid role token; fail-fast on mismatch.
  - **Security Model:** `validateSession()` called first; function returns 403 if unauthorized.

#### Role-Based Access Control

- **Fixed: Cosmetic Roles (Only `deleteData` Checked Admin)**
  - Any staff token could call `saveSettings` (change admin PIN, set `FREEZE_DAYS=0`), `setGSTLock`, `executeYearEndRollover`.
  - **Fix:** Role-based access control (RBAC) now enforced on all sensitive operations.
  - **Roles:** `admin` (full access), `accountant` (view/edit, no settings), `viewer` (read-only), `guest` (login prompt).

---

### 🎨 **UI & XSS Hardening**

- **Fixed: XSS in Dynamic Content (118 Sites)**
  - 118 `innerHTML` assignments; ≥29 template lines interpolated names unescaped: `${c.name}`, `onclick="del('Invoices','${i.invNum}')"` vulnerable to quote-injection.
  - **Fix:** All dynamic content rendered via safe DOM methods; event delegation; no interpolation in attribute contexts.
  - **Example:** Client name now sanitized through `textContent` before display.

- **Added: Warnings for Missing Data (Amber Box)**
  - Missing HSN codes, GSTINs without state code now displayed in an amber alert box under errors.
  - **UX:** Non-blocking warnings don't prevent save, but appear clearly above results.

---

### 📊 **Audit Trail & Record-Keeping**

#### Immutable Audit Log

- **Fixed: Deletable Audit Log**
  - `AuditLog` had no user field, no before/after values; `cleanAuditLog()` **deleted** entries; `deleteData()` hard-deleted payments.
  - **Fix:** Append-only `AuditLog` with hash-chained entries (previous entry SHA256 in each new row); user/timestamp/module/record-id/before/after captured.
  - **Compliance:** Cannot edit or erase audit log without breaking the chain; visible to CA/lender.

#### Backup Retention

- **Fixed: 7-Day Backup Deletion**
  - Backups older than 7 days were auto-deleted.
  - **Fix:** Backups now retained 8 years per Companies Act s.128; 72 months for GST records; Trash bin available for 30-day recovery window.

---

### ⚡ **Performance & Concurrency**

- **Fixed: Lock Contention During PDF/QR Generation**
  - `waitLock(10000)` held while generating PDF, fetching QR over HTTP, and sleeping 1.5 s → concurrent users timed out.
  - **Fix:** Slow I/O executed **after** lock release; lock timeout increased to 30 s for edge cases.
  - **Result:** Multiple users can save invoices simultaneously; PDF generation doesn't block.

- **Fixed: Numbering Race Condition**
  - Next invoice number computed in browser cache (5-min window); two users could receive the same number, second bounced with "Duplicate".
  - **Fix:** Server counter is now atomic; conflict detection rejects duplicate numbers; clear error message + auto-increment suggestion.

---

### 📄 **Features Added**

- **GSTR-3B JSON Export:** Downloads JSON in GST portal format (Table 3.1, 3.2, 4); offline-ready.
- **GSTR-1 JSON Export:** B2B, B2C, HSN, Credit/Debit Note sections; e-way bill data included.
- **Trial Balance & Statement Print:** Date-range filtered TB, P&L, Balance Sheet, Cash Flow with `balanced` flag validation.
- **Per-Line Tax Rates:** Support for mixed 5%/12%/18%/28% in one invoice.
- **Bank Reconciliation:** BRS (Bank Reconciliation Statement) template; auto-match bank statement CSV.
- **Cost Head Dimensions:** Ledger entries tagged with Site/Project for cost analytics.

---

### 🛠 **Deprecated / Removed**

- `validateSession()` old Props-only fallback replaced with Properties + Cache hybrid.
- `cachePutChunked()` removed; all caching now respects 100 KB byte limit.
- Hard-coded 18% GST rate in `runRecurringBilling()` replaced with line-item rates.

---

## [v1.0.0] — 2026-09-15

### Initial Release

- GST-compliant invoicing (CGST/SGST/IGST auto-calculation).
- GSTR-1, GSTR-3B, GSTR-2B reconciliation screens.
- TDS/TCS computations.
- PDF generation with Rule 48 multi-page compliance.
- Vendor & Client ledgers.
- Period locks & FY close.
- Period-end backup with 7-day retention.
- Session management with OTP login.
- Audit log (mutable; replaced in v1.1.0).

---

## Notes for Contributors

- **Before tagging a release:** Run `npm test` and verify GSTR JSON exports against the live GST portal.
- **For fixes:** Always include the bug reference (e.g., "B1: Payment double-post") and impact statement.
- **For features:** Link to the enhancement proposal issue if one exists.
- **Sync:** After merging to `main`, update `_system/package.json` version field.
