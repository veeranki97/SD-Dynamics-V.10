# LEDGER_POSTING.md — Chart of Accounts & GL spine (Phase A–B)

**Status:** Phase A (CoA seed) + Phase B (postDocument engine) delivered.  
**Document wiring (Phase C+), Books UI, period-close wizard:** not in this drop — enable only after TB proof.

## Kill-switch

| Setting | Behaviour |
|---------|-----------|
| `meta.useGlEngine` absent / `false` | **Default.** All existing journal / receipt / invoice paths stay legacy. `postDocument` returns `{ skipped: true, reason: 'engine_off' }`. |
| `meta.useGlEngine = true` | `postDocument` enforces balance (≤1 paise), period lock + freeze, append-only reverse-on-repost, writes `journals` with `glEngine: true` and `accountId` on lines. |

**Rollback:** set `meta.useGlEngine` to `false`. Historical `glEngine` journals remain readable; legacy writers resume. No data wipe.

How to enable (after sample TB balances on manual journals only):

1. Books → (future) or edit `data/meta.json` / meta via API: `"useGlEngine": true`
2. Restart not required if meta is re-read per request; hard-refresh UI.
3. Post one balanced manual journal → Trial Balance must Dr = Cr.

## Persistence (no one-off DB path)

| Concern | Collection | Notes |
|---------|------------|--------|
| Chart of Accounts | `accounts` | Already in `COLLECTIONS`. Seed via `ensureCoaSeeded`. |
| GL batches | `journals` | Same hybrid sqlite + JSON mirror. Lines in `entries[]` with `accountId` + `account` (name). |
| Locks | `meta.lockedMonths` | Existing `periodLock.js` — engine calls same helpers. |

`SCHEMA_VERSION` bumped to **3** in sqliteStore (documentation only; payload_json already flexible).

## Cash book rule (chosen)

When engine **ON**, cash/bank movements that go through `postDocument` are the source of truth. Cash book views should read GL lines for accounts with `accountType` `cash` | `bank`.  
When engine **OFF**, legacy cash/receipt writers remain (current behaviour).

Do not dual-write the same receipt to a second conflicting store while engine is ON without going through `postDocument`.

## Seed CoA (codes)

See `coaSeed.js` — Assets 1000–1430, Liabilities 2000–2300, Equity 3100–3200, Income 4100–4200, Expenses 5100–5900. System leaves cannot be deleted if they have GL lines (UI Phase E).

## Source types — posting matrix

| sourceType | Phase | Status |
|------------|-------|--------|
| `manual_journal` | B | **Ready** via `postManualJournal` / `postDocument` |
| `receipt` / invoice payment | C | **Deferred** — wire after TB proof |
| `tax_invoice` | C | **Deferred** |
| `pi_to_ti_advance` | C | **Deferred** (Dr 2300 / Cr 1300, no bank) |
| `expense` / `purchase` | C | **Deferred** |
| `vendor_payment` | C | **Deferred** |
| `opening_balance` | D | **Deferred** |
| `period_close` | D | **Deferred** (to 3200 RE) |

Legacy free-text journals without `accountId` still display on read paths (`account` name).

## Files in this drop

- `_system/src/db/sqliteStore.js` — CoA/GL comments + SCHEMA_VERSION 3  
- `_system/src/utils/coaSeed.js` — seed + `ensureCoaSeeded` + `DEFAULT_GL_MAP`  
- `_system/src/utils/glPosting.js` — `createGlEngine`, `postDocument`, TB helper  
- `_system/docs/LEDGER_POSTING.md` — this file  

**Not yet:** server.js routes, Settings glMap UI, Books CoA/TB pages, period close wizard, mass document conversion.
