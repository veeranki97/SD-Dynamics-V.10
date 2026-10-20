# LEDGER_POSTING — Fresh app (engine ON by default)

## Behaviour
- On first boot, if `meta.useGlEngine` is unset → **true**.
- Explicit `false` still disables engine (legacy writers only).
- server.js calls afterTaxInvoiceSaved, afterReceiptSaved, afterExpenseSaved, afterPurchaseSaved, afterPiToTiAdvance when applicable.
- POST /api/journals with sourceType+lines uses postDocument when engine on.
- CoA seeded via ensureCoaOnBoot + migrateLegacyCoaIfEmptyish.

## Cash book (next response)
Cash/bank lines from postDocument are source of truth when engine ON.
CashBookView should read GL — not dual-write receipts.

## Source types posted
tax_invoice, receipt, expense, purchase, pi_to_ti_advance (if advanceApplied+convertedFrom), manual_journal via /api/gl/post or journals with lines.

## Rollback
POST /api/meta/useGlEngine { "value": false }
