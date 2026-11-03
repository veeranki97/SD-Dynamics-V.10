<div align="center">

# SD Dynamics V.10 — GST Billing & Business ERP

### Offline-first invoicing, project operations, accounting, and workforce tools.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.txt)
[![Latest release](https://img.shields.io/github/v/release/veeranki97/SD-Dynamics-V.10?label=Latest&color=orange)](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest)
[![GitHub Stars](https://img.shields.io/github/stars/veeranki97/SD-Dynamics-V.10?style=social)](https://github.com/veeranki97/SD-Dynamics-V.10)

**Create GST invoices, manage work and purchase orders, track ledgers and cash flow, and handle payroll and statutory registers from a local application.**

The app runs on your computer. There is no required hosted account or cloud database. Data stays local unless you choose to export it or enable an optional backup integration.

[⬇ Download the latest release](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest/download/SD-Dynamics-V.10.zip) · [📦 All releases](https://github.com/veeranki97/SD-Dynamics-V.10/releases)

</div>

---

## Latest release: v2.5.3

Recent updates include usability and workflow improvements across invoicing, cash book, and HRMS:

- **HRMS leave requests** — record CL/SL/EL requests, approve or reject them, and update employee leave balances on approval.
- **Overtime payroll** — record overtime hours in attendance and include overtime pay in payroll and wage-register calculations.
- **Labour-register exports** — download Excel-compatible Form T, Form XVII, Form XXII, Form XX, Form XXI, Form XXIII, and Form XIII registers, with optional site filtering and statutory header details. Some registers are templates and may show nil entries where the app does not capture those records.
- **Cash Book improvements** — summary cards, search, movement-type filters, and clearer Bank Ledger / Day Book views.
- **Invoice workflow improvements** — reorder line items by dragging, display amount-in-words using the selected currency, and show an estimated gross margin when line-item cost data is available.
- **Ariba SES follow-ups** — create and track follow-up tasks from an invoice action.
- **Additional fixes** — HRMS layout and report refinements, product matching, and invoice/client state handling when converting work orders.

See the [v2.5.3 release](https://github.com/veeranki97/SD-Dynamics-V.10/releases/tag/v2.5.3) and [full changelog](CHANGELOG.md) for details.

---

## Install

### Windows: one-command installer

Requirements: **Windows** and an internet connection for the initial download/install. The installer installs the app under your local programs folder and creates a Desktop shortcut. No administrator rights are required.

Open PowerShell and run:

```powershell
irm https://raw.githubusercontent.com/veeranki97/SD-Dynamics-V.10/main/install.ps1 | iex
```

Alternatively, download and extract the [latest release ZIP](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest/download/SD-Dynamics-V.10.zip), then follow the included `READ ME FIRST.txt` and launch the Windows HTA launcher.

### Run from source / other desktop environments

The app requires **Node.js 18 or newer** and npm. Download the source, then from the `_system/` directory install dependencies and start the server using the included package scripts. Refer to the release instructions and scripts for platform-specific setup; the packaged Windows launcher is the simplest installation path.

---

## Core features

### Invoices and GST

- Tax invoices, proforma/estimate documents, bills of supply, credit notes, and delivery challans.
- CGST/SGST or IGST calculations, mixed item tax rates, discounts, round-off, and multi-currency invoicing.
- Invoice PDF generation, UPI QR support, configurable terms and branding, and amount-in-words output.
- Offline GSTR-1 and GSTR-3B data exports, GSTR-2B reconciliation from portal JSON, and NIC-format e-way bill JSON export.
- TDS/TCS tracking and vendor ledger workflows.

> SD Dynamics provides calculations and export tools; review filings and statutory obligations with your tax professional before submission.

### Project and business operations

- Work Orders and Purchase Orders, including work-order-to-invoice workflows.
- Client, vendor, product, purchase, expense, receipt, and payment records.
- Chart of Accounts, journals, Trial Balance, Profit & Loss, Balance Sheet, Cash Book, and cost-centre tools.
- Searchable tasks, command palette, and Ariba SES follow-up reminders.

### HRMS and payroll

- Employee directory, attendance, payroll, PF/ESI calculations, and payslips.
- Overtime-hour entry and payroll calculation.
- Leave requests for CL, SL, and EL, with approval/rejection actions and employee balance updates.
- EPFO ECR, ESIC, attendance and wage exports, plus Excel-compatible CLRA-style registers. Review generated statutory records before filing.

### Storage, backup, and offline use

- SQLite storage with JSON migration/mirroring support.
- Local backup and restore tools, including daily backups and a 30-day trash/recovery workflow.
- PWA caching supports offline use after installation; internet may still be needed for initial setup, updates, or explicitly enabled integrations.

---

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite |
| Backend | Node.js, Express |
| Storage | SQLite (`better-sqlite3`) and JSON support |
| PDF | jsPDF and html2canvas |
| Offline app support | PWA service worker |

---

## Data and security

Business records are stored locally in the application's data directory. Keep the app updated, use its backup/restore features, and do not manually edit or delete files in the data directory. Optional exports or enabled backup integrations can send data outside the computer; review their settings before use.

For vulnerability reports, please follow [SECURITY.md](SECURITY.md) rather than opening a public issue.

---

## Documentation and support

- [Changelog](CHANGELOG.md)
- [User guide and documentation index]( _system/docs/README.md )
- [Issues and feature requests](https://github.com/veeranki97/SD-Dynamics-V.10/issues)
- [Releases](https://github.com/veeranki97/SD-Dynamics-V.10/releases)

## Contributing

Fork the repository, create a feature branch, make and test your changes, then open a pull request. See the project scripts and documentation for development and release checks.

## License

This project is distributed under the [MIT License](LICENSE.txt).

---

**SD Dynamics V.10** · GST billing and business operations software · [Download the latest release](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest)
