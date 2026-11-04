# Changelog — SD Dynamics V.10

Notable changes to SD Dynamics are documented here. Versions follow [Semantic Versioning](https://semver.org/); the format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

[⬇ Download the latest release](https://github.com/veeranki97/SD-Dynamics-V.10/releases/latest) · [📦 All releases](https://github.com/veeranki97/SD-Dynamics-V.10/releases) · [📖 User guide]( _system/docs/USER_GUIDE.md )

---

## [v2.5.3] — 2026-11-02

Latest published release. Includes workflow and usability improvements across HRMS, cash book, and invoicing.

### Added

- HRMS leave requests for CL, SL, and EL, with approval/rejection actions and employee leave-balance updates on approval.
- Overtime-hour entry in attendance and overtime pay in payroll and wage-register calculations.
- Excel-compatible labour-register exports for Forms T, XVII, XXII, XX, XXI, XXIII, and XIII, with optional site filtering and statutory header details.
- Ariba SES follow-up task creation and tracking from an invoice action.

### Improved

- Cash Book summary cards, search, movement-type filters, and clearer Bank Ledger and Day Book views.
- Invoice line-item reordering by drag and drop, amount-in-words output in the selected currency, and estimated gross margin display when item cost data is available.
- HRMS layout and report refinements, product matching, and invoice/client state handling when converting work orders.

See the [v2.5.3 release](https://github.com/veeranki97/SD-Dynamics-V.10/releases/tag/v2.5.3).

## [v2.5.2] — 2026-10-28

### Security and maintenance

- Updated dependency copies in the release tree, including `body-parser`, `fast-uri`, and `serialize-javascript`, to incorporate upstream fixes and maintenance updates.
- Updated `body-parser` to 2.4.0 and `fast-uri` to 3.1.9; these upstream releases include security fixes. Updated `serialize-javascript` to 7.1.4.

See the [v2.5.2 release](https://github.com/veeranki97/SD-Dynamics-V.10/releases/tag/v2.5.2) and the [merged dependency updates](https://github.com/veeranki97/SD-Dynamics-V.10/pulls?q=is%3Apr+is%3Amerged+22+23).

## [v2.5.1] — 2026-10-24

### Improved

- Polished Dashboard cards and surfaces, with responsive KPI layout and improved spacing and visual hierarchy.
- Improved sidebar navigation styling, active states, and keyboard focus visibility.
- Respected reduced-motion preferences in the updated dashboard styling.

See the [v2.5.1 release](https://github.com/veeranki97/SD-Dynamics-V.10/releases/tag/v2.5.1) and [PR #18](https://github.com/veeranki97/SD-Dynamics-V.10/pull/18).

## [v2.5.0] — 2026-10-23

### Maintenance

- Published the v2.5.0 release. The release notes describe a set of fixes but do not enumerate them; see the [release page](https://github.com/veeranki97/SD-Dynamics-V.10/releases/tag/v2.5.0) for its original notes.

## [v2.4.9] — 2026-10-19

- Published the v2.4.9 release. See the [release page](https://github.com/veeranki97/SD-Dynamics-V.10/releases/tag/v2.4.9).

## [v2.4.0] — 2026-10-19

### Added and improved

- Added Tesseract asset bundling through the install/build hooks for OCR-related assets.
- Expanded developer test scripts, smoke checks, and release verification tooling.
- Improved release ZIP packaging and cross-platform path validation.
- Clarified the Node.js requirement: version 18 or newer.
- Retained JSON-to-SQLite migration and JSON mirroring support introduced in earlier releases.

## [v2.3.8] — 2026-10-03

### Added and improved

- Added SQLite storage with `better-sqlite3`, automatic JSON migration, and JSON mirroring support.
- Added indexed lookups for common records and a System Health view for SQLite status and record counts.
- Improved Settings loading for large datasets and refreshed invoice, payment tracker, expenses, and sidebar workflows.
- Fixed multiple UI, payment, expense, and data-stability issues.

This entry summarizes the previous changelog's v2.3.8 baseline; the legacy details below are historical and may not describe the current release.

---

## Earlier product history

| Version | Historical milestone |
| --- | --- |
| v2.3.0 | Profile-related groundwork and TDS/TCS improvements. |
| v2.2.0 | HRMS/payroll and cost-centre work. |
| v2.1.0 | Recurring invoicing and audit-log work. |
| v2.0.0 | SD Dynamics ERP release, adding work orders, purchase orders, vendors, cost centres, accounting books, and project-focused invoice styles. |
| v1.x | Upstream Free GST Billing Software history; see the [upstream changelog](https://github.com/IamRamgarhia/Free-GST-Billing-Software/blob/main/CHANGELOG.md). |

## Current feature areas

The application continues to include GST invoicing and exports, work and purchase orders, accounting books, cash and bank ledgers, HRMS/payroll, local backups, and offline support. For current usage details, see the [README](README.md) and [User Guide]( _system/docs/USER_GUIDE.md ).

### GST and statutory data

The application provides GST calculations and data exports, including GSTR-1, GSTR-3B, GSTR-2B reconciliation, and NIC-format e-way bill JSON. HRMS provides the payroll and register exports described in the current release notes. Review all calculations and generated statutory records before filing or submission; this software does not submit filings on your behalf.

### Data storage and migrations

SQLite and JSON migration/mirroring support were introduced in v2.3.8. Keep backups before updates, restores, migrations, or manual data operations. Do not edit or delete files in the application data directory directly.

## Release and version notes

- The latest published version is **v2.5.3**. Check [GitHub Releases](https://github.com/veeranki97/SD-Dynamics-V.10/releases) for newer releases before relying on this document for version-specific guidance.
- See [README installation instructions](README.md#download-and-install) for installing and updating the app.
- Earlier notes and planned-feature lists from the former v2.3.8-era changelog have been condensed because their roadmap status may have changed. Check the current [issues](https://github.com/veeranki97/SD-Dynamics-V.10/issues) and release notes for work in progress.
- Security issues should be reported using [SECURITY.md](SECURITY.md), not as public issues.

---

**Last updated:** 2026-11-04 · **Latest documented release:** v2.5.3
