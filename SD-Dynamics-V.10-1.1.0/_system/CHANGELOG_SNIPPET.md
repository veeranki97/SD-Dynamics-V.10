## [2.1.0] - 2026-09-24

### Added
- Windows HTA launcher pack (`SD Dynamics - WINDOWS.hta`) adapted from Free-GST 1.10.69 install UX
- Update checker pointed at `veeranki97/SD-Dynamics` (not upstream Free-GST / old Bharatbill2)

### Fixed (cumulative from 2.0.0 line)
- Server-side GST recompute on bill save
- Cash Book reads Journal only (aligned with General Ledger)
- Partial payment / unpaid status journal + reversal paths
- Invoice number preview reconciles with existing bills (no “already used” surprise)
- HSN/SAC strict 2/4/6/8 digit validation
- Clean Windows .bat files (no Git conflict markers)

### Notes for users
- Data folder is never overwritten by updates
- Clear **Brand Prefix** in Invoice Number Settings if you want plain `QUO/...` instead of `SD-QUO/...`
