import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

/** Compact 3-dots action menu — opens upward if near bottom; high z-index so not clipped */
export default function ActionMenu({ items = [] }) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const toggle = () => {
    setOpen(o => {
      const next = !o;
      if (next && ref.current) {
        const r = ref.current.getBoundingClientRect();
        setDropUp(r.bottom > window.innerHeight - 160);
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
        <div role="menu" style={{
          position: 'absolute', right: 0, zIndex: 10000, minWidth: 168,
          ...(dropUp ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }),
          background: '#fff', color: '#0f172a',
          border: '1px solid #e2e8f0', borderRadius: 8,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)', padding: '0.35rem 0',
        }}>
          {items.filter(Boolean).map((it, i) => (
            <button key={i} type="button" role="menuitem"
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.9rem',
                border: 'none', background: 'transparent', fontSize: '0.85rem', cursor: 'pointer',
                color: it.danger ? '#dc2626' : '#0f172a',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
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
