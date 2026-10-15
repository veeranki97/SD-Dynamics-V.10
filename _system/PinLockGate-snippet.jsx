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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: p }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setErr('Incorrect PIN');
        setPin('');
        setBusy(false);
        return;
      }
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
