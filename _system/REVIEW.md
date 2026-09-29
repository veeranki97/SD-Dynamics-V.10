# Billing & Accounting App — Architecture, Compliance and Audit-Readiness Review
Files reviewed: `CodeGSV1.txt` (5,905 lines, ~95 functions) and `HTMLV1.txt` (8,124 lines, 64 `google.script.run` calls).
Everything marked **✔ tested** below is covered by the 20 automated tests in `tests/core.test.js`, which run against in-memory Apps Script mocks; your original `Code.gs` also loads and runs under the same mocks (`npm run smoke`). Nothing has been run against real Google services, so treat the deployed behaviour of Drive/Mail/Cache as unverified until you try it.

> **Read this first — the honest headline.** The app is a capable single-company tool with a lot of thoughtful guard-rails (period locks, optimistic concurrency, overpayment blocks, GSTIN checksum). But it has (a) several **money-affecting bugs** that make the ledger diverge from the invoices, (b) **authorization holes** that let any visitor to the `/exec` URL call many write/destructive functions, and (c) **structural gaps** (no chart of accounts, no true audit trail, client-side tax) that no banker, CA or GST officer would accept. Items in §1 and §4 should be fixed before any real customer's data goes in. Reaching Zoho/Tally parity on Google Sheets is not realistic; §1.4 says where the ceiling is.

---
## 1. Code review & local execution

### 1.1 Critical bugs (books are wrong)
| # | Where | Problem | Effect |
|---|---|---|---|
| B1 | `savePayment` → `manageJournalEntry("PAYMENT", ref \|\| id …)` | Ledger `sourceId` is the **invoice number**; `manageJournalEntry` first marks every live entry with the same source as reversed | The 2nd part-payment on an invoice deletes the 1st payment's ledger entry. ✔ tested (regression) |
| B2 | `saveInvoice`: `catch (journalErr) { console.error(…) }` | Journal failure is swallowed after the invoice row and PDF are already saved | Invoice exists, ledger doesn't. AR, Sales, GST payable all wrong |
| B3 | `processBulkPayment` | Writes Payment rows but **never posts a journal**; also filters on a non-existent `"Status"` column (falls back to *Site*), so **cancelled invoices receive money**; deleted payments still count as paid | Ledger vs sub-ledger drift |
| B4 | `restoreInvoice` | Rebuilt journal omits the Round-Off line → unbalanced → exception swallowed | Restored invoice has no ledger entry |
| B5 | `savePurchase` | Silently "auto-corrects" `taxable + tax ≠ total`; new-row `appendRow` has 13 columns (edit path has 14 → `WO_No` lost); `Utilities.sleep(1500)` inside the lock | Wrong numbers posted without warning |
| B6 | `getFinalAccountsData` | P&L from operational sheets: Purchases **and** Vendor Payments both counted as expense; no date range; credit notes ignored | Profit understated, double-counted; differs from the ledger-based screen |
| B7 | `getFinancialStatements` | Classification by `name.includes("sales" / "(ap)" …)`; expense payments book to `"<vendor> (AP/Expense)"` which lands under **Assets**; no A = L + E check | Balance Sheet cannot be relied on |
| B8 | `saveInvoiceWithLog` | Calls `saveInvoice(formStr)` (token slot!) and checks the FY lock **after** saving | Dead/incorrect wrapper |
| B9 | `runRecurringBilling` | `Date.now().slice(-6)` inside a loop → duplicate draft numbers; hard-coded 18 % and "Andhra Pradesh"; posts all tax as **IGST** even intra-state; never called by UI or trigger | Wrong tax on recurring bills |
| B10 | `manageJournalEntry` | FY column stamped with *today's* FY, not the transaction date; "reversal" overwrites the `IsReversed` flag (history mutated); floats summed directly | Not an audit-grade ledger |
| B11 | `putCacheChunked` | 90 000 **chars** per chunk vs 100 KB **byte** limit; `₹` is 3 bytes | Cache `put` throws on Indian text |
| B12 | `getAppData` | `purchases.slice(0,500)` not reversed (shows oldest); `deleteData` writes boolean `true` where readers test `=== "TRUE"` → deleted invoices still count in Work-Order limits | Stale/incorrect screens |
| B13 | Sessions | `validateSession` reads Properties fallback that is never written; `put(…, 28800)` but Cache max is 21 600 s (6 h) | Sessions silently die at 6 h |

