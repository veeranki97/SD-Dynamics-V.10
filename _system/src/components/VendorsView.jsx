import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Users, Search, FileText, ChevronDown, ChevronUp, Trash2, X, 
  MessageCircle, Mail, Plus, Edit3, Copy, Upload, Download, 
  Building2, Landmark, Phone, MapPin
} from 'lucide-react';
import HelpButton from './HelpButton';
import { 
  getAllClients, saveClient, deleteClient, 
  getAllPurchases, getAllExpenses, getProfile 
} from '../store';
import { formatCurrency } from '../utils';
import { getPrintSettings } from '../utils/printSettings';
import { openWhatsAppShare } from '../utils/share';
import { confirmAction } from './ConfirmModal';
import { toast } from './Toast';
import ActionMenu from './ActionMenu';

function getAccentRGB() {
  try {
    const ps = getPrintSettings();
    if (ps.userColorsEnabled && ps.pdfAccent) {
      const hex = String(ps.pdfAccent).replace('#', '');
      if (/^[0-9a-f]{6}$/i.test(hex)) {
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
      }
    }
  } catch { /* ignore */ }
  return [30, 64, 175];
}

const STATUS_COLORS = {
  unpaid:  { label: 'Unpaid',  color: '#f59e0b', bg: '#fffbeb' },
  partial: { label: 'Partial', color: '#8b5cf6', bg: '#f5f3ff' },
  paid:    { label: 'Paid',    color: '#059669', bg: '#ecfdf5' },
  overdue: { label: 'Overdue', color: '#dc2626', bg: '#fef2f2' },
};

const STATE_BY_CODE = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh'
};

const emptyVendorForm = {
  name: '',
  contactPerson: '',
  gstin: '',
  pan: '',
  state: '',
  city: '',
  pin: '',
  address: '',
  phone: '',
  email: '',
  bankName: '',
  accountNumber: '',
  ifsc: '',
  accountHolderName: '',
  notes: '',
  isVendor: true,
  type: 'vendor',
  partyType: 'vendor'
};

