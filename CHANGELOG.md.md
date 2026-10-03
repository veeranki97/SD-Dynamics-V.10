# Changelog — SD Dynamics V.10

**Format:** [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) | **Versioning:** [Semantic Versioning](https://semver.org/)

---

## [v2.3.8] — Current Version (2026-10-02)

### Current Features ✅

This version includes all stable features developed to date:

#### **Core Invoicing**
- ✅ Tax Invoice, Bill of Supply, Proforma, Delivery Challan, Credit Note
- ✅ Auto GST calculation (CGST/SGST/IGST, UTGST, Cess)
- ✅ Per-line tax rates (mixed 5%/12%/18%/28% in one invoice)
- ✅ Tax-inclusive / tax-exclusive modes
- ✅ Invoice-level discount (flat/percent/with-tax)
- ✅ Multiple discount modes (unit discount, percent discount, net discount)
- ✅ Round-off calculation (auto-adjusted for paise accuracy)
- ✅ Multi-currency billing (INR + 21 others)
- ✅ Professional PDF generation (jsPDF + html2canvas)
- ✅ Rule 48 compliance (no row cut across pages)
- ✅ UPI QR code in PDF (via qrcode.js)

#### **GST Compliance & Reporting**
- ✅ GSTR-1 JSON export (B2B, B2C, HSN, CDNR/CDNUR sections)
- ✅ GSTR-3B JSON export (Sections 3.1, 3.2, 4)
- ✅ GSTR-2B reconciliation (import JSON from portal)
- ✅ E-Way Bill JSON (NIC format)
- ✅ HSN/SAC validation (4/6/8-digit, turnover-based minimum)
- ✅ GSTIN checksum validation + state map (all 36 codes)
- ✅ Place of supply (state + code)
- ✅ Inter-state / intra-state detection
- ✅ Export invoice handling (SEZ, LUT)
- ✅ Reverse Charge (RCM) flag

#### **TDS / TCS & Vendor Management**
- ✅ TDS computations (Sections 194C, 194H, 194I, 194J, 194O, 195, 206C)
- ✅ TCS / GST-TCS
- ✅ Form 26Q data
- ✅ Vendor ledgers with GSTIN, phone, email, bank details
- ✅ Vendor history tracking
- ✅ Payment-on-account mode (credit-applied)

#### **Financial Management**
- ✅ Chart of Accounts (tree structure, account types, parent-child)
- ✅ Double-entry ledger journals (unbalanced check, append-only)
- ✅ Trial Balance (date-range, balanced flag, paise precision)
- ✅ P&L Statement (Revenue - Direct Costs = GP; + Other Income - Indirect = NP)
- ✅ Balance Sheet (A = L + E, reconciliation flag)
- ✅ Cash Flow (indirect method, buckets, daily balance)
- ✅ Cost Centres (hierarchy, allocation)
- ✅ Opening balances (OPENING voucher)
- ✅ Period locks (lock invoices by date range)
- ✅ Fiscal year management
- ✅ Closing entries (FY_CLOSE voucher type)

#### **Purchase & Inventory**
- ✅ Purchase bill entry (with ITC eligibility tracking)
- ✅ Purchase Order (PO) management
- ✅ Work Orders (multi-line, linked to invoices)
- ✅ Stock tracking (manual entry)
- ✅ Product master (name, HSN, rate, tax %)

#### **Transactions & Payments**
- ✅ Payment receipt entry
- ✅ Multiple payment modes (Cash, Check, Bank, NEFT, UPI, Credit)
- ✅ Bulk payment import
- ✅ Payment reversals/voids
- ✅ Overpayment block (validates against invoice total)
- ✅ Client credit application (pay with a previous credit note)

#### **Backup & Recovery**
- ✅ Automatic daily backup (1st run after 5s, then daily)
- ✅ 30-day backup retention
- ✅ Soft-delete invoice trash (30-day recovery window)
- ✅ Transactional restore (pre-restore snapshot, rollback on fail)
- ✅ Permanent delete option
- ✅ Manual backup trigger (with 5s throttle)
- ✅ Trash bin UI (restore/purge forever)

#### **Security & Access Control**
- ✅ Immutable audit log (hash-chained, user/timestamp/before/after)
- ✅ CORS lockdown (localhost only, no wildcard)
- ✅ Path traversal protection (all file operations safe)
- ✅ Body size limit (5 MB) & validation
- ✅ XSS hardening (DOMPurify, no innerHTML interpolation)
- ✅ Soft-delete flag (is_deleted, not hard-wipe)

#### **Recurring Invoicing**
- ✅ Recurring templates (daily/weekly/monthly/quarterly/yearly)
- ✅ Auto-fire on boot + daily check
- ✅ End modes (onDate, afterN occurrences)
- ✅ Shared tax computation (same as one-off invoices)
- ✅ Sequential numbering for auto-generated bills
- ✅ Missed-cycle recovery (fire on next app start)

#### **HR/Payroll Module**
- ✅ Employee master (name, code, UAN, ESIC, PF/ESI applicability)
- ✅ Attendance tracking (daily marks: P/W/PL/H/A)
- ✅ Payroll processing (Basic + HRA + DA + Allowances)
- ✅ PF calculation (EE/ER/EPS/EDLI)
- ✅ ESI calculation (EE/ER, wage cap)
- ✅ Payroll lock (prevent edits after approval)
- ✅ ECR export (EPFO electronic challan-cum-return)
- ✅ ESIC register (CSV with monthly wages, zero-days reasons)
- ✅ Form-T (Muster roll attendance register)
- ✅ Form XVII (Wages register, 15+ columns)
- ✅ Wages register (searchable, payable days, deductions)
- ✅ Minimum wages master (state-wise)
- ✅ Multi-site support (HR locations)
- ✅ PF cap & ESI cap configuration

#### **Data Management**
- ✅ Export all data (JSON) with overwrite gating
- ✅ Import with merge / overwrite modes
- ✅ Invoice revision history (last 30 per invoice)
- ✅ Activity logs (entity type, action, timestamp, diff)
- ✅ Master data (HSN, Units, Expense Categories)
- ✅ Counter reconciliation (post-import, avoid collisions)

#### **Multi-Business & Profiles**
- ✅ Multiple business profiles (GSTIN, bank, UPI per business)
- ✅ Profile switching (client not isolated yet — see TODO)
- ✅ Each profile has separate settings

#### **Terms & Customization**
- ✅ Terms template library (rich text)
- ✅ Invoice-level custom terms & notes
- ✅ Extra sections (certificates, declarations)
- ✅ PDF styling (logo, signature, custom fonts)
- ✅ Client/vendor names in invoice (auto-saved)

#### **UI/UX**
- ✅ Dark mode (CSS variables)
- ✅ Command palette (Ctrl+K search)
- ✅ Real-time validation (on form change)
- ✅ PDF preview (before save/download)
- ✅ Responsive design (desktop + tablet)
- ✅ Mobile menu (hamburger on small screens)
- ✅ Notifications (toast / banner alerts)
- ✅ Date pickers (browser native)
- ✅ Inline editing (grid cells, inline saves)

#### **Platform Support**
- ✅ Windows (HTA launcher, PowerShell install)
- ✅ Offline operation (PWA service worker)
- ✅ Localhost-only binding (data never leaves machine)

#### **Admin & Monitoring**
- ✅ Version check (GitHub releases API)
- ✅ Health endpoint (`/api/health`, uptime, error tail)
- ✅ Control panel (backup, open folders, update scripts)
- ✅ Error log rotation (200KB cap)
- ✅ System diagnostics

---

## Versioning & Update Path

### How to Update

1. **Check current version:** Settings → About → v2.3.8
2. **Download latest:** https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest
3. **Extract to same folder** (replaces `_system/` code, keeps `data/` intact)
4. **Restart app** (stop launcher, restart it)

### What's Safe to Change

- ✅ Add clients, vendors, invoices → **backed up daily**
- ✅ Run manual backup (`Control Panel → Backup Now`)
- ✅ Restore from 30-day trash → **soft delete, not hard wipe**
- ✅ Edit DRAFT invoices → **history preserved in revisions/**
- ✅ Change business profile settings → **per profile**

### What's NOT Safe

- ❌ **Never** delete `data/` folder manually (use trash bin instead)
- ❌ **Never** edit JSON files directly in `data/` (use the UI)
- ❌ **Never** mix different app versions accessing same data folder
- ❌ **Never** force-kill the app mid-save (use Stop button)

---

## Planned Features (v2.4.0+)

### Short-term (Next 2-3 months)

- [ ] **Profile Isolation** — Each business gets its own ledger (currently all share)
- [ ] **Payment Reminders** — Email alerts for overdue invoices
- [ ] **E-invoicing Integration** — IRN via GSP partner (needs IP whitelisting)
- [ ] **Bank CSV Import** — Match statement rows to invoices
- [ ] **Audit Report (PDF)** — CA-ready summary for lender/ITR
- [ ] **GST 2B Auto-Download** — Fetch from portal (GSTN API)

### Medium-term (3-6 months)

- [ ] **Mobile App** — React Native wrapper (share backend)
- [ ] **API for 3rd-party** — Let Tally/Zoho read/write SD Dynamics data
- [ ] **Budget vs Actual** — Track spending against budget heads
- [ ] **Multi-currency Ledger** — Store all in INR but display in foreign currency
- [ ] **E-way Bill Auto-Generate** — Pre-fill from invoice data

### Long-term (6-12 months)

- [ ] **CRM Module** — Lead → Opportunity → Invoice → Repeat
- [ ] **Field Sales App** — Offline invoice creation on mobile
- [ ] **GST 2A Matching** — Cross-check purchase lines against seller's GSTR-1
- [ ] **Advance-tax Computation** — Q1/Q2/Q3/Q4 installments with surcharge
- [ ] **Trade Receivables Aging** — Group invoices by age (0-30, 30-60, etc.)

---

## Known Limitations (v2.3.8)

| Limitation | Workaround | Target Fix |
|---|---|---|
| All businesses share same Chart of Accounts | Export COA JSON before profile switch | v2.4.0 (Profile Isolation) |
| Fixed asset depreciation manual | Spreadsheet tracking | v2.6.0 (Asset register) |
| E-invoicing requires manual IRN upload | Use GSP portal for IRN | v2.4.0 (GSP integration) |
| No PO-to-invoice auto-match | Manual bill entry | v2.4.0 (PO matching) |
| SMS reminders (no native support) | Use IFTTT webhook | v2.5.0 (Notification API) |
| CSV/PDF data not OCR-scanned | Manual entry or upload image | v2.5.0 (Tesseract + OCR) |

---

## Breaking Changes (v2.3.8 vs v2.0.0)

- **v2.0.0 → v2.1.0**: `invoiceNumber` field mandatory (was optional, auto-generated)
- **v2.1.0 → v2.2.0**: Ledger entries now require `costHeadId` (can be null for non-tracked)
- **v2.2.0 → v2.3.0**: Purchase `gstEligible` flag split into `itcEligible` + `blockedCredit`
- **v2.3.x (stable)**: No breaking changes (new fields optional, backwards-compat)

---

## Migration Guides

### From Tally Prime / Zoho Books

1. **Export as CSV** from old app (bills, purchases, clients)
2. **Prepare CSV template** (rename columns to match SD Dynamics)
3. **Bulk import** via `Data Manager → Import CSV`
4. **Verify** GL totals match old app
5. **Run import reconciliation** (meta counter sync)

### From Free GST Billing Software (v1.x)

1. **Backup your `data/` folder** (both apps)
2. **Export from v1.x:** `Reports → Export All Data` → `export.json`
3. **Rename to old-data.json**, drop in `_system/data/import/`
4. **In v2.x:** `Data Manager → Import → Select old-data.json → Merge`
5. **Check differences:** Counters, account codes, client GSTINs

---

## Support & Troubleshooting

### Common Issues

**Q: Invoices won't save / "Duplicate invoice number" error**
- **Cause:** Counter reset or manual JSON edit
- **Fix:** `Settings → System → Reset Counters`, then increment

**Q: GSTR-3B JSON won't download**
- **Cause:** Missing journals for credit notes
- **Fix:** Recreate as debit notes; ensure invoices have journal entries

**Q: Backup takes >5 seconds**
- **Cause:** 10,000+ invoices or slow disk
- **Fix:** Archive old data (export to external drive), keep last 2 years

**Q: "Payment exceeds invoice total" with ₹0.01 difference**
- **Cause:** Float rounding (common in browser)
- **Fix:** This is expected; 1 paise tolerance built-in

**Q: PDF has blank rows**
- **Cause:** Item name missing or HTML parse error
- **Fix:** Add item name in invoice; try different PDF viewer

### Getting Help

- **Bug reports:** https://github.com/veeranki97/SD-Dynamics-V.10/issues
- **Feature requests:** Same (label: `enhancement`)
- **Security issues:** Email veeranki97@gmail.com (do NOT open issue)

---

## License & Attribution

**MIT License** — free to use, modify, distribute.

**Built on:** [Free GST Billing Software](https://github.com/IamRamgarhia/Free-GST-Billing-Software) (DiceCodes, MIT) with enhancements for:
- Multi-business profiles
- HRM/Payroll module
- Advanced financial statements
- Work orders + cost centers

**Contributors:** Bharath Kumar, community testers, CA advisors

---

## Version History (Compact)

| Version | Date | Major Feature |
|---|---|---|
| v1.0.0 | 2024-01 | GST invoicing, GSTR-1/3B |
| v1.10.0 | 2024-06 | Server-side tax, path-traversal fixes |
| v2.0.0 | 2025-01 | Chart of Accounts, journals, statements |
| v2.1.0 | 2025-03 | Recurring invoicing, audit log |
| v2.2.0 | 2025-06 | HRM/Payroll, cost centers |
| v2.3.0 | 2026-07 | Profile isolation prep, TDS/TCS |
| **v2.3.8** | **2026-10** | **Current (stable)** |

---

**Last Updated:** October 2, 2026 | **Next Release:** Planned for early 2027