# Receipt double-post fix

## Problem
Legacy client journal (Bank / Sundry Debtors) + server afterReceiptSaved (1210 / 1300)
both appeared → cash book / day book double inflow.

## Fix
1. POST /api/journals rejects auto payment/receipt/invoice journals when useGlEngine is on.
2. CashBook + General Ledger display only glEngine journals when any exist.
3. glClient probe more reliable so saveJournalIfLegacy skips on UI.

## Clean existing double lines
Delete or archive the **legacy** journal files that have free-text accounts
"Bank" / "Sundry Debtors" without glEngine:true for the same receipt.
Keep jnl_gl_receipt_* rows.

## Test
- [ ] One receipt → one Dr Bank + one Cr Debtors in GL (with 1210/1300 labels)
- [ ] Day book inflow = receipt amount once
- [ ] Cash book running bal matches single receipt