export default function VendorsView() {
  const [vendors, setVendors] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [search, setSearch] = useState('');
  const [expandedVendor, setExpandedVendor] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formVendor, setFormVendor] = useState({ ...emptyVendorForm });
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [profile, setProfile] = useState(null);
  const csvInputRef = useRef(null);

  const loadData = async () => {
    try {
      const [allParties, pb, exp, prof] = await Promise.all([
        getAllClients(),
        getAllPurchases ? getAllPurchases().catch(() => []) : Promise.resolve([]),
        getAllExpenses().catch(() => []),
        getProfile().catch(() => null)
      ]);
      const v = (allParties || []).filter(c => c.isVendor || c.type === 'vendor' || c.partyType === 'vendor');
      setVendors(v);
      setPurchases(pb || []);
      setExpenses(exp || []);
      setProfile(prof);
    } catch {
      toast('Failed to load vendor records', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map transactions (Purchases + Expenses) per vendor
  // CA rule: Purchase Bills drive vendor PAYABLES.
  // Expenses to the same vendor are listed separately (job cost / cash out).
  // If expense is linked to a purchase bill id, treat as payment on that bill (no second "billed").
  const transactionsByVendor = useMemo(() => {
    const map = new Map();

    const addTx = (vendorName, tx) => {
      const key = (vendorName || '').trim().toLowerCase();
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(tx);
    };

    const purchaseById = new Map();
    (purchases || []).forEach(p => {
      if (p.status === 'cancelled') return;
      const vName = p.vendorName || p.supplierName || p.data?.vendor?.name || '';
      const total = Number(p.totalAmount || p.total || 0);
      const st = String(p.status || p.paymentStatus || '').toLowerCase().trim();
      let paid = Number(p.paidAmount ?? p.amountPaid ?? 0) || 0;
      // Status "Paid" / "Fully Paid" must count even if paidAmount was never written
      if (paid <= 0 && (/^paid$|fully.?paid|received|settled/.test(st))) paid = total;
      if (paid > total && total > 0) paid = total;
      const id = String(p.id || p.billNumber || '');
      const derivedStatus =
        total > 0 && paid >= total - 0.01 ? 'paid'
        : paid > 0.01 ? 'partial'
        : (st || 'unpaid');
      const tx = {
        id: id || p.billNumber || Math.random(),
        type: 'Purchase Bill',
        stream: 'purchase',
        refNo: p.billNumber || p.invoiceNumber || p.id || 'PB-BILL',
        date: p.billDate || p.date || '',
        dueDate: p.dueDate || '',
        category: p.category || 'Goods / Material',
        total,
        paid,
        outstanding: Math.max(0, total - paid),
        status: derivedStatus,
        raw: p
      };
      if (id) purchaseById.set(id, tx);
      if (p.billNumber) purchaseById.set(String(p.billNumber), tx);
      addTx(vName, tx);
    });

    (expenses || []).forEach(e => {
      const vName = e.vendorName || e.payee || '';
      const total = Number(e.amount || 0);
      const linkedPb = e.purchaseBillId || e.purchaseId || e.againstPurchase || e.againstPurchaseBill || '';
      // Expense that settles a purchase bill → apply as payment on that bill, skip second billed line
      if (linkedPb && purchaseById.has(String(linkedPb))) {
        const pb = purchaseById.get(String(linkedPb));
        const addPaid = Number(e.amount || 0);
        pb.paid = Math.min(pb.total, (Number(pb.paid) || 0) + addPaid);
        pb.outstanding = Math.max(0, pb.total - pb.paid);
        pb.status = pb.paid >= pb.total - 0.01 ? 'paid' : pb.paid > 0 ? 'partial' : 'unpaid';
        addTx(vName, {
          id: e.id || Math.random(),
          type: 'Payment (on bill)',
          stream: 'payment',
          refNo: e.invoiceNo || e.id || 'PAY',
          date: e.date || '',
          dueDate: '',
          category: `Applied to ${pb.refNo}`,
          total: 0,
          paid: addPaid,
          outstanding: 0,
          status: 'paid',
          raw: e,
          linkedPurchase: pb.refNo
        });
        return;
      }

      const against = String(e.againstInvoice || e.invoiceNo || e.againstBill || '').trim();
      const isPaid = e.status === 'paid' || e.paid || !e.status;
      const paid = isPaid ? total : 0;
      // Client sales invoice ref (e.g. SD/…, TAX/…) → job cost, not PO payable
      const looksLikeSalesInv = /^(SD|TAX|INV|TI|PI|QUO|DC)\b/i.test(against) || /\d{4}-\d{2}\/\d+/.test(against);
      addTx(vName, {
        id: e.id || Math.random(),
        type: looksLikeSalesInv ? 'Expense (client job)' : 'Expense',
        stream: 'expense',
        refNo: against || e.invoiceNo || `EXP-${String(e.id || '').slice(-6)}`,
        date: e.date || '',
        dueDate: '',
        category: e.category || e.description || 'General Expense',
        total,
        paid,
        outstanding: isPaid ? 0 : total,
        status: isPaid ? 'paid' : 'unpaid',
        raw: e,
        againstClientInv: looksLikeSalesInv ? against : ''
      });
    });

    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    return map;
  }, [purchases, expenses]);

  const statsByVendor = useMemo(() => {
    const map = new Map();
    for (const [key, txList] of transactionsByVendor) {
      const purchasesOnly = txList.filter(t => t.stream === 'purchase');
      const expensesOnly = txList.filter(t => t.stream === 'expense');
      const paymentsOnly = txList.filter(t => t.stream === 'payment');
      const purchaseBilled = purchasesOnly.reduce((s, t) => s + t.total, 0);
      const purchasePaid = purchasesOnly.reduce((s, t) => s + t.paid, 0);
      const expenseBilled = expensesOnly.reduce((s, t) => s + t.total, 0);
      const expensePaid = expensesOnly.reduce((s, t) => s + t.paid, 0);
      // True vendor payable = unpaid purchase bills + unpaid expense claims (not paid job costs)
      const unpaid = purchasesOnly.reduce((s, t) => s + Math.max(0, t.outstanding), 0)
        + expensesOnly.reduce((s, t) => s + Math.max(0, t.outstanding), 0);
      const paid = purchasePaid + expensePaid + paymentsOnly.reduce((s, t) => s + t.paid, 0);
      // Header "Total Billed" for AP clarity: purchases + unpaid-style expenses still listed;
      // primary payable KPI uses unpaid only.
      const total = purchaseBilled + expenseBilled;
      map.set(key, {
        total,
        paid,
        unpaid,
        count: txList.length,
        purchaseBilled,
        purchasePaid,
        expenseBilled,
        expensePaid,
        purchaseCount: purchasesOnly.length,
        expenseCount: expensesOnly.length
      });
    }
    return map;
  }, [transactionsByVendor]);

  const EMPTY_TX = useMemo(() => [], []);
  const getVendorTransactions = (vendorName) =>
    transactionsByVendor.get((vendorName || '').trim().toLowerCase()) || EMPTY_TX;

  const getVendorStats = (vendorName) =>
    statsByVendor.get((vendorName || '').trim().toLowerCase())
    || { total: 0, paid: 0, unpaid: 0, count: 0 };

  const getVendorAging = (vendorName) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = { current: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 };
    const unpaidTxs = [];

    for (const tx of getVendorTransactions(vendorName)) {
      if (tx.outstanding <= 0.01) continue;
      const refDate = tx.dueDate || tx.date;
      const due = refDate ? new Date(refDate) : today;
      const ageDays = Math.max(0, Math.floor((today - due) / 86400000));
      
      if (ageDays <= 30) buckets.current += tx.outstanding;
      else if (ageDays <= 60) buckets.d31_60 += tx.outstanding;
      else if (ageDays <= 90) buckets.d61_90 += tx.outstanding;
      else buckets.d90plus += tx.outstanding;

      buckets.total += tx.outstanding;
      unpaidTxs.push({ tx, ageDays, outstanding: tx.outstanding });
    }
    return { buckets, unpaidTxs };
  };

  const allVendorNames = useMemo(() => {
    const set = new Set();
    vendors.forEach(v => { if (v.name) set.add(v.name); });
    purchases.forEach(p => { const n = p.vendorName || p.supplierName || p.data?.vendor?.name; if (n) set.add(n); });
    expenses.forEach(e => { if (e.vendorName) set.add(e.vendorName); });
    return [...set];
  }, [vendors, purchases, expenses]);

  const filteredVendorNames = useMemo(() => {
    if (!search.trim()) return allVendorNames;
    const q = search.toLowerCase();
    return allVendorNames.filter(name => {
      const v = vendors.find(item => item.name.toLowerCase() === name.toLowerCase());
      return name.toLowerCase().includes(q)
        || (v?.gstin && v.gstin.toLowerCase().includes(q))
        || (v?.city && v.city.toLowerCase().includes(q))
        || (v?.phone && v.phone.toLowerCase().includes(q));
    });
  }, [allVendorNames, search, vendors]);

  const sortedVendors = useMemo(() => {
    return [...filteredVendorNames].sort((a, b) => {
      const sa = getVendorStats(a);
      const sb = getVendorStats(b);
      return sb.unpaid - sa.unpaid;
    });
  }, [filteredVendorNames, statsByVendor]);

  // Vendor Statement PDF
  const generateVendorStatement = async (vendorName) => {
    const txList = getVendorTransactions(vendorName);
    if (txList.length === 0) {
      toast('No purchase or expense records for this vendor', 'warning');
      return;
    }
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const savedVendor = vendors.find(v => v.name.toLowerCase() === vendorName.toLowerCase()) || { name: vendorName };
      const stats = getVendorStats(vendorName);
      const pageW = 210, marginL = 15, marginR = 195, tableW = marginR - marginL;

      const fmt = (n) => 'Rs. ' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Header Banner
      doc.setFillColor(...getAccentRGB());
      doc.rect(0, 0, pageW, 22, 'F');
      doc.setTextColor(255); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('VENDOR ACCOUNT STATEMENT', pageW / 2, 12, { align: 'center' });
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}  ·  Payables & Purchases`, pageW / 2, 18, { align: 'center' });

      let y = 30;
      const colL = marginL, colR = marginL + tableW / 2 + 5;
      const colWidth = tableW / 2 - 5;

      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100);
      doc.text('BILLED BY (VENDOR)', colL, y);
      doc.text('PAYABLE BY (YOUR BUSINESS)', colR, y);
      doc.setTextColor(0);
      y += 4;

      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text(doc.splitTextToSize(savedVendor.name || vendorName, colWidth), colL, y);
      doc.text(doc.splitTextToSize(profile?.businessName || 'Your Business', colWidth), colR, y);
      y += 5;
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');

      const vendorLines = [
        savedVendor.address,
        [savedVendor.city, savedVendor.state, savedVendor.pin].filter(Boolean).join(', '),
        savedVendor.gstin ? `GSTIN: ${savedVendor.gstin}` : null,
        savedVendor.email,
        savedVendor.phone ? `Ph: ${savedVendor.phone}` : null,
        savedVendor.accountNumber ? `Bank A/c: ${savedVendor.accountNumber} (${savedVendor.ifsc || ''})` : null
      ].filter(Boolean);

      const businessLines = [
        profile?.address,
        [profile?.city, profile?.state, profile?.pin].filter(Boolean).join(', '),
        profile?.gstin ? `GSTIN: ${profile.gstin}` : null,
        profile?.phone ? `Ph: ${profile.phone}` : null,
      ].filter(Boolean);

      let vDy = 0;
      vendorLines.forEach(line => {
        const wrap = doc.splitTextToSize(line, colWidth);
        doc.text(wrap, colL, y + vDy);
        vDy += wrap.length * 4;
      });
      let bDy = 0;
      businessLines.forEach(line => {
        const wrap = doc.splitTextToSize(line, colWidth);
        doc.text(wrap, colR, y + bDy);
        bDy += wrap.length * 4;
      });
      y += Math.max(vDy, bDy) + 6;

      // Summary Card
      doc.setFillColor(241, 245, 249);
      doc.rect(marginL, y, tableW, 16, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginL, y, tableW, 16, 'S');

      const cellW = tableW / 4;
      // Payable = open purchase bills (+ unpaid expense claims). Job-cost expenses are not vendor AP.
      const summaryCells = [
        { label: 'Entries', value: String(stats.count) },
        { label: 'Purchase Billed', value: fmt(stats.purchaseBilled ?? stats.total) },
        { label: 'Paid (all)', value: fmt(stats.paid), color: [5, 150, 105] },
        { label: 'Payable (AP)', value: fmt(stats.unpaid), color: stats.unpaid > 0 ? [220, 38, 38] : [5, 150, 105] },
      ];
      summaryCells.forEach((cell, i) => {
        const cx = marginL + i * cellW + cellW / 2;
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
        doc.text(cell.label.toUpperCase(), cx, y + 5, { align: 'center' });
        doc.setFontSize(cell.label === 'Entries' ? 12 : 9.5); doc.setFont('helvetica', 'bold');
        if (cell.color) doc.setTextColor(...cell.color); else doc.setTextColor(15, 23, 42);
        doc.text(cell.value, cx, y + 12, { align: 'center' });
      });
      y += 22;

      // Ledger Table
      const col = {
        dateEnd: 38,
        refEnd: 78,
        typeEnd: 112,
        billedEnd: 140,
        paidEnd: 168,
        balEnd: marginR - 2
      };

      doc.setFillColor(...getAccentRGB());
      doc.rect(marginL, y, tableW, 8, 'F');
      doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
      doc.text('Date', marginL + 2, y + 5.5);
      doc.text('Bill / Ref #', col.dateEnd + 2, y + 5.5);
      doc.text('Type', col.refEnd + 2, y + 5.5);
      doc.text('Billed', col.billedEnd, y + 5.5, { align: 'right' });
      doc.text('Paid', col.paidEnd, y + 5.5, { align: 'right' });
      doc.text('Balance', col.balEnd, y + 5.5, { align: 'right' });
      y += 11;

      let runningPayable = 0;
      const sortedTxs = [...txList].reverse(); // Oldest first for running ledger

      sortedTxs.forEach((tx, i) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const rowH = 6.5;
        if (i % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(marginL, y - rowH + 1.5, tableW, rowH, 'F');
        }
        // Running AP: purchase bills + unpaid expenses only (not paid job-cost lines)
        if (tx.stream === 'purchase') {
          runningPayable += (tx.total - tx.paid);
        } else if (tx.stream === 'expense' && (tx.outstanding || 0) > 0.01) {
          runningPayable += tx.outstanding;
        } else if (tx.stream === 'payment') {
          runningPayable = Math.max(0, runningPayable - (tx.paid || 0));
        }

        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(15, 23, 42);
        doc.text(tx.date ? new Date(tx.date).toLocaleDateString('en-IN') : '—', marginL + 2, y);
        doc.text(String(tx.refNo || '—').slice(0, 20), col.dateEnd + 2, y);
        const typeLabel = String(tx.type || '').slice(0, 18);
        doc.text(typeLabel, col.refEnd + 2, y);
        doc.text(tx.total > 0 ? fmt(tx.total) : '—', col.billedEnd, y, { align: 'right' });
        doc.text(tx.paid > 0 ? fmt(tx.paid) : '—', col.paidEnd, y, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        if (runningPayable > 0.01) doc.setTextColor(220, 38, 38);
        else doc.setTextColor(5, 150, 105);
        doc.text(fmt(runningPayable), col.balEnd, y, { align: 'right' });

        y += rowH;
      });

      y += 4;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.4);
      doc.line(marginL, y, marginR, y); y += 6;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
      doc.text('CLOSING PAYABLE BALANCE (AP)', marginL, y);
      if (stats.unpaid > 0.01) doc.setTextColor(220, 38, 38); else doc.setTextColor(5, 150, 105);
      doc.text(fmt(stats.unpaid), col.balEnd, y, { align: 'right' });

      y += 8;
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      const note = 'Note: Purchase bills create vendor payable (AP). Expenses tagged to a client invoice (e.g. SD/…) are job costs — shown for history but do not add to AP when already paid. To settle a PO bill, pay the Purchase Bill (or link expense with purchaseBillId), do not book a second full expense for the same job.';
      const noteLines = doc.splitTextToSize(note, tableW);
      doc.text(noteLines, marginL, y);

      if ((stats.expenseBilled || 0) > 0.01 && (stats.purchaseBilled || 0) > 0.01) {
        y += noteLines.length * 3.5 + 3;
        doc.setTextColor(180, 83, 9);
        doc.text(
          `Info: This vendor also has expenses ₹${fmt(stats.expenseBilled)} (paid ₹${fmt(stats.expensePaid || 0)}). Those are separate from purchase payable ₹${fmt(stats.unpaid)}.`,
          marginL,
          y
        );
      }

      doc.save(`Vendor-Statement-${vendorName.replace(/[^\w]+/g, '-')}.pdf`);
      toast('Vendor Statement downloaded', 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to generate statement', 'error');
    }
  };

  // Vendor Aging Report PDF
  const generateAgingReport = async (vendorName) => {
    try {
      const { jsPDF } = await import('jspdf');
      const { unpaidTxs, buckets } = getVendorAging(vendorName);
      if (unpaidTxs.length === 0) {
        toast(`No outstanding payables for ${vendorName}`, 'info');
        return;
      }
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const marginL = 15, marginR = 195;
      let y = 20;

      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('VENDOR PAYABLES AGING REPORT', marginL, y); y += 8;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      doc.text(`Vendor: ${vendorName}  ·  As of ${new Date().toLocaleDateString('en-IN')}`, marginL, y);
      y += 8;

      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.4);
      doc.line(marginL, y, marginR, y); y += 7;

      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
      doc.text('Ref / Bill #', marginL, y);
      doc.text('Date', marginL + 45, y);
      doc.text('Overdue Age', marginL + 80, y);
      doc.text('Bill Total', marginL + 120, y, { align: 'right' });
      doc.text('Payable Balance', marginR, y, { align: 'right' });
      y += 6;

      const fmt = (n) => 'Rs. ' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      doc.setFont('helvetica', 'normal');
      for (const { tx, ageDays, outstanding } of unpaidTxs) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(String(tx.refNo || '—').slice(0, 22), marginL, y);
        doc.text(tx.date ? new Date(tx.date).toLocaleDateString('en-IN') : '—', marginL + 45, y);
        doc.text(`${ageDays} days`, marginL + 80, y);
        doc.text(fmt(tx.total), marginL + 120, y, { align: 'right' });
        doc.setTextColor(ageDays > 60 ? 220 : 15, ageDays > 60 ? 38 : 23, ageDays > 60 ? 38 : 42);
        doc.text(fmt(outstanding), marginR, y, { align: 'right' });
        doc.setTextColor(15, 23, 42);
        y += 6;
      }

      y += 6;
      doc.setDrawColor(226, 232, 240); doc.line(marginL, y, marginR, y); y += 8;
      doc.setFontSize(9.5); doc.setFont('helvetica', 'bold');
      doc.text('AGEING SUMMARY (BILLS DUE)', marginL, y); y += 6;
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');

      const bRows = [
        ['Current (0–30 days)', buckets.current],
        ['31–60 days', buckets.d31_60],
        ['61–90 days', buckets.d61_90],
        ['90+ days overdue', buckets.d90plus],
      ];
      bRows.forEach(([lbl, amt]) => {
        doc.text(lbl, marginL, y);
        doc.text(fmt(amt), marginR, y, { align: 'right' });
        y += 5.5;
      });

      y += 3;
      doc.setLineWidth(0.4); doc.line(marginL, y, marginR, y); y += 6;
      doc.setFontSize(10.5); doc.setFont('helvetica', 'bold');
      doc.text('TOTAL AMOUNT PAYABLE', marginL, y);
      doc.setTextColor(220, 38, 38);
      doc.text(fmt(buckets.total), marginR, y, { align: 'right' });

      doc.save(`Vendor-Aging-${vendorName.replace(/[^\w]+/g, '-')}.pdf`);
      toast('Aging report downloaded', 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to generate aging report', 'error');
    }
  };

  const handleOpenAdd = (prefill) => {
    setFormVendor(prefill ? { ...emptyVendorForm, ...prefill } : { ...emptyVendorForm });
    setEditingVendorId(null);
    setShowModal(true);
  };

  const handleOpenEdit = (vendor) => {
    setFormVendor({ ...emptyVendorForm, ...vendor });
    setEditingVendorId(vendor.id);
    setShowModal(true);
  };

  const handleGstinChange = (raw) => {
    const val = raw.toUpperCase().trim();
    const patch = { gstin: val };
    if (val.length >= 2 && STATE_BY_CODE[val.slice(0, 2)]) {
      patch.state = STATE_BY_CODE[val.slice(0, 2)];
    }
    if (val.length >= 12) {
      const derivedPan = val.slice(2, 12);
      if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(derivedPan)) patch.pan = derivedPan;
    }
    setFormVendor(prev => ({ ...prev, ...patch }));
  };

  const handleSaveVendor = async (e) => {
    e.preventDefault();
    if (!formVendor.name.trim()) { toast('Vendor Name is required', 'warning'); return; }
    if (formVendor.gstin && formVendor.gstin.length !== 15) { toast('GSTIN must be 15 characters', 'warning'); return; }

    try {
      const payload = { ...formVendor, isVendor: true, type: 'vendor', partyType: 'vendor' };
      if (editingVendorId) payload.id = editingVendorId;
      await saveClient(payload);
      toast(editingVendorId ? 'Vendor updated' : 'Vendor added', 'success');
      setShowModal(false);
      loadData();
    } catch {
      toast('Failed to save vendor', 'error');
    }
  };

  const handleDeleteVendor = async (id) => {
    if (await confirmAction({
      title: 'Remove this vendor?',
      message: 'Their purchase bills and expenses remain safely in your ledger. This only removes them from your saved vendor address book.',
      confirmLabel: 'Remove',
      tone: 'danger',
    })) {
      await deleteClient(id);
      toast('Vendor removed', 'success');
      loadData();
    }
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast('CSV file has no data rows', 'warning'); return; }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        const row = {};
        headers.forEach((h, idx) => { row[h] = parts[idx] || ''; });
        const name = row.name || row.vendor || row['vendor name'];
        if (!name) continue;
        await saveClient({
          name,
          contactPerson: row['contact person'] || row.contact || '',
          gstin: row.gstin || '',
          state: row.state || '',
          city: row.city || '',
          phone: row.phone || '',
          email: row.email || '',
          address: row.address || '',
          bankName: row['bank name'] || row.bank || '',
          accountNumber: row['account number'] || row.account || '',
          ifsc: row.ifsc || '',
          isVendor: true,
          type: 'vendor',
          partyType: 'vendor'
        });
        count++;
      }
      toast(`Imported ${count} vendors successfully`, 'success');
      loadData();
    } catch {
      toast('Failed to parse CSV', 'error');
    }
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const exportCSV = () => {
    if (vendors.length === 0) { toast('No vendors to export', 'warning'); return; }
    const headers = ['Name', 'Contact Person', 'GSTIN', 'State', 'City', 'Phone', 'Email', 'Address', 'Bank Name', 'Account No', 'IFSC', 'Total Billed', 'Outstanding'];
    const rows = [headers.join(',')];
    vendors.forEach(v => {
      const s = getVendorStats(v.name);
      rows.push([
        `"${v.name || ''}"`,
        `"${v.contactPerson || ''}"`,
        `"${v.gstin || ''}"`,
        `"${v.state || ''}"`,
        `"${v.city || ''}"`,
        `"${v.phone || ''}"`,
        `"${v.email || ''}"`,
        `"${(v.address || '').replace(/"/g, '""')}"`,
        `"${v.bankName || ''}"`,
        `"${v.accountNumber || ''}"`,
        `"${v.ifsc || ''}"`,
        s.total,
        s.unpaid
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'vendors_list.csv'; a.click();
    URL.revokeObjectURL(url);
    toast('Vendors exported to CSV', 'success');
  };

  const shareWhatsAppVendor = (tx, vendor) => {
    const msg = `*Purchase/Expense Record — ${tx.refNo}*\nVendor: ${vendor.name}\nAmount: ${formatCurrency(tx.total)}\nStatus: ${tx.status.toUpperCase()}\nDate: ${tx.date}`;
    openWhatsAppShare(vendor.phone, msg);
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div>
            <h1 className="page-title">Vendors</h1>
            <p className="page-subtitle">Supplier-wise purchase bill ledger and payables</p>
          </div>
          <HelpButton title="Vendors — how to use">
            <ul style={{ paddingLeft: '1.1rem', margin: 0 }}>
              <li><strong>Click a vendor card</strong> to review all linked purchase bills and expenses.</li>
              <li><strong>Statement PDF</strong> — formal supplier account statement detailing billed sums vs payments made.</li>
              <li><strong>Aging PDF</strong> — outstanding payables grouped into 0-30 / 31-60 / 61-90 / 90+ day buckets.</li>
              <li><strong>Bank Details</strong> — store vendor bank A/C numbers &amp; IFSC for payouts.</li>
              <li><strong>Import / Export</strong> — upload spreadsheets or backup suppliers.</li>
            </ul>
          </HelpButton>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".csv" ref={csvInputRef} style={{ display: 'none' }} onChange={handleCSVImport} />
          <button className="btn btn-secondary" onClick={() => csvInputRef.current?.click()} title="Import vendors from CSV">
            <Upload size={16} /> Import CSV
          </button>
          <button className="btn btn-secondary" onClick={exportCSV} title="Export vendor list with balances">
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => handleOpenAdd()}>
            <Plus size={18} /> Add Vendor
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-panel p-4 mb-6">
        <div className="search-box" style={{ maxWidth: '400px' }}>
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search vendor, GSTIN, city, phone..." 
            value={search}
            onChange={e => setSearch(e.target.value)} 
            className="search-input" 
          />
          {search && <button className="icon-btn" onClick={() => setSearch('')}><X size={14} /></button>}
        </div>
      </div>

      {/* Vendor Cards List */}
      {sortedVendors.length === 0 ? (
        <div className="glass-panel p-6">
          <div className="empty-state">
            <Users size={48} />
            <p>No vendors found.</p>
            <button className="btn btn-secondary" onClick={() => handleOpenAdd()} style={{ marginTop: '0.5rem' }}>
              <Plus size={16} /> Add Your First Vendor
            </button>
          </div>
        </div>
      ) : (
        <div className="client-list">
          {sortedVendors.map(vendorName => {
            const stats = getVendorStats(vendorName);
            const savedVendor = vendors.find(v => v.name.toLowerCase() === vendorName.toLowerCase());
            const isExpanded = expandedVendor === vendorName;
            const vendorTxs = isExpanded ? getVendorTransactions(vendorName) : [];

            return (
              <div key={vendorName} className="glass-panel mb-4" style={{ overflow: 'visible' }}>
                {/* Card Header */}
                <div className="client-card-header" onClick={() => setExpandedVendor(isExpanded ? null : vendorName)}>
                  <div className="client-card-info">
                    <div className="client-avatar" style={{ background: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' }}>
                      {vendorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="client-card-name">{vendorName}</h3>
                      <p className="client-card-meta">
                        {stats.count} transaction{stats.count !== 1 ? 's' : ''}
                        {savedVendor?.state ? ` | ${savedVendor.state}` : ''}
                        {savedVendor?.gstin ? ` | ${savedVendor.gstin}` : ''}
                        {savedVendor?.contactPerson ? ` | Attn: ${savedVendor.contactPerson}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="client-card-stats">
                    <div className="client-stat">
                      <span className="client-stat-label">Total Billed</span>
                      <span className="client-stat-value">{formatCurrency(stats.total)}</span>
                    </div>
                    <div className="client-stat">
                      <span className="client-stat-label">Paid</span>
                      <span className="client-stat-value" style={{ color: '#059669' }}>{formatCurrency(stats.paid)}</span>
                    </div>
                    <div className="client-stat">
                      <span className="client-stat-label">
                        {stats.unpaid < -0.005 ? 'Advance' : 'Payable'}
                      </span>
                      <span className="client-stat-value" style={{ color: stats.unpaid > 0.005 ? '#dc2626' : (stats.unpaid < -0.005 ? '#0369a1' : '#059669') }}>
                        {formatCurrency(Math.abs(stats.unpaid))}
                      </span>
                    </div>
                    <div style={{ marginLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {isExpanded ? 'Hide' : 'View'} {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Ledger Section */}
                {isExpanded && (
                  <div className="client-invoices">
                    {/* Action Bar */}
                    <div style={{ padding: '0.5rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                        onClick={() => generateVendorStatement(vendorName)}
                        title="Generate detailed supplier ledger statement PDF">
                        <Download size={14} /> Statement PDF
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                        onClick={() => generateAgingReport(vendorName)}
                        title="Generate aging breakdown PDF for supplier payables">
                        <Download size={14} /> Aging PDF
                      </button>
                    </div>

                    {/* Aging Summary Strip */}
                    {(() => {
                      const { buckets } = getVendorAging(vendorName);
                      if (buckets.total <= 0.01) return null;
                      const fmt = (n) => formatCurrency(n, 'INR');
                      const cells = [
                        { label: 'Current', val: buckets.current, color: '#059669' },
                        { label: '31–60d',  val: buckets.d31_60,   color: '#d97706' },
                        { label: '61–90d',  val: buckets.d61_90,   color: '#ea580c' },
                        { label: '90+ d',   val: buckets.d90plus,  color: '#dc2626' },
                      ];
                      return (
                        <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Aging Payables:</span>
                          {cells.map(c => (
                            <span key={c.label} style={{ display: 'inline-flex', gap: 4, alignItems: 'baseline' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{c.label}</span>
                              <strong style={{ color: c.val > 0 ? c.color : 'var(--text-muted)' }}>{fmt(c.val)}</strong>
                            </span>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Vendor Contact & Bank Info */}
                    {savedVendor && (
                      <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {(savedVendor.address || savedVendor.city || savedVendor.pin) && (
                          <span><MapPin size={13} style={{ display: 'inline', marginRight: 4 }} />{[savedVendor.address, savedVendor.city, savedVendor.pin].filter(Boolean).join(', ')}</span>
                        )}
                        {savedVendor.phone && <span><Phone size={13} style={{ display: 'inline', marginRight: 4 }} />{savedVendor.phone}</span>}
                        {savedVendor.email && <span><Mail size={13} style={{ display: 'inline', marginRight: 4 }} />{savedVendor.email}</span>}
                        {savedVendor.accountNumber && (
                          <span><Landmark size={13} style={{ display: 'inline', marginRight: 4 }} /><strong>{savedVendor.bankName || 'Bank'}:</strong> A/c {savedVendor.accountNumber} ({savedVendor.ifsc || ''})</span>
                        )}
                      </div>
                    )}

                    {/* Transactions Table */}
                    {vendorTxs.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                        <p className="text-muted" style={{ fontSize: '0.85rem' }}>No purchase bills or expenses linked to this vendor yet.</p>
                      </div>
                    ) : (
                      <div className="table-scroll">
                        <table className="data-table" style={{ marginBottom: 0, minWidth: '750px' }}>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Ref / Bill #</th>
                              <th>Type</th>
                              <th>Category / Item</th>
                              <th style={{ textAlign: 'right' }}>Total Amount</th>
                              <th style={{ textAlign: 'right' }}>Paid</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vendorTxs.map(tx => {
                              const sc = STATUS_COLORS[tx.status] || STATUS_COLORS.unpaid;
                              return (
                                <tr key={tx.id}>
                                  <td className="text-muted">{tx.date ? new Date(tx.date).toLocaleDateString('en-IN') : '—'}</td>
                                  <td><span className="invoice-badge">{tx.refNo}</span></td>
                                  <td><span className="type-badge">{tx.type}</span></td>
                                  <td className="text-muted">{tx.category}</td>
                                  <td className="font-bold" style={{ textAlign: 'right' }}>{formatCurrency(tx.total)}</td>
                                  <td className="text-muted" style={{ textAlign: 'right', color: tx.paid > 0 ? '#059669' : undefined }}>
                                    {tx.paid > 0 ? formatCurrency(tx.paid) : '—'}
                                  </td>
                                  <td>
                                    <span style={{ 
                                      background: sc.bg, color: sc.color, 
                                      fontSize: '0.72rem', padding: '0.2rem 0.5rem', 
                                      borderRadius: '4px', fontWeight: 600, display: 'inline-block' 
                                    }}>
                                      {sc.label}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="table-actions">
                                      {savedVendor?.phone && (
                                        <button className="icon-btn icon-btn-green" onClick={() => shareWhatsAppVendor(tx, savedVendor)} title="Share via WhatsApp">
                                          <MessageCircle size={14} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Bottom Action Menu */}
                    <div className="client-actions-bar" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.75rem 1.5rem', borderTop: '1px solid var(--border)', position: 'relative', zIndex: 20 }}>
                      {savedVendor ? (
                        <ActionMenu items={[
                          { label: 'Edit Vendor', onClick: () => handleOpenEdit(savedVendor) },
                          { label: 'Copy Vendor', onClick: () => handleOpenAdd({ ...savedVendor, id: undefined, name: `${savedVendor.name} (Copy)` }) },
                          { label: 'Delete Vendor', danger: true, onClick: () => handleDeleteVendor(savedVendor.id) },
                        ]} />
                      ) : (
                        <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }} onClick={() => handleOpenAdd({ name: vendorName })}>
                          <Plus size={13} /> Save to Vendor Master
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Vendor Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '780px', padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>
                {editingVendorId ? 'Edit Vendor' : 'Add New Vendor'}
              </h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleSaveVendor}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
                
                {/* Row 1: Name, Contact Person, Phone */}
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Vendor / Company Name *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="e.g. Balaji Electricals & Hardware"
                    value={formVendor.name} 
                    onChange={e => setFormVendor({ ...formVendor, name: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Person</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Rajesh Kumar"
                    value={formVendor.contactPerson} 
                    onChange={e => setFormVendor({ ...formVendor, contactPerson: e.target.value })} 
                  />
                </div>

                {/* Row 2: GSTIN, PAN, Phone */}
                <div className="form-group">
                  <label className="form-label">GSTIN (15 Digits)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    maxLength={15} 
                    placeholder="37AAAAA0000A1Z5"
                    value={formVendor.gstin} 
                    onChange={e => handleGstinChange(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">PAN (10 Digits)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    maxLength={10} 
                    placeholder="AAAAA0000A"
                    value={formVendor.pan} 
                    onChange={e => setFormVendor({ ...formVendor, pan: e.target.value.toUpperCase().trim() })} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone / Mobile</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. 9876543210"
                    value={formVendor.phone} 
                    onChange={e => setFormVendor({ ...formVendor, phone: e.target.value })} 
                  />
                </div>

                {/* Row 3: Email, State, City */}
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="vendor@example.com"
                    value={formVendor.email} 
                    onChange={e => setFormVendor({ ...formVendor, email: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Andhra Pradesh"
                    value={formVendor.state} 
                    onChange={e => setFormVendor({ ...formVendor, state: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">City / District</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Vijayawada"
                    value={formVendor.city} 
                    onChange={e => setFormVendor({ ...formVendor, city: e.target.value })} 
                  />
                </div>

                {/* Row 4: Street Address & PIN */}
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Street Address</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Plot / Door No, Street / Industrial Area"
                    value={formVendor.address} 
                    onChange={e => setFormVendor({ ...formVendor, address: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Postal / PIN Code</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    maxLength={6}
                    placeholder="520001"
                    value={formVendor.pin} 
                    onChange={e => setFormVendor({ ...formVendor, pin: e.target.value })} 
                  />
                </div>

                {/* Bank Details Strip */}
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', marginTop: '0.2rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Landmark size={14} style={{ color: 'var(--primary)' }} />
                    Vendor Bank Details (For Payouts / NEFT / RTGS)
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. State Bank of India"
                    value={formVendor.bankName} 
                    onChange={e => setFormVendor({ ...formVendor, bankName: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">A/C Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Bank Account Number"
                    value={formVendor.accountNumber} 
                    onChange={e => setFormVendor({ ...formVendor, accountNumber: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">IFSC Code</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    maxLength={11}
                    placeholder="SBIN0001234"
                    value={formVendor.ifsc} 
                    onChange={e => setFormVendor({ ...formVendor, ifsc: e.target.value.toUpperCase().trim() })} 
                  />
                </div>

                {/* Notes */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Payment Terms / Internal Note</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. 15 days credit, primary solar cabling supplier"
                    value={formVendor.notes} 
                    onChange={e => setFormVendor({ ...formVendor, notes: e.target.value })} 
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingVendorId ? 'Update Vendor' : 'Save Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}