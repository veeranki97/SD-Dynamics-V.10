# One clean GL post + REC numbers

## Fixes
1. postDocument: same sourceType+sourceId + same lineHash → SKIP (no reverse).
2. Real change → one reversal + one new post.
3. tax_invoice sourceId = bill.id; invoice number only in narration/ref.
4. New receipts get receiptNumber REC/FY/### before GL post.
5. Single afterTaxInvoiceSaved / afterReceiptSaved on server success paths.

## If GL already polluted
Delete or archive old journal files for those docs, then re-save invoice once and receipt once.

## Test checklist
- [ ] Save invoice twice no edit → one debtors/sales/tax set
- [ ] Edit amount → one reversal + one new set
- [ ] Receipt shows REC/2026-27/00n in response and GL narration
- [ ] TB still balances
- [ ] npm run build
