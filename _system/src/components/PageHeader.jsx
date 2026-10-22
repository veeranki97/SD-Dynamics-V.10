// Shared page header — Design system Phase 2
// Props: icon, title, subtitle, meta, children (actions)

export default function PageHeader({ icon, title, subtitle, meta, children }) {
  return (
    <div className="page-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0 }}>
        {icon !== undefined && icon !== null && (
          <div className="page-header-icon" aria-hidden>{icon}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-title">{title}</h1>
          {(subtitle || meta) && (
            <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
              {subtitle && <span>{subtitle}</span>}
              {meta && <span className="page-header-meta">{meta}</span>}
            </p>
          )}
        </div>
      </div>
      {children ? (
        <div className="page-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
