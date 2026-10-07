import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getCountryConfig, isValidIndianGSTIN, getStatesForCountry, validateTaxId, detectCountryFromBrowser, getCountriesForRegion, PAPER_SIZES } from '../utils';
import { getRegionMode } from '../store';

export default function ClientModal({ lockedFields = false,  show, onClose, onSave, client, isEditing, defaultCountry }) {
  // Country defaults: explicit prop (active business profile) → browser locale → 'India'.
  const fallbackCountry = defaultCountry || detectCountryFromBrowser();
  const emptyForm = {
    name: '', address: '', city: '', pin: '', state: '', gstin: '', email: '', phone: '', sites: ['Main Site'], site: 'Main Site', serviceType: '', creditLimit: '', paymentTerms: 'Net 30', tdsSection: '194C',
    country: fallbackCountry, isSEZ: false,
    // v1.9.1 — per-client print preferences. When set, they auto-populate
    // invoiceOptions when the user creates a new invoice for this client.
    // Left blank = use app-wide defaults.
    preferredPaperSize: '',   // '' | 'a4' | 'a5' | 'thermal80' | ...
    preferredCurrency: '',    // '' | 'INR' | 'USD' | ...
    autoPrint: false,          // per-client auto-print override
  };
  const [form, setForm] = useState({ ...emptyForm });
  const [taxIdWarning, setTaxIdWarning] = useState('');

  useEffect(() => {
    if (show && client) {
      setForm({
        name: client.name || '', address: client.address || '', city: client.city || '',
        pin: client.pin || '', state: client.state || '', gstin: client.gstin || '', sites: client.sites || (client.site ? [client.site] : ['Main Site']), site: client.site || 'Main Site', serviceType: client.serviceType || '', creditLimit: client.creditLimit || '', paymentTerms: client.paymentTerms || 'Net 30', tdsSection: client.tdsSection || '194C',
        email: client.email || '', phone: client.phone || '', country: client.country || fallbackCountry,
        isSEZ: !!client.isSEZ,
        preferredPaperSize: client.preferredPaperSize || '',
        preferredCurrency: client.preferredCurrency || '',
        autoPrint: !!client.autoPrint,
      });
    } else if (show) {
      setForm({ ...emptyForm });
    }
    setTaxIdWarning('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, client]);

  if (!show) return null;

  const cc = getCountryConfig(form.country);
  const stateOptions = getStatesForCountry(form.country);

  const handleTaxIdBlur = () => {
    const result = validateTaxId(form.country, form.gstin);
    setTaxIdWarning(result.ok ? '' : result.message);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if ((form.country === 'India' || !form.country) && form.gstin && form.gstin.trim()) {
      const v = isValidIndianGSTIN(form.gstin);
      if (!v.valid) { alert(v.message); return; }
    }
    if (lockedFields) {
      alert('Company Name, GSTIN and State are locked — this client has active Tax Invoices.');
      return;
    }
    onSave(form);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '820px' }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="section-title" style={{ margin: 0 }}>{isEditing ? 'Edit Client' : 'Add New Client'}</h3>
          <button type="button" className="icon-btn" onClick={onClose} title="Close"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Client / Business Name *</label>
            <input type="text" className="form-input" value={form.name} readOnly={!!lockedFields} disabled={!!lockedFields} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Acme Corp" />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Address</label>
            <input type="text" className="form-input" value={form.address} onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))} placeholder="Street address, locality" />
          </div>
          <div className="form-group">
            <label className="form-label">Country</label>
            <select className="form-input" value={form.country} onChange={e => setForm(prev => ({ ...prev, country: e.target.value, state: '' }))}>
              {(() => {
                const visible = getCountriesForRegion(getRegionMode());
                const out = [];
                if (form.country && !visible.some(c => c.name === form.country)) {
                  out.push(<option key={form.country} value={form.country}>{form.country}</option>);
                }
                return out.concat(visible.map(c => <option key={c.code} value={c.name}>{c.name}</option>));
              })()}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input type="text" className="form-input" value={form.city} onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))} placeholder="e.g. Mumbai" />
          </div>
          <div className="form-group">
            <label className="form-label">{cc.postalLabel}</label>
            <input type="text" className="form-input" value={form.pin} onChange={e => setForm(prev => ({ ...prev, pin: e.target.value }))} placeholder={cc.postalLabel} />
          </div>
          <div className="form-group">
            <label className="form-label">{cc.stateLabel}</label>
            {stateOptions.length > 0 ? (
              <select className="form-input" value={form.state} disabled={!!lockedFields} onChange={e => setForm(prev => ({ ...prev, state: e.target.value }))}>
                <option value="">Select {cc.stateLabel}</option>
                {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input type="text" className="form-input" value={form.state} onChange={e => setForm(prev => ({ ...prev, state: e.target.value }))} placeholder={cc.stateLabel} />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{cc.taxIdLabel}</label>
            <input type="text" className="form-input"
              style={taxIdWarning ? { borderColor: '#f59e0b' } : undefined}
              value={form.gstin}
              onChange={e => {
                const g = e.target.value.toUpperCase();
                const code = g.replace(/[^0-9A-Z]/g, '').slice(0, 2);
                const STATE_BY_GST = {
                  '01':'Jammu and Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
                  '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh',
                  '10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
                  '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
                  '20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat',
                  '27':'Maharashtra','29':'Karnataka','30':'Goa','32':'Kerala','33':'Tamil Nadu',
                  '34':'Puducherry','36':'Telangana','37':'Andhra Pradesh','38':'Ladakh'
                };
                const st = STATE_BY_GST[code];
                setForm(prev => ({ ...prev, gstin: g, ...(st ? { state: st } : {}) }));
                if (taxIdWarning) setTaxIdWarning('');
              }}
              onBlur={handleTaxIdBlur}
              placeholder={cc.taxIdPlaceholder} maxLength={20} />
            {taxIdWarning && <small style={{ color: '#d97706', fontSize: '0.7rem', display: 'block', marginTop: '0.2rem' }}>⚠ {taxIdWarning}</small>}
          </div>
          <div className="form-group">
            <label className="form-label">Credit Limit (₹)</label>
            <input type="number" className="form-input" value={form.creditLimit || ''} onChange={e => setForm(prev => ({ ...prev, creditLimit: e.target.value }))} />
            <label className="form-label">Payment Terms</label>
            <select className="form-input" value={form.paymentTerms || 'Net 30'} onChange={e => setForm(prev => ({ ...prev, paymentTerms: e.target.value }))}>
              <option>Net 30</option><option>Net 15</option><option>Net 45</option>
              <option>50% Advance / 50% on Delivery</option><option>Due on Receipt</option>
            </select>
            <label className="form-label">TDS Section</label>
            <select className="form-input" value={form.tdsSection || '194C'} onChange={e => setForm(prev => ({ ...prev, tdsSection: e.target.value }))}>
              <option value="194C">194C (~1-2%)</option><option value="194J">194J (10%)</option>
              <option value="194H">194H (5%)</option><option value="none">None</option>
            </select>
            <label className="form-label">Service Type</label>
            <input type="text" className="form-input" value={form.serviceType || ''} list="service-type-list"
              onChange={e => setForm(prev => ({ ...prev, serviceType: e.target.value }))}
              placeholder="e.g. Manpower / Housekeeping / AMC" />
            <datalist id="service-type-list">
              <option value="Manpower" /><option value="Housekeeping" /><option value="Security" />
              <option value="AMC" /><option value="Consulting" /><option value="Transport" />
            </datalist>
            <label className="form-label">Sites (one per line — same GSTIN, different locations)</label>
            <textarea className="form-input" rows={3}
              value={(form.sites || []).join('\n')}
              onChange={e => setForm(prev => ({
                ...prev,
                sites: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
                site: (e.target.value.split('\n').map(s => s.trim()).filter(Boolean)[0]) || prev.site
              }))}
              placeholder="Main Site&#10;Chirala Yard&#10;Site B" />
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} placeholder="client@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input type="tel" className="form-input" value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} placeholder="+91 98765 43210" />
          </div>
          {form.country === 'India' && (
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.isSEZ}
                  onChange={e => setForm(prev => ({ ...prev, isSEZ: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                <span><strong>SEZ unit / Developer</strong> — supplies will be charged IGST regardless of state (Section 16, IGST Act).</span>
              </label>
            </div>
          )}

          {/* v1.9.1 — per-client print preferences. All optional; leave blank
              to use the app-wide defaults from Settings. When set, they
              auto-apply the next time an invoice is created for this client. */}
          <div className="form-group" style={{ gridColumn: 'span 2', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', marginTop: '0.5rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
              Print preferences (optional)
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
              Auto-applied when you create a new invoice for this client. Leave blank to use app-wide defaults.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 3 }}>Preferred paper size</label>
                <select className="form-input" style={{ fontSize: '0.8rem', padding: '0.35rem' }}
                  value={form.preferredPaperSize}
                  onChange={e => setForm(prev => ({ ...prev, preferredPaperSize: e.target.value }))}>
                  <option value="">Use app default</option>
                  {Object.entries(PAPER_SIZES).map(([key, ps]) => (
                    <option key={key} value={key}>{ps.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 3 }}>Preferred currency</label>
                <select className="form-input" style={{ fontSize: '0.8rem', padding: '0.35rem' }}
                  value={form.preferredCurrency}
                  onChange={e => setForm(prev => ({ ...prev, preferredCurrency: e.target.value }))}>
                  <option value="">Use invoice default</option>
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AED">AED (د.إ)</option>
                  <option value="SGD">SGD (S$)</option>
                  <option value="AUD">AUD (A$)</option>
                </select>
              </div>
              <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', marginTop: '0.2rem' }}>
                <input type="checkbox" checked={!!form.autoPrint}
                  onChange={e => setForm(prev => ({ ...prev, autoPrint: e.target.checked }))}
                  style={{ width: 15, height: 15, accentColor: 'var(--primary)' }} />
                <span><strong>Auto-print on save for this client</strong> — overrides global setting</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>{isEditing ? 'Update Client' : 'Save Client'}</button>
        </div>
      </div>
    </div>
  );
}
