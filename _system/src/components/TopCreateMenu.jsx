/**
 * Spec region 4 — Quick Create dropdown for App top bar.
 * Wire: <TopCreateMenu onNewInvoice={handleNewInvoice} />
 */
import { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown, FileText, ShoppingCart, Wallet, Receipt, BookOpen } from 'lucide-react';

function go(view) {
  try {
    sessionStorage.setItem('gst_currentView', view);
    window.dispatchEvent(new CustomEvent('sd-navigate', { detail: view }));
  } catch (_) {}
}

export default function TopCreateMenu({ onNewInvoice }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const items = [
    { label: 'New Invoice', icon: FileText, run: () => (onNewInvoice ? onNewInvoice() : go('new')) },
    { label: 'Purchase Order', icon: ShoppingCart, run: () => go('purchaseorders') },
    { label: 'Expense', icon: Wallet, run: () => go('expenses') },
    { label: 'Receipt / Payment', icon: Receipt, run: () => go('receipts') },
    { label: 'Journal Voucher', icon: BookOpen, run: () => go('vouchers') },
  ];

  return (
    <div className="sd-top-create" ref={ref}>
      <button
        type="button"
        className="btn btn-primary sd-top-create-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus size={16} /> Create <ChevronDown size={14} />
      </button>
      {open && (
        <ul className="sd-top-create-menu" role="menu">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <li key={it.label} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="sd-top-create-item"
                  onClick={() => {
                    setOpen(false);
                    it.run();
                  }}
                >
                  <Icon size={16} /> {it.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
