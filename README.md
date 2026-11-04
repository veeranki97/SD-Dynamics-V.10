<div align="center">

# SD Dynamics V.10 — GST Billing & Business ERP

### Offline-first invoicing, project operations, accounting, and workforce tools.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.txt)
[![Latest release](https://img.shields.io/github/v/release/veeranki97/SD-Dynamics-V.10?label=Latest&color=orange)](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest)
[![GitHub Stars](https://img.shields.io/github/stars/veeranki97/SD-Dynamics-V.10?style=social)](https://github.com/veeranki97/SD-Dynamics-V.10)

**Create GST invoices, manage work and purchase orders, track ledgers and cash flow, and handle payroll and statutory registers—all from an application that runs on your computer.**

No hosted account or cloud database is required. Business records are stored locally; you decide whether to export them or enable an optional integration.

[⬇ Download latest release ZIP](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest/download/SD-Dynamics-V.10.zip) · [📦 Browse all releases](https://github.com/veeranki97/SD-Dynamics-V.10/releases) · [📖 User guide]( _system/docs/USER_GUIDE.md )

</div>

---

## Contents

- [Download and install](#download-and-install)
- [Start the app and use the desktop shortcut](#start-the-app-and-use-the-desktop-shortcut)
- [Update, back up, restore, or move your data](#update-back-up-restore-or-move-your-data)
- [First-time setup and first invoice](#first-time-setup-and-first-invoice)
- [Features](#features)
- [Data, privacy, and security](#data-privacy-and-security)
- [Technology](#technology)
- [Documentation and support](#documentation-and-support)
- [Contributing and license](#contributing-and-license)

## Download and install

### Option 1 — Windows one-command installer

This is the quickest option for Windows. It downloads the latest published release, installs it under your local programs folder, and runs the setup. The first install needs an internet connection.

1. Open **PowerShell**. You can find it from the Windows Start menu.
2. Paste this command and press **Enter**:

   ```powershell
   irm https://raw.githubusercontent.com/veeranki97/SD-Dynamics-V.10/main/install.ps1 | iex
   ```

3. Wait for the installer to download and configure the app. It may also download Node.js into the app folder if needed.
4. When setup completes, the app starts and opens in your browser. A **SD Dynamics** shortcut is created on the Windows Desktop and in the Start menu.
5. For future launches, use that shortcut; you do not need to run the installer command again.

The installer is for Windows. For other systems, use the release ZIP instructions below.

### Option 2 — Download the release ZIP and use its launcher

Use this method if you prefer to download and extract the release yourself, or are installing on macOS/Linux.

1. Open the [latest releases page](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest).
2. Download the **`SD-Dynamics-V.10.zip`** release asset. You can also [download that ZIP directly](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest/download/SD-Dynamics-V.10.zip).
   - Do **not** use the green **Code → Download ZIP** button on the repository page. That button downloads source code, not the ready-to-run release package.
3. Extract the downloaded ZIP to a normal folder. On Windows, right-click the ZIP and choose **Extract All**. Choose a location you can find again, such as a folder under Documents.
4. Open the extracted folder. Choose the included launcher for your operating system; keep the `_system` folder next to it.
5. On Windows, double-click **`SD Dynamics - WINDOWS.hta`**, then select **Install**. The first setup installs dependencies and may take a few minutes. The launcher reports when the app is ready.
6. On macOS or Linux, install **Node.js 18 or newer** if it is not already installed, then run the matching launcher included in the release ZIP. If your system blocks a shell launcher, open Terminal in the extracted folder and follow the launcher's on-screen instructions.

> **Important:** Extract the ZIP before opening a launcher. If you run the Windows launcher while browsing inside the ZIP, Windows may open only a temporary copy of that one file; the launcher will not find the neighboring `_system` folder.

The app runs locally and opens in your browser at an address similar to `http://localhost:47371`. The port can vary if that port is already in use.

### Option 3 — Run from source (developers)

Requirements: **Node.js 18 or newer** and npm. From the repository directory:

```bash
cd _system
npm install
npm run dev
```

For a production-style local start, use `npm start`. Available scripts and checks are listed in [`_system/package.json`]( _system/package.json ).

## Start the app and use the desktop shortcut

### Windows

After installation, launch **SD Dynamics** from the Desktop shortcut or the Windows Start menu. The shortcut opens the launcher, which starts the local server and opens the app in your browser. If the app is already running, opening it again reuses the running server rather than starting another copy.

The launcher displays the current state and offers the appropriate main action:

- **Install** — shown when the app has not yet been set up.
- **Open App** — starts the app and opens the browser after installation.
- **More options** — offers update, backup, restore, move-to-another-PC, stop-server, and rebuild actions.

The installed app folder also uses the SD Dynamics icon where Windows supports it. If you move or rename the folder after installation, the shortcut may no longer point to the right location; run the launcher from its new folder or recreate the shortcut by installing again.

### macOS and Linux

Use the included platform launcher from the extracted release folder to start the local server and open the app in your browser. Keep the release folder in place while using the app because it contains the application files and local data. The Windows Desktop shortcut instructions do not apply to these platforms.

### Close or stop the app

Closing the browser tab does not necessarily stop the local server. On Windows, open the launcher and choose **More options → Stop the app** when you want to stop it. On macOS/Linux, use the stop action if provided by the release tools, or follow the platform-specific instructions in the [User Guide]( _system/docs/USER_GUIDE.md ).

## Update, back up, restore, or move your data

On Windows, open the launcher and choose **More options**:

| Action | What it does |
| --- | --- |
| **Update to the latest version** | Downloads the latest published release and updates application files. The updater creates a pre-update data backup and preserves the existing `data/` folder. Restart the app after the update. |
| **Back up my data** | Creates a timestamped ZIP of the local data folder in `Documents\SDDynamics Backups\` and opens that folder. |
| **Restore a backup** | Lets you select a backup ZIP. The current data is snapshotted before restore, then the selected backup replaces the current data. Choose carefully and keep a separate copy of important backups. |
| **Move to another PC** | Exports the data folder as a timestamped ZIP on the Desktop. Install SD Dynamics on the new computer, transfer the ZIP, and use **Restore a backup** there. |
| **Stop the app** | Stops the local server. Start it again with **Open App**. |
| **Rebuild app** | Runs the rebuild/recovery action if the local app installation needs repair. |

You can also use the app's own backup and restore features. Keep at least one backup somewhere separate from the computer that runs SD Dynamics. Do not manually edit or delete files inside the application data directory.

## First-time setup and first invoice

### Set up your business

On first launch, complete the welcome/setup flow, or open **Settings**:

1. Enter your business name, address, state, and GSTIN where applicable.
2. Add bank and UPI details if you want them shown on invoices.
3. Choose invoice numbering, document preferences, and print/PDF branding.
4. Add clients and vendors. Add products, services, HSN/SAC codes, units, and cost centres as needed.
5. Set up and test a backup before entering important records.

### Create and manage an invoice

1. Choose **New Invoice** and select the document type: Tax Invoice, Proforma/Estimate, Bill of Supply, Credit Note, or Delivery Challan.
2. Select an existing client or add a new one.
3. Add line items with descriptions, quantity, unit, rate, and tax rate. Add discounts or round-off where applicable.
4. Confirm the business/client details, tax split, totals, and invoice preview.
5. Save the invoice and generate or print its PDF. Record receipts and payments from the relevant invoice or payment workflow.

### Explore the daily workflow

- Create a **Work Order**, track its site/cost centre and budget, then link invoices and purchasing where appropriate.
- Create **Purchase Orders** and purchase bills, and record vendor payments and business expenses.
- Review **Cash Book**, Bank Ledger, Day Book, general ledger, and financial reports.
- Use **Ctrl+K** to open the command palette for supported search and navigation tasks.
- In HRMS, manage employees, attendance, payroll, overtime, leave requests, and available exports.

For detailed screen-by-screen instructions, see the [User Guide]( _system/docs/USER_GUIDE.md ).

## Features

### GST invoicing and PDFs

- Tax invoices, proforma/estimate documents, bills of supply, credit notes, and delivery challans.
- CGST/SGST or IGST calculations, mixed item tax rates, discounts, round-off, and multi-currency invoicing.
- PDF generation with configurable branding and terms, UPI QR support, and amount-in-words output.
- TDS/TCS tracking and vendor-ledger workflows.
- Invoice and client workflows that can be linked with Work Orders.

### GST returns and compliance exports

- Offline GSTR-1 and GSTR-3B data exports.
- GSTR-2B reconciliation using JSON downloaded from the GST portal.
- NIC-format e-way bill JSON export.
- Review exports and statutory calculations before using them in a filing.

> SD Dynamics provides calculations and export tools; it does not file returns on your behalf. Verify generated data and statutory obligations with a qualified tax professional before submission.

### Projects, purchasing, and accounting

- Work Orders and Purchase Orders, including work-order-to-invoice and linked purchasing workflows.
- Client, vendor, product, purchase, expense, receipt, and payment records.
- Chart of Accounts, journals, general ledger, Trial Balance, Profit & Loss, and Balance Sheet.
- Cash Book, Bank Ledger, Day Book, and cost-centre tools.
- Searchable tasks, command palette, and Ariba SES follow-up reminders.

### HRMS and payroll

- Employee directory, attendance, payroll calculations, and payslips.
- Overtime-hour entry and overtime pay in payroll and wage-register calculations.
- CL/SL/EL leave requests, approval/rejection actions, and employee leave-balance updates.
- EPFO ECR, ESIC, attendance and wage exports, and Excel-compatible labour registers, including available site filters.

Review generated statutory records with the relevant professional before filing or submission.

### Local data, backup, and offline use

- Local SQLite storage with JSON migration/mirroring support.
- Local backup and restore tools, daily backups, and a 30-day trash/recovery workflow.
- PWA caching supports offline use after installation. Internet may still be needed for initial setup, updates, or integrations you explicitly enable.

## Data, privacy, and security

Business records are stored locally in the application's `_system/data/` directory. The application does not require a hosted account or cloud database. Optional integrations or exports may send data to services you choose to configure; review those settings before enabling them.

The app's PIN lock is a screen lock, **not database encryption**. Anyone with access to your computer account and application data folder may be able to access those files. Use your operating system's disk encryption and keep separate backups.

Keep the app updated, use its backup/restore features, and do not manually edit or delete files in the data directory. For vulnerability reports, follow [SECURITY.md](SECURITY.md) rather than opening a public issue. Do not include real invoice data, client details, or GSTINs in reports.

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite |
| Backend | Node.js, Express |
| Storage | SQLite (`better-sqlite3`) with JSON support |
| PDF | jsPDF and html2canvas |
| Offline app support | PWA service worker |

## Troubleshooting

| Problem | Try this |
| --- | --- |
| Launcher says `_system` is missing | Extract the whole release ZIP first. Do not launch the HTA from inside the ZIP or from a folder containing only the launcher. |
| Windows says the app is installing or starting | Let the installer finish. First setup downloads dependencies and the first start can take longer. Keep the installer window open until it completes. |
| Browser cannot connect / page is blank | Start the app again using the SD Dynamics shortcut and wait for the local server. If the configured port is busy, the app may use another local port. |
| Update completed but the old screen still appears | Stop and reopen the app; refresh the browser if needed. |
| Need to move to a new computer | Use **More options → Move to another PC**, transfer the ZIP, install the app on the new computer, then restore the backup. |
| Need help with a module or workflow | See the [User Guide]( _system/docs/USER_GUIDE.md ) and [open an issue](https://github.com/veeranki97/SD-Dynamics-V.10/issues) with a description and steps to reproduce. Use sample data and hide sensitive details. |

## Documentation and support

- [User guide]( _system/docs/USER_GUIDE.md ) — setup, modules, daily workflows, backups, and troubleshooting
- [Documentation index]( _system/docs/README.md )
- [Changelog](CHANGELOG.md)
- [Issues and feature requests](https://github.com/veeranki97/SD-Dynamics-V.10/issues)
- [Latest release](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest)
- [All releases](https://github.com/veeranki97/SD-Dynamics-V.10/releases)
- [Security policy](SECURITY.md)

## Contributing and license

Contributions are welcome. Fork the repository, create a feature branch, make and test your changes, then open a pull request. Consult the project scripts and documentation for development and release checks.

This project is distributed under the [MIT License](LICENSE.txt).

---

<div align="center">

**SD Dynamics V.10** · GST billing and business operations software · [⬇ Download the latest release](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest)

</div>
