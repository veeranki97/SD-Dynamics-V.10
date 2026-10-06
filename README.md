1| <div align="center">
2| 
3| # SD Dynamics V.10 — GST Billing & ERP Software
4| 
5| ### Comprehensive GST invoicing, ERP, and project billing software for modern operations.
6| 
7| [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
8| [![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](#install-in-60-seconds--one-launcher-per-platform)
9| [![Latest release](https://img.shields.io/github/v/release/veeranki97/SD-Dynamics-V.10?label=Latest&color=orange)](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest)
10| [![PWA](https://img.shields.io/badge/PWA-installable-purple.svg)](#install-in-60-seconds--one-launcher-per-platform)
11| [![GitHub Stars](https://img.shields.io/github/stars/veeranki97/SD-Dynamics-V.10?style=social)](https://github.com/veeranki97/SD-Dynamics-V.10)
12| [![GST](https://img.shields.io/badge/GST-Compliant-success.svg)](#gst-compliance--filing)
13| [![SQLite](https://img.shields.io/badge/Database-SQLite-blue.svg)](#database-performance-new)
14| 
15| **Create GST-compliant invoices, file GSTR-1 / GSTR-3B / GSTR-2B reconciliation, manage vendor ledgers, track TDS / TCS, and handle operations for civil, electrical, and service contracts.**
16| 
17| Your data never leaves your computer. No cloud. No signup. No tracking. Open-source and offline-first.
18| 
19| <a href="https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest/download/SD-Dynamics-V.10.zip"><img src="https://img.shields.io/github/v/release/veeranki97/SD-Dynamics-V.10?style=for-the-badge" alt="Latest release" /></a>
20| 
21| <sub>Always the newest version · about 16 MB · Windows, macOS and Linux in one ZIP · Last Updated: October 6, 2026</sub>
22| 
23| [⬇ Download ZIP](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest/download/SD-Dynamics-V.10.zip) &nbsp;|&nbsp; [📦 Releases](https://github.com/veeranki97/SD-Dynamics-V.10/releases) &nbsp;|&nbsp; [💬 Issues](https://github.com/veeranki97/SD-Dynamics-V.10/issues)
24| 
25| </div>
26| 
27| ---
28| 
29| ## Install in 60 Seconds — one launcher per platform
30| 
31| The download ZIP holds a **launcher for each system**, a plain-English **`READ ME FIRST.txt`**, and a `_system/` folder with everything else. Extract the ZIP, double-click the launcher for your computer, and the app opens locally in your browser.
32| 
33| ```
34| SD-Dynamics-V.10/
35| ├── SD Dynamics - WINDOWS.hta    ← Windows: double-click this
36| ├── READ ME FIRST.txt            ← step-by-step, in plain English
37| └── _system/                     ← the app (hidden after install)
38| ```
39| 
40| ---
41| 
42| ## 📑 Table of Contents
43| 
44| * [Install in 60 Seconds](#install-in-60-seconds--one-launcher-per-platform)
45| * [Why Choose SD Dynamics V.10?](#why-choose-sd-dynamics-v10)
46| * [Your First Invoice in 5 Minutes](#your-first-invoice-in-5-minutes)
47| * [Key Features](#key-features)
48| * [Database Performance — NEW](#database-performance--new)
49| * [Contract Billing & RA Tracking](#contract-billing--ra-tracking)
50| * [Invoicing & Billing](#invoicing--billing)
51| * [GST Compliance & Filing](#gst-compliance--filing)
52| * [Business Management](#business-management)
53| * [Tech Stack](#tech-stack)
54| * [Who Is This For?](#who-is-this-for)
55| * [Data Privacy & Security](#data-privacy--security)
56| 
57| ---
58| 
59| ## Why Choose SD Dynamics V.10?
60| 
61| SD Dynamics V.10 is the open-source alternative that changes everything, especially tailored for detailed service contracts, construction tracking, and precise GST/TDS management.
62| 
63| * **Completely free** — no subscription, no premium tier, no hidden charges.
64| * **100% offline** — runs on localhost, works without internet after installation.
65| * **Your data stays on YOUR computer** — invoices, GSTIN, vendor ledgers, and client records stored as local SQLite database + JSON backup.
|66| * **GST compliant** — auto-calculates CGST/SGST/IGST, generates GSTR-1 & GSTR-3B data, and supports complex GST tax splitting.
67| * **Fast & responsive** — SQLite database with indexed queries (60%+ faster on large datasets).
68| * **Contract-ready billing** — includes RA / running-account bill workflows, mobilization advance recovery, retention, and statutory withholdings.
69| * **Procurement-aware controls** — link work orders, purchase orders, and subcontract expenses to the same project ledger.
70| * **Open-source (MIT licensed)** — built and maintained by Veeranki Bharath Kumar.
71| 
72| ---
73| 
74| ## Key Features
75| 
76| ### Database Performance — NEW 🚀
77| 
|78| * **SQLite Store (v2.3.8+):** Primary indexed database with automatic JSON migration
79|   - Automatic one-time import from JSON on first boot (no action needed)
80|   - Full-text indexing: invoiceNumber, docDate, clientName, status, workOrderId
81|   - WAL (Write-Ahead Logging) for safe concurrent access
82|   - JSON mirror enabled by default for data safety and fallback
83|   - **Settings page loads ~60% faster** on 10,000+ records
84| * **Hybrid Storage:** JSONs remain on disk as backup; SQLite for speed
85|   - Disable JSON mirror if needed: `SD_JSON_MIRROR=0` (advanced users)
86|   - Force re-import: `SD_SQLITE_REIMPORT=1` at startup
87| * **System Health Panel:** Monitor SQLite status, record counts, and re-import
88| * **Migration Script:** `scripts/migrate-to-sqlite.mjs` for manual re-import
89| 
90| ### Contract Billing & RA Tracking
91| 
|92| * **Running Account (RA) Bill Mode:** Contracting and infrastructure billing with cumulative work-done tracking.
93| * **RA Certificate Logic:** Captures previous gross passed, mobilization advances, retention deductions, and statutory withholdings.
94| * **TDS / GST-TDS / BOCW:** Supports common construction and EPC deductions such as 194C, GST-TDS, and labour cess handling.
95| * **Net Certified Payable:** Calculates the final certificate amount for each RA bill while keeping the accounting entries aligned.
96| * **Work-order linkage:** Connect invoices, POs, and subcontract costs to project-level tracking and cost ceilings.
97| 
98| ### Invoicing & Billing
99| 
99| * **Full Invoice Types:** Tax Invoice, Proforma/Estimate, Bill of Supply, Credit Note, Delivery Challan.
100| * **Auto GST Calculation:** CGST + SGST for intra-state, IGST for inter-state.
101| * **Advanced Tax Splitting & TDS:** Section 194Q / 194C / 194J / 194I / 194H / 194O / 195 (TDS) and TCS computations, critical for accurate contractor and vendor ledger maintenance.
102| * **Multi-Currency:** Bill in INR + 21 other currencies.
103| * **Professional PDF Formatting:** Custom PDF styling perfect for executive corporate submissions and technical project billing. Multi-page Rule 48 compliance ensures rows are never cut across pages.
104| * **Bank Feed Matching:** Reconcile bank statements to invoices and post the receipt automatically into related ledgers.
105| 
106| ### GST Compliance & Filing
107| 
107| * **GSTR-1 & GSTR-3B Computation:** Output tax liability, Input Tax Credit, and net tax payable computed offline.
108| * **GSTR-2B Reconciliation:** Import JSON downloaded from the GST portal to auto-match against your purchase records.
109| * **E-Way Bill JSON:** Download NIC-format JSON for e-way bill portal upload.
110| * **Income Tax (ITR) Computation:** Built-in module for tax tracking, advance-tax schedules, and surcharge calculations (Updated for October 2026).
111| 
112| ### Business Management
113| 
113| * **Vendor & Client Ledgers:** Save clients and subcontractors with GSTINs, track outstanding amounts, and maintain full vendor history.
114| * **Multi-Business Profiles:** Run multiple business entities side-by-side, each with its own GSTIN and bank details.
115| * **Work Orders & Purchase Orders:** Link project work orders to budgets, purchase orders, and subcontract approvals.
116| * **Expense Controls:** Filter by work order and track PO numbers and subcontract spend for better project cost control.
117| * **Automated Backup:** Daily automatic backups to `data/backups/YYYY-MM-DD/` with a 30-day retention Trash bin.
118| * **Command Palette:** `Ctrl+K` spotlight-style search across invoices, clients, products, and ledgers.
119| 
120| ---
121| 
122| ## Tech Stack
123| 
124| | Layer | Technology |
125| | --- | --- |
126| | **Frontend** | React 19, Vite 7 |
127| | **Backend** | Express 5 (Node.js) |
128| | **Database** | SQLite (better-sqlite3) with JSON fallback |
129| | **PDF Generation** | jsPDF + html2canvas (Custom PDF Print Formatting) |
130| | **Storage** | Hybrid: SQLite + JSON files — no external database needed |
131| | **Offline** | PWA with service worker caching |
132| 
133| ---
134| 
135| ## Who Is This For?
136| 
137| | Who | How They Use It |
138| | --- | --- |
139| | **Service & Civil Contractors** | Manage project billing for solar plant O&M, civil construction, electrical operations, and vegetation removal. Record TDS meticulously and maintain robust vendor and subcontract ledgers. |
140| | **Freelancers & Consultants** | Invoice clients for projects or hourly work. |
141| | **Small Shops & Retail Stores** | Quick bill generation with UPI QR code and stock tracking. |
142| | **Manufacturers & Traders** | GST tax invoices with HSN codes, delivery challans, e-way bill JSON. |
143| 
144| ---
145| 
146| ## Data Privacy & Security
147| 
148| **Where is my data stored?**
149| In a `data/` folder on your computer as SQLite database + JSON files. No server, no cloud, no database.
150| 
151| **Can anyone access my invoices?**
152| No. The app runs on `localhost` — not accessible from the internet or other computers unless you specifically configure your LAN.
153| 
154| **Do I need internet?**
155| Only for the first install (`npm install`). After that, everything works completely offline.
156| 
157| **Is my data backed up?**
158| Yes. Daily automatic backups to `data/backups/YYYY-MM-DD/` with a 30-day retention trash bin. You can also restore from the trash UI.
159| 
160| ---
161| 
162| ## Contributing
163| 
164| 1. **Fork** the repository
165| 2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
166| 3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
167| 4. **Push** to the branch (`git push origin feature/amazing-feature`)
168| 5. **Open** a Pull Request
169| 
170| ---
171| 
172| ## License
173| 
174| This project is licensed under the [MIT License](LICENSE) — free to use, modify, and distribute.
175| 
176| ### Built for modern, hassle-free business operations.
177| 
178| **[⬇ Download Now](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest/download/SD-Dynamics-V.10.zip)** · [⭐ Star on GitHub](https://github.com/veeranki97/SD-Dynamics-V.10) · [💬 Open Issue](https://github.com/veeranki97/SD-Dynamics-V.10/issues)
179| 
180| ---
181| 
182| **SD Dynamics V.10** by Veeranki Bharath Kumar · MIT Licensed · October 2026
