# SD Dynamics — User Guide

A plain-language guide for everyday use. No coding background needed.  
If you only have two minutes, start with [Quick Start](#2-quick-start).

> **TL;DR**  
> 1. Extract the release ZIP and open **`SD Dynamics - WINDOWS.hta`** (or your platform launcher).  
> 2. First run installs Node if needed, builds the app, and opens it on **localhost**.  
> 3. Your data lives in **`_system/data/`** (SQLite + JSON mirror). Back that folder up regularly.

**Product:** Offline GST billing & service/project ERP for Indian contractors, O&M, and service businesses.  
**Repo:** https://github.com/veeranki97/SD-Dynamics-V.10  

---

## Table of contents

1. [What is SD Dynamics?](#1-what-is-sd-dynamics)
2. [Quick Start](#2-quick-start)
3. [Sidebar & navigation](#3-sidebar--navigation)
4. [Company setup & Settings](#4-company-setup--settings)
5. [Master data](#5-master-data)
6. [Clients & vendors](#6-clients--vendors)
7. [Invoices & document types](#7-invoices--document-types)
8. [Work Orders](#8-work-orders)
9. [Purchase Orders & purchase bills](#9-purchase-orders--purchase-bills)
10. [Receipts, expenses & cash book](#10-receipts-expenses--cash-book)
11. [Financial books & ledgers](#11-financial-books--ledgers)
12. [GST returns & month close](#12-gst-returns--month-close)
13. [PDF styles & printing](#13-pdf-styles--printing)
14. [Security (PIN), backup & health](#14-security-pin-backup--health)
15. [HRMS (optional)](#15-hrms-optional)
16. [FAQ & troubleshooting](#16-faq--troubleshooting)

---

## 1. What is SD Dynamics?

SD Dynamics is a **local desktop-style web app** (React + Node) for:

- GST tax invoices, quotations, proformas, credit notes, delivery challans  
- **Work Orders** with budget ceilings and linked invoices / POs  
- **Purchase Orders** (including subcontract linked to a WO)  
- Payments, expenses, journals, cash book / day book  
- Trial balance, balance sheet, P&L, site / WO / cost-centre P&L  
- GSTR-1, GSTR-3B, GSTR-2B / 2A style matching helpers  
- Optional HR attendance / ECR–ESIC helpers  

**It will not** send your books to a public cloud by default. Google Drive and SMTP are optional and under your control.

**PIN lock** only locks the screen. It is **not** full database encryption. Anyone with folder access to `_system/data/` can read files. Use OS disk encryption and backups.

---

## 2. Quick Start

### Windows

1. Download the latest release ZIP from GitHub Releases.  
2. Extract to a stable folder (e.g. `Documents\SD-Dynamics`).  
3. Double-click **`SD Dynamics - WINDOWS.hta`**.  
4. Use **Install** on first run, then **Open App**.  
5. Browser opens at something like `http://localhost:47371` (port may vary; see `data/port.txt`).

### First-run checklist

1. **Settings → Company profile** — name, address, GSTIN, state, bank / UPI.  
2. **Settings → Invoice & print** — number prefixes (Tax Invoice, Quotation, etc.), PDF template.  
3. **Work → Master data** — cost centres, HSN/SAC, units, expense categories, services.  
4. Add a **client**, then **New Invoice**.  
5. **Backup Management** — turn on automatic backup or run Backup now.

---

## 3. Sidebar & navigation

Menus are grouped for daily workflow:

| Group | Typical items |
|--------|----------------|
| **Home** | Dashboard |
| **Sales** | Invoices, New Invoice, Recurring, Clients |
| **Purchase** | Vendors, Purchase Orders, Purchase Bills, Expenses |
| **Work** | Work Orders, Master data |
| **Money** | Receipts, Payment recon, Cash book, Bank feed |
| **Books** | Chart of accounts, General ledger, **Financial Books** |
| **Compliance** | GST Returns, Reports / Data export, Income tax helpers |
| **HR** | HRMS (if used) |
| **System** | Settings, Control panel, Activity log, System health |

**Dashboard** shows high-level KPIs (billed, tax, received, outstanding, this-month sales/purchases).  
**Invoices** is the full document list (use type tabs: All / Tax Invoice / Quotation / Proforma / DC).

---

## 4. Company setup & Settings

Settings use **horizontal jump tabs** (not a second “E-Invoice” under System):

- **Company profile** — business identity, bank accounts, logo / stamp  
- **GST & e-Invoice** — GST options, IRN fields (manual paste until GSP keys are set)  
- **Invoice & print** — templates (Sai Durga / Tally / Boxed grid), prefixes, stamp  
- **Mail & templates** — SMTP (e.g. Gmail app password), reminder text  
- **Dashboard charts** — which charts to show  
- **Backup & trash** — manual backup/restore, **automatic backup**, trash bin  
- **Security** — PIN lock (6 or 8 digits), idle auto-lock, RESET-PIN file note  
- **Modules & region** — turn modules on/off, India / international  

**Save all changes** uses the bottom bar when several sections are dirty.

---

## 5. Master data

**Work → Master data** tabs:

| Tab | Purpose |
|-----|---------|
| **Cost centres** | Job / site cost tracking. New IDs are sequential (`CC-001`, …). |
| **HSN / SAC** | Codes used on invoices, WO, PO. Search + add. |
| **Units** | Nos, Hrs, etc. Search + add. |
| **Expense categories** | Categories for expenses. |
| **Services** | Service catalogue (rates / SAC) for lines on invoices and WOs. |

Row actions use the **⋮** menu (Edit / Copy / Delete) where implemented.  
HSN, units, and cost centres should be maintained here so invoices and POs **dropdown** from the same master list.

---

## 6. Clients & vendors

- **Clients** under Sales; **Vendors** under Purchase.  
- GSTIN is validated (length / checksum; state code vs state when provided).  
- **Identity lock:** if a client has real invoices (or a vendor has purchase bills), **name / GSTIN / state** cannot be changed. Phone, email, notes remain editable.  
- **Sites:** optional multiple sites (name, optional address / GSTIN). Invoice ship-to can use a site.  
- Collapse / statement actions follow the same pattern on both lists where available.

---

## 7. Invoices & document types

### Types

Tax Invoice, Quotation, Proforma (PI), Credit Note, Delivery Challan (DC), Bill of Supply (as enabled).

### Important rules

- **Revenue / GSTR sales / aging / dashboard turnover** use **tax invoices** (and BOS if used). **Quotations, proformas, DCs, cancelled** are excluded from turnover. Credit notes reduce sales.  
- **Payments / Mark paid** only on **tax invoices** (not quotation / proforma / DC).  
- **Document numbers** use separate series per type (e.g. SD/…, QUO/…, PI/…, DC/…).  
- **Bill period:** invoice date rules follow product validation (period end vs invoice date as configured).  
- **Link to Work Order:** type-ahead; existing WO pre-fills client / lines / GST; you can also create a WO from the invoice when needed.  
- **Convert:** Quotation → PI / DC / Tax Invoice; PI → Tax Invoice (advances should transfer, not double bank inflow).  
- **Final (submitted) documents** should not change taxable values; payments and reversals still allowed.  
- **Delivery Challan** PDFs are quantity-oriented (no rate/amount/GST on standard DC layout).  

### Line tools

Fill-down HSN/SAC, unit, rate, tax %, description; duplicate last row — use the line toolbar.

---

## 8. Work Orders

- Create WOs with client, site, cost centre, line items, **approved budget** (incl. GST when calculated like PO).  
- **Budget ceiling:** invoicing beyond remaining WO budget is blocked (with small tolerance).  
- **Actions (⋮):** Email, Create Expense, View ledger, Convert to Tax Invoice / PI / DC (hidden when WO is completed / cancelled / closed).  
- **Create PO:**  
  - Opens New Purchase Order with WO, site, cost centre, lines prefilled.  
  - **After one non-cancelled PO is linked to the WO, Create PO is disabled** (same “convert once” idea as invoices).  
  - Cancelled POs do not count — Create PO becomes available again if no active linked PO remains.  
- Dossier shows linked invoices, subcontract POs, purchases, expenses, and job-cost style margins when data is tagged with the WO.

---

## 9. Purchase Orders & purchase bills

- **PO** can link to a **Work Order** (subcontract). Cost centre and ship-to should come from WO / client, not the seller address.  
- **Print / PDF:** in-tab print; suggested file name = **PO number**. Use print dialog **Headers and footers OFF**.  
- **Create bill from PO** moves to Purchase Bills with lines prefilled; PO billing status can move to fully billed.  
- **Vendor statement / outstanding** depends on **purchase bills and payments**, not only “PO fully billed”. Record vendor payment against the bill so outstanding clears.  
- Large POs may write an **approval log** entry when above threshold.

---

## 10. Receipts, expenses & cash book

- **Receipts:** against unpaid tax invoices; amount cannot exceed outstanding (≈ ₹1 tolerance). Auto-fill client, WO, cost centre, site when invoice is chosen.  
- **Expenses:** optional job-cost / WO; cost centre recommended for site/WO P&L.  
- **Cash book:** Bank ledger + Day book; export / print with letterhead style where enabled.  
- Journals should stay **append-only** for reversals (unpaid / cancel posts a reversing entry, not a rewritten narration).

---

## 11. Financial books & ledgers

**Books → Financial Books** (sidebar label; not only “Trial Balance”):

| Tab | Content |
|-----|---------|
| Trial Balance | Account balances |
| Balance Sheet | Assets / liabilities / equity |
| P&L | Trading / P&L summary |
| Site-wise P&L | By site tag |
| **WO-wise P&L** | By work order (journals **or** invoices/expenses tagged with WO) |
| **Cost centre P&L** | By cost centre on invoices/expenses/journals |
| Period lock | Lock a month in the books (see also GST month close) |

**General ledger** supports party filters and export.  

**Two different locks (do not confuse):**

| Lock | Where | Effect |
|------|--------|--------|
| **Period lock (Financial Books)** | Books → Financial Books → Period lock | Blocks posting into locked book months for journals / related posts |
| **GST / filing month lock** | Compliance → GST Returns → Filing assist | Filing / return month freeze for GST workflow |

---

## 12. GST returns & month close

- **GSTR-1 / GSTR-3B** summaries and exports (JSON/CSV) from books.  
- ITC set-off follows **Rule 88A** order (IGST → CGST → SGST rules as implemented).  
- **GSTR-2B / 2A-style** upload matching purchases (tax tolerance ~ ₹2).  
- **Month close path:** prefer **one** path under **GST Returns → Filing assist** (Export → Review → Lock → Backup). Avoid duplicating a second full wizard only under Settings.  
- **Data export** consolidates GSTR and sales/purchase CSV entry points under Compliance / Reports as configured.

---

## 13. PDF styles & printing

**Settings → Invoice & print → Template:**

- **Sai Durga** — compact service-style layout  
- **Tally / Tally v2** — ruled accounting style  
- **Boxed grid** — full cell borders  

**Tips for clear PDFs**

- Prefer **vector / print HTML** (Print or Save PDF), not a photo-like canvas capture.  
- Chrome: turn **Headers and footers OFF**; set paper to **A4**.  
- File names should be the **document number** (slashes become `-`).  
- DC: no commercial amounts on the standard challan layout.  

---

## 14. Security (PIN), backup & health

### PIN

- **Settings → Security** — set 6 or 8 digit PIN; optional idle lock.  
- Wrong PIN stays on the gate.  
- **Forgot PIN:** place a file named **`RESET-PIN`** next to the app launcher (not inside `data/`), reopen the app; hash is cleared.  
- PIN hash is stored in **meta** (survives port changes). Not included in casual exports as a recoverable password.

### Backup

- **Backup & trash:** manual backup/restore, trash for soft-deleted docs.  
- **Automatic backup:** interval + keep last N copies under the auto folder; optional Drive if connected.  
- After SQLite migration, keep **JSON mirror** until `/api/sqlite-status?verify=1` looks healthy, then you may set `SD_JSON_MIRROR=0` only if you understand the risk.

### System health

- SQLite ready vs JSON fallback, uptime, error tail (if shown).  
- If SQLite shows not ready: from `_system` run `npm rebuild better-sqlite3` then restart `node server.js`.

### Activity log

- Creates / updates of major documents should appear under **Activity log** (and export if available).

---

## 15. HRMS (optional)

Under **HR** when enabled: employees, attendance grid, min wages by state/category, payslip / ECR / ESIC style exports as implemented.  
Statutory filings still need your review before portal upload.

---

## 16. FAQ & troubleshooting

**Q: Create PO from Work Order does nothing or opens a blank page**  
A: Update to the build that normalizes multi-site objects and PO prefill. Use **Create PO** only when no active PO is linked (menu shows disabled if linked).

**Q: Why is Create PO greyed out?**  
A: This WO already has a non-cancelled Purchase Order. Open it from **Purchase Orders** or the WO dossier → Subcontract POs.

**Q: Vendor still shows outstanding after PO is fully billed**  
A: Fully billed means bills exist; outstanding clears when **payments** are recorded against those purchase bills.

**Q: WO-wise / Cost centre P&L empty**  
A: Tag invoices and expenses with **Work Order** and **Cost centre**. Financial Books also falls back to tagged invoices/expenses when journals lack those fields.

**Q: Client name/GSTIN won’t save**  
A: Identity lock — client already has invoices. Change phone/email only, or use a new client master for a true identity change.

**Q: Update available not showing**  
A: Releases must be published on **your** GitHub repo with a higher `version` in `package.json` and a release asset the app is configured to check.

**Q: Server starts but SQLite “Not ready”**  
A: Rebuild native module for your Node version; confirm you run **root** `server.js` from `_system`, not `src/server.js`.

**Q: Port keeps changing**  
A: Another Node process holds the old port. `taskkill /F /IM node.exe` then start once; check `data/port.txt`.

---

## Developers (short)

- App code: `_system/src/` · API: `_system/server.js` · DB: `better-sqlite3` + `data/sd-dynamics.sqlite`  
- In-app guide source: `_system/src/userGuideContent.js` · this file: `_system/docs/USER_GUIDE.md`  
- Prefer surgical changes; do not rewrite tax math or dual-write without a migration plan.

---

*SD Dynamics — offline GST & service ERP. Keep `_system/data/` backed up.*