### 1.2 Security
| Sev | Finding | Fix |
|---|---|---|
| **Critical** | ~22 server functions have **no token check** (`getFinancialStatements`, `saveManualJournal`, `executeYearEndRollover`, `createBackup`, `toggleInvoiceGST`, `runFullSystemDiagnostics` …). With "Execute as me / Anyone", anyone who opens the URL can call them from the browser console. `executeYearEndRollover` **deletes live rows** (only guarded by "April/May"). | `PATCHES` P5 |
| **Critical** | Roles are cosmetic: only `deleteData` checks admin. Any staff token can `saveSettings` (change admin PIN, set `FREEZE_DAYS=0`, write any key via `useDirectKeys`), `setGSTLock`, `cleanAuditLog` | `validateSession(token,'admin')` + key whitelist (P6) |
| **High** | Login UI placeholder reads `e.g. admin1236` — the default admin PIN; default PINs are seeded in `getConfig` | Removed by e-mail OTP flow (H1/H2) |
| **High** | OTP is global per role (not per login), `verifyLoginOTP` has **no attempt limit** → anyone can brute-force the 6-digit code during the 5-minute window after a genuine request; wrong-PIN attempts lock the role for everyone (DoS); OTP via `Math.random` | Per-challenge, HMAC-stored, 5 tries, `getUuid`-derived ✔ tested |
| **High** | Every user shares one PIN per role → no individual accountability; PIN hashed with unsalted SHA-256 and the raw hash is also accepted as a PIN (`providedHash === adminPin`) | Named users (Users sheet) + e-mail OTP |
| **High** | XSS: 118 `innerHTML` sites; ≥29 template lines interpolate names/sites/descriptions unescaped (`${c.name}`, `value="${it.desc}"`) and `onclick="del('Invoices','${i.invNum}')"` puts client-controlled text inside JS. `sanitizeInput` strips only `< >`, is applied on 3 write paths, and does not stop attribute breakout (`" onmouseover=`). Stored XSS runs with the admin's session token in `sessionStorage`. | Output-encode with `esc()`, `data-*` + delegated handler, CSP (H3) |
| **Med** | Invoice-integrity salt `"SAIDURGA-SECURE-2026"` is hard-coded in source (twice) | `serverSecret_()` in Script Properties |
| **Med** | `setXFrameOptionsMode(ALLOWALL)` → clickjacking; CDN scripts unpinned (`sweetalert2@11`, `chart.js`) with no SRI | `DEFAULT`, pin + SRI |
| **Med** | `deleteData(type)` uses `type` as a raw sheet name → admin token can wipe `Settings`/`AuditLog` | Whitelist (P7) |
| **Med** | UPI QR is rendered by sending UPI ID + amount to `quickchart.io` | Generate QR client-side or in-house |
| **Low** | Client-side `userRole` defaults to `'admin'` when storage is empty | Default to `'viewer'` |

