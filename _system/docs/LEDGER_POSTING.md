# LEDGER_POSTING.md — CoA, GL spine, document wiring (Phases A–E)

## Kill-switch

| meta.useGlEngine | Behaviour |
|------------------|-----------|
| false / absent (default) | Legacy journals only. postDocument / after* hooks skip. |
| true | Balanced postDocument + period lock; document hooks when server wired. |

Rollback: set useGlEngine false. No data wipe.

## Cash book rule

Engine ON: cash/bank lines from postDocument are source of truth.
Engine OFF: existing cash book / receipt writers unchanged.

## Source types

| sourceType | Status |
|------------|--------|
| manual_journal | Wired — Books Manual Journal + /api/gl/post |
| tax_invoice | Wired when afterTaxInvoiceSaved installed |
| receipt | Wired when afterReceiptSaved installed |
| pi_to_ti_advance | Wired when afterPiToTiAdvance installed |
| expense / purchase | Wired when after* installed |
| vendor_payment | Recipe ready |
| opening_balance | UI + /api/gl/post |
| period_close | linesPeriodClose recipe; existing P&L close + Period Lock tab |

## Install

See SERVER_GL_INSTALL.md

## Test checklist

- CoA seeds; system accounts protected
- Engine off = legacy OK
- Engine on = unbalanced MJ rejected; balanced MJ on TB + ledger
- Payment ceiling / period lock / PI-TI no double bank
- npm run build
- Toggle off restores legacy
