import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { getAllClients, saveClient, deleteClient, getAllExpenses, getAllPurchases } from '../store';
import { formatCurrency } from '../utils';
import { toast } from './Toast';
import ActionMenu from './ActionMenu';

/** Vendors tab — client-card style with search + paid/outstanding metrics */
export default function VendorsView() {
  const [list, setList] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const empty = () => ({
    name: '', gstin: '', state: '', city: '', phone: '', email: '', address: '',
    isVendor: true, type: 'vendor', sites: ['Main Site'],
  });

  const STATE_BY_CODE = {
    '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
    '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
    '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
    '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
    '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '32': 'Kerala', '33': 'Tamil Nadu',
    '34': 'Puducherry', '36': 'Telangana', '37': 'Andhra Pradesh',
  };

  const load = async () => {
    try {
      const [all, pb, exp] = await Promise.all([
        getAllClients(),
        getAllPurchases ? getAllPurchases().catch(() => []) : Promise.resolve([]),
        getAllExpenses().catch(() => []),
      ]);
      setList((all || []).filter(c => c.isVendor || c.type === 'vendor'));
      setPurchases(pb || []);
      setExpenses(exp || []);
    } catch {
      toast('Failed to load vendors', 'error');
    }
  };
  useEffect(() => { load(); }, []);

  const onGstin = (gstin) => {
    const g = (gstin || '').toUpperCase().trim();
    const patch = { gstin: g };
    if (g.length >= 2 && STATE_BY_CODE[g.slice(0, 2)]) patch.state = STATE_BY_CODE[g.slice(0, 2)];
    setForm(prev => ({ ...prev, ...patch }));
  };

  const metrics = useMemo(() => {
    const map = {};
    for (const v of list) {
      map[v.name] = { total: 0, paid: 0, outstanding: 0 };
    }
    for (const p of purchases) {
      const name = p.vendorName || p.supplierName || p.data?.vendor?.name || '';
      if (!name) continue;
      if (!map[name]) map[name] = { total: 0, paid: 0, outstanding: 0 };
      const tot = Number(p.totalAmount || p.total || 0);
      const paid = Number(p.paidAmount || 0);
      map[name].total += tot;
      map[name].paid += paid;
      map[name].outstanding += Math.max(0, tot - paid);
    }
    for (const e of expenses) {
      const name = e.vendorName || e.payee || '';
      if (!name || !map[name]) continue;
      const amt = Number(e.amount || 0) + (Number(e.gstAmount) || 0);
      map[name].total += amt;
      if (e.status === 'paid' || e.paid) map[name].paid += amt;
      else map[name].outstanding += amt;
    }
    return map;
  }, [list, purchases, expenses]);

  const filtered = search.trim()
    ? list.filter(v =>
        (v.name || '').toLowerCase().includes(search.toLowerCase())
        || (v.gstin || '').toLowerCase().includes(search.toLowerCase())
        || (v.city || '').toLowerCase().includes(search.toLowerCase()))
    : list;

  const save = async () => {
    if (!form.name?.trim()) return toast('Vendor name required', 'error');
    if (form.gstin && form.gstin.length !== 15) return toast('GSTIN must be 15 characters', 'error');
    try {
      await saveClient({ ...form, isVendor: true, type: 'vendor' });
      toast('Vendor saved', 'success');
      setForm(null);
      load();
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Vendors</h2>
          <p className="page-subtitle" style={{ margin: 0 }}>Suppliers · paid & outstanding metrics</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setForm(empty())}>
          <Plus size={16} /> New Vendor
        </button>
      </div>

      <div className="search-box" style={{ marginBottom: 16, maxWidth: 360 }}>
        <Search size={16} className="search-icon" />
        <input className="search-input" placeholder="Search vendor, GSTIN, city…"
          value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button type="button" className="icon-btn" onClick={() => setSearch('')}><X size={14} /></button>}
      </div>

      {filtered.map(v => {
        const m = metrics[v.name] || { total: 0, paid: 0, outstanding: 0 };
        const isOpen = expanded === v.id;
        return (
          <div key={v.id} className="glass-panel mb-3" style={{ overflow: 'visible' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.1rem', cursor: 'pointer' }}
              onClick={() => setExpanded(isOpen ? null : v.id)}>
              <div>
                <strong style={{ fontSize: '1.05rem' }}>{v.name}</strong>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {[v.state, v.gstin, v.phone].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Total</div>
                  <div style={{ fontWeight: 600 }}>{formatCurrency(m.total)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Paid</div>
                  <div style={{ fontWeight: 600, color: '#059669' }}>{formatCurrency(m.paid)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Outstanding</div>
                  <div style={{ fontWeight: 600, color: m.outstanding > 0 ? '#dc2626' : '#059669' }}>{formatCurrency(m.outstanding)}</div>
                </div>
                <ActionMenu items={[
                  { label: 'Edit', onClick: () => setForm({ ...v }) },
                  { label: 'Copy', onClick: () => setForm({ ...v, id: undefined, name: (v.name || '') + ' (Copy)' }) },
                  { label: 'Delete', danger: true, onClick: async () => {
                    if (!confirm('Delete vendor?')) return;
                    await deleteClient(v.id);
                    toast('Deleted', 'success');
                    load();
                  }},
                ]} />
              </div>
            </div>
            {isOpen && (
              <div style={{ padding: '0.75rem 1.1rem', borderTop: '1px solid var(--border)', fontSize: 13, color: '#64748b' }}>
                {[v.address, v.city, v.pin].filter(Boolean).join(', ') || 'No address'}
                {v.email && <div>{v.email}</div>}
              </div>
            )}
          </div>
        );
      })}
      {filtered.length === 0 && (
        <p style={{ textAlign: 'center', color: '#94a3b8' }}>No vendors yet</p>
      )}

      {form && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setForm(null)}>
          <div className="modal glass-panel" style={{ width: 'min(720px, 96vw)', maxHeight: '90vh', overflow: 'auto', padding: '1.25rem' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{form.id ? 'Edit' : 'New'} Vendor</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Vendor Name *</label>
                <input className="form-input" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">GSTIN</label>
                <input className="form-input" maxLength={15} value={form.gstin || ''} onChange={e => onGstin(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input className="form-input" value={form.state || ''} onChange={e => setForm({ ...form, state: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input className="form-input" value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Address</label>
                <textarea className="form-input" rows={2} value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={save}>Save Vendor</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
