# Architecture vs SD Dynamics (after this pack)

| Feature | Status |
|---------|--------|
| PI convert to Tax Invoice | Done — stamps source, locks PI as converted, transfers payments |
| WO remaining qty + overbill | Done — quantity field + Limit Exceeded |
| WO budget tolerance | Done — Rs 5 |
| WO status after invoice | Done — deriveWOStatus on save |
| PO status lifecycle | Done — Draft/Issued/Partial/Fully Received/Cancelled |
| Create Bill from PO | Done — session prefill to Purchase Bills |
| Invoice after period end | Done — allowed |
| Client credit consume | Already in repo |
| Journal reverse payments | Already in repo |
| Full soft-delete all journals | Partial |
| Site dunning emails | UI only — needs mail |