### 1.3 Performance and Google quotas
* **Data model:** each save does 3–4 full `getDataRange()` scans of *Invoices*, 2 of *Payments*, 1 of *WorkOrders*; `cancelInvoice` re-reads Payments **inside the per-row loop**; 94 `getDataRange` calls total; `getAppData` reads 8 sheets on every cache miss and ships everything to the browser. Line items live as JSON in one cell (50 000-character cell limit). Expect it to feel slow beyond a few thousand invoices.
* **Locks:** `waitLock(10000)` while generating a PDF, fetching a QR over HTTP and sleeping 1.5 s → concurrent users time out. Do slow I/O after releasing the lock.
* **Numbering race:** next invoice number is computed in `getAppData` (cached 5 min) and typed by the client; two users get the same number and the second is bounced with "Duplicate".
* **Quotas to design around** (verify current figures on Google's *Apps Script quotas* page; they differ for consumer vs Workspace and change over time): ≈6 min per execution; ≈90 min/day trigger runtime (consumer) vs 6 h (Workspace); `MailApp` ≈100/day consumer, ≈1,500/day Workspace (each login OTP spends one); `UrlFetchApp` ≈20 k/day consumer; Cache 100 KB/value, 6 h max; Properties 9 KB/value, ≈500 KB total; Sheets 10 M cells/file; concurrent executions ≈30/user.
* **Cloud-IP problem for GST:** NIC e-invoice / e-way / GSTN APIs require whitelisted static IPs and a GSP/ASP; Apps Script egresses from shared Google IPs, so direct integration is not possible — you would call a GSP (ClearTax, Masters India, IRIS, etc.) from Apps Script or, better, from a proper backend.

### 1.4 Where Apps Script + Sheets stops being enough
Single tenant per spreadsheet (`getActiveSpreadsheet`, one shared script cache), no row-level security, no transactions (a crash between the invoice row and the journal leaves half-written state), no DB constraints (unique invoice numbers are enforced only in code), no per-tenant isolation, owner can edit any cell including the "immutable" audit sheet. For a sellable SaaS, keep this codebase as the **prototype/spec** and plan: Postgres (Supabase / Cloud SQL) + a small API (Node/Cloud Run or Apps Script as thin proxy) + the same UI. The pure functions in `EnterpriseCore.gs` (tax, ledger validation, statements, GSTR JSON) are deliberately I/O-free so they port unchanged.

### 1.5 Running, testing and debugging locally
**A. Sync code with `clasp`** (edit in VS Code, push to a *dev* copy of the sheet)
```bash
npm i -g @google/clasp && clasp login           # enable the Apps Script API at script.google.com/home/usersettings
clasp create --type webapp --title "Billing DEV" --rootDir ./deploy      # or: clasp clone <scriptId>
mkdir deploy && cp legacy/Code.gs deploy/Code.js && cp src/EnterpriseCore.gs deploy/EnterpriseCore.js \
   && cp legacy/index.html deploy/index.html && cp appsscript.json deploy/
clasp push --watch                              # re-uploads on save
clasp deploy --description "dev"                # new /exec URL;  `clasp open` opens the editor
clasp logs --watch                              # live Cloud Logging (console.log / errors)
```
`doGet` loads `createTemplateFromFile('index')` → your HTML file **must be named `index.html`** (you have `HTMLV1.txt`). Use a separate dev spreadsheet (container-bound script) and a copy of production data with real GSTINs scrubbed. Install `@types/google-apps-script` for autocomplete.

**B. Run the server logic in Node (no Google account, milliseconds per run)**
```bash
npm install
npm test          # 20 tests: tax, GSTIN, numbering, double-entry, TB/P&L/BS/CF, FY close, audit chain, auth, GSTR-1/3B
npm run smoke     # loads YOUR legacy Code.gs + EnterpriseCore.gs on mocks; logs in, getAppData(), saveClient()
```
`tests/gas-mocks.js` provides in-memory `SpreadsheetApp`, `CacheService`, `PropertiesService`, `LockService`, `Utilities`, `MailApp`, `DriveApp` stubs. Add methods when your code touches ones I haven't stubbed (Drive/PDF paths are stubbed, not simulated).

**C. Run the UI locally against that logic** (`google.script.run` shim)
```bash
npm run dev       # http://localhost:8080  — serves legacy/index.html, injects local/gsr-shim.js, RPC → your .gs in a Node vm
npm run debug     # same with --inspect: attach VS Code ("Attach to Node"), put breakpoints in .gs files, step through
```
Login OTPs print in the terminal. Functions ending in `_` are refused, exactly as Apps Script does. State is in memory (resets on restart). Pure logic is best debugged via `npm test -- --test-name-pattern "GSTR-1"` and stepping in the inspector.

**D. In the real runtime:** Apps Script editor debugger for a function with breakpoints; `console.log` → Executions/Cloud Logging; wrap each `api_*` in `try/catch` that calls `logSystemError`. Test triggers on the dev copy only.

---
## 2. Premium feature gap analysis (vs Zoho Books / TallyPrime / Vyapar)
**Missing entirely in the code (keyword search confirms no occurrences):** chart of accounts & account groups; inventory/stock ledger (only a manual `CLOSING_STOCK` setting); multi-currency; batch/expiry; debit notes; purchase returns; bank accounts & bank reconciliation (the "auto reconciliation" matches GST, not bank statements); fixed assets & depreciation; e-invoicing (IRN/QR), e-way bill; TCS; TDS **payable** (only TDS receivable exists); RCM; GSTR-2B; cess; discounts and per-line tax rates (one `GSTRate` per invoice); users/roles per person; approvals; document attachments; multi-branch/multi-GSTIN; budgets; payment gateways; customer/vendor portal; API/webhooks; mobile app.

**Implementation sketches (in build order)**
1. **Chart of Accounts + ledger** — done in `EnterpriseCore.gs` §6–8 (append-only `Ledger`, dimensions `CostHead`/`Site`, party sub-ledger via `Party` column). Migrate old `Journal` by mapping account names → codes.
2. **Inventory & FIFO/LIFO/weighted-average** — sheets `Items`, `StockMove(ID, Date, Item, Warehouse, Batch, QtyIn, QtyOut, UnitCost, SourceType, SourceID)`. Never store "current stock"; compute it. **FIFO**: keep layers `{batch, qtyRemaining, unitCost}` per item; a sale consumes the oldest layer(s) and posts `Dr COGS / Cr Inventory` at the layers' cost; LIFO consumes newest; weighted average recomputes after each receipt. Note: LIFO is not permitted under Ind AS 2 / AS 2 for reporting — offer FIFO and weighted average for statutory books. **Batch/expiry**: batch is a dimension on `StockMove`; pick-lists sorted by earliest expiry (FEFO); nightly job flags items expiring in N days; block sale of expired batches. Closing stock for the P&L then comes from the stock ledger, not a settings cell.
3. **Multi-currency** — `Currencies` and `FxRates(Date, Ccy, Rate)`; each transaction stores `ccy`, `fxRate`, `amountFx`, `amountBase`; ledger stays in INR. Receipt in a different rate posts realised gain/loss (`Dr/Cr 4910 Forex Gain-Loss`); month-end revaluation of open AR/AP posts unrealised gain/loss with an auto-reversal on day 1. Exports: LUT/zero-rated (GSTR-1 Table 6A), IGST refund tracking.
4. **Recurring invoicing** — `RecurringProfiles(ID, Client, Items, Frequency, NextRunDate, EndDate, Mode[Draft|AutoIssue|AutoIssueAndEmail])` + one time-driven trigger. Generate through the *same* `saveInvoice` path (server tax, real gapless number), advance `NextRunDate` with end-of-month clamping, idempotency key `ProfileID+PeriodStart` so a re-run cannot double-bill, per-run log and failure e-mail.
5. **Customer/vendor portal** — Apps Script can serve it as a second page in the same web app, but authenticate **customers with the same OTP flow** (role `portal`, bound to one `PartyID`), and scope every query by `PartyID` on the *server*. Show statement, open invoices, PDF download (signed, expiring links), payment link (Razorpay/Cashfree webhook posting a receipt voucher), dispute note. Never reuse the staff cache or `getAppData`.
6. **E-invoicing / e-way bill** — via a GSP API; store `IRN`, `AckNo`, `AckDate`, signed QR on the invoice; lock the invoice after IRN generation; cancel within the 24-hour IRN window. Needs a backend with a static IP.
7. **Bank module** — bank accounts as ledger accounts, statement import (CSV/OFX), matching engine (amount + date window + reference), reconciliation statement (BRS) required by lenders.

---
## 3. Regulatory & tax compliance (India)
Verdict: **partially compliant for a tiny service business; not compliant for audit or scale.** Rules cited from my knowledge — confirm current rates/notifications with your CA (GST slabs were restructured in Sept 2025 and return schemas change often).

| Area | Status | Gap / action |
|---|---|---|
| Tax computation | ⚠ Done **in the browser**; server trusts `igst/cgst/sgst/grandTotal`; intra-state decided by `state === "Andhra Pradesh"` hard-coded | Server recomputes and rejects mismatches ✔ tested (`prepareInvoiceServerSide_`). Home state from Settings; Place of Supply stored per invoice |
| Rate per line / mixed supplies | ✗ One `GSTRate` per invoice; HSN summary applies the invoice rate to every line | Per-line `taxRate`; rate validated against slab list (maintain a dated rate master) |
| Invoice content (Rule 46) | ⚠ | Add place of supply with state code, reverse-charge flag, discount, recipient name/address for B2C ≥ ₹50 000, supplier GSTIN on doc |
| HSN/SAC | ⚠ Free text via `Input` list | Numeric 4/6/8-digit validation with the turnover-based minimum (4 digits up to ₹5 Cr, 6 above) ✔ tested; mandatory in GSTR-1 Table 12, now split B2B/B2C |
| GSTIN validation | ✔ Format + checksum is correct (verified against an independent sample GSTIN) | State map has a duplicate key, missing codes 26 (merged UT), 97, 99, and "Jammu" label; use the full map (`STATE_CODES_`) |
| **Sequential numbering** | ✗ Number typed/held by the client, derived from `max()+1`, reusable after delete; no series-gap detection | Server counter per document type per FY, ≤16 chars, consumed only on success ✔ tested; gap detector feeds GSTR-1 Table 13 |
| Editing issued invoices | ✗ Tax invoices can be overwritten in place | After issue, corrections via credit/debit note; edits only while `DRAFT` |
| Credit notes | ⚠ Booked, but GST reports **add** them as positive supply; no link to original invoice; no Sec-34 time-limit check | Separate CDNR/CDNUR sections and negative netting ✔ tested; store `OriginalInvNo/Date` |
| **GSTR-1 JSON** | ✗ Only a screen `getGSTReportData` (B2B/B2C + SAC) | `buildGSTR1Json_` → b2b, b2cl (> ₹1 lakh inter-state unregistered), b2cs, cdnr/cdnur, hsn (b2b/b2c), doc_issue with gap/cancel warnings ✔ tested. **Validate the file in the GST Offline Tool / GSP sandbox before filing** — schema versions change and I could not test against the portal. `exp`, `at`, `atadj`, `exemp`, SEZ/export need extra data fields |
| **GSTR-3B JSON** | ⚠ Screen sums outward tax minus a single combined `Tax` ITC; ignores credit notes | `buildGSTR3BFromLedger_` ties 3.1 and 4 to the books ✔ tested. Needs Table 3.2 (inter-state to unregistered by POS), 4(B) reversals, 5/6 |
| ITC | ✗ Single `Tax` column; no CGST/SGST/IGST split, no blocked-credit (Sec 17(5)) flag, no RCM, no 2B match, no Rule 37 180-day reversal, GSTR-**2A** (not 2B) | Columns + `ITC_Eligible`/`RCM`; import 2B JSON; reconciliation by GSTIN+invoice no.+tax; ITC posted only if in 2B (Sec 16(2)(aa)) |
| GST set-off | ✗ Output and input accounts never net; "GST Payable (Offset)" is a plug | `gstSetOff_` follows statutory order and posts the month-end voucher ✔ tested |
| E-invoice / e-way | ✗ | Mandatory above the notified AATO threshold (₹5 Cr today; check) — IRN via GSP |
| TDS/TCS | ⚠ Only TDS **receivable** | TDS payable on vendor payments (194C/194J…), challans, 26Q data; TCS; GST-TDS by government customers |
| MSME 43B(h) | ✗ | MSME flag on vendors; alert for unpaid > 45 days (disallowance) |
| **Audit trail** | ✗ `AuditLog(Timestamp, "Authorized Admin", Action, "Module | Record ID")` — no user, no before/after; `cleanAuditLog` **deletes** entries; `deleteData` hard-deletes payments/purchases | Companies (Accounts) Rules 2014 r.3(1) proviso (from FY 2023-24): audit trail of every change, cannot be disabled, preserved 8 years. `auditAppend_`: per-user, changed-field diff, reason, hash-chained, `verifyAuditChain_` ✔ tested. Sheets owner can still edit — e-mail the head hash monthly to a CA/off-site to make tampering provable |
| **FY closing lock** | ⚠ Three mechanisms (hard-coded "current FY starts 1-Apr" gate, freeze-days, GST month lock) but no FY master, no closing entries, no opening-balance carry-forward, and the "current FY" gate blocks March entries in April though GSTR-3B for March is due 20 April | `FinancialYears` master (OPEN/CLOSED), `api_closeFinancialYear` (requires TB balanced and 12 months locked; posts P&L → Retained Earnings), `api_reopenFinancialYear` needs written reason + audit ✔ tested. Replace `executeYearEndRollover` |
| Retention | ✗ Backups older than 7 days are deleted | 8 years for books (Companies Act s.128); 72 months GST |

---
## 4. Bank-loan & audit readiness
**What lenders/CAs actually accept:** figures certified by a CA (UDIN), supported by ITR, GST returns, 26AS/AIS and bank statements; software is judged on whether the books are *traceable and consistent*. Banks cross-check turnover in GSTR-3B vs ITR vs bank credits, ask for debtors/creditors ageing, stock statements (drawing power), and ratios (current ratio, DSCR, TOL/TNW, debtor days). So:

**Structural changes required**
1. **One source of truth:** every module posts only to the ledger; every report reads only the ledger. (Today: 3 different profit numbers depending on the screen.)
2. **Chart of Accounts** with type + statutory group (Schedule III for companies; ICAI format for firms), party sub-ledgers controlled by *Trade Receivables/Payables*, dimensions for cost head/site — `DEFAULT_COA_`.
3. **Append-only ledger:** edits = reversal + repost, cancels = contra; period locks apply to the *original* date of what is being reversed ✔ tested.
4. **Opening balances** as an `OPENING` voucher to `3950 Opening Balance Equity`; **capital, drawings, loans, fixed assets/depreciation, provisions, prepaid/accrued** as ordinary vouchers (add screens).
5. **Bank & cash accounts** + reconciliation statement; **GST ledger** (set-off) and **TDS ledgers** reconciled to returns.
6. **Closing stock from the stock ledger** (not a settings cell) once inventory exists.
7. **Immutable FY close** with retained-earnings transfer; signed-off CA review status; export PDF/Excel with schedules.
8. **Ratios & MIS pack** (CMA-style): DSCR, current ratio, TOL/TNW, debtor/creditor days, monthly turnover vs GST.

**Statement logic (implemented and tested in `EnterpriseCore.gs` §8)**
* *Trial Balance* — cumulative Dr/Cr per account to a date; `balanced` flag compares total debits to credits in **paise integers** (no float drift). ✔
* *P&L* — Revenue from Operations − Direct Expenses = Gross Profit; + Other Income − Indirect Expenses = Net Profit; closing (`FY_CLOSE`) vouchers excluded so a closed year still shows its profit. Scenario check: revenue 1,00,000, direct 40,000, indirect 6,000 → NP 54,000. ✔
* *Balance Sheet* — Assets = Liabilities + Equity, where Equity includes unclosed P&L; returns `balanced` and `difference`; UI shows a red banner if not. ✔
* *Cash Flow (indirect)* — every non-cash account's period movement is bucketed (Profit / Non-cash add-back / Working capital / Investing / Financing); the sum provably equals the change in cash+bank, and the report asserts `opening + net = closing`. ✔ Classification is driven by the `CashFlow` column of the chart of accounts, so a new account never silently falls in the wrong bucket.

**Double-entry enforcement (`validateVoucher_`, ✔ tested):** ≥2 non-zero lines; each line one side only; no negatives; account must exist; Dr = Cr in paise; period open; all-or-nothing batch write; failure throws to the caller (no swallowing). Rules the *old* engine lacked: unknown accounts accepted; free-text account names; zero-line filtering hid errors; failures suppressed.

---
## 5. Actionable code
| File | Contents |
|---|---|
| `src/EnterpriseCore.gs` | New server module: e-mail-OTP auth + RBAC, hash-chained audit, server-side GST calc & GSTIN/HSN validation, gapless numbering, FY/period control, double-entry ledger, posting adapters (invoice, credit note, purchase incl. ITC/RCM, receipt, vendor payment, TDS, GST set-off), TB/P&L/BS/CF, FY close/re-open, GSTR-1 & GSTR-3B JSON, `api_*` endpoints |
| `src/PATCHES_for_Code.gs.md` | Line-level before/after patches for your existing functions (P0–P12) |
| `src/HTML_Patches.html` | Login (email+OTP), XSS-safe rendering + event delegation, server-owned tax/number, "Books" tab (statements + JSON downloads) |
| `tests/`, `local/`, `package.json`, `appsscript.json` | Test suite, mocks, local UI server + `google.script.run` shim, clasp config |

**Suggested rollout (2–3 weeks part-time):** 1) copy the project, run `npm test`; 2) add EnterpriseCore, delete old `validateSession`, run `bootstrapSecurity()`; 3) P5/P6 (close the open functions — do this the same day); 4) P1–P4 + HTML H1–H4; 5) migrate old `Journal` into `Ledger` (map names → codes, post an `OPENING` voucher at a cut-off date, keep the old sheet read-only) and compare the old vs new Trial Balance; 6) show the four statements to your CA and reconcile GSTR-3B totals; 7) only then onboard other companies.

**Known limits of what I delivered:** not run against real Google services or the GST portal; GSTR JSON keys follow the offline-tool structure as I know it and must be validated before filing; the migration of historic `Journal` rows and the inventory/multi-currency/portal modules are designed in §2 but **not coded**; GST rate slabs and thresholds quoted above should be re-confirmed on the date you file.
