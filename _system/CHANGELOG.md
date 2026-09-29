# Changelog — SD Dynamics

Product: **SD Dynamics**  
Repository: https://github.com/veeranki97/Bharatbill2  

Semantic Versioning. Format: Keep a Changelog.

---

## [2.0.0] - 2026-09-23

### Initial SD Dynamics release

First versioned product release of the customized ERP fork (base: Free GST Billing ~1.10.x).

#### Branding
- Application display name: **SD Dynamics**
- Package name: `sd-dynamics`
- GitHub repo remains `veeranki97/Bharatbill2` (code host)

#### Added (ERP)
- Work Orders, Purchase Orders, Vendors, Cost Centers
- Chart of Accounts, General Ledger, Cash Book (CSV export), Payment Recon
- Site-wise & WO-wise P&L
- Sai Durga / Tally PDF styles
- Invoice cascade State → Client → Site; WO auto-fill; due date +30 days
- Update check → this repository only

#### Fixed
- Payment status → journal/receipt for ledger + cash book
- Client list excludes vendors; ActionMenu visibility; line-item grid alignment

---

## Upstream

Historical Free GST Billing notes:  
https://github.com/IamRamgarhia/Free-GST-Billing-Software/blob/main/CHANGELOG.md
