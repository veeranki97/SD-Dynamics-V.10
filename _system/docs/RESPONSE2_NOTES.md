# Response 2 — Cash book + period close + Settings mapping

## CashBookView
- Loads CoA accounts
- Treats a journal line as cash/bank if:
  - account name matches /bank|cash/i (legacy), OR
  - accountId is CoA accountType cash|bank or code 1100/1210
- Uses activeGlJournals (skips fully reversed batches)

## FinancialBooksView
- Period close → when useGlEngine: postDocument sourceType period_close via linesPeriodClose
- Then POST /api/period-lock { month, action: 'lock' }
- Legacy path still uses periodCloseJournal when engine off

## SettingsView
- GlMappingPanel under GST & e-Invoice (section-gl-map)
- Jump nav entry "GL mapping"

## Install with Response 1 server
Copy entire _system overlay + keep wired server.js from SD-GL-SERVER-WIRED if already applied.
