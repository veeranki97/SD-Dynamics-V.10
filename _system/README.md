<div align="center">

# SD Dynamics V.10 — GST Billing & ERP Software

### Comprehensive GST invoicing, ERP, and project billing software for modern operations.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](#install-in-60-seconds--one-launcher-per-platform)
[![Latest release](https://img.shields.io/github/v/release/veeranki97/SD-Dynamics-V.10?label=Latest&color=orange)](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest)
[![PWA](https://img.shields.io/badge/PWA-installable-purple.svg)](#install-in-60-seconds--one-launcher-per-platform)
[![GitHub Stars](https://img.shields.io/github/stars/veeranki97/SD-Dynamics-V.10?style=social)](https://github.com/veeranki97/SD-Dynamics-V.10)
[![GST](https://img.shields.io/badge/GST-Compliant-success.svg)](#gst-compliance--filing)

**Create GST-compliant invoices, file GSTR-1 / GSTR-3B / GSTR-2B reconciliation, manage vendor ledgers, track TDS / TCS, and handle operations for civil, electrical, and service contracts.**

Your data never leaves your computer. No cloud. No signup. No tracking. Open-source and offline-first.

<a href="https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest/download/SD-Dynamics-V.10.zip"><img src="https://img.shields.io/github/v/release/veeranki97/SD-Dynamics-V.10?style=for-the-badge&label=%E2%AC%87%EF%B8%8F%20Download&color=16a34a&labelColor=15803d" alt="Download the latest version" height="48"></a>

<sub>Always the newest version · about 16 MB · Windows, macOS and Linux in one ZIP · Last Updated: October 2, 2026</sub>

[⬇ Download ZIP](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest/download/SD-Dynamics-V.10.zip) &nbsp;|&nbsp; [📦 Releases](https://github.com/veeranki97/SD-Dynamics-V.10/releases) &nbsp;|&nbsp; [⚡ 3-Step Install](#install-in-60-seconds--one-launcher-per-platform) &nbsp;|&nbsp; [🧾 First Invoice in 5 Minutes](#your-first-invoice-in-5-minutes) &nbsp;|&nbsp; [🐛 Report Bug](https://github.com/veeranki97/SD-Dynamics-V.10/issues)

</div>

---

## Install in 60 Seconds — one launcher per platform

The download ZIP holds a **launcher for each system**, a plain-English **`READ ME FIRST.txt`**, and a `_system/` folder with everything else. Extract the ZIP, double-click the launcher for your computer, click **Install** — it sets itself up, needs no administrator rights, and opens the app in your browser when it is done.

```
SD-Dynamics-V.10/
├── SD Dynamics - WINDOWS.hta    ← Windows: double-click this
├── READ ME FIRST.txt            ← step-by-step, in plain English
└── _system/                     ← the app (hidden after install)
```

<!--
  TODO before publishing: no automated one-line PowerShell installer (install.ps1) exists in the
  repository yet. Remove this section or build the script first — a broken install command is the
  worst possible first impression. Restore this block once install.ps1 is actually in the repo:

  **Prefer one command?** Paste this into PowerShell — no admin rights needed:
  ```powershell
  irm https://raw.githubusercontent.com/veeranki97/SD-Dynamics-V.10/main/install.ps1 | iex
  ```
  It fetches the latest release, installs it to `%LOCALAPPDATA%\Programs\SD Dynamics`, installs
  Node.js if you do not have it, and creates the Desktop shortcut.
-->

---

## 📑 Table of Contents

* [Install in 60 Seconds](#install-in-60-seconds--one-launcher-per-platform)
* [Why Choose SD Dynamics V.10?](#why-choose-sd-dynamics-v10)
* [Your First Invoice in 5 Minutes](#your-first-invoice-in-5-minutes)
* [Key Features](#key-features)
* [Invoicing & Billing](#invoicing--billing)
* [GST Compliance & Filing](#gst-compliance--filing)
* [Business Management](#business-management)
* [Tech Stack](#tech-stack)
* [Who Is This For?](#who-is-this-for)
* [Data Privacy & Security](#data-privacy--security)

---

## Your First Invoice in 5 Minutes

A step-by-step guide for the *very first* invoice you create after installing.

### Step 1 — Install (1 minute)

1. **[Download the ZIP](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest/download/SD-Dynamics-V.10.zip)** — always the latest version.
2. Right-click the downloaded ZIP → **Extract All** → pick a folder you'll remember (e.g. `Documents\SDDynamics`)
3. Open the **extracted** folder → double-click **`SD Dynamics - WINDOWS`**.
4. Click **Install Node & App**. Takes 1–2 minutes the first time.
5. Click **Open App** — the app opens in your browser at `http://localhost:47371`.

### Step 2 — Set up your business profile (1 minute)

The Welcome Wizard appears automatically on first launch. Fill in your business name, address, GSTIN, and bank/UPI details.

### Step 3 — Create your first invoice (2 minutes)

1. Click **+ New Invoice** in the sidebar.
2. Pick the invoice type: **Tax Invoice**, **Bill of Supply**, **Proforma**, or **Delivery Challan**.
3. Type the client's name in the **Bill To** field.
4. Add line items in the table (Description, Qty, Unit, Rate, Tax %).
5. Click **Download PDF** in the top-right to generate your perfectly formatted PDF.

---

## Why Choose SD Dynamics V.10?

SD Dynamics V.10 is the open-source alternative that changes everything, especially tailored for detailed service contracts, construction tracking, and precise GST/TDS management.

* **Completely free** — no subscription, no premium tier, no hidden charges.
* **100% offline** — runs on localhost, works without internet after installation.
* **Your data stays on YOUR computer** — invoices, GSTIN, vendor ledgers, and client records stored as local JSON files.
* **GST compliant** — auto-calculates CGST/SGST/IGST, generates GSTR-1 & GSTR-3B data, and supports complex GST tax splitting.
* **Custom formatting** — finely-tuned PDF print formatting, ready for corporate clients and rigorous tender documentation.
* **Open-source (MIT licensed)** — built and maintained by Veeranki Bharath Kumar.

---

## Key Features

### Invoicing & Billing

* **Full Invoice Types:** Tax Invoice, Proforma/Estimate, Bill of Supply, Credit Note, Delivery Challan.
* **Auto GST Calculation:** CGST + SGST for intra-state, IGST for inter-state.
* **Advanced Tax Splitting & TDS:** Section 194Q / 194C / 194J / 194I / 194H / 194O / 195 (TDS) and TCS computations, critical for accurate contractor and vendor ledger maintenance.
* **Multi-Currency:** Bill in INR + 21 other currencies.
* **Professional PDF Formatting:** Custom PDF styling perfect for executive corporate submissions and technical project billing. Multi-page Rule 48 compliance ensures rows are never cut across pages.

### GST Compliance & Filing

* **GSTR-1 & GSTR-3B Computation:** Output tax liability, Input Tax Credit, and net tax payable computed offline.
* **GSTR-2B Reconciliation:** Import JSON downloaded from the GST portal to auto-match against your purchase records.
* **E-Way Bill JSON:** Download NIC-format JSON for e-way bill portal upload.
* **Income Tax (ITR) Computation:** Built-in module for tax tracking, advance-tax schedules, and surcharge calculations (Updated for October 2026).

### Business Management

* **Vendor & Client Ledgers:** Save clients and subcontractors with GSTINs, track outstanding amounts, and maintain full vendor history.
* **Multi-Business Profiles:** Run multiple business entities side-by-side, each with its own GSTIN and bank details.
  <!-- TODO before publishing: verify data isolation between profiles end to end (create two profiles,
       confirm an invoice/ledger entry made under one never appears under the other, including in
       Reports and GSTR exports) before restoring the stronger "fully isolated financial books" wording. -->
* **Automated Backup:** Daily automatic backups to `data/backups/YYYY-MM-DD/` with a 30-day retention Trash bin.
* **Command Palette:** `Ctrl+K` spotlight-style search across invoices, clients, products, and ledgers.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React 19, Vite 7 |
| **Backend** | Express 5 (Node.js) |
| **PDF Generation** | jsPDF + html2canvas (Custom PDF Print Formatting) |
| **Storage** | File-based JSON — no database needed |
| **Offline** | PWA with service worker caching |

---

## Who Is This For?

| Who | How They Use It |
| --- | --- |
| **Service & Civil Contractors** | Manage project billing for solar plant O&M, civil construction, electrical operations, and vegetation removal. Record TDS meticulously and maintain robust vendor ledgers. |
| **Freelancers & Consultants** | Invoice clients for projects or hourly work. |
| **Small Shops & Retail Stores** | Quick bill generation with UPI QR code and stock tracking. |
| **Manufacturers & Traders** | GST tax invoices with HSN codes, delivery challans, e-way bill JSON. |

---

## Data Privacy & Security

**Where is my data stored?**
In a `data/` folder on your computer as plain JSON files. No server, no cloud, no database.

**Can anyone access my invoices?**
No. The app runs on `localhost` — not accessible from the internet or other computers unless you specifically configure your LAN.

**Do I need internet?**
Only for the first install (`npm install`). After that, everything works completely offline.

---

## Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

---

## License

This project is licensed under the [MIT License](LICENSE) — free to use, modify, and distribute.

### Built for modern, hassle-free business operations.

**[⬇ Download Now](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest/download/SD-Dynamics-V.10.zip)** · [⭐ Star on GitHub](https://github.com/veeranki97/SD-Dynamics-V.10) · [🐛 Report an Issue](https://github.com/veeranki97/SD-Dynamics-V.10/issues)

---

**SD Dynamics V.10** by Veeranki Bharath Kumar · MIT Licensed · October 2026
