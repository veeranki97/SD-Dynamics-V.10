<div align="center">

# SD Dynamics V.10 — GST Billing & Business ERP

### Offline-first invoicing · work orders · ledgers · HRMS — on your computer

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.txt)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](#install)
[![Latest release](https://img.shields.io/github/v/release/veeranki97/SD-Dynamics-V.10?label=Latest&color=orange)](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest)
[![GitHub Stars](https://img.shields.io/github/stars/veeranki97/SD-Dynamics-V.10?style=social)](https://github.com/veeranki97/SD-Dynamics-V.10)

**Create GST-compliant invoices, run projects with Work Orders & Purchase Orders, keep books (GL, Cash Book, Trial Balance), and manage payroll & labour registers — without a mandatory cloud account.**

**Runs on your PC. Data stays local. MIT open source.**

<a href="https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest/download/SD-Dynamics-V.10.zip"><img src="https://img.shields.io/github/v/release/veeranki97/SD-Dynamics-V.10?style=for-the-badge&label=%E2%AC%87%EF%B8%8F%20Download&color=16a34a&labelColor=15803d" alt="Download the latest version" height="44"></a>
&nbsp;
<a href="https://github.com/veeranki97/SD-Dynamics-V.10/releases"><img src="https://img.shields.io/badge/📦%20All%20releases-1e293b?style=for-the-badge" alt="All releases" height="44"></a>

<sub>Windows · extract ZIP · open **SD Dynamics - WINDOWS.hta** · or one-line PowerShell install below</sub>

</div>

---

## Latest release — v2.5.3

| Area | What shipped |
|------|----------------|
| **HRMS** | Leave requests (CL / SL / EL) with approve / reject and balance updates |
| **Payroll** | Overtime hours on attendance → OT pay in payroll & wage register |
| **Registers** | Excel-compatible Form T, XVII, XXII, XX, XXI, XXIII, XIII (site filter + statutory headers; some sheets nil until data is captured) |
| **Cash Book** | Summary cards, search, in/out filters, clearer Bank Ledger & Day Book |
| **Invoices** | Drag-to-reorder lines, amount-in-words by currency, estimated gross margin when cost is set |
| **Ops** | Ariba SES follow-up tasks from invoice actions |
| **Fixes** | HRMS layout/reports, product matching, WO → invoice client/state handling |

Full notes: [v2.5.3 release](https://github.com/veeranki97/SD-Dynamics-V.10/releases/tag/v2.5.3) · [CHANGELOG.md](CHANGELOG.md)

---

## Why SD Dynamics?

Most GST apps stop at invoices. Contracting, O&M, and site work need **job cost, advances, ledgers, and labour compliance** in one local tool.

| | SD Dynamics | Typical billing-only apps |
|--|-------------|---------------------------|
| GST invoices + GSTR exports | ✅ | ✅ |
| Work Orders + budget / PI → Tax Invoice | ✅ | ❌ / limited |
| Purchase Orders & subcontract tracking | ✅ | ❌ / limited |
| Chart of Accounts + GL posting spine | ✅ | Basic or none |
| Cash Book from bank/cash journals | ✅ | Varies |
| HRMS · attendance · PF/ESI · payslips · ECR/ESIC · labour registers | ✅ | ❌ |
| Offline-first, no forced cloud | ✅ | Often cloud-only |
| Price | **Free (MIT)** | Subscription / license |

Built for **service & project businesses** (solar O&M, civil, facilities, multi-site contractors) who still need clean GST documents for clients and CAs.

---

## Install

### Windows — one command (recommended)

```powershell
irm https://raw.githubusercontent.com/veeranki97/SD-Dynamics-V.10/main/install.ps1 | iex
```

No admin rights required. Installs under your local programs folder and creates a Desktop shortcut.

### Windows — ZIP + launcher

1. Download [**SD-Dynamics-V.10.zip**](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest/download/SD-Dynamics-V.10.zip)
2. **Right-click → Extract All** (do not run from inside the ZIP)
3. Open the extracted folder → double-click **`SD Dynamics - WINDOWS.hta`**
4. Follow **Install** / **Open App** (see `READ ME FIRST.txt` if present)

Default app URL: **http://localhost:47371** (port may change if busy; see `data/port.txt`).

### From source

Requires **Node.js 18+**. From `_system/`:

```bash
npm install
npm start
```

Use the project’s package scripts for production build when packaging a release.

---

## Core features

### Invoices & GST

- **Types:** Tax Invoice, Proforma / Estimate, Bill of Supply, Credit Note, Delivery Challan  
- **Tax:** CGST+SGST or IGST, mixed rates, discounts, round-off, multi-currency  
- **PDF:** Configurable templates (including Tally-style / boxed layouts where enabled), UPI QR, branding, amount in words  
- **Returns:** GSTR-1 / GSTR-3B style exports, GSTR-2B import & match helpers, e-way bill JSON (NIC-oriented)  
- **TDS / TCS** fields and reporting hooks  

> SD Dynamics prepares calculations and files. **You** (or your CA) review and file on the GST portal.

### Projects & operations

- **Work Orders** — link invoices, track budget, convert PI → Tax Invoice with advance handling  
- **Purchase Orders** — vendor POs, print/PDF, link to jobs  
- **Clients, vendors, products, purchases, expenses, receipts & payments**  
- **Sites / cost centres** on documents where configured  
- **Tasks / SES follow-ups** for operational chasing  

### Books & cash

- **Chart of Accounts** (Indian SME-oriented seed)  
- **General Ledger** with document posting path (tax invoice, receipt, expense, etc.)  
- **Trial Balance, P&L, Balance Sheet** style views  
- **Cash Book / Day Book** from bank & cash journal lines  
- **Period lock** and backup discipline for month-end  

### HRMS & statutory

- Employees, **attendance** grid, **payroll**, PF / ESI, **payslips**  
- **Overtime** on attendance → payroll  
- **Leave** (CL / SL / EL) request & approval  
- **EPFO ECR**, **ESIC**, attendance & wage exports  
- **Labour registers** (Form T, XVII, XXII, XX, XXI, XXIII, XIII) — Excel-compatible; review before filing  

### Storage, backup, offline

- **SQLite** primary store with JSON mirror / migration support  
- Local **backup / restore**, trash recovery window  
- **PWA** shell for offline use after install  
- Optional integrations (e.g. Drive) only when you enable them  

---

## Data & security

| Topic | Practice |
|-------|----------|
| **Where data lives** | Application data directory (SQLite + mirrored files under `_system/data` as configured) |
| **Cloud** | Not required. Exports and optional backups are under your control |
| **PIN / app lock** | Screen lock only — **not** full disk encryption of books |
| **Network** | Server is intended for local use; do not expose to the public internet without auth |
| **Updates** | Prefer release ZIPs / installer; keep backups before major upgrades |

Vulnerability reports: see [SECURITY.md](SECURITY.md) (prefer private disclosure over public issues).

---

## Documentation

| Doc | Path |
|-----|------|
| Changelog | [CHANGELOG.md](CHANGELOG.md) |
| In-app User Guide | Sidebar → **User Guide** (content: `_system/src/userGuideContent.js`) |
| Docs index | [`_system/docs/`](_system/docs/) |
| Issues / ideas | [GitHub Issues](https://github.com/veeranki97/SD-Dynamics-V.10/issues) |

---

## Tech stack

| Layer | Stack |
|-------|--------|
| UI | React, Vite |
| API | Node.js, Express |
| DB | better-sqlite3 (+ JSON dual-write paths) |
| PDF | jsPDF, html2canvas (and print pipelines) |
| Offline | PWA service worker |

---

## Roadmap (product direction)

Not a promise of dates — priority themes:

1. **Books reliability** — one clean GL post per payment/invoice; Cash Book always matches Bank  
2. **GST accuracy** — Table 6 / ITC set-off, 2B match, export JSON quality  
3. **Job cost** — WO dossier (billed vs PO vs cost vs margin)  
4. **HRMS depth** — registers filled from real attendance/payroll, not placeholders  
5. **Privacy UX** — clearer offline / “what uses the network” controls (inspired by modern local-first billing apps)  

---

## Contributing

1. Fork → feature branch  
2. Keep changes **surgical** (do not strip WO / GL / HRMS)  
3. Test invoice save, payment → cash book, and `npm run build` where applicable  
4. Open a PR with a short test checklist  

---

## License

[MIT License](LICENSE.txt) — use, modify, and distribute freely.

---

<div align="center">

### Ready to run projects and books on one local app?

[**⬇ Download latest release**](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest) · [**⭐ Star on GitHub**](https://github.com/veeranki97/SD-Dynamics-V.10) · [**Report an issue**](https://github.com/veeranki97/SD-Dynamics-V.10/issues)

**SD Dynamics V.10** · GST + Work Orders + Ledgers + HRMS · Made for Indian SMEs

</div>
