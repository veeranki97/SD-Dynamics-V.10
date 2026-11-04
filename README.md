<div align="center">

# SD Dynamics V.10

### Offline-first GST billing, project operations, accounting, and HRMS for Indian businesses

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.txt)
[![Latest release](https://img.shields.io/github/v/release/veeranki97/SD-Dynamics-V.10?label=Latest&color=orange)](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest)
[![GitHub Stars](https://img.shields.io/github/stars/veeranki97/SD-Dynamics-V.10?style=social)](https://github.com/veeranki97/SD-Dynamics-V.10)

**Create GST invoices, manage work and purchase orders, track cash flow and ledgers, and organize payroll and statutory-register data—all from an application that runs on your computer.**

No hosted account or cloud database is required. Your business records are stored locally; you decide whether to export them or enable an optional integration.

[⬇ Download the latest release](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest/download/SD-Dynamics-V.10.zip) · [📦 All releases](https://github.com/veeranki97/SD-Dynamics-V.10/releases) · [📖 User guide]( _system/docs/USER_GUIDE.md )

</div>

---

## Why SD Dynamics?

SD Dynamics brings everyday billing and business workflows together in one local application:

- **Work offline after setup** — use the app locally without depending on a hosted business account.
- **Cover the workflow beyond invoicing** — connect invoices with work orders, purchase orders, payments, expenses, ledgers, and cost centres.
- **Keep control of your records** — local storage, backup and restore tools, and export options.
- **Support your team** — employee records, attendance, payroll calculations, leave requests, and register exports.
- **Use it for your business process** — configure invoice documents, numbering, branding, and terms to suit your workflow.

## Quick start

### Windows: one-command installer

Open PowerShell and run:

```powershell
irm https://raw.githubusercontent.com/veeranki97/SD-Dynamics-V.10/main/install.ps1 | iex
```

The installer downloads the latest release into your local programs folder and runs the included Windows setup. An internet connection is needed for the initial download and setup.

### Install from the release ZIP

1. Download and extract the [latest release ZIP](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest/download/SD-Dynamics-V.10.zip).
2. Open the extracted folder and follow `READ ME FIRST.txt` and the launcher for your platform.
3. On first run, complete the setup and open the app in your browser at its local address.

### Run from source

Requirements: **Node.js 18 or newer** and npm.

```bash
cd _system
npm install
npm start
```

For development, use the scripts documented in `_system/package.json` and the project documentation.

### First-use checklist

1. Add your company details, GSTIN/state, and bank or UPI information in Settings.
2. Set invoice numbering and print preferences.
3. Add clients, vendors, products or services as needed.
4. Create an invoice, review it, and save or print its PDF.
5. Set up backups before entering important business records.

---

## Features

### GST invoicing and documents

- Tax invoices, quotations/proformas, bills of supply, credit notes, and delivery challans.
- CGST/SGST or IGST calculations, mixed item tax rates, discounts, round-off, and multi-currency invoicing.
- Invoice PDFs with configurable branding and terms, UPI QR support, and amount-in-words output.
- Work-order-to-invoice workflows and invoice line-item editing tools.
- TDS/TCS tracking and vendor ledger workflows.

### GST returns and exports

- Offline GSTR-1 and GSTR-3B data exports.
- GSTR-2B reconciliation using JSON downloaded from the GST portal.
- NIC-format e-way bill JSON export.
- HR and payroll-related exports, including EPFO ECR, ESIC, attendance, wage data, and Excel-compatible labour registers.

> SD Dynamics provides calculations and export tools; it does not file returns on your behalf. Review generated data and statutory obligations with a qualified tax professional before submission.

### Projects, purchasing, and accounting

- Work Orders and Purchase Orders, including linked purchasing and billing workflows.
- Client, vendor, product, purchase, expense, receipt, and payment records.
- Chart of Accounts, journals, general ledger, Trial Balance, Profit & Loss, and Balance Sheet.
- Cash Book, Bank Ledger, Day Book, and cost-centre tools.
- Searchable tasks, a command palette, and Ariba SES follow-up reminders.

### HRMS and payroll

- Employee directory, attendance, payroll calculations, and payslips.
- Overtime-hour entry and overtime pay in payroll and wage-register calculations.
- CL/SL/EL leave requests, approval or rejection, and leave-balance updates.
- Excel-compatible statutory and labour-register exports, with optional site filtering where supported.

### Local data, backups, and offline support

- SQLite storage with JSON migration/mirroring support.
- Local backup and restore tools, daily backups, and a 30-day trash/recovery workflow.
- PWA caching supports offline use after installation. Internet may still be needed for initial setup, updates, or integrations you choose to enable.

---

## A typical invoice workflow

1. Set up your company profile and invoice preferences.
2. Choose **New Invoice** and select the appropriate document type.
3. Select or add a client, then enter line items, quantities, rates, and applicable tax.
4. Review the totals and invoice preview, then save or generate the PDF.
5. Record payments and use the relevant ledger and reporting views to follow up.

For detailed instructions on invoices, work orders, purchase orders, books, backups, and troubleshooting, see the [User Guide]( _system/docs/USER_GUIDE.md ).

---

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite |
| Backend | Node.js, Express |
| Storage | SQLite (`better-sqlite3`) with JSON support |
| PDF | jsPDF and html2canvas |
| Offline app support | PWA service worker |

## Data and security

Business records are stored locally in the application's data directory. Keep the app updated, use its backup/restore features, and avoid manually editing or deleting application data files. Optional integrations may transmit data to services you configure; review their settings before enabling them.

The app's PIN lock is a screen lock, **not database encryption**. Anyone with access to your computer account and application data folder may be able to access those files. Use your operating system's disk encryption and maintain separate backups.

For vulnerability reports, follow [SECURITY.md](SECURITY.md) rather than opening a public issue. Do not include real invoice data, client details, or GSTINs in reports.

## Documentation and support

- [User guide and documentation index]( _system/docs/README.md )
- [Changelog](CHANGELOG.md)
- [Issues and feature requests](https://github.com/veeranki97/SD-Dynamics-V.10/issues)
- [Releases](https://github.com/veeranki97/SD-Dynamics-V.10/releases)
- [Security policy](SECURITY.md)

## Contributing

Fork the repository, create a feature branch, make and test your changes, then open a pull request. Consult the project scripts and documentation for development and release checks.

## License

This project is distributed under the [MIT License](LICENSE.txt).

---

<div align="center">

**SD Dynamics V.10** · GST billing and business operations software · [Download the latest release](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest)

</div>
