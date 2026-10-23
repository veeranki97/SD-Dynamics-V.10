import { loadMasterDataFromServer } from './utils/masterData';
import { hydratePrintSettingsFromServer } from './utils/printSettings';
import HrmView from './components/HrmView';
import DataExportView from './components/DataExportView';
import ActivityLogView from './components/ActivityLogView';
import DashboardChartSettings from './components/DashboardChartSettings';
import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { Home, FileText, Settings, Plus, Users, Package, BarChart3, Wallet, RefreshCw, Receipt, BookOpen, Moon, Sun, Download, X, ShoppingCart, ChevronDown, Building2, Pencil, HelpCircle, Search, Command, Bell, Calculator, HardDrive, Menu, ClipboardList, ShoppingBag, Banknote, Activity, Target, CheckSquare,
  Scale, Landmark, ScrollText, Truck, Layers
} from 'lucide-react';
import { getAllProfiles, saveProfile, getEnabledModules, getAllBills, getAllProducts, getStockAlertSettings, getAllClients } from './store';
import { isModuleEnabled, getUpcomingFilings } from './utils';
// v1.10.4 — Route-level lazy loading. Prior App.jsx synchronously
// imported all 12 views (~15k LOC combined), so a first-paint on
// Dashboard downloaded and parsed GSTReturns (1952), InvoiceGenerator
// (2409), IncomeTax (1038), SettingsView (1479), PrintSettings (1294)
// etc. before the user even asked for them.
//
// Now:
//  - Dashboard stays eager — it's the default landing route.
//  - InvoiceGenerator stays eager — new-invoice is the primary action
//    reachable from Ctrl+K / manifest shortcut / big blue button.
//  - Every other view is React.lazy → own Vite chunk → fetched on
//    first navigation only. Suspense fallback is a lightweight spinner.
// Result: smaller initial JS payload; each heavy view chunk-caches
// once fetched.
import Dashboard from './components/Dashboard';
import TopCreateMenu from './components/TopCreateMenu';
import InvoiceGenerator from './components/InvoiceGenerator';
import SetupWizard from './components/SetupWizard';
import ToastContainer, { toast } from './components/Toast';
import { shouldNagBackup, backupNagMessage } from './utils/backupNag';
import ConfirmModalContainer from './components/ConfirmModal';
import WelcomeGuide from './components/WelcomeGuide';
const SettingsView = lazy(() => import('./components/SettingsView'));
const ClientsView = lazy(() => import('./components/ClientsView'));
const InventoryView = lazy(() => import('./components/InventoryView'));
const TasksView = lazy(() => import('./components/TasksView'));
const ReportsView = lazy(() => import('./components/ReportsView'));
const EinvoiceSettingsPanel = lazy(() => import('./components/EinvoiceSettingsPanel'));
const ExpenseTracker = lazy(() => import('./components/ExpenseTracker'));
const RecurringInvoices = lazy(() => import('./components/RecurringInvoices'));
const ReceiptVoucher = lazy(() => import('./components/ReceiptVoucher'));
const GSTReturns = lazy(() => import('./components/GSTReturns'));
const IncomeTax = lazy(() => import('./components/IncomeTax'));
const PurchaseBills = lazy(() => import('./components/PurchaseBills'));
const UserGuideView = lazy(() => import('./components/UserGuideView'));
const ControlPanel = lazy(() => import('./components/ControlPanel'));
const WorkOrdersView = lazy(() => import('./components/WorkOrdersView'));
const PurchaseOrdersView = lazy(() => import('./components/PurchaseOrdersView'));
const CashBookView = lazy(() => import('./components/CashBookView'));
const VendorsView = lazy(() => import('./components/VendorsView'));
const CostCentersView = lazy(() => import('./components/CostCentersView'));
const ChartOfAccountsView = lazy(() => import('./components/ChartOfAccountsView'));
const GeneralLedgerView = lazy(() => import('./components/GeneralLedgerView'));
const PaymentReconView = lazy(() => import('./components/PaymentReconView'));
const FinancialBooksView = lazy(() => import('./components/FinancialBooksView'));
const BankFeedView = lazy(() => import('./components/BankFeedView'));
const VoucherEntryView = lazy(() => import('./components/VoucherEntryView'));
const ServiceRevenueReport = lazy(() => import('./components/ServiceRevenueReport'));
const WorkflowRulesView = lazy(() => import('./components/WorkflowRulesView'));
const SystemHealthView = lazy(() => import('./components/SystemHealthView'));
const PaymentRemindersView = lazy(() => import('./components/PaymentRemindersView'));
const BudgetSettingsView = lazy(() => import('./components/BudgetSettingsView'));
import { getPrintSettings } from './utils/printSettings';

