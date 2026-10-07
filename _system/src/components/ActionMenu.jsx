import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

/** Compact 3-dots action menu — fixed position so not clipped by table overflow; opens up near bottom */
export default function ActionMenu({ items = [] }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, dropUp: false });
  const ref = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target) && menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open]);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (next && ref.current) {
        const r = ref.current.getBoundingClientRect();
        const menuH = Math.min(280, (items.filter(Boolean).length || 1) * 40 + 16);
        const spaceBelow = window.innerHeight - r.bottom;
        const dropUp = spaceBelow < menuH + 12;
        const top = dropUp ? Math.max(8, r.top - menuH - 4) : r.bottom + 4;
        const left = Math.min(window.innerWidth - 180, Math.max(8, r.right - 168));
        setCoords({ top, left, dropUp });
      }
      return next;
    });
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', zIndex: open ? 9999 : 1 }}>
      <button type="button" className="btn-icon" aria-label="Actions" onClick={toggle}
        style={{ border: '1px solid var(--border,#e2e8f0)', borderRadius: 6, padding: 4, background: 'var(--card,#fff)' }}>
        <MoreVertical size={16} />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            zIndex: 100000,
            minWidth: 168,
            maxHeight: 'min(280px, calc(100vh - 16px))',
            overflowY: 'auto',
            background: '#fff',
            color: '#0f172a',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
            padding: '0.35rem 0',
          }}
        >
          {items.filter(Boolean).map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.9rem',
                border: 'none', background: 'transparent', fontSize: '0.85rem', cursor: 'pointer',
                color: it.danger ? '#dc2626' : '#0f172a',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              onClick={() => { setOpen(false); it.onClick?.(); }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
