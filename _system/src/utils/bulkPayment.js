/**
 * Bulk FIFO Payment Allocation
 * Allocate a lump-sum payment across open invoices (oldest first)
 * Free-GST-Billing custom addition
 */

export function planBulkAllocation(clientName, amount, allBills) {
  if (!clientName || !amount) {
    return { allocations: [], leftover: Number(amount) || 0 };
  }

  const open = (allBills || [])
    .filter(b => {
      const nameMatch =
        (b.clientName || '').trim().toLowerCase() === clientName.trim().toLowerCase();
      const stillDue =
        (b.status === 'unpaid' || b.status === 'partial' || b.status === 'overdue') &&
        (Number(b.totalAmount) || 0) - (Number(b.paidAmount) || 0) > 0.009;
      return nameMatch && stillDue;
    })
    .sort((a, b) => new Date(a.invoiceDate || 0) - new Date(b.invoiceDate || 0));

  let remaining = Number(amount) || 0;
  const allocations = [];

  for (const bill of open) {
    if (remaining <= 0.009) break;
    const due = (Number(bill.totalAmount) || 0) - (Number(bill.paidAmount) || 0);
    const apply = Math.min(remaining, due);
    if (apply > 0.009) {
      const newPaid = (Number(bill.paidAmount) || 0) + apply;
      allocations.push({
        billId: bill.id,
        invoiceNumber: bill.invoiceNumber,
        amount: +apply.toFixed(2),
        previousPaid: Number(bill.paidAmount) || 0,
        newPaid: +newPaid.toFixed(2),
        newStatus:
          newPaid >= (Number(bill.totalAmount) || 0) - 0.01 ? 'paid' : 'partial',
      });
      remaining -= apply;
    }
  }

  return {
    allocations,
    leftover: +remaining.toFixed(2),
  };
}
