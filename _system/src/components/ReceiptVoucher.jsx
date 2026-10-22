import { resolveWoCostCenter, resolveWoSite } from '../utils/workOrder';
import { useState, useEffect, useRef } from 'react';
import { Receipt, Plus, Trash2, Search, Printer, Pencil, Layers } from 'lucide-react';
import { getAllReceipts, saveReceipt, deleteReceipt, getAllBills, getProfile, getNextInvoiceNumber, saveBill, saveJournal, getAllWorkOrders, getAllCostCenters, getAllClients } from '../store';
import { journalFromPayment } from '../utils/ledger';
import { saveJournalIfLegacy } from '../utils/glClient';
import { formatCurrency, numberToWords, belongsToProfile, isUnassignedToBusiness } from '../utils';
import { planBulkAllocation } from '../utils/bulkPayment';
import UnassignedBanner from './UnassignedBanner';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';

const PAYMENT_MODES = ['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Other'];

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  receiptNo: '',
  clientName: '',
  clientAddress: '',
  amount: '',
  paymentMode: 'Bank Transfer',
  referenceNo: '',
  againstInvoice: '',
  note: '',
  paymentType: 'invoice', // advance | invoice | vendor
  direction: 'in', // in | out
  site: '',
  workOrderId: '',
  workOrderNo: '',
  costCenterId: '',
};

