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

      <div className="sd-dash-extras-bottom">
        <div className="sd-dash-activity glass-panel">
          <div className="sd-dash-section-head">
            <span className="sd-dash-section-title">Recent Activity</span>
            <button type="button" className="btn-link" onClick={() => navigate('activity-log')}>View All</button>
          </div>
          {feed.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>No recent activity yet.</p>
          ) : (
            <ul className="sd-dash-activity-list">
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

        <div className="sd-dash-compliance">
          <div className="sd-dash-compliance-inner">
            <ShieldCheck size={22} />
            <div>
              <div className="sd-dash-compliance-title">Stay Compliant</div>
              <div className="sd-dash-compliance-text">Keep your books, returns and taxes up to date.</div>
            </div>
          </div>
          <button type="button" className="btn btn-secondary sd-dash-compliance-btn" onClick={() => navigate('filing')}>
            View Compliance →
          </button>
          {secondaryKpis && secondaryKpis.openInv != null ? (
            <p className="sd-dash-compliance-meta text-muted">
              Open invoices: {secondaryKpis.openInv}
              {secondaryKpis.drafts != null ? ' · Drafts: ' + secondaryKpis.drafts : ''}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
