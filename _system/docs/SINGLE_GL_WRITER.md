# Single GL writer + clean audit

## Root cause
Frontend InvoiceGenerator / Receipt / Expense called `saveJournal` (legacy free-text)
AND server `afterTaxInvoiceSaved` (engine) → double / reverse spam in General Ledger.

## Fix
1. When `meta.useGlEngine` is true, UI uses `saveJournalIfLegacy` → skips client journals.
2. Server posts once via after* + postDocument hash-skip if unchanged.
3. Bank-paid expense: Cr Bank/Cash (not Creditors).
4. Cash/day book voucher prefers REC/… refLabel.

## Apply
Copy files into `_system/`, restart server, rebuild UI (`npm run build`).

## Clean old spam
Delete `data/journals/*` for test (or only non-glEngine junk), re-save invoice + receipt once.

## Test
- [ ] Save tax invoice once → one 4-leg set (or 3 IGST)
- [ ] Save again unchanged → no new lines
- [ ] Receipt → REC/ in day book + GL narration
- [ ] Bank expense → Dr expense Cr Bank
- [ ] TB balances; PDF/GSTR still work