// v1.10.4 — Lightweight Suspense fallback shown while a lazy view
// downloads. Purely visual — no data fetching, no state.
function ViewLoading() {
  return (
    <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        <span style={{
          display: 'inline-block', width: 14, height: 14, border: '2px solid var(--border)',
          borderTopColor: 'var(--primary)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        Loading…
      </div>
    </div>
  );
}


/** Full-screen welcome + PIN gate — screen lock only (data files are NOT encrypted). */
/** Full-screen welcome + PIN gate — screen lock only (data files are NOT encrypted).
 *  Drop-in replacement for PinLockGate in App.jsx
 */
function PinLockGate({ onUnlock, autoLockMinutes, autoLockEnabled }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (value) => {
    const p = (value != null ? value : pin).replace(/\D/g, '');
    if (p.length < 6) { setErr('Enter your 6 or 8 digit PIN'); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/app-lock/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: p }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setErr('Incorrect PIN');
        setPin('');
        setBusy(false);
        return;
      }
      try {
        if (j.sessionToken) sessionStorage.setItem('sd_session_token', j.sessionToken);
      } catch (_) {}
      onUnlock();
    } catch {
      setErr('Could not verify PIN — is the server running?');
    }
    setBusy(false);
  };

  const dots = Math.min(8, Math.max(0, pin.length));

  return (
    <div
      className="sd-pin-gate"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(12px, 3vw, 28px)',
        boxSizing: 'border-box',
        background:
          'radial-gradient(1200px 600px at 10% 0%, #60a5fa55 0%, transparent 55%),' +
          'radial-gradient(900px 500px at 90% 100%, #a78bfa66 0%, transparent 50%),' +
          'linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #312e81 100%)',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: 'min(400px, 100%)',
          maxHeight: 'min(92vh, 640px)',
          overflow: 'auto',
          borderRadius: 20,
          padding: 'clamp(1.25rem, 4vw, 2rem) clamp(1.25rem, 4vw, 2.25rem)',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 25px 50px -12px rgba(15,23,42,0.45), 0 0 0 1px rgba(255,255,255,0.4) inset',
          textAlign: 'center',
          color: '#0f172a',
        }}
      >
        <div
          style={{
            width: 56, height: 56, margin: '0 auto 1rem', borderRadius: 16,
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(37,99,235,0.35)',
            color: '#fff', fontWeight: 800, fontSize: 18,
          }}
          aria-hidden
        >
          SD
        </div>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#64748b', fontWeight: 600, marginBottom: 4 }}>
          WELCOME TO
        </div>
        <h1 style={{ margin: '0 0 0.25rem', fontSize: 'clamp(1.35rem, 4vw, 1.65rem)', fontWeight: 800, color: '#1d4ed8' }}>
          SD Dynamics
        </h1>
        <p style={{ margin: '0 0 1.35rem', fontSize: 13, color: '#64748b' }}>
          Enterprise Resource Platform
        </p>

        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
            borderRadius: 999, background: '#eff6ff', color: '#1d4ed8',
            fontSize: 13, fontWeight: 600, marginBottom: '1.15rem',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          Administrator
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 14 }} aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 10, height: 10, borderRadius: '50%',
                background: i < dots ? '#2563eb' : '#e2e8f0',
                boxShadow: i < dots ? '0 0 0 3px #dbeafe' : 'none',
              }}
            />
          ))}
        </div>

        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 8)); setErr(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="Enter PIN"
          aria-label="PIN"
          style={{
            width: '100%',
            padding: '0.85rem 1rem',
            fontSize: '1.15rem',
            letterSpacing: '0.35em',
            textAlign: 'center',
            borderRadius: 12,
            border: err ? '1.5px solid #f87171' : '1.5px solid #e2e8f0',
            background: '#f8fafc',
            color: '#0f172a',
            boxSizing: 'border-box',
            outline: 'none',
          }}
          autoFocus
        />
        {err && (
          <p style={{ color: '#dc2626', fontSize: 13, margin: '0.65rem 0 0', fontWeight: 500 }}>{err}</p>
        )}

        <button
          type="button"
          disabled={busy || pin.length < 6}
          onClick={() => submit()}
          style={{
            width: '100%',
            marginTop: 16,
            padding: '0.85rem 1rem',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: busy || pin.length < 6 ? 'not-allowed' : 'pointer',
            color: '#fff',
            background: busy || pin.length < 6
              ? 'linear-gradient(90deg, #94a3b8, #cbd5e1)'
              : 'linear-gradient(90deg, #2563eb, #4f46e5)',
            boxShadow: busy || pin.length < 6 ? 'none' : '0 10px 20px rgba(37,99,235,0.35)',
          }}
        >
          {busy ? 'Verifying…' : 'Verify PIN'}
        </button>

        <p style={{ margin: '1.1rem 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
          Screen lock only — data files on disk are not encrypted.
          {autoLockEnabled ? ` Auto-locks after ${autoLockMinutes || 15} min idle.` : ''}
        </p>
        <p style={{ margin: '0.5rem 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
          Forgot PIN? Place empty file <strong>RESET-PIN</strong> next to the launcher, then reopen.
        </p>
      </div>
    </div>
  );
}



function App() {
  // v1.9.3 — Setup Wizard shown on first-run (before onboardingComplete = true)
  const [showWizard, setShowWizard] = useState(() => {
    try { return !getPrintSettings().onboardingComplete; } catch { return false; }
  });

  // App lock (screen PIN) — hash lives in meta (survives port).
  // Unlock is kept in sessionStorage for this browser tab session so a normal
  // page refresh does NOT re-prompt. Closing the tab / new window needs PIN again.
  // "Lock now" and idle timeout clear the session unlock.
  const PIN_SESSION_KEY = 'sd_app_unlocked';
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [appUnlocked, setAppUnlocked] = useState(() => {
    try { return sessionStorage.getItem(PIN_SESSION_KEY) === '1'; } catch { return false; }
  });
  const [appLockPrefs, setAppLockPrefs] = useState({ autoLockEnabled: true, autoLockMinutes: 15 });
  const lastActivityRef = useRef(Date.now());

  const setUnlocked = (v) => {
    setAppUnlocked(!!v);
    try {
      if (v) sessionStorage.setItem(PIN_SESSION_KEY, '1');
      else {
        sessionStorage.removeItem(PIN_SESSION_KEY);
        sessionStorage.removeItem('sd_session_token');
        fetch('/api/app-lock/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
      }
    } catch { /* private mode */ }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/app-lock/status');
        const j = await r.json();
        if (cancelled) return;
        setAppLockPrefs({
          autoLockEnabled: j.autoLockEnabled !== false,
          autoLockMinutes: Number(j.autoLockMinutes) || 15,
        });
        if (j.enabled) {
          setAppLockEnabled(true);
          // Keep session unlock across refresh; only force lock if never unlocked this tab
          let sessionOk = false;
          let hasToken = false;
          try {
            sessionOk = sessionStorage.getItem(PIN_SESSION_KEY) === '1';
            hasToken = !!(sessionStorage.getItem('sd_session_token') || '');
          } catch {}
          // Need both UI unlock flag AND API session token (token survives restart only if signed)
          if (!sessionOk || !hasToken) {
            try {
              sessionStorage.removeItem(PIN_SESSION_KEY);
              sessionStorage.removeItem('sd_session_token');
            } catch {}
            setUnlocked(false);
          } else {
            setAppUnlocked(true);
          }
        } else {
          setAppLockEnabled(false);
          setUnlocked(true); // lock off → always open
        }
      } catch {
        if (!cancelled) { setAppLockEnabled(false); setUnlocked(true); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Idle auto-lock
  useEffect(() => {
    if (!appLockEnabled || !appUnlocked || !appLockPrefs.autoLockEnabled) return;
    const mark = () => { lastActivityRef.current = Date.now(); };
    const evs = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    evs.forEach(e => window.addEventListener(e, mark, { passive: true }));
    const t = setInterval(() => {
      const mins = Number(appLockPrefs.autoLockMinutes) || 15;
      if (Date.now() - lastActivityRef.current > mins * 60 * 1000) {
        setUnlocked(false);
      }
    }, 15000);
    return () => {
      evs.forEach(e => window.removeEventListener(e, mark));
      clearInterval(t);
    };
  }, [appLockEnabled, appUnlocked, appLockPrefs.autoLockEnabled, appLockPrefs.autoLockMinutes]);

  // Listen for Settings "Lock now"
  useEffect(() => {
    const onLock = () => { if (appLockEnabled) setUnlocked(false); };
    const onPrefs = (e) => {
      if (e?.detail) setAppLockPrefs(p => ({ ...p, ...e.detail }));
      if (e?.detail?.enabled === false) { setAppLockEnabled(false); setUnlocked(true); }
      if (e?.detail?.enabled === true) { setAppLockEnabled(true); setUnlocked(true); }
    };
    window.addEventListener('sd-app-lock-now', onLock);
    const onNeedPin = () => { if (appLockEnabled) setUnlocked(false); };
    window.addEventListener('sd-app-lock-required', onNeedPin);
    window.addEventListener('sd-app-lock-prefs', onPrefs);
    return () => {
      window.removeEventListener('sd-app-lock-now', onLock);
      window.removeEventListener('sd-app-lock-required', onNeedPin);
      window.removeEventListener('sd-app-lock-prefs', onPrefs);
    };
  }, [appLockEnabled]);
  const [currentView, setCurrentView] = useState(() => {
    // PWA manifest "shortcuts" deep-link in via ?view=X (e.g. right-clicking
    // the pinned taskbar icon → "New Invoice" opens /?view=new). Honour that
    // before falling back to whatever the user was last looking at.
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('view');
      const valid = ['dashboard', 'new', 'clients', 'inventory', 'expenses', 'purchases', 'recurring', 'receipts', 'reports', 'filing', 'incometax', 'guide', 'settings'];
      if (v && valid.includes(v)) {
        // Strip the query string so a refresh doesn't keep snapping back to
        // the shortcut target — only the *first* navigation honours it.
        window.history.replaceState({}, '', window.location.pathname);
        return v;
      }
    } catch { /* sandboxed history API — fall through */ }
    const saved = sessionStorage.getItem('gst_currentView') || 'dashboard';
    // Guard: unknown / partially-updated views must not blank the whole app
    const known = new Set(['dashboard','invoices','new','recurring','clients','vendors','inventory','expenses','purchases','workorders','purchaseorders','cashbook','costcenters','coa','generalledger','servicerev','finbooks','payrecon','bankfeed','vouchers','workflows','receipts','reports','filing','incometax','guide','settings','controlpanel','activity-log','system-health','payment-reminders','einvoice','budgets','dataexport','tasks','hrm','chart-settings']);
    return known.has(saved) ? saved : 'dashboard';
  });
  const [profile, setProfile] = useState(null);
  const [editingBill, setEditingBill] = useState(() => {
    try {
      const saved = sessionStorage.getItem('gst_editingBill');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('freegstbill_theme') === 'dark';
  });
  const [showWelcome, setShowWelcome] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  const deferredPrompt = useRef(null);
  const retryTimer = useRef(null);

  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
  const profileLoaded = useRef(false);
  const [allProfiles, setAllProfiles] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  // Update notification state. Auto-checks GitHub on mount + every 6h.
  // The user can dismiss a specific version (stored in localStorage) so the
  // banner doesn't keep nagging once they've seen it. A NEW version released
  // after that dismissal will re-show the banner.
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const updateBannerVisible = updateInfo?.updateAvailable
    && localStorage.getItem('freegstbill_dismissedUpdate') !== updateInfo.latest;

  // Hydrate print settings from server meta (survives port changes)
  useEffect(() => {
    hydratePrintSettingsFromServer().catch(() => {});
    try { loadMasterDataFromServer && loadMasterDataFromServer(); } catch (e) { /* optional */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('/api/check-update');
        const data = await res.json();
        if (!cancelled) setUpdateInfo(data);
      } catch { /* offline — quietly skip */ }
    };
    // First check ~5 seconds after mount so it doesn't fight the initial load.
    const initial = setTimeout(check, 5000);
    // Then re-check every 6 hours while the app is open.
    const interval = setInterval(check, 6 * 60 * 60 * 1000);
    return () => { cancelled = true; clearTimeout(initial); clearInterval(interval); };
  }, []);

  // ---- Notification centre ----
  // Computed from server data on app boot + every 10 minutes; tucked under a
  // bell icon next to dark-mode toggle in the sidebar. Each section is one
  // click away from the relevant page.
  const [notifications, setNotifications] = useState({ overdue: [], dueSoon: [], lowStock: [], filings: [], autoFire: null });
  const [showNotifs, setShowNotifs] = useState(false);

  // v1.10.62 — reported (#53, @sangwanmail-eng): "Notifications should clear
  // after check."
  //
  // They never did, and the reason is that these are not messages — they are
  // computed live from your data every time the app loads ("3 invoices are
  // overdue", "2 products are low on stock"). There was no notion of having
  // read one, so the badge simply reported what was true and stayed lit
  // forever.
  //
  // Marking them read cannot just hide them, though: if an invoice goes
  // overdue tomorrow you must be told, even if you dismissed yesterday's
  // overdue notice. So dismissal is recorded per section as a SIGNATURE of
  // what was actually shown — the specific invoice numbers, the specific
  // products. Dismissing stores that signature; the section stays quiet only
  // while the signature is unchanged. The moment the underlying facts differ
  // — a new overdue invoice, a different product running low — the signature
  // changes and the alert comes back on its own.
  //
  // Kept in localStorage: it is a per-machine reading preference, not
  // business data, and it must not travel in a backup or sync to another PC.
  const DISMISS_KEY = 'fgsb_dismissedNotifs';
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}'); } catch { return {}; }
  });

  const notifSignatures = useMemo(() => ({
    overdue: notifications.overdue.map(b => b.invoiceNumber || b.id).sort().join('|'),
    dueSoon: notifications.dueSoon.map(b => b.invoiceNumber || b.id).sort().join('|'),
    lowStock: notifications.lowStock.map(p => `${p.id || p.name}:${p.stock ?? ''}`).sort().join('|'),
    filings: notifications.filings.map(f => f.label || f.id || String(f)).sort().join('|'),
    autoFire: notifications.autoFire?.count > 0 ? `autofire:${notifications.autoFire.count}` : '',
  }), [notifications]);

  // A section counts toward the badge only when it has content AND that
  // content is not the exact thing the user already dismissed.
  const isLive = (key) => !!notifSignatures[key] && dismissed[key] !== notifSignatures[key];

  const notifTotal = (isLive('overdue') ? notifications.overdue.length : 0)
    + (isLive('dueSoon') ? notifications.dueSoon.length : 0)
    + (isLive('lowStock') ? notifications.lowStock.length : 0)
    + (isLive('filings') ? notifications.filings.length : 0)
    + (isLive('autoFire') ? 1 : 0);

  // How many sections are currently showing something that could be cleared.
  const dismissableCount = ['overdue', 'dueSoon', 'lowStock', 'filings', 'autoFire']
    .filter(isLive).length;

  const markAllNotifsRead = () => {
    const next = { ...dismissed, ...notifSignatures };
    setDismissed(next);
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };

  useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      try {
        const [bills, products, stockAlertCfg] = await Promise.all([
          getAllBills().catch(() => []),
          getAllProducts().catch(() => []),
          getStockAlertSettings().catch(() => ({ enabled: true, threshold: 5 })),
        ]);
        if (cancelled) return;
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 3);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const overdue = bills.filter(b => {
          const d = b.data?.details?.dueDate;
          return d && d < today && b.status !== 'paid';
        });
        const dueSoon = bills.filter(b => {
          const d = b.data?.details?.dueDate;
          return d && d >= today && d <= tomorrowStr && b.status !== 'paid';
        });
        // Honour the user's stock-alert preferences. When disabled, the filter
        // returns nothing — bell badge drops to 0 for the stock category.
        // When enabled, use the configured threshold (default 5).
        const stockThreshold = Number(stockAlertCfg?.threshold ?? 5);
        const lowStock = stockAlertCfg?.enabled === false
          ? []
          : products.filter(p => (p.stock ?? 999) <= stockThreshold);
        const filings = getUpcomingFilings().filter(f => f.daysAway <= 10);
        // Recurring auto-fire breadcrumb — set by server.js processDueRecurring().
        // Only "fresh" (today's) auto-fires count as a notification; older ones
        // would otherwise stay sticky forever.
        let autoFire = null;
        try {
          const r = await fetch('/api/meta/lastRecurringAutoFire');
          if (r.ok) {
            const j = await r.json();
            if (j.value && j.value.date === today && j.value.count > 0) autoFire = j.value;
          }
        } catch { /* fine */ }
        setNotifications({ overdue, dueSoon, lowStock, filings, autoFire });
      } catch { /* offline / server down — leave previous counts */ }
    };
    compute();
    const interval = setInterval(compute, 10 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [currentView]); // recompute on view change so the bell stays fresh after the user records a payment

  // ---- Keyboard shortcuts + command palette ----
  // Ctrl+K opens a Spotlight-style command palette; Ctrl+N starts a new
  // invoice from anywhere; Ctrl+/ shows the full shortcuts list. Ctrl+S /
  // Ctrl+P live in InvoiceGenerator (they need invoice-form context). All
  // global handlers also accept Meta (⌘) for macOS users.
  const [showPalette, setShowPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIdx, setPaletteIdx] = useState(0);
  // v1.9.4 — pre-load searchable content so Ctrl+K acts as a true global
  // search across invoices, clients, products, and settings sections.
  // Small cost (fires once on mount + when palette opens); big UX win.
  const [searchCorpus, setSearchCorpus] = useState({ bills: [], clients: [], products: [] });
  useEffect(() => {
    Promise.all([
      getAllBills().catch(() => []),
      getAllClients().catch(() => []),
      getAllProducts().catch(() => []),
    ]).then(([bills, clients, products]) => {
      setSearchCorpus({
        bills: bills.slice(0, 100),
        clients: clients.slice(0, 200),
        products: products.slice(0, 200),
      });
    });
  }, [showPalette]); // refresh when palette opens
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Palette useMemo + dependent effects are declared further down, AFTER
  // `navItems` and `handleNewInvoice` exist. Declaring them up here would
  // throw "Cannot access 'X' before initialization" at render time because
  // useMemo's dependency array is evaluated synchronously every render.

  const dismissUpdate = () => {
    if (updateInfo?.latest) {
      localStorage.setItem('freegstbill_dismissedUpdate', updateInfo.latest);
      // v1.10.6 — audit L10: was `setUpdateInfo(prev => prev ? { ...prev }
      // : prev)` "to trigger re-render". No-op — `setShowUpdateModal(false)`
      // below already re-renders, and `updateBannerVisible` reads
      // localStorage every render so the new dismissal is picked up.
    }
    setShowUpdateModal(false);
  };

  // Check if server is running — continuously monitors
  useEffect(() => {
    let cancelled = false;

    const checkServer = async () => {
      try {
        const res = await fetch('/api/profile', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          if (cancelled) return;
          setServerDown(false);
          setServerStatus('online');
          if (!profileLoaded.current) {
            profileLoaded.current = true;
            const p = await res.json();
            setProfile(p);
            if (!p.businessName && !localStorage.getItem('freegstbill_onboarded')) {
              setShowWelcome(true);
            }
          }
          return;
        }
        throw new Error('not ok');
      } catch {
        if (!cancelled) {
          setServerDown(true);
          setServerStatus('offline');
        }
      }
    };

    checkServer();
    // Keep checking every 5 seconds (fast when down, normal heartbeat when up)
    retryTimer.current = setInterval(checkServer, 5000);

    return () => {
      cancelled = true;
      if (retryTimer.current) clearInterval(retryTimer.current);
    };
  }, []);

  // Capture PWA install prompt. Banner re-appears 14 days after dismissal
  // (was: dismissed forever — too aggressive, users who closed it during
  // a busy moment never saw it again).
  useEffect(() => {
    const dismissedAt = localStorage.getItem('freegstbill_pwa_dismissed_at');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true; // iOS Safari
    if (isStandalone) return;
    // 14-day cool-down on dismissal
    if (dismissedAt) {
      const days = (Date.now() - Number(dismissedAt)) / 86400000;
      if (days < 14) return;
    }

    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    sessionStorage.setItem('gst_currentView', currentView);
  }, [currentView]);

  useEffect(() => {
    if (editingBill) {
      sessionStorage.setItem('gst_editingBill', JSON.stringify(editingBill));
    } else {
      sessionStorage.removeItem('gst_editingBill');
    }
  }, [editingBill]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('freegstbill_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Load all saved business profiles
  useEffect(() => {
    if (serverStatus === 'online') {
      getAllProfiles().then(setAllProfiles).catch(() => {});
    }
  }, [serverStatus]);

  // Close profile menu on outside click
  useEffect(() => {
    if (!showProfileMenu) return;
    const handler = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProfileMenu]);

  const handleSwitchProfile = async (bp) => {
    setShowProfileMenu(false);
    const loaded = { ...bp };
    delete loaded.id;
    await saveProfile(loaded);
    setProfile(loaded);
  };

  // v1.10.66 (#64 item 1) — identifies the active business for the screens
  // keyed on it below. GSTIN first, the same rule belongsToProfile() uses to
  // decide which records a business owns; the name covers a business that has
  // no GSTIN yet.
  const businessKey = String(profile?.gstin || profile?.businessName || '').trim().toUpperCase();

  // v1.10.66 (#59) — on a phone the sidebar is a slide-in menu. It closes as
  // soon as something in it is chosen, so picking a page never leaves the menu
  // covering the page that was just asked for. Opening the business list is
  // the one exception: that choice is not finished yet.
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const v = localStorage.getItem('freegstbill_sidebar_collapsed');
      return v === null ? true : v === '1';
    } catch { return true; }
  });
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => {
    try {
      const raw = localStorage.getItem('fgsb_nav_groups');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { Sales: true, Orders: true, Parties: true, Money: true, Purchases: true, Books: true, Compliance: true, System: true, Home: true };
  });
  const toggleNavGroup = (g) => {
    setExpandedGroups(prev => {
      const next = { ...prev, [g]: !prev[g] };
      try { localStorage.setItem('fgsb_nav_groups', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const sidebarExpanded = !sidebarCollapsed || sidebarHovered || navOpen;
  const toggleSidebarPin = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('freegstbill_sidebar_collapsed', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  const closeNavAfterPick = (e) => {
    const picked = e.target.closest('button');
    if (picked && !picked.classList.contains('profile-switcher-btn')) setNavOpen(false);
  };

  /** Work Order ⋮ → New Invoice (tax / proforma / DC). Uses sessionStorage + view switch (reliable). */
  const handleWoConvertToInvoice = (wo, targetType = 'tax-invoice') => {
    if (!wo || !wo.id) return;
    const payload = {
      workOrderId: wo.id,
      woNumber: wo.woNumber || wo.number || '',
      clientName: wo.clientName || wo.client || '',
      site: wo.site || '',
      title: wo.title || wo.workDetails || wo.workDescription || wo.notes || '',
      costCenterId: wo.costCenterId || '',
      targetType: targetType || 'tax-invoice',
      periodStart: wo.periodStart || '',
      periodEnd: wo.periodEnd || '',
    };
    try { sessionStorage.setItem('sd_convert_wo', JSON.stringify(payload)); } catch {}
    sessionStorage.removeItem('gst_invoiceDraft');
    setEditingBill(null);
    setCurrentView('new');
  };

  const handleNewInvoice = () => {
    sessionStorage.removeItem('gst_invoiceDraft');
    setEditingBill(null);
    setCurrentView('new');
  };

  const handleEditInvoice = (bill) => {
    sessionStorage.removeItem('gst_invoiceDraft');
    setEditingBill(bill);
    setCurrentView('new');
  };

  useEffect(() => {
    const onOpen = (ev) => {
      const bill = ev?.detail;
      if (bill) handleEditInvoice(bill);
    };
    const onSetView = (ev) => {
      const target = ev?.detail;
      if (typeof target === 'string' && target) setCurrentView(target);
      else if (target && typeof target === 'object' && typeof target.view === 'string') setCurrentView(target.view);
    };
    window.addEventListener('sd-open-invoice', onOpen);
    window.addEventListener('sd-set-view', onSetView);
    window.addEventListener('sd-navigate', onSetView);
    return () => {
      window.removeEventListener('sd-open-invoice', onOpen);
      window.removeEventListener('sd-set-view', onSetView);
      window.removeEventListener('sd-navigate', onSetView);
    };
  }, []);

  const handleDuplicateInvoice = (bill) => {
    sessionStorage.removeItem('gst_invoiceDraft');
    const clone = JSON.parse(JSON.stringify(bill));
    clone._isDuplicate = true;
    delete clone.id;
    clone.invoiceNumber = '';
    if (clone.data) {
      clone.data = { ...clone.data };
      if (clone.data.details) {
        clone.data.details = {
          ...clone.data.details,
          invoiceNumber: '',
          invoiceDate: new Date().toISOString().split('T')[0],
        };
      }
    }
    clone.status = 'unpaid';
    clone.paidAmount = 0;
    clone.payments = [];
    setEditingBill(clone);
    setCurrentView('new');
  };

  const handleInstallPWA = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const result = await deferredPrompt.current.userChoice;
    if (result.outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    deferredPrompt.current = null;
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    // Timestamp-based dismissal — the 14-day cool-down in the install-prompt
    // effect uses this to decide whether to re-show. Old boolean key kept for
    // back-compat with v1.6.0 — readers that find only the legacy key treat
    // it as "permanently dismissed" (same as today's behaviour for them).
    localStorage.setItem('freegstbill_pwa_dismissed_at', String(Date.now()));
  };

  const handleConvertToInvoice = async (bill, targetType = 'tax-invoice') => {
    const st = String(bill.status || '').toLowerCase();
    if (st === 'converted' || st === 'cancelled' || bill.convertedToInvoiceId || bill.data?.convertedToInvoiceId) {
      alert('This document was already converted and is locked.');
      return;
    }
    const dest = String(targetType || 'tax-invoice').toLowerCase();
    const allowed = ['tax-invoice', 'proforma', 'delivery-challan'];
    const toType = allowed.includes(dest) ? dest : 'tax-invoice';
    sessionStorage.removeItem('gst_invoiceDraft');
    const clone = JSON.parse(JSON.stringify(bill));
    const srcType = (bill.invoiceType || bill.data?.invoiceType || '').toLowerCase();
    clone._isDuplicate = true;
    clone._convertToType = toType;
    clone._sourceDocId = bill.id;
    clone._sourceDocNumber = bill.invoiceNumber || bill.id;
    clone._sourceDocType = srcType;
    // legacy aliases used by generator
    clone._sourceProformaId = bill.id;
    clone._sourceProformaNumber = bill.invoiceNumber || bill.id;
    // Convert lock moved to InvoiceGenerator after successful Tax Invoice save.
    // Locking here marked PI as Converted even when the user discarded the draft.
    clone.id = undefined;
    clone.invoiceNumber = '';
    clone.invoiceType = toType;
    if (clone.data) {
      clone.data = { ...clone.data, invoiceType: toType };
      if (clone.data.details) {
        clone.data.details = {
          ...clone.data.details,
          invoiceNumber: '',
          invoiceDate: new Date().toISOString().slice(0, 10),
          convertedFrom: bill.invoiceNumber || bill.id,
          convertedFromType: srcType,
        };
      }
    }
    // Keep advances/payments from PI/Quotation so Tax Invoice shows received/partial/pending
    const paid = Number(clone.paidAmount) || (clone.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0) || 0;
    const total = Number(clone.totalAmount) || 0;
    if (paid <= 0.009) clone.status = 'unpaid';
    else if (paid + 0.009 >= total) clone.status = 'paid';
    else clone.status = 'partial';
    // Annotate payment notes for ledger/audit
    if (Array.isArray(clone.payments) && clone.payments.length) {
      clone.payments = clone.payments.map(p => ({
        ...p,
        note: [p.note, `Against ${srcType || 'source'} ${bill.invoiceNumber || bill.id}`].filter(Boolean).join(' | '),
        againstSourceDoc: bill.invoiceNumber || bill.id,
      }));
    }
    setEditingBill(clone);
    setCurrentView('new');
  };

  // Pull the user's module preferences once per render. Re-mount happens
  // when settings save, which triggers a re-render via the profile state.
  const enabledModules = getEnabledModules();
  const showIfModule = (moduleId) => isModuleEnabled(moduleId, enabledModules);

  // If the user just disabled the module backing the current view, kick them to dashboard
  // so they don't land on an empty page after toggling.
  useEffect(() => {
    const map = { new: 'invoicing', clients: 'clients', inventory: 'inventory', expenses: 'expenses', purchases: 'purchases', recurring: 'recurring', receipts: 'receipts', reports: 'reports', filing: 'gstReturns' };
    const moduleForView = map[currentView];
    if (moduleForView && !isModuleEnabled(moduleForView, enabledModules)) {
      setCurrentView('dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, JSON.stringify(enabledModules)]);

  // Grouped navigation — process-oriented (Sales / Purchase / Work / Money / Books / Compliance)
  // E-Invoice lives only under Settings (no duplicate System entry).
  // Services catalogue lives under Work → Master data → Services tab.
  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard', module: 'dashboard', group: 'Overview' },
    // Sales — documents + clients
    { id: 'invoices', icon: FileText, label: 'Invoices', module: 'invoicing', group: 'Sales & Receivables' },
    { id: 'new', icon: Plus, label: 'New Invoice', onClick: handleNewInvoice, module: 'invoicing', group: 'Sales & Receivables', parent: 'invoices' },
    { id: 'recurring', icon: RefreshCw, label: 'Recurring', module: 'recurring', group: 'Sales & Receivables', parent: 'invoices' },
    { id: 'payment-reminders', icon: Bell, label: 'Payment reminders', module: 'invoicing', group: 'Sales & Receivables', parent: 'invoices' },
    { id: 'clients', icon: Users, label: 'Clients', module: 'clients', group: 'Sales & Receivables' },
    // Purchase — vendors + PO + bills + expenses
    { id: 'vendors', icon: Truck, label: 'Vendors', module: 'clients', group: 'Purchases & Expenses' },
    { id: 'purchaseorders', icon: ShoppingBag, label: 'Purchase Orders', module: 'purchases', group: 'Purchases & Expenses' },
    { id: 'purchases', icon: ShoppingCart, label: 'Purchase Bills', module: 'purchases', group: 'Purchases & Expenses' },
    { id: 'expenses', icon: Wallet, label: 'Expenses', module: 'expenses', group: 'Purchases & Expenses' },
    // Work — jobs + masters (Services tab inside Master data)
    { id: 'workorders', icon: ClipboardList, label: 'Work Orders', module: 'dashboard', group: 'Operations' },
    { id: 'costcenters', icon: Building2, label: 'Master data', module: 'settings', group: 'Operations' },
    { id: 'inventory', icon: Package, label: 'Services', module: 'inventory', group: 'Operations' },
    // Money
    { id: 'receipts', icon: Receipt, label: 'Receipts', module: 'receipts', group: 'Cash & Banking' },
    { id: 'payrecon', icon: Receipt, label: 'Payment Recon', module: 'reports', group: 'Cash & Banking' },
    { id: 'cashbook', icon: Banknote, label: 'Cash Book', module: 'reports', group: 'Cash & Banking' },
    { id: 'bankfeed', icon: Banknote, label: 'Bank Feed', module: 'reports', group: 'Cash & Banking' },
    // Books
    { id: 'vouchers', icon: Calculator, label: 'Vouchers', module: 'reports', group: 'Accounting' },
    { id: 'coa', icon: Layers, label: 'Chart of Accounts', module: 'reports', group: 'Accounting' },
    { id: 'generalledger', icon: ScrollText, label: 'General Ledger', module: 'reports', group: 'Accounting' },
    { id: 'finbooks', icon: Landmark, label: 'Financial Books', module: 'reports', group: 'Accounting' },
    { id: 'budgets', icon: Target, label: 'Budgets & Control', module: 'reports', group: 'Accounting' },
    // Compliance
    { id: 'reports', icon: BarChart3, label: 'Reports', module: 'reports', group: 'Tax & Compliance' },
    { id: 'dataexport', icon: Download, label: 'Data export', module: 'reports', group: 'Tax & Compliance' },
    { id: 'servicerev', icon: BarChart3, label: 'Service revenue', module: 'reports', group: 'Tax & Compliance' },
    { id: 'filing', icon: BookOpen, label: 'GST Returns', module: 'gstReturns', group: 'Tax & Compliance' },
    { id: 'incometax', icon: Calculator, label: 'Income Tax', module: 'incomeTax', group: 'Tax & Compliance' },
    // HR
    { id: 'hrm', icon: Users, label: 'HRMS', module: 'dashboard', group: 'HR & Payroll' },
    // System — keep contiguous (Tasks before Notifications) so only ONE System group header
    { id: 'tasks', icon: CheckSquare, label: 'Tasks', module: 'dashboard', group: 'Administration' },
    { id: 'workflows', icon: CheckSquare, label: 'Workflow rules', module: 'dashboard', group: 'Administration' },
    { id: 'notifications', icon: Bell, label: 'Notifications', module: 'dashboard', group: 'Administration', onClick: () => setShowNotifs(true) },
    { id: 'darkmode', icon: Moon, label: 'Dark Mode', module: 'dashboard', group: 'Administration', onClick: () => setDarkMode(d => !d) },
    { id: 'controlpanel', icon: HardDrive, label: 'Control Panel', module: 'settings', group: 'Administration' },
    { id: 'activity-log', icon: FileText, label: 'Activity log', module: 'settings', group: 'Administration' },
    { id: 'system-health', icon: Activity, label: 'System health', module: 'settings', group: 'Administration' },
    { id: 'settings', icon: Settings, label: 'Settings', module: 'settings', group: 'Administration' },
    { id: 'guide', icon: HelpCircle, label: 'User Guide', module: 'dashboard', group: 'Administration' },
  ].filter(item => showIfModule(item.module));

  // Command palette actions — declared here (not earlier) because the deps
  // array references `navItems` and `handleNewInvoice`, which are consts.
  // Reading a const before its declaration triggers a Temporal Dead Zone
  // ReferenceError ("Cannot access 'X' before initialization") at runtime.
  const paletteActions = useMemo(() => {
    const acts = [
      { label: 'New Invoice', hint: 'Ctrl+N', category: 'action', run: () => { handleNewInvoice(); } },
    ];
    navItems.forEach(item => {
      if (item.id === 'new') return; // already covered above
      acts.push({ label: `Go to ${item.label}`, hint: '', category: 'nav', run: item.onClick || (() => setCurrentView(item.id)) });
    });
    acts.push({ label: 'Go to Settings', hint: '', category: 'nav', run: () => setCurrentView('settings') });
    acts.push({
      label: 'Go to Master data → Services',
      hint: '',
      category: 'nav',
      run: () => {
        try { sessionStorage.setItem('sd_master_tab', 'services'); } catch (_) {}
        setCurrentView('costcenters');
      },
    });
    acts.push({
      label: 'Settings → GST & e-Invoice',
      hint: '',
      category: 'nav',
      run: () => {
        try { sessionStorage.setItem('sd_settings_tab', 'gst-einvoice'); } catch (_) {}
        setCurrentView('settings');
      },
    });
    acts.push({ label: 'Toggle dark mode', hint: '', category: 'action', run: () => setDarkMode(d => !d) });
    acts.push({ label: 'Show keyboard shortcuts', hint: 'Ctrl+/', category: 'help', run: () => setShowShortcutsHelp(true) });
    if (updateInfo?.updateAvailable) {
      acts.push({ label: `View update — v${updateInfo.latest}`, hint: '', category: 'update', run: () => setShowUpdateModal(true) });
    }
    // v1.9.4 — cross-app search: invoices, clients, products
    // v1.10.5 — audit H24 fix. Prior code dispatched
    // `CustomEvent('fgsb-open-bill', { detail: b.id })` but no one
    // listened for it — selecting an invoice in the palette silently
    // dropped the ID and just landed on Dashboard. Now: reuse
    // handleEditInvoice() directly, which is already the canonical way
    // to open a bill for editing (works from Dashboard row-click too).
    searchCorpus.bills.forEach(b => {
      acts.push({
        label: `📄 ${b.invoiceNumber || 'INV-?'} — ${b.clientName || 'No client'}`,
        hint: b.invoiceDate ? new Date(b.invoiceDate).toLocaleDateString('en-IN') : '',
        category: 'invoice',
        run: () => handleEditInvoice(b),
      });
    });
    searchCorpus.clients.forEach(c => {
      acts.push({
        label: `👤 ${c.name} — client${c.gstin ? ' · GSTIN: ' + c.gstin : ''}`,
        hint: c.phone || c.email || '',
        category: 'client',
        run: () => setCurrentView('clients'),
      });
    });
    searchCorpus.products.forEach(p => {
      acts.push({
        label: `📦 ${p.name} — product${p.hsn ? ' · HSN: ' + p.hsn : ''}`,
        hint: (p.stock ?? 0) + ' in stock',
        category: 'product',
        run: () => { try { sessionStorage.setItem('sd_master_tab', 'services'); } catch (_) {} setCurrentView('costcenters'); },
      });
    });
    // Settings sections (jump to specific area)
    const settingsJumps = [
      'Company profile', 'Payment accounts', 'Print & PDF Settings', 'PDF Style Editor',
      'Business type presets', 'Section labels', 'Watermarks', 'Multi-copy print',
      'Digital signature', 'Company letterhead', 'Modules', 'Region preference',
      'Google Drive backup', 'App updates',
    ];
    settingsJumps.forEach(s => {
      acts.push({ label: `⚙️ Settings → ${s}`, hint: '', category: 'settings', run: () => setCurrentView('settings') });
    });
    return acts;
  }, [navItems, updateInfo, handleNewInvoice, searchCorpus]);

  const filteredPalette = paletteActions.filter(a =>
    !paletteQuery.trim() || a.label.toLowerCase().includes(paletteQuery.toLowerCase())
  );

  // Global keyboard shortcuts. Lives down here for the same TDZ reason —
  // the handler closes over `handleNewInvoice` which is declared above only.
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const tag = (e.target?.tagName || '').toLowerCase();
      const editable = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setShowPalette(p => !p);
        setPaletteQuery('');
        setPaletteIdx(0);
      } else if (e.key === '/') {
        e.preventDefault();
        setShowShortcutsHelp(s => !s);
      } else if ((e.key === 'n' || e.key === 'N') && !editable) {
        e.preventDefault();
        handleNewInvoice();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v1.9.4 — Accessibility hooks (v1.10.4/1.10.6 updated):
  //   1. Mirror `title` → `aria-label` on every icon button that lacks one.
  //      Runs on mount + via a MutationObserver when the DOM adds new
  //      icon buttons (bulk toolbars, modals, etc.). See M15.
  //   2. Global ESC handler for any open `.modal-overlay` — clicks the
  //      backdrop (which triggers the overlay's own close). No CSS
  //      class is added; the earlier `.esc-closable` idea was never
  //      implemented, comment cleaned up (audit L7).
  useEffect(() => {
    // v1.10.4 — audit M15. Prior code polled the DOM every 3 seconds
    // to mirror title→aria-label on new .icon-btn elements. Constant
    // idle-time work for a paper-thin accessibility win. Replaced with
    // a MutationObserver that fires ONLY when new buttons enter the
    // DOM. Existing buttons get the treatment once at mount.
    const mirrorTitleToAria = (root = document) => {
      root.querySelectorAll('button.icon-btn[title]:not([aria-label])').forEach(btn => {
        btn.setAttribute('aria-label', btn.getAttribute('title'));
      });
    };
    mirrorTitleToAria();
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {  // Element
              if (node.matches?.('button.icon-btn[title]:not([aria-label])')) {
                node.setAttribute('aria-label', node.getAttribute('title'));
              }
              mirrorTitleToAria(node);
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Global ESC → click the topmost modal-overlay (dismisses it).
    const onEsc = (e) => {
      if (e.key !== 'Escape') return;
      const overlays = Array.from(document.querySelectorAll('.modal-overlay'));
      const top = overlays[overlays.length - 1];
      if (!top) return;
      if (showPalette) return;
      top.click();
    };
    window.addEventListener('keydown', onEsc);
    return () => { observer.disconnect(); window.removeEventListener('keydown', onEsc); };
  }, [showPalette]);

  // Palette-only arrow / Enter / Esc nav. Filtered list dep keeps the
  // handler in sync with the user's current query.
  useEffect(() => {
    if (!showPalette) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); setShowPalette(false); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteIdx(i => Math.min(i + 1, filteredPalette.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const action = filteredPalette[paletteIdx];
        if (action) { action.run(); setShowPalette(false); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPalette, paletteIdx, filteredPalette]);

  if (serverDown) {
    return (
      <div className="server-down-overlay">
        <div className="server-down-modal">
          <FileText size={48} color="#3b82f6" />
          <h2>SD Dynamics Needs a Quick Start</h2>
          <p>
            Your data is <strong>100% safe</strong> on your computer — nothing is lost.
            The app just needs to be started once.
          </p>
          <a href="freegstbill://start" className="server-start-btn">
            Open SD Dynamics
          </a>
          <div className="server-down-steps">
            <p className="server-down-hint">Or start manually:</p>
            <ol>
              <li>Double-click <strong>SD Dynamics</strong> on your Desktop</li>
              <li>Or search <strong>"SD Dynamics"</strong> in Start Menu</li>
            </ol>
          </div>
          <p className="server-down-safe">All your invoices, clients, and data are safely stored on your computer. They are never deleted or shared.</p>
          <div className="server-down-waiting">
            <div className="server-down-spinner" />
            <span>Starting... this page will open automatically.</span>
          </div>
        </div>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <>
        <WelcomeGuide onComplete={(p) => {
          if (p) setProfile(p);
          setShowWelcome(false);
        }} />
        <ToastContainer />
        <ConfirmModalContainer />
      </>
    );
  }

  // v1.10.33 — "Finish setup" bottom-right pill. Shown when the user
  // hit Skip on the wizard (onboardingSkipped=true) so they can come
  // back later without hunting through Settings. Hidden after they
  // finish setup (finish() clears the flag) or if they explicitly said
  // "None of these — I'll configure manually".
  const showResumeSetupPill = (() => {
    try {
      const ps = getPrintSettings();
      return !showWizard && ps.onboardingComplete === true && ps.onboardingSkipped === true;
    } catch { return false; }
  })();

  if (appLockEnabled && !appUnlocked) {
    return (
      <PinLockGate
        onUnlock={() => { setUnlocked(true); lastActivityRef.current = Date.now(); }}
        autoLockMinutes={appLockPrefs.autoLockMinutes}
        autoLockEnabled={appLockPrefs.autoLockEnabled}
      />
    );
  }

  return (
    <div className={`app-layout${sidebarCollapsed && !sidebarHovered ? ' app-layout-sidebar-collapsed' : ''}`}>
      {showWizard && <SetupWizard onClose={() => setShowWizard(false)} />}
      {showResumeSetupPill && (
        <button type="button"
          onClick={() => setShowWizard(true)}
          title="Come back to the setup wizard — pick a business type, paper size, and language."
          style={{
            position: 'fixed', bottom: '1.25rem', right: '1.25rem', zIndex: 9998,
            padding: '0.6rem 1rem', borderRadius: 999,
            background: 'var(--primary)', color: '#fff', border: 'none',
            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(30,64,175,0.35), 0 2px 4px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
          ✨ Finish setup
        </button>
      )}
      {/* v1.10.66 (#59) — phone-only top bar with the menu button. CSS hides it
          on wider screens, where the sidebar is always shown. */}
      <div className="mobile-topbar">
        <button type="button" className="mobile-topbar-btn" onClick={() => setNavOpen(true)}
          aria-label="Open menu" aria-expanded={navOpen}>
          <Menu size={22} />
        </button>
        <span className="mobile-topbar-title">SD Dynamics</span>
        <span className="mobile-topbar-business">{profile?.businessName || ''}</span>
        <TopCreateMenu onNewInvoice={handleNewInvoice} />
      </div>
      {navOpen && <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <div
        className={`sidebar${navOpen ? ' sidebar-open' : ''}${sidebarCollapsed && !sidebarHovered && !navOpen ? ' sidebar-collapsed' : ''}${sidebarExpanded ? ' sidebar-expanded' : ''}`}
        onClick={closeNavAfterPick}
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
      >
        <div className="sidebar-header sidebar-brand">
          <div className="logo-wrapper sidebar-logo-animated" title="SD Dynamics" aria-hidden>
            <span className="brand-icon-mark">SD</span>
          </div>
          <div className="sidebar-brand-text">
            <h1 className="brand-name sidebar-title">{(typeof localStorage !== 'undefined' && localStorage.getItem('sd_brand_title')) || 'SD Dynamics'}</h1>
            <p className="sidebar-subtitle">{(typeof localStorage !== 'undefined' && localStorage.getItem('sd_brand_subtitle')) || 'Service ERP'}</p>
          </div>
          <button
            type="button"
            className="sidebar-pin-btn"
            title={sidebarCollapsed ? 'Keep sidebar open' : 'Auto-hide sidebar'}
            onClick={(e) => { e.stopPropagation(); toggleSidebarPin(); }}
            aria-label={sidebarCollapsed ? 'Pin sidebar open' : 'Auto-hide sidebar'}
          >
            <Menu size={16} />
          </button>
        </div>

        <div className="profile-switcher" ref={profileMenuRef} style={{ position: 'relative' }}>
          <div className="profile-switcher-row">
            <button
              className="profile-switcher-btn"
              onClick={() => allProfiles.length > 1 && setShowProfileMenu(v => !v)}
              title={allProfiles.length > 1 ? 'Switch business profile' : profile?.businessName || 'My Business'}
              style={{ cursor: allProfiles.length > 1 ? 'pointer' : 'default' }}
            >
              <Building2 size={14} />
              <span className="profile-switcher-name" title={profile?.businessName || 'My Business'}>Business</span>
              {allProfiles.length > 1 && <ChevronDown size={13} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
            </button>
            <button
              className="profile-switcher-edit"
              onClick={() => { setShowProfileMenu(false); setCurrentView('settings'); }}
              title="Edit business profile"
            >
              <Pencil size={13} />
            </button>
          </div>
          {showProfileMenu && (
            <div className="profile-switcher-menu">
              {allProfiles.map(bp => (
                <button
                  key={bp.id || bp.businessName}
                  className={`profile-switcher-item${bp.businessName?.trim().toLowerCase() === profile?.businessName?.trim().toLowerCase() ? ' active' : ''}`}
                  onClick={() => handleSwitchProfile(bp)}
                >
                  {bp.businessName}
                </button>
              ))}
              <button
                className="profile-switcher-item profile-switcher-manage"
                onClick={() => { setShowProfileMenu(false); setCurrentView('settings'); }}
              >
                Manage profiles...
              </button>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {(() => {
            // Grouped nav: collapsible sections; nested (New Invoice / Recurring) under parent
            const groups = [];
            let cur = null;
            navItems.forEach((item) => {
              const g = item.group || 'Overview';
              if (!cur || cur.name !== g) {
                cur = { name: g, items: [] };
                groups.push(cur);
              }
              cur.items.push(item);
            });
            return groups.map((grp) => {
              const open = expandedGroups[grp.name] !== false;
              return (
                <div key={grp.name} className="nav-group">
                  {grp.name !== 'Overview' && (
                    <button
                      type="button"
                      className={`nav-group-header${open ? ' open' : ''}`}
                      onClick={() => toggleNavGroup(grp.name)}
                      aria-expanded={open}
                      title={open ? ('Collapse ' + grp.name) : ('Expand ' + grp.name)}
                    >
                      <span className="nav-group-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        {(() => {
                          const GI = {
                            Sales: FileText,
                            'Sales & Receivables': FileText,
                            Purchase: ShoppingCart,
                            'Purchases & Expenses': ShoppingCart,
                            Work: ClipboardList,
                            Operations: ClipboardList,
                            Money: Banknote,
                            'Cash & Banking': Banknote,
                            Books: BookOpen,
                            Accounting: BookOpen,
                            Compliance: BarChart3,
                            'Tax & Compliance': BarChart3,
                            Reports: BarChart3,
                            'Reports & Analytics': BarChart3,
                            System: Settings,
                            Administration: Settings,
                            'Administration & Settings': Settings,
                            HR: Users,
                            Overview: Home,
                          };
                          const Ic = GI[grp.name];
                          return Ic ? <Ic size={14} strokeWidth={2} aria-hidden /> : null;
                        })()}
                        <span className="nav-group-text">{grp.name}</span>
                      </span>
                      <span className="nav-group-chevron">▸</span>
                    </button>
                  )}
                  {(open || grp.name === 'Overview') && grp.items.map((item) => {
                    const isNested = !!item.parent;
                    // Keep the invoice section visibly active when one of its child workflows is open.
                    const isInvoiceParentActive = item.id === 'invoices'
                      && ['new', 'recurring', 'payment-reminders'].includes(currentView);
                    const isActive = currentView === item.id || isInvoiceParentActive;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        className={`nav-btn ${isActive ? 'nav-btn-active' : ''}${isNested ? ' nav-btn-nested' : ''}`}
                        onClick={item.onClick || (() => setCurrentView(item.id))}
                        title={item.label}
                        style={item.id === 'notifications' && notifTotal > 0 ? { position: 'relative' } : undefined}
                      >
                        {item.id === 'darkmode'
                          ? (darkMode ? <Sun size={isNested ? 16 : 18} /> : <Moon size={isNested ? 16 : 18} />)
                          : <item.icon size={isNested ? 16 : 18} />}
                        <span className="nav-label">
                          {item.id === 'darkmode' ? (darkMode ? 'Light Mode' : 'Dark Mode') : item.label}
                        </span>
                        {item.id === 'notifications' && notifTotal > 0 && (
                          <span style={{
                            marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 5px', borderRadius: '9px',
                            background: 'var(--danger)', color: '#fff',
                            fontSize: '0.65rem', fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{notifTotal > 99 ? '99+' : notifTotal}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            });
          })()}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {/* Update-available banner — only shows when GitHub has a newer version
                AND the user hasn't already dismissed THIS specific version. New
                releases re-show the banner. Click to view notes + update. */}
            {updateBannerVisible && (
              <button
                className="nav-btn"
                onClick={() => setShowUpdateModal(true)}
                title={`v${updateInfo.latest} is available`}
                style={{
                  background: 'var(--info-bg)',
                  borderColor: 'var(--info-border)',
                  color: 'var(--info-text)',
                  fontWeight: 600,
                  position: 'relative',
                }}
              >
                <Download size={18} />
                <span style={{ flex: 1, textAlign: 'left' }}>
                  Update to v{updateInfo.latest}
                </span>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,0.25)',
                  flexShrink: 0,
                }} />
              </button>
            )}
            {/* System items (Notifications, Dark Mode, Control Panel, Settings)
                live once under the SYSTEM group in navItems — do not duplicate here. */}
            <div className={`server-status server-status-${serverStatus}`}>
              <span className="server-status-dot" />
              {serverStatus === 'online' ? 'App Ready' : serverStatus === 'offline' ? 'App Not Running' : 'Connecting...'}
            </div>
          </div>
        </nav>
      </div>

      {showInstallBanner && (
        <div className="pwa-install-banner">
          <Download size={18} />
          <span>
            <strong>Install as Desktop App</strong> — own icon, no browser chrome. Requires Chrome/Edge on this same URL after <code>npm run build</code> + server (localhost or HTTPS). If Install stays grey, open DevTools → Application → Manifest.
          </span>
          <button className="pwa-install-btn" onClick={handleInstallPWA}>Install App</button>
          <button className="pwa-dismiss-btn" onClick={dismissInstallBanner} title="Remind me later (re-shows in 14 days)"><X size={16} /></button>
        </div>
      )}
      <div className="main-content">
        {(currentView === 'dashboard' || currentView === 'invoices') && (
          <Dashboard
            listMode={currentView === 'invoices'}
            onNew={handleNewInvoice}
            onEdit={handleEditInvoice}
            onDuplicate={handleDuplicateInvoice}
            onConvert={handleConvertToInvoice}
            onOpenProducts={() => { try { sessionStorage.setItem('sd_master_tab', 'services'); } catch (_) {} setCurrentView('costcenters'); }}
            activeProfile={profile}
            onOpenSearch={() => setShowPalette(true)}
            onOpenNotifs={() => setShowNotifs(true)}
            darkMode={darkMode}
            onToggleTheme={() => setDarkMode(d => !d)}
          />
        )}
        {currentView === 'new' && (
          <InvoiceGenerator
            onBack={() => { setEditingBill(null); setCurrentView('invoices'); }}
            profile={profile} editingBill={editingBill}
          />
        )}
        {/* v1.10.4 — All lazy views under one Suspense boundary. Only the
             matched view's chunk actually loads; others stay unfetched. */}
        <Suspense fallback={<ViewLoading />}>
        {currentView === 'vendors' && (
          <VendorsView key={businessKey} />
        )}
        {currentView === 'clients' && (
          <ClientsView onNew={handleNewInvoice} onEdit={handleEditInvoice} onDuplicate={handleDuplicateInvoice} />
        )}
        {currentView === 'inventory' && (
          <InventoryView />
        )}
        {/* v1.10.66 (#64 item 1) — `key={businessKey}` remounts these screens
            when the business changes. Each reads the business once when it
            opens, so a switch left the previous company's records on screen,
            and a record added straight after switching was saved under the OLD
            business. Remounting makes every one of them read it again. */}
        {currentView === 'expenses' && (
          <ExpenseTracker key={businessKey} />
        )}
        {currentView === 'purchases' && (
          <PurchaseBills key={businessKey} />
        )}
        {currentView === 'workorders' && (
          <WorkOrdersView key={businessKey} onConvertToInvoice={handleWoConvertToInvoice} onOpenInvoice={handleEditInvoice} />
        )}
        {currentView === 'purchaseorders' && (
          <PurchaseOrdersView key={businessKey} />
        )}
        {currentView === 'cashbook' && (
          <CashBookView key={businessKey} />
        )}
        {currentView === 'costcenters' && (
          <CostCentersView key={businessKey} />
        )}
        {currentView === 'coa' && (
          <ChartOfAccountsView key={businessKey} />
        )}
        {currentView === 'generalledger' && (
          <GeneralLedgerView key={businessKey} />
        )}
        {currentView === 'servicerev' && (
          <Suspense fallback={<ViewLoading />}><ServiceRevenueReport key={businessKey} /></Suspense>
        )}
        {currentView === 'finbooks' && (
          <Suspense fallback={<ViewLoading />}><FinancialBooksView key={businessKey} /></Suspense>
        )}
        {currentView === 'budgets' && (
          <Suspense fallback={<ViewLoading />}><BudgetSettingsView key={businessKey} /></Suspense>
        )}
        {currentView === 'payrecon' && (
          <PaymentReconView key={businessKey} />
        )}
        {currentView === 'bankfeed' && (
          <Suspense fallback={<ViewLoading />}><BankFeedView key={businessKey} /></Suspense>
        )}
        {currentView === 'vouchers' && (
          <Suspense fallback={<ViewLoading />}><VoucherEntryView key={businessKey} /></Suspense>
        )}
        {currentView === 'recurring' && (
          <RecurringInvoices key={businessKey} onEdit={handleEditInvoice} />
        )}
        {currentView === 'receipts' && (
          <ReceiptVoucher key={businessKey} />
        )}
        {currentView === 'reports' && (
          <ReportsView key={businessKey} />
        )}
        {currentView === 'dataexport' && (
          <Suspense fallback={<ViewLoading />}><DataExportView key={businessKey} /></Suspense>
        )}
        {currentView === 'filing' && (
          <GSTReturns key={businessKey} />
        )}
        {currentView === 'incometax' && (
          <IncomeTax key={businessKey} />
        )}
        {currentView === 'guide' && (
          <UserGuideView />
        )}
        {currentView === 'workflows' && (
          <Suspense fallback={<ViewLoading />}><WorkflowRulesView key={businessKey} /></Suspense>
        )}
        {currentView === 'tasks' ? (
            <Suspense fallback={null}><TasksView /></Suspense>
          ) : currentView === 'hrm' ? <HrmView />
        : currentView === 'activity-log' ? <ActivityLogView />
        : currentView === 'system-health' ? (
          <Suspense fallback={<ViewLoading />}><SystemHealthView /></Suspense>
        )
        : currentView === 'payment-reminders' ? (
          <Suspense fallback={<ViewLoading />}><PaymentRemindersView /></Suspense>
        )
        : currentView === 'einvoice' ? (
          <Suspense fallback={<ViewLoading />}><EinvoiceSettingsPanel /></Suspense>
        )
        : currentView === 'chart-settings' ? (
          <SettingsView onSaved={(p) => setProfile(p)} />
        ) : currentView === 'settings' && (
          <SettingsView onSaved={(p) => setProfile(p)} />
        )}
        {currentView === 'controlpanel' && (
          <ControlPanel />
        )}
        </Suspense>
      </div>

      {/* Update modal — release notes + Export-backup-first nudge + Update Now */}
      {/* Notification popover — rendered as a click-out modal so it works on
          tablets too. Grouped by category with a navigate-to button per group. */}
      {showNotifs && (
        <div className="modal-overlay" onClick={() => setShowNotifs(false)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Notifications</h3>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {/* v1.10.62 (#53) — clears everything currently shown. Each
                    section remembers exactly WHAT was cleared, so a genuinely
                    new overdue invoice or a different product running low
                    brings the alert back by itself. */}
                {dismissableCount > 0 && (
                  <button
                    type="button"
                    className="btn"
                    onClick={markAllNotifsRead}
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                    title="Clear these notifications. They return if something new happens.">
                    Mark all as read
                  </button>
                )}
                <button className="icon-btn" onClick={() => setShowNotifs(false)} title="Close"><X size={18} /></button>
              </span>
            </div>
            {notifTotal === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0', margin: 0 }}>
                All clear ✨ — nothing needs your attention right now.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {isLive('autoFire') && (
                  <button type="button" className="notice notice-info" onClick={() => { setShowNotifs(false); setCurrentView('dashboard'); }} style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}>
                    <span className="notice-icon">🔁</span>
                    <div style={{ flex: 1 }}>
                      <strong>{notifications.autoFire.count} recurring invoice{notifications.autoFire.count !== 1 ? 's' : ''} auto-generated today</strong>
                      <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '0.2rem' }}>
                        Check the Dashboard for the new bills · review and download PDFs as needed
                      </div>
                    </div>
                  </button>
                )}
                {isLive('overdue') && (
                  <button type="button" className="notice notice-danger" onClick={() => { setShowNotifs(false); setCurrentView('dashboard'); }} style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}>
                    <span className="notice-icon">⚠</span>
                    <div style={{ flex: 1 }}>
                      <strong>{notifications.overdue.length} overdue invoice{notifications.overdue.length !== 1 ? 's' : ''}</strong>
                      <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '0.2rem' }}>
                        {notifications.overdue.slice(0, 3).map(b => b.invoiceNumber).join(' · ')}{notifications.overdue.length > 3 ? ` · +${notifications.overdue.length - 3} more` : ''}
                      </div>
                    </div>
                  </button>
                )}
                {isLive('dueSoon') && (
                  <button type="button" className="notice notice-warn" onClick={() => { setShowNotifs(false); setCurrentView('dashboard'); }} style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}>
                    <span className="notice-icon">⏰</span>
                    <div style={{ flex: 1 }}>
                      <strong>{notifications.dueSoon.length} invoice{notifications.dueSoon.length !== 1 ? 's' : ''} due in next 3 days</strong>
                      <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '0.2rem' }}>
                        {notifications.dueSoon.slice(0, 3).map(b => `${b.invoiceNumber} (${b.clientName})`).join(' · ')}
                      </div>
                    </div>
                  </button>
                )}
                {isLive('filings') && (
                  <button type="button" className="notice notice-info" onClick={() => { setShowNotifs(false); setCurrentView('filing'); }} style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}>
                    <span className="notice-icon">📋</span>
                    <div style={{ flex: 1 }}>
                      <strong>{notifications.filings.length} GST filing{notifications.filings.length !== 1 ? 's' : ''} due in next 10 days</strong>
                      <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '0.2rem' }}>
                        {notifications.filings.slice(0, 3).map(f => `${f.label} (${f.daysAway === 0 ? 'today' : f.daysAway + 'd'})`).join(' · ')}
                      </div>
                    </div>
                  </button>
                )}
                {isLive('lowStock') && (
                  <button type="button" className="notice notice-note" onClick={() => { setShowNotifs(false); try { sessionStorage.setItem('sd_master_tab', 'services'); } catch (_) {} setCurrentView('costcenters'); }} style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}>
                    <span className="notice-icon">📦</span>
                    <div style={{ flex: 1 }}>
                      <strong>{notifications.lowStock.length} product{notifications.lowStock.length !== 1 ? 's' : ''} low on stock</strong>
                      <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '0.2rem' }}>
                        {notifications.lowStock.slice(0, 3).map(p => `${p.name} (${p.stock} left)`).join(' · ')}
                      </div>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Command palette — Ctrl/Cmd+K. Spotlight-style: type to filter actions,
          ↑/↓ to navigate, Enter to run, Esc to close. */}
      {showPalette && (
        <div className="modal-overlay" onClick={() => setShowPalette(false)}>
          <div className="modal-content" style={{ maxWidth: '520px', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input autoFocus type="text" placeholder="Type a command or page name…"
                value={paletteQuery}
                onChange={e => { setPaletteQuery(e.target.value); setPaletteIdx(0); }}
                className="form-input" style={{ border: 0, background: 'transparent', flex: 1, fontSize: '0.95rem' }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Esc</span>
            </div>
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {filteredPalette.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.25rem', margin: 0, fontSize: '0.85rem' }}>
                  Nothing matches "{paletteQuery}".
                </p>
              )}
              {filteredPalette.map((a, i) => (
                <button key={a.label} type="button"
                  onClick={() => { a.run(); setShowPalette(false); }}
                  onMouseEnter={() => setPaletteIdx(i)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '0.6rem 1rem', border: 0, cursor: 'pointer',
                    background: i === paletteIdx ? 'var(--bg-tertiary)' : 'transparent',
                    color: 'var(--text-primary)', textAlign: 'left', fontSize: '0.88rem',
                  }}>
                  <span>{a.label}</span>
                  {a.hint && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.hint}</span>}
                </button>
              ))}
            </div>
            <div style={{ padding: '0.4rem 1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><Command size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Ctrl+K to toggle · ↑↓ navigate · Enter run</span>
              <button type="button" onClick={() => { setShowPalette(false); setShowShortcutsHelp(true); }} style={{ background: 'none', border: 0, color: 'var(--primary)', cursor: 'pointer', fontSize: '0.7rem' }}>
                All shortcuts (Ctrl+/)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard-shortcuts help — Ctrl/Cmd+/. Single-pane reference. */}
      {showShortcutsHelp && (
        <div className="modal-overlay" onClick={() => setShowShortcutsHelp(false)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Keyboard Shortcuts</h3>
              <button className="icon-btn" onClick={() => setShowShortcutsHelp(false)} title="Close"><X size={18} /></button>
            </div>
            <table className="kv-list">
              <tbody>
                <tr><td><kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>K</kbd></td><td>Open command palette (jump to any page)</td></tr>
                <tr><td><kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>N</kbd></td><td>New invoice</td></tr>
                <tr><td><kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>S</kbd></td><td>Save current invoice (when on the invoice form)</td></tr>
                <tr><td><kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>P</kbd></td><td>Download PDF (when on the invoice form)</td></tr>
                <tr><td><kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>/</kbd></td><td>Toggle this help</td></tr>
                <tr><td><kbd>Esc</kbd></td><td>Close any open modal</td></tr>
              </tbody>
            </table>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.75rem', marginBottom: 0 }}>
              On macOS, use <kbd>⌘</kbd> instead of <kbd>Ctrl</kbd>.
            </p>
          </div>
        </div>
      )}

      {showUpdateModal && updateInfo && (
        <div className="modal-overlay" onClick={() => setShowUpdateModal(false)}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div>
                <h3 className="section-title" style={{ marginTop: 0, marginBottom: '0.25rem' }}>
                  Update available — v{updateInfo.latest}
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  You're on v{updateInfo.current}
                  {updateInfo.releasePublishedAt && ` · released ${new Date(updateInfo.releasePublishedAt).toLocaleDateString()}`}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setShowUpdateModal(false)} title="Close"><X size={18} /></button>
            </div>

            {/* Data-safety reassurance — explicit, prominent. Same .notice-info style
                as the Data Management privacy card so users learn one visual pattern. */}
            <div className="notice notice-info" style={{ marginBottom: '0.85rem' }}>
              <span className="notice-icon">🔒</span>
              <div>
                <strong>Your data is safe.</strong> Updates only refresh the app code and dependencies — your <code>data/</code> folder (invoices, clients, products, settings) and <code>Saved Invoices/</code> PDF archive are <strong>never touched</strong>. The updater pulls the latest source from GitHub and rebuilds, then restarts.
              </div>
            </div>

            {/* Release notes */}
            <div className="surface-card" style={{ maxHeight: '320px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.82rem', lineHeight: 1.55, marginBottom: '0.85rem' }}>
              {updateInfo.releaseNotes || (
                <span style={{ color: 'var(--text-muted)' }}>
                  No release notes available — see the full changelog at{' '}
                  <a href={updateInfo.releaseUrl || 'https://github.com/veeranki97/Bharatbill2/releases'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>GitHub Releases</a>.
                </span>
              )}
            </div>

            {/* Suggested pre-update step: export a backup */}
            <div className="notice notice-warn" style={{ marginBottom: '1rem' }}>
              <span className="notice-icon">💡</span>
              <div>
                <strong>Recommended:</strong> export a backup before updating, just in case. <button type="button" className="btn-link" onClick={() => { setShowUpdateModal(false); setCurrentView('settings'); }} style={{ background: 'none', border: 0, color: 'var(--primary)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', padding: 0 }}>Open Settings → Data Management</button> and click <em>Export Backup…</em>.
              </div>
            </div>

            <div className="flex gap-2 justify-end" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={dismissUpdate}>
                Skip this version
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowUpdateModal(false)}>
                Remind me later
              </button>
              {updateInfo.releaseUrl && (
                <a href={updateInfo.releaseUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                  View on GitHub
                </a>
              )}
              <a href="freegstbill-update://run" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                <Download size={16} /> Update Now
              </a>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.6rem', marginBottom: 0 }}>
              <em>Update Now</em> launches <code>Update FreeGSTBill.bat</code> in a window. Wait for it to finish (~30 seconds), then refresh this page.
            </p>
          </div>
        </div>
      )}

      <ToastContainer />
      <ConfirmModalContainer />
    </div>
  );
}

export default App;