export default function ReceiptVoucher() {
  const [receipts, setReceipts] = useState([]);
  const [bills, setBills] = useState([]);
  const [profile, setProfile] = useState({});
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [workOrders, setWorkOrders] = useState([]);
  const [vendorsList, setVendorsList] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [previewReceipt, setPreviewReceipt] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const receiptRef = useRef(null);
  
  // Bulk FIFO allocation
  const [showBulk, setShowBulk] = useState(false);
  const [bulkClient, setBulkClient] = useState('');
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkMode, setBulkMode] = useState('Bank Transfer');
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  const loadData = async () => {
    try {
      const [recs, bls, prof] = await Promise.all([getAllReceipts(), getAllBills(), getProfile()]);
      setReceipts((recs || []).filter(r => belongsToProfile(r, prof)));
      setBills((bls || []).filter(b => belongsToProfile(b, prof)));
      setProfile(prof || {});
    } catch {
      toast('Failed to load data', 'error');
    }
  };

  useEffect(() => {
    getAllWorkOrders().then(setWorkOrders).catch(() => {});
    getAllClients().then(all => {
      const list = all || [];
      setVendorsList(list.filter(c => c.isVendor || c.type === 'vendor'));
      setClientsList(list.filter(c => !c.isVendor && c.type !== 'vendor'));
    }).catch(() => {});
    getAllCostCenters().then(setCostCenters).catch(() => {});
  }, []);
  
  useEffect(() => {
    loadData();
  }, []);

  const getNextReceiptNo = async () => {
    try {
      const raw = await getNextInvoiceNumber('PAY', { peek: true, explicitPrefix: true });
      const n = String(raw || '');
      const num = (n.match(/(\d+)\s*$/) || [])[1];
      if (num) return 'PAY-' + String(Number(num)).padStart(3, '0');
      return n.startsWith('PAY') ? n : (n ? 'PAY-' + n : 'PAY-001');
    } catch {
      return 'PAY-001';
    }
  };

  const filtered = search.trim()
    ? receipts.filter(r =>
        (r.clientName || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.receiptNo || '').toLowerCase().includes(search.toLowerCase()))
    : receipts;

  const openAdd = async () => {
    const receiptNo = await getNextReceiptNo();
    setForm({ ...emptyForm, receiptNo });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (rcp) => {
    setForm({
      date: rcp.date || new Date().toISOString().split('T')[0],
      receiptNo: rcp.receiptNo || '',
      clientName: rcp.clientName || '',
      clientAddress: rcp.clientAddress || '',
      amount: String(Math.abs(rcp.amount ?? '')),
      paymentMode: rcp.paymentMode || 'Bank Transfer',
      referenceNo: rcp.referenceNo || '',
      againstInvoice: rcp.againstInvoice || '',
      note: rcp.note || '',
      paymentType: rcp.paymentType || 'invoice',
      direction: rcp.direction || (Number(rcp.amount) < 0 ? 'out' : 'in'),
      site: rcp.site || '',
      workOrderId: rcp.workOrderId || '',
      workOrderNo: rcp.workOrderNo || '',
      costCenterId: rcp.costCenterId || '',
    });
    setEditingId(rcp.id);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setForm({ ...emptyForm }); setEditingId(null); };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleTypeChange = (type) => {
    const direction = type === 'vendor' ? 'out' : 'in';
    updateField('paymentType', type);
    updateField('direction', direction);
    
    // Clear irrelevant fields when switching types
    if (type === 'invoice') {
      updateField('site', '');
      updateField('workOrderId', '');
      updateField('costCenterId', '');
    } else if (type === 'advance') {
      updateField('againstInvoice', '');
    }

    if (!editingId) {
      getNextInvoiceNumber('PAY', { peek: true, explicitPrefix: true }).then(raw => {
        const n = String(raw || '');
        const digits = (n.match(/(\d+)\s*$/) || [])[1];
        updateField('receiptNo', digits ? 'PAY-' + String(Number(digits)).padStart(3, '0') : (n.startsWith('PAY') ? n : 'PAY-' + (n || '001')));
      }).catch(() => {});
    }
  };

  const selectInvoice = (bill) => {
    setForm(prev => ({
      ...prev,
      paymentType: 'invoice',
      direction: 'in',
      clientName: bill.clientName || '',
      clientAddress: bill.data?.client?.address || '',
      amount: String(Math.max(0, bill.totalAmount - (bill.paidAmount || 0))),
      againstInvoice: bill.invoiceNumber || '',
    }));
  };

  const handleSave = async () => {
    if (!form.clientName.trim()) { toast('Party name required', 'warning'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast('Enter valid amount', 'warning'); return; }
    try {
      let receiptNo = form.receiptNo;
      if (!editingId) {
        try {
          let raw = await getNextInvoiceNumber('PAY', { explicitPrefix: true });
          const n = String(raw || '');
          const digits = (n.match(/(\d+)\s*$/) || [])[1];
          if (digits) receiptNo = 'PAY-' + String(Number(digits)).padStart(3, '0');
          else if (n.startsWith('PAY')) receiptNo = n;
          else receiptNo = n ? 'PAY-' + n : receiptNo;
        } catch { /* fall back to peeked number */ }
      }

      const existing = editingId ? receipts.find(r => r.id === editingId) : null;
      const receipt = {
        ...form,
        receiptNo,
        amount: (form.direction === 'out' ? -1 : 1) * Math.abs(parseFloat(form.amount) || 0),
        paymentType: form.paymentType || 'invoice',
        direction: form.direction || 'in',
        ownerGstin: existing ? (existing.ownerGstin || '') : (profile?.gstin || ''),
        ownerName: existing ? (existing.ownerName || '') : (profile?.businessName || ''),
      };
      if (editingId) receipt.id = editingId;
      await saveReceipt(receipt);

      const modeMap = { 'Bank Transfer': 'bank-transfer', 'UPI': 'upi', 'Cash': 'cash', 'Cheque': 'cheque', 'Card': 'card', 'Other': 'other' };
      const paidAmount = parseFloat(form.amount);
      const stripReceiptFromBill = async (bill) => {
        if (!bill) return;
        const priorPayments = bill.payments || [];
        const kept = priorPayments.filter(p => p.receiptNo !== receiptNo);
        if (kept.length === priorPayments.length) return;
        const newTotal = kept.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const nextStatus = newTotal >= (Number(bill.totalAmount) || 0) ? 'paid' : (newTotal > 0 ? 'partial' : 'unpaid');
        await saveBill({ ...bill, paidAmount: newTotal, status: nextStatus, payments: kept }, { overwrite: true });
      };

      if (editingId) {
        try {
          const original = receipts.find(r => r.id === editingId);
          const oldRef = original?.againstInvoice?.trim();
          const newRef = form.againstInvoice?.trim();
          if (oldRef && oldRef !== newRef) {
            const oldBill = bills.find(b => b.invoiceNumber === oldRef || b.id === oldRef);
            await stripReceiptFromBill(oldBill);
          }
        } catch { /* non-fatal */ }
      }
      
      if (form.againstInvoice && form.againstInvoice.trim()) {
        try {
          const bill = bills.find(b => b.invoiceNumber === form.againstInvoice.trim() || b.id === form.againstInvoice.trim());
          if (bill) {
            const priorPayments = bill.payments || [];
            const priorIdx = priorPayments.findIndex(p => p.receiptNo === receiptNo);
            const nextEntry = {
              amount: paidAmount,
              date: form.date,
              mode: modeMap[form.paymentMode] || 'other',
              note: 'Receipt ' + receiptNo + (form.referenceNo ? ' · ref ' + form.referenceNo : ''),
              recordedAt: priorIdx >= 0 ? priorPayments[priorIdx].recordedAt : new Date().toISOString(),
              receiptNo,
            };
            const nextPayments = priorIdx >= 0
              ? priorPayments.map((p, i) => i === priorIdx ? nextEntry : p)
              : [...priorPayments, nextEntry];
            const newTotal = nextPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const nextStatus = newTotal >= (Number(bill.totalAmount) || 0) ? 'paid' : (newTotal > 0 ? 'partial' : 'unpaid');
            await saveBill({ ...bill, paidAmount: newTotal, status: nextStatus, payments: nextPayments }, { overwrite: true });
            
            try {
              const jnl = journalFromPayment(bill, paidAmount, form.paymentMode || form.mode || 'bank', {
                id: form.id || ('rv_' + Date.now()),
                date: form.date,
                party: form.clientName || bill.clientName,
              });
              if (jnl) await saveJournalIfLegacy(saveJournal, jnl);
            } catch (e) { console.warn('[ledger] receipt voucher journal', e); }
          }
        } catch { /* non-fatal */ }
      }

      toast('Transaction saved', 'success');
      closeForm();
      loadData();
    } catch {
      toast('Failed to save', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (await confirmAction({
      title: 'Delete this transaction?',
      message: 'The transaction is removed from your records. The underlying invoice payment stays intact.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })) {
      try { await deleteReceipt(id); toast('Deleted', 'success'); loadData(); }
      catch { toast('Failed to delete', 'error'); }
    }
  };

  const printReceipt = (receipt) => {
    setPreviewReceipt(receipt);
    setTimeout(() => {
      const el = receiptRef.current;
      if (!el) return;
      const printWindow = window.open('', '_blank');
      // Intentionally leaving standard string concatenation for the pure HTML document string since it is not JSX
      printWindow.document.write(
        '<html><head><title>Receipt ' + receipt.receiptNo + '</title>' +
        '<style>' +
        'body { font-family: "Inter", Arial, sans-serif; margin: 0; padding: 2rem; color: #1a1a2e; }' +
        '.receipt-box { max-width: 600px; margin: 0 auto; border: 2px solid #e2e8f0; border-radius: 8px; padding: 2rem; }' +
        '.receipt-header { text-align: center; margin-bottom: 1.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; }' +
        '.receipt-title { font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0; }' +
        '.receipt-row { display: flex; justify-content: space-between; padding: 0.5rem 0; font-size: 0.9rem; border-bottom: 1px solid #f1f5f9; }' +
        '.receipt-label { color: #64748b; font-weight: 500; }' +
        '.receipt-value { color: #1e293b; font-weight: 600; }' +
        '.receipt-amount { font-size: 1.5rem; font-weight: 800; color: #1e40af; text-align: center; margin: 1.5rem 0; padding: 1rem; background: #eff6ff; border-radius: 8px; }' +
        '.receipt-words { font-size: 0.85rem; color: #334155; font-style: italic; text-align: center; margin-bottom: 1.5rem; }' +
        '.receipt-footer { display: flex; justify-content: space-between; margin-top: 3rem; padding-top: 1rem; }' +
        '.receipt-sig { text-align: center; }' +
        '.receipt-sig-line { width: 180px; border-bottom: 1.5px solid #1e293b; margin-bottom: 0.25rem; }' +
        '.receipt-sig-label { font-size: 0.75rem; color: #64748b; }' +
        '.business-name { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem; }' +
        '.business-details { font-size: 0.75rem; color: #64748b; }' +
        '@media print { body { margin: 0; } .receipt-box { border: none; } }' +
        '</style></head><body>' +
        el.innerHTML +
        '<script>window.print(); window.close();</script>' +
        '</body></html>'
      );
      printWindow.document.close();
      setPreviewReceipt(null);
    }, 100);
  };

  const unpaidBills = bills.filter(b => b.status !== 'paid');
  const clientNames = [...new Set(
    bills.filter(b => (b.status === 'unpaid' || b.status === 'partial' || b.status === 'overdue'))
      .map(b => b.clientName).filter(Boolean)
  )].sort();

  const previewBulk = () => {
    if (!bulkClient.trim()) { toast('Select a client', 'warning'); return; }
    const amt = parseFloat(bulkAmount);
    if (!amt || amt <= 0) { toast('Enter a valid amount', 'warning'); return; }
    const plan = planBulkAllocation(bulkClient, amt, bills);
    if (!plan.allocations.length) { toast('No open invoices for this client', 'warning'); setBulkPreview(null); return; }
    setBulkPreview(plan);
  };

  const runBulkAllocate = async () => {
    if (!bulkPreview?.allocations?.length) return;
    setBulkSaving(true);
    try {
      const modeMap = { 'Bank Transfer': 'bank-transfer', 'UPI': 'upi', 'Cash': 'cash', 'Cheque': 'cheque', 'Card': 'card', 'Other': 'other' };
      const mode = modeMap[bulkMode] || 'other';
      const today = new Date().toISOString().split('T')[0];
      for (const a of bulkPreview.allocations) {
        const bill = bills.find(b => b.id === a.billId);
        if (!bill) continue;
        const entry = { amount: a.amount, date: today, mode, note: 'Bulk FIFO allocation', recordedAt: new Date().toISOString() };
        const nextPayments = [...(bill.payments || []), entry];
        const newPaid = nextPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const nextStatus = newPaid >= (Number(bill.totalAmount) || 0) - 0.01 ? 'paid' : 'partial';
        await saveBill({ ...bill, paidAmount: newPaid, status: nextStatus, payments: nextPayments }, { overwrite: true });
        try {
          const jnl = journalFromPayment(bill, Number(form.amount)||0, form.paymentMode || 'bank', { id: form.id || ('rv2_' + Date.now()), date: form.date, party: form.clientName || bill.clientName });
          if (jnl) await saveJournalIfLegacy(saveJournal, jnl);
        } catch (e) { console.warn('[ledger] receipt voucher journal', e); }
      }
      try {
        let receiptNo = await getNextInvoiceNumber('PAY', { explicitPrefix: true });
        const n = String(receiptNo || '');
        const digits = (n.match(/(\d+)\s*$/) || [])[1];
        if (digits) receiptNo = 'PAY-' + String(Number(digits)).padStart(3, '0');
        else if (!n.startsWith('PAY')) receiptNo = n ? 'PAY-' + n : receiptNo;
        await saveReceipt({
          date: today, receiptNo, clientName: bulkClient, amount: parseFloat(bulkAmount), paymentMode: bulkMode,
          againstInvoice: bulkPreview.allocations.map(a => a.invoiceNumber).join(', '),
          note: 'Bulk FIFO: ' + bulkPreview.allocations.length + ' invoice(s)' + (bulkPreview.leftover > 0 ? '; leftover ₹' + bulkPreview.leftover : ''),
          ownerGstin: profile?.gstin || '', ownerName: profile?.businessName || '',
        });
      } catch { /* non-fatal */ }
      toast('Allocated across ' + bulkPreview.allocations.length + ' invoice(s)', 'success');
      setShowBulk(false); setBulkPreview(null); setBulkClient(''); setBulkAmount('');
      loadData();
    } catch (e) { toast(e.message || 'Bulk allocation failed', 'error'); } finally { setBulkSaving(false); }
  };

  const unassignedReceipts = receipts.filter(isUnassignedToBusiness);
  const assignUnassignedReceipts = async () => {
    await Promise.all(unassignedReceipts.map(r => saveReceipt({ ...r, ownerGstin: profile?.gstin || '', ownerName: profile?.businessName || '' })));
    loadData();
  };

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Receipts & Payments</h1>
          <p className="page-subtitle">Log incoming client payments and outgoing vendor expenses</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => { setShowBulk(true); setBulkPreview(null); }}>
            <Layers size={18} /> Bulk Allocate
          </button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> New Record</button>
        </div>
      </div>

      <UnassignedBanner count={unassignedReceipts.length} businessName={profile?.businessName} noun="receipt" onAssign={assignUnassignedReceipts} />

      {/* Bulk FIFO Modal */}
      {showBulk && (
        <div className="modal-overlay" onClick={() => !bulkSaving && setShowBulk(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <h3 className="section-title">Bulk FIFO Payment Allocation</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>Enter a lump-sum amount to automatically apply against the client’s oldest open invoices.</p>
            <div className="form-group">
              <label className="form-label">Client</label>
              <select className="form-input" value={bulkClient} onChange={e => { setBulkClient(e.target.value); setBulkPreview(null); }}>
                <option value="">Select client with open invoices</option>
                {clientNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Amount received (₹)</label>
              <input type="number" className="form-input" value={bulkAmount} onChange={e => { setBulkAmount(e.target.value); setBulkPreview(null); }} min="0" step="0.01" />
            </div>
            <div className="form-group">
              <label className="form-label">Payment mode</label>
              <select className="form-input" value={bulkMode} onChange={e => setBulkMode(e.target.value)}>
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <button type="button" className="btn btn-secondary" onClick={previewBulk} style={{ marginBottom: '1rem' }}>Preview allocation</button>
            {bulkPreview && (
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', maxHeight: 200, overflowY: 'auto' }}>
                {bulkPreview.allocations.map(a => (
                  <div key={a.billId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.25rem 0' }}>
                    <span>{a.invoiceNumber}</span>
                    <span>₹{a.amount.toLocaleString('en-IN')} → {a.newStatus}</span>
                  </div>
                ))}
                {bulkPreview.leftover > 0.01 && <div style={{ marginTop: 6, color: '#d97706', fontWeight: 600 }}>Leftover (credit): ₹{bulkPreview.leftover.toLocaleString('en-IN')}</div>}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" disabled={bulkSaving} onClick={() => setShowBulk(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={bulkSaving || !bulkPreview?.allocations?.length} onClick={runBulkAllocate}>
                {bulkSaving ? 'Allocating…' : 'Allocate now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Primary Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <h3 className="section-title" style={{ marginBottom: '1rem' }}>{editingId ? 'Edit Transaction' : 'Record Transaction'}</h3>
            
            {/* Transaction Type Selector */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Select Transaction Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                <button type="button" 
                  onClick={() => handleTypeChange('invoice')}
                  style={{ padding: '0.75rem', borderRadius: '8px', border: form.paymentType === 'invoice' ? '2px solid var(--primary)' : '1px solid var(--border)', background: form.paymentType === 'invoice' ? 'rgba(30, 64, 175, 0.05)' : 'white', textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>💰 Payment Received</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Client payment against an existing invoice</div>
                </button>
                <button type="button" 
                  onClick={() => handleTypeChange('advance')}
                  style={{ padding: '0.75rem', borderRadius: '8px', border: form.paymentType === 'advance' ? '2px solid var(--primary)' : '1px solid var(--border)', background: form.paymentType === 'advance' ? 'rgba(30, 64, 175, 0.05)' : 'white', textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>📥 Customer Advance</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Advance received before work begins</div>
                </button>
                <button type="button" 
                  onClick={() => handleTypeChange('vendor')}
                  style={{ padding: '0.75rem', borderRadius: '8px', border: form.paymentType === 'vendor' ? '2px solid #dc2626' : '1px solid var(--border)', background: form.paymentType === 'vendor' ? 'rgba(220, 38, 38, 0.05)' : 'white', textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: '4px' }}>📤 Vendor Payment</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Money paid out to a supplier or vendor</div>
                </button>
              </div>
            </div>

            {/* Quick select from unpaid invoices (Only shows for 'invoice' type) */}
            {form.paymentType === 'invoice' && unpaidBills.length > 0 && !form.againstInvoice && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                <label className="form-label" style={{ marginBottom: '0.5rem' }}>Quick Select — Unpaid Invoices</label>
                <div className="client-picker" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {unpaidBills.slice(0, 10).map(bill => (
                    <button key={bill.id} className="client-picker-item" onClick={() => selectInvoice(bill)}>
                      <div>
                        <strong>{bill.clientName}</strong>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{bill.invoiceNumber}</span>
                      </div>
                      {(bill.totalAmount - (bill.paidAmount || 0)) > 0.005 && (
                        <span style={{ fontWeight: 600 }}>{formatCurrency(bill.totalAmount - (bill.paidAmount || 0))}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tight 3-line grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.75rem' }}>
              {/* --- LINE 1 --- */}
              <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                <label className="form-label">
                  {form.paymentType === 'vendor' ? 'Paid To (Vendor Name) *' : 'Received From (Client Name) *'}
                </label>
                <input type="text" className="form-input" list="rcpt-party-list" value={form.clientName} onChange={e => updateField('clientName', e.target.value)} placeholder={form.paymentType === 'vendor' ? 'Select or type vendor...' : 'Select or type client name...'} />
                <datalist id="rcpt-party-list">
                  {(form.paymentType === 'vendor' ? vendorsList : clientsList).map(p => (
                    <option key={p.id} value={p.name}>{p.gstin || p.city || ''}</option>
                  ))}
                </datalist>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Amount *</label>
                <input type="number" className="form-input" value={form.amount} onChange={e => updateField('amount', e.target.value)} min="0" placeholder="0.00" />
              </div>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Date</label>
                <input type="date" className="form-input" value={form.date} onChange={e => updateField('date', e.target.value)} />
              </div>

              {/* --- LINE 2 --- */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Payment Mode</label>
                <select className="form-input" value={form.paymentMode} onChange={e => updateField('paymentMode', e.target.value)}>
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Reference No (Txn ID)</label>
                <input type="text" className="form-input" value={form.referenceNo} onChange={e => updateField('referenceNo', e.target.value)} placeholder="UTR or Cheque" />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Receipt No</label>
                <input type="text" className="form-input" value={form.receiptNo} onChange={e => updateField('receiptNo', e.target.value)} />
              </div>

              {/* Conditional 4th Column on Line 2 */}
              {(form.paymentType === 'invoice' || form.paymentType === 'vendor') ? (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{form.paymentType === 'vendor' ? 'Against Bill No' : 'Against Invoice No'}</label>
                  <input type="text" className="form-input" value={form.againstInvoice} onChange={e => updateField('againstInvoice', e.target.value)} placeholder="e.g. INV/26-27/001" />
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Site / Location</label>
                  <input className="form-input" value={form.site || ''} onChange={e => updateField('site', e.target.value)} placeholder="Optional" />
                </div>
              )}

              {/* --- LINE 3 --- */}
              {(form.paymentType === 'advance' || form.paymentType === 'vendor') && (
                <>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Work Order Link</label>
                    <select className="form-input" value={form.workOrderId || ''}
                      onChange={e => {
                        const id = e.target.value;
                        const wo = workOrders.find(w => w.id === id);
                        updateField('workOrderId', id);
                        const cc = resolveWoCostCenter(wo); if (cc) updateField('costCenterId', cc);
                        const st = resolveWoSite(wo); if (st) updateField('site', st);
                        if (wo?.site) updateField('site', wo.site);
                        if (wo?.woNumber) updateField('workOrderNo', wo.woNumber);
                      }}>
                      <option value="">— Optional WO —</option>
                      {workOrders.map(wo => (
                        <option key={wo.id} value={wo.id}>{wo.woNumber} — {wo.clientName || ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Cost Center</label>
                    <select className="form-input" value={form.costCenterId || ''}
                      onChange={e => updateField('costCenterId', e.target.value)}>
                      <option value="">— Optional —</option>
                      {costCenters.map(cc => (
                        <option key={cc.id || cc.name} value={cc.id || cc.name}>{cc.name || cc.id}</option>
                      ))}
                    </select>
                  </div>

                  {form.paymentType === 'vendor' && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Site / Location</label>
                      <input className="form-input" value={form.site || ''} onChange={e => updateField('site', e.target.value)} placeholder="Optional" />
                    </div>
                  )}
                </>
              )}

              {/* Note field dynamically stretches to fill remaining space */}
              <div className="form-group" style={{ gridColumn: form.paymentType === 'invoice' ? 'span 4' : (form.paymentType === 'advance' ? 'span 2' : 'span 1'), marginBottom: 0 }}>
                <label className="form-label">Internal Note</label>
                <input type="text" className="form-input" value={form.note} onChange={e => updateField('note', e.target.value)} placeholder="Any extra details..." />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-slate-200">
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save Record</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden receipt for printing */}
      {previewReceipt && (
        <div style={{ position: 'absolute', left: '-9999px' }} ref={receiptRef}>
          <div className="receipt-box">
            <div className="receipt-header">
              <p className="business-name">{profile.businessName || 'Your Business'}</p>
              <p className="business-details">{profile.address}</p>
              {profile.gstin && <p className="business-details">GSTIN: {profile.gstin}</p>}
              <h2 className="receipt-title">{previewReceipt.paymentType === 'vendor' ? 'PAYMENT VOUCHER' : 'PAYMENT RECEIPT'}</h2>
            </div>
            <div className="receipt-row"><span className="receipt-label">Receipt No:</span><span className="receipt-value">{previewReceipt.receiptNo}</span></div>
            <div className="receipt-row"><span className="receipt-label">Date:</span><span className="receipt-value">{new Date(previewReceipt.date).toLocaleDateString('en-IN')}</span></div>
            <div className="receipt-row"><span className="receipt-label">{previewReceipt.paymentType === 'vendor' ? 'Paid To:' : 'Received From:'}</span><span className="receipt-value">{previewReceipt.clientName}</span></div>
            <div className="receipt-row"><span className="receipt-label">Payment Mode:</span><span className="receipt-value">{previewReceipt.paymentMode}</span></div>
            {previewReceipt.referenceNo && <div className="receipt-row"><span className="receipt-label">Reference No:</span><span className="receipt-value">{previewReceipt.referenceNo}</span></div>}
            {previewReceipt.againstInvoice && <div className="receipt-row"><span className="receipt-label">Against Doc:</span><span className="receipt-value">{previewReceipt.againstInvoice}</span></div>}
            <div className="receipt-amount">{formatCurrency(Math.abs(previewReceipt.amount))}</div>
            <p className="receipt-words">{numberToWords(Math.abs(previewReceipt.amount))}</p>
            {previewReceipt.note && <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Note: {previewReceipt.note}</p>}
            <div className="receipt-footer">
              <div className="receipt-sig"><div className="receipt-sig-line"></div><span className="receipt-sig-label">Recorded By</span></div>
              <div className="receipt-sig"><div className="receipt-sig-line"></div><span className="receipt-sig-label">Authorized Signatory</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="list-module-toolbar glass-panel">
        <div className="search-box" style={{ maxWidth: '400px' }}>
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Search by name or receipt no..." value={search}
            onChange={e => setSearch(e.target.value)} className="search-input" />
        </div>
      </div>

      {/* Receipts Table */}
      <div className="list-module receipts-list-module glass-panel">
        <div className="table-header"><h3>Transaction History</h3></div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Receipt size={48} />
            <p>{receipts.length === 0 ? 'No transactions recorded yet.' : 'No transactions match your search.'}</p>
            {receipts.length === 0 && <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Record Transaction</button>}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: '700px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Receipt No</th>
                  <th>Type</th>
                  <th>Party Name</th>
                  <th>Linked Doc</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Mode</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(rcp => {
                  const isOut = rcp.direction === 'out' || rcp.paymentType === 'vendor';
                  return (
                  <tr key={rcp.id}>
                    <td className="text-muted">{rcp.date ? new Date(rcp.date).toLocaleDateString('en-IN') : ''}</td>
                    <td><span className="invoice-badge">{rcp.receiptNo}</span></td>
                    <td>
                      <span className="badge" style={{ background: isOut ? 'rgba(220,38,38,0.1)' : 'rgba(16,185,129,0.1)', color: isOut ? '#dc2626' : '#059669' }}>
                        {rcp.paymentType === 'vendor' ? 'Outflow (Vendor)' : rcp.paymentType === 'advance' ? 'Advance In' : 'Invoice Payment In'}
                      </span>
                    </td>
                    <td className="font-medium">{rcp.clientName}</td>
                    <td className="text-muted">{rcp.againstInvoice || rcp.workOrderNo || '-'}</td>
                    <td style={{ textAlign: 'right' }} className="font-bold">
                      <span style={{ color: isOut ? '#dc2626' : '#1e293b' }}>
                        {isOut ? '-' : '+'}{formatCurrency(Math.abs(rcp.amount))}
                      </span>
                    </td>
                    <td className="text-muted">{rcp.paymentMode}</td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn icon-btn-blue" onClick={() => printReceipt(rcp)} title="Print"><Printer size={15} /></button>
                        <button className="icon-btn" onClick={() => openEdit(rcp)} title="Edit"><Pencil size={15} /></button>
                        <button className="icon-btn icon-btn-red" onClick={() => handleDelete(rcp.id)} title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}