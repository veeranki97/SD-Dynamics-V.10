<div align="center">

# SD Dynamics

### GST billing & service ERP for India

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0.0-blue.svg)](https://github.com/veeranki97/Bharatbill2/releases)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](#quick-start)

**Product name:** SD Dynamics  
**Source repository:** [github.com/veeranki97/Bharatbill2](https://github.com/veeranki97/Bharatbill2)

Offline-first · Local `data/` · React + Vite + Express

</div>

---

## About

**SD Dynamics** is a customized GST + service ERP for Indian operations (work orders, sites, cost centers, double-entry-style ledgers, Sai Durga / Tally PDF layouts).

It is based on [Free GST Billing Software](https://github.com/IamRamgarhia/Free-GST-Billing-Software) (DiceCodes, MIT), extended for SD-style workflows.

| | |
|--|--|
| **Product** | SD Dynamics |
| **Version** | **2.0.0** (fork initial ERP release) |
| **GitHub** | `veeranki97/Bharatbill2` *(repo folder name; app displays as SD Dynamics)* |

In-app update checks use **this** GitHub repo so customizations are not overwritten by upstream Free GST Billing releases.

---

## Quick start

```bash
git clone https://github.com/veeranki97/Bharatbill2.git
cd Bharatbill2
npm install
npm run build
npm start
```

Protect the **`data/`** folder (all business data).

```bash
npm run dev:win   # Windows dev
```

---

## Features (SD Dynamics layer)

- Work Orders (budget ceiling, invoice link, auto-fill)
- Purchase Orders + Cost Centers
- Clients vs Vendors, Site cascade on invoice
- Cash Book, journals, Chart of Accounts, General Ledger
- Site-wise / WO-wise P&L
- Sai Durga & Tally Classic PDF templates
- Receipts / expenses with Site + WO + Cost Center
- Grouped navigation, ActionMenu (⋮)

Plus retained upstream GST invoicing, GSTR helpers, inventory, PWA, backups.

---

## Documentation

- [CHANGELOG.md](./CHANGELOG.md) — starts at **2.0.0**
- [CUSTOM_CHANGES_README.txt](./CUSTOM_CHANGES_README.txt)
- [docs/README.md](./docs/README.md)

---

## Attribution

- **SD Dynamics** custom ERP — maintained at [veeranki97/Bharatbill2](https://github.com/veeranki97/Bharatbill2)
- Base app — [Free GST Billing Software](https://github.com/IamRamgarhia/Free-GST-Billing-Software) (MIT)

License: **MIT**

---

<div align="center"><b>SD Dynamics v2.0.0</b></div>
