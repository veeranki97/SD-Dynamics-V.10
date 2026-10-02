/** Optional: drop into SettingsView under Appearance — brand title/subtitle for sidebar */
import { useState } from 'react';
import { toast } from './Toast';

export function BrandSettingsPanel() {
  const [title, setTitle] = useState(() => localStorage.getItem('sd_brand_title') || 'SD Dynamics');
  const [subtitle, setSubtitle] = useState(() => localStorage.getItem('sd_brand_subtitle') || 'Service ERP');
  const [primary, setPrimary] = useState(() => localStorage.getItem('sd_theme_primary') || '#2563eb');
  const save = () => {
    localStorage.setItem('sd_brand_title', title.trim() || 'SD Dynamics');
    localStorage.setItem('sd_brand_subtitle', subtitle.trim() || 'Service ERP');
    localStorage.setItem('sd_theme_primary', primary);
    document.documentElement.style.setProperty('--primary', primary);
    toast('Brand & theme saved — reload sidebar if title does not update', 'success');
  };
  return (
    <div className="glass-panel p-3" style={{ maxWidth: 480 }}>
      <h3 style={{ marginTop: 0 }}>Sidebar brand</h3>
      <label className="form-label">Title (replaces “SD Dynamics”)</label>
      <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
      <label className="form-label" style={{ marginTop: 8 }}>Subtitle</label>
      <input className="form-input" value={subtitle} onChange={e => setSubtitle(e.target.value)} />
      <label className="form-label" style={{ marginTop: 8 }}>Primary theme colour</label>
      <input type="color" value={primary} onChange={e => setPrimary(e.target.value)} />
      <div style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-primary" onClick={save}>Save brand</button>
      </div>
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
        Logo: use Settings → Active business profile → Logo (shows in sidebar when set).
      </p>
    </div>
  );
}
