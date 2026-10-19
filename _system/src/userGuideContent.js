// Structured content for the in-app User Guide (UserGuideView.jsx) and searchable PDF.
// Block types: h1|h2|h3, p, ul|ol, note, kv, spacer
// Keep in sync with _system/docs/USER_GUIDE.md

export const GUIDE_CONTENT = [
  { type: 'h1', text: 'SD Dynamics — User Guide' },
  { type: 'p', text: 'Plain-language guide for GST billing, work orders, purchase orders, and books. Use Ctrl+F (or PDF search) to find a topic.' },
  { type: 'note', text: 'TL;DR — Extract the release ZIP → open SD Dynamics launcher → data lives in _system/data/ (SQLite + JSON mirror). Back that folder up regularly. PIN locks the screen only; it is not full disk encryption.' },
  { type: 'spacer' },

  { type: 'h2', text: '1. What is SD Dynamics?' },
  { type: 'p', text: 'Offline-first GST and service/project ERP for contractors, O&M, and service businesses. Runs on your PC; optional Google Drive backup and SMTP email only when you configure them.' },
  { type: 'h3', text: 'It can do' },
  { type: 'ul', items: [
    'Tax invoices, quotations, proformas, credit notes, delivery challans with separate number series.',
    'Work Orders with budget ceilings; link invoices and subcontract Purchase Orders.',
    'Purchase Orders, purchase bills, expenses, receipts, cash book / day book, journals.',
    'Financial Books: trial balance, balance sheet, P&L, site / WO / cost-centre P&L, period lock.',
    'GSTR-1 / GSTR-3B exports, 2B/2A-style purchase matching, ITC set-off helpers.',
    'PDF templates: Sai Durga, Tally, Boxed grid; master data for HSN, units, cost centres, services.',
    'PIN screen lock, automatic local backups, activity log, optional HRMS.',
  ]},
  { type: 'h3', text: 'It will not' },
  { type: 'ul', items: [
    'Upload your books to a public cloud unless you connect Drive/SMTP yourself.',
    'Encrypt the database with the PIN — PIN only blocks the UI. Protect the data folder and use OS encryption.',
  ]},
  { type: 'spacer' },

  { type: 'h2', text: '2. Quick Start' },
  { type: 'ol', items: [
    'Download the latest release ZIP from GitHub (veeranki97/SD-Dynamics-V.10).',
    'Extract to a stable folder. Open “SD Dynamics - WINDOWS.hta” (or platform launcher).',
    'First run: Install → Open App. Browser opens on localhost (port may be in data/port.txt).',
    'Settings → Company profile: name, address, GSTIN, state, bank/UPI.',
    'Work → Master data: cost centres, HSN/SAC, units, services.',
    'Add a client → New Invoice → save. Turn on Backup under Settings → Backup & trash.',
  ]},
  { type: 'spacer' },

  { type: 'h2', text: '3. Sidebar groups' },
  { type: 'kv', rows: [
    ['Home', 'Dashboard KPIs and charts'],
    ['Sales', 'Invoices list, New Invoice, Recurring, Clients'],
    ['Purchase', 'Vendors, Purchase Orders, Purchase Bills, Expenses'],
    ['Work', 'Work Orders, Master data'],
    ['Money', 'Receipts, recon, Cash book, Bank feed'],
    ['Books', 'Chart of accounts, General ledger, Financial Books'],
    ['Compliance', 'GST Returns, Reports / Data export'],
    ['System', 'Settings, activity log, system health'],
  ]},
  { type: 'spacer' },

  { type: 'h2', text: '4. Settings' },
  { type: 'p', text: 'Jump tabs: Company profile · GST & e-Invoice · Invoice & print · Mail & templates · Dashboard charts · Backup & trash · Security · Modules & region. E-Invoice settings live here only (not a second System menu item). Use “Save all changes” on the bottom bar when several sections are dirty.' },
  { type: 'spacer' },

  { type: 'h2', text: '5. Master data' },
  { type: 'ul', items: [
    'Cost centres — sequential IDs such as CC-001; use on invoice lines, WO, PO, expenses.',
    'HSN / SAC — search and add; used on invoices, WO, PO.',
    'Units — search and add; shared dropdowns.',
    'Expense categories — for expenses.',
    'Services — catalogue rates/SAC for service lines.',
    'Use ⋮ on rows for Edit / Copy / Delete where available.',
  ]},
  { type: 'spacer' },

  { type: 'h2', text: '6. Clients & vendors' },
  { type: 'ul', items: [
    'GSTIN checked for format/checksum; state digits should match state when both are set.',
    'Identity lock: if the client has invoices (or vendor has purchase bills), name / GSTIN / state cannot change. Phone and email stay editable.',
    'Optional multi-site (name + address + GSTIN). Ship-to on invoices can use a site.',
  ]},
  { type: 'spacer' },

  { type: 'h2', text: '7. Invoices' },
  { type: 'ul', items: [
    'Types: Tax Invoice, Quotation, Proforma, Credit Note, Delivery Challan (and Bill of Supply if enabled).',
    'Turnover, aging, and GSTR sales count tax invoices only — not quotation, proforma, DC, or cancelled. Credit notes reduce sales.',
    'Record payment / Mark paid only on tax invoices.',
    'Separate number series per document type.',
    'Link Work Order: type-ahead; pre-fills client and lines. Create WO from invoice when you invent a job number for records.',
    'Convert Quotation → PI/DC/Tax Invoice; PI → Tax Invoice (advances should transfer without double bank inflow).',
    'Delivery Challan PDF is quantity-focused (no commercial amounts on standard DC layout).',
    'Line toolbar: fill-down HSN, unit, rate, tax %, description; duplicate row.',
  ]},
  { type: 'spacer' },

  { type: 'h2', text: '8. Work Orders' },
  { type: 'ul', items: [
    'Budget ceiling: cannot bill more than remaining WO budget (small tolerance).',
    '⋮ actions: email, Create Expense, View ledger, convert to invoice types (hidden when completed/cancelled/closed).',
    'Create PO: opens New PO prefilled from the WO. After one non-cancelled PO is linked, Create PO is disabled (convert-once, like invoices). Cancelled POs do not block a new Create PO.',
    'Dossier: linked invoices, subcontract POs, purchases, expenses, margin-style totals when tagged.',
  ]},
  { type: 'spacer' },

  { type: 'h2', text: '9. Purchase Orders & bills' },
  { type: 'ul', items: [
    'Link WO for subcontract; ship-to is client/site address — never the seller profile address.',
    'Print uses PO number as suggested file name; turn off browser headers/footers; A4.',
    'Create bill from PO pre-fills purchase bill lines. “Fully billed” is not the same as vendor paid — record payment to clear outstanding.',
  ]},
  { type: 'spacer' },

  { type: 'h2', text: '10. Receipts, expenses, cash book' },
  { type: 'ul', items: [
    'Payment against invoice cannot exceed outstanding (about ₹1 tolerance).',
    'Choosing an invoice on receipt/expense can auto-fill WO, cost centre, and site.',
    'Cash book: bank ledger + day book; print/export where enabled.',
    'Reversals should post new journal lines (append-only), not rewrite old narrations.',
  ]},
  { type: 'spacer' },

  { type: 'h2', text: '11. Financial Books' },
  { type: 'p', text: 'Sidebar: Financial Books. Tabs include Trial Balance, Balance Sheet, P&L, Site-wise, WO-wise, Cost centre P&L, and Period lock.' },
  { type: 'note', text: 'Period lock (Financial Books) is separate from GST month lock under GST Returns → Filing assist. Both freeze different workflows.' },
  { type: 'p', text: 'WO-wise and Cost centre P&L use journals when tagged; otherwise they fall back to invoices and expenses that carry workOrderId / costCenterId.' },
  { type: 'spacer' },

  { type: 'h2', text: '12. GST returns' },
  { type: 'ul', items: [
    'GSTR-1 and GSTR-3B summaries and file exports from Compliance → GST Returns.',
    'ITC set-off follows Rule 88A-style head order in the liability table.',
    '2B/2A-style CSV/JSON match against purchases (small tax tolerance).',
    'Prefer a single Month close path under Filing assist: Export → Review → Lock → Backup.',
  ]},
  { type: 'spacer' },

  { type: 'h2', text: '13. PDF templates' },
  { type: 'ul', items: [
    'Settings → Invoice & print: Sai Durga, Tally, Boxed grid.',
    'Prefer Print / vector PDF (selectable text), not a screenshot-style capture.',
    'Chrome print: Headers and footers OFF; A4; file name = document number.',
  ]},
  { type: 'spacer' },

  { type: 'h2', text: '14. PIN, backup, health' },
  { type: 'ul', items: [
    'Security: 6 or 8 digit PIN; optional idle lock. Forgot PIN → place file RESET-PIN next to the launcher and reopen.',
    'Backup & trash: manual backup/restore, automatic backup schedule, trash for soft deletes.',
    'System health: SQLite ready vs JSON fallback. If SQLite fails: npm rebuild better-sqlite3 from _system, restart node server.js (root file, not src/server.js).',
    'Activity log: major create/update events for audit.',
  ]},
  { type: 'spacer' },

  { type: 'h2', text: '15. FAQ' },
  { type: 'kv', rows: [
    ['Create PO disabled?', 'WO already has a non-cancelled Purchase Order. Open it from PO list or WO dossier.'],
    ['Blank page on Create PO?', 'Update to the build that fixes multi-site object rendering on Ship To; rebuild and restart.'],
    ['Vendor still due after fully billed PO?', 'Record payment against the purchase bill; PO status alone does not clear AP.'],
    ['Empty WO / CC P&L?', 'Tag invoices and expenses with Work Order and Cost centre.'],
    ['Cannot change client GSTIN?', 'Identity lock — client has invoices. Edit phone/email only.'],
    ['Port keeps changing?', 'Kill extra node.exe processes; start server once; check data/port.txt.'],
  ]},
  { type: 'spacer' },

  { type: 'h2', text: '16. Need help?' },
  { type: 'p', text: 'Project: https://github.com/veeranki97/SD-Dynamics-V.10 — keep _system/data/ backed up before major upgrades.' },
];
