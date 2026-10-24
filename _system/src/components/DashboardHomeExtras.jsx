/**
 * Dashboard home extras — regions 12–14 of annotated Business Dashboard UI Spec.
 * Drop-in: import and render below DashboardCharts on home (!listMode).
 * Uses real bills / purchases / activity-logs only — no sample KPI numbers.
 */
import { useEffect, useState, useMemo } from 'react';
import {
  FileText, ShoppingCart, Wallet, BookOpen, UserPlus, Users,
  Receipt, Package, Bell, ShieldCheck,
} from 'lucide-react';
import { getActivityLogs, getAllBills, getAllPurchases } from '../store';
import { formatCurrency } from '../utils';

function navigate(view) {
  try {
    sessionStorage.setItem('gst_currentView', view);
    window.dispatchEvent(new CustomEvent('sd-navigate', { detail: view }));
  } catch (_) {}
}

function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' hours ago';
  return Math.floor(s / 86400) + ' day(s) ago';
}

/**
 * @param {{ onNew?: function, secondaryKpis?: object }} props
 */
export default function DashboardHomeExtras({ onNew, secondaryKpis }) {
  const [logs, setLogs] = useState([]);
  const [recentDocs, setRecentDocs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [acts, bills, purch] = await Promise.all([
          getActivityLogs().catch(() => []),
          getAllBills().catch(() => []),
          getAllPurchases().catch(() => []),
        ]);
        if (cancelled) return;
        const sortedLogs = (Array.isArray(acts) ? acts : [])
          .slice()
          .sort((a, b) => String(b.at || b.createdAt || '').localeCompare(String(a.at || a.createdAt || '')))
          .slice(0, 12);
        setLogs(sortedLogs);

        const docs = [];
        (bills || []).forEach((b) => {
          docs.push({
            id: 'b-' + (b.id || b.invoiceNumber),
            kind: 'invoice',
            title: (b.invoiceType || 'Invoice') + ' ' + (b.invoiceNumber || ''),
            sub: (b.clientName || '') + (b.totalAmount != null ? ' · ' + formatCurrency(b.totalAmount, b.currency || 'INR') : ''),
            at: b.updatedAt || b.createdAt || b.invoiceDate,
          });
        });
        (purch || []).forEach((p) => {
          docs.push({
            id: 'p-' + (p.id || p.purchaseNumber || p.billNumber),
            kind: 'purchase',
            title: 'Purchase ' + (p.purchaseNumber || p.billNumber || p.invoiceNumber || ''),
            sub: (p.vendorName || p.supplier || '') + (p.total != null ? ' · ' + formatCurrency(p.total, 'INR') : ''),
            at: p.updatedAt || p.date || p.billDate,
          });
        });
        docs.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
        setRecentDocs(docs.slice(0, 8));
      } catch (_) {
        if (!cancelled) {
          setLogs([]);
          setRecentDocs([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const feed = useMemo(() => {
    if (logs.length) {
      return logs.slice(0, 8).map((L) => ({
        id: L.id || (L.at + L.entityId),
        title: (L.action || 'update') + ' · ' + (L.entityType || '') + ' ' + (L.entityId || ''),
        sub: L.phrase || '',
        at: L.at || L.createdAt,
        kind: L.entityType || 'log',
      }));
    }
    return recentDocs;
  }, [logs, recentDocs]);

  const actions = [
    { id: 'inv', label: 'Create Invoice', hint: 'Sales', icon: FileText, run: () => (onNew ? onNew() : navigate('new')) },
    { id: 'po', label: 'Create Purchase Order', hint: 'Purchase', icon: ShoppingCart, run: () => navigate('purchaseorders') },
    { id: 'pay', label: 'Record Payment', hint: 'Money', icon: Wallet, run: () => navigate('receipts') },
    { id: 'jv', label: 'Journal Voucher', hint: 'Books', icon: BookOpen, run: () => navigate('vouchers') },
    { id: 'cust', label: 'Add Customer', hint: 'Master Data', icon: UserPlus, run: () => navigate('clients') },
    { id: 'vend', label: 'Add Vendor', hint: 'Master Data', icon: Users, run: () => navigate('vendors') },
  ];

  return (
    <div className="sd-dash-extras">
      <div className="sd-dash-quick-actions glass-panel">
        <div className="sd-dash-section-title">Quick Actions</div>
        <div className="sd-dash-quick-grid">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.id} type="button" className="sd-dash-quick-tile" onClick={a.run}>
                <span className="sd-dash-quick-icon"><Icon size={20} /></span>
                <span className="sd-dash-quick-label">{a.label}</span>
                <span className="sd-dash-quick-hint">{a.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sd-dash-extras-bottom" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, 300px)',
        gap: 12,
        alignItems: 'stretch',
      }}>
        <div className="sd-dash-activity glass-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="sd-dash-section-head">
            <span className="sd-dash-section-title">Recent Activity</span>
            <button type="button" className="btn-link" onClick={() => navigate('activity-log')}>View All</button>
          </div>
          {feed.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>No recent activity yet.</p>
          ) : (
            <ul className="sd-dash-activity-list" style={{ flex: 1, margin: 0 }}>
              {feed.map((item) => (
                <li key={item.id}>
                  <span className="sd-dash-activity-dot" data-kind={item.kind} />
                  <div className="sd-dash-activity-body">
                    <div className="sd-dash-activity-title">{item.title}</div>
                    {item.sub ? <div className="sd-dash-activity-sub">{item.sub}</div> : null}
                    <div className="sd-dash-activity-time">{timeAgo(item.at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Stretch with activity column — no empty white gap under the card */}
        <div className="sd-dash-compliance" style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: 12,
          height: '100%',
          minHeight: '100%',
          padding: '14px 16px',
          borderRadius: 12,
          background: 'linear-gradient(160deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)',
          color: '#fff',
          boxSizing: 'border-box',
        }}>
          <div className="sd-dash-compliance-inner" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <ShieldCheck size={22} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div className="sd-dash-compliance-title" style={{ fontWeight: 700, fontSize: '0.95rem' }}>Stay Compliant</div>
              <div className="sd-dash-compliance-text" style={{ fontSize: '0.78rem', opacity: 0.92, marginTop: 4, lineHeight: 1.35 }}>
                Keep books, GST returns and taxes up to date.
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-secondary sd-dash-compliance-btn" onClick={() => navigate('filing')}
            style={{ width: '100%', background: '#fff', color: '#1e40af', border: 'none', fontWeight: 600 }}>
            View Compliance →
          </button>
          <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.22)', fontSize: '0.78rem', opacity: 0.95 }}>
            {secondaryKpis && secondaryKpis.openInv != null ? (
              <>
                <div>Open invoices: <strong>{secondaryKpis.openInv}</strong></div>
                {secondaryKpis.drafts != null ? <div style={{ marginTop: 2 }}>Drafts: <strong>{secondaryKpis.drafts}</strong></div> : null}
                {secondaryKpis.monthSales != null ? (
                  <div style={{ marginTop: 2 }}>This month sales: <strong>{formatCurrency(secondaryKpis.monthSales)}</strong></div>
                ) : null}
              </>
            ) : (
              <div style={{ opacity: 0.85 }}>GST filing · GSTR-1 / 3B reminders</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
