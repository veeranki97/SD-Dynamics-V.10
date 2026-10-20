# Server install — GL bridge (Phase C–E)

## 1. Copy files into `_system/`

```
src/utils/coaSeed.js
src/utils/glPosting.js
src/utils/glRecipes.js
src/utils/glServerBridge.js
src/db/sqliteStore.js          (SCHEMA_VERSION 3 comment)
src/components/ChartOfAccountsView.jsx
src/components/FinancialBooksView.jsx
src/components/GlMappingPanel.jsx
docs/LEDGER_POSTING.md
```

## 2. Wire `server.js` (once)

Near other ESM imports (top of file), add:

```js
import {
  createServerGlContext,
  ensureCoaOnBoot,
  migrateLegacyCoaIfEmptyish,
  registerGlMetaRoutes,
  afterTaxInvoiceSaved,
  afterReceiptSaved,
  afterExpenseSaved,
  afterPurchaseSaved,
  afterPiToTiAdvance,
} from './src/utils/glServerBridge.js';
```

After `DATA_DIR`, `META_PATH`, `readJSON`, `writeJSON`, `readAllFromDir`, `safeFileName` are defined, and `app` exists:

```js
const glCtx = createServerGlContext({
  DATA_DIR, readJSON, writeJSON, readAllFromDir, META_PATH, safeFileName, path, fs,
});
ensureCoaOnBoot(glCtx);
migrateLegacyCoaIfEmptyish(glCtx);
registerGlMetaRoutes(app, glCtx);
```

### Optional hooks (engine still no-ops until useGlEngine true)

**After successful tax-invoice / bill write** (inside POST `/api/bills` success path):

```js
try { afterTaxInvoiceSaved(glCtx, bill); } catch (e) { console.warn('[gl] invoice', e.message); }
```

**After successful receipt write**:

```js
try { afterReceiptSaved(glCtx, receipt, bill); } catch (e) { console.warn('[gl] receipt', e.message); }
```

**After expense / purchase write**:

```js
try { afterExpenseSaved(glCtx, expense); } catch (_) {}
try { afterPurchaseSaved(glCtx, purchase); } catch (_) {}
```

**On PI → TI convert when applying advance** (no bank):

```js
try {
  afterPiToTiAdvance(glCtx, advanceAmount, clientName, newTaxInvoiceId, invoiceDate);
} catch (_) {}
```

## 3. Settings UI (optional embed)

In `SettingsView.jsx`, under Backup or Invoice section:

```jsx
import GlMappingPanel from './GlMappingPanel';
// ...
<GlMappingPanel />
```

## 4. Enable engine

Books → Financial Books → **GL Engine** tab → Turn ON  
(or POST `/api/meta/useGlEngine` `{ "value": true }`)

Only after a manual journal TB balances.

## 5. Rollback

POST `{ "value": false }` to `/api/meta/useGlEngine`. Legacy writers unchanged.
