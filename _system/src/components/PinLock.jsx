import { useState, useEffect } from 'react';

const PIN_KEY = 'sd_app_pin';
const IDLE_KEY = 'sd_pin_idle_min';

export function getPinSettings() {
  try {
    return {
      pin: localStorage.getItem(PIN_KEY) || '',
      idleMin: Number(localStorage.getItem(IDLE_KEY) || 0) || 0,
    };
  } catch {
    return { pin: '', idleMin: 0 };
  }
}

export function savePinSettings({ pin, idleMin }) {
  try {
    if (pin) localStorage.setItem(PIN_KEY, String(pin).slice(0, 4));
    else localStorage.removeItem(PIN_KEY);
    localStorage.setItem(IDLE_KEY, String(Number(idleMin) || 0));
  } catch { /* */ }
}

/** Full-screen lock overlay when PIN set and idle/locked. */
export default function PinLock({ children }) {
  const [locked, setLocked] = useState(false);
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');
  const { pin, idleMin } = getPinSettings();

  useEffect(() => {
    if (!pin || pin.length < 4) return undefined;
    let timer;
    const bump = () => {
      clearTimeout(timer);
      if (idleMin > 0) {
        timer = setTimeout(() => setLocked(true), idleMin * 60 * 1000);
      }
    };
    const evts = ['mousemove', 'keydown', 'click', 'touchstart'];
    evts.forEach((e) => window.addEventListener(e, bump));
    bump();
    return () => {
      clearTimeout(timer);
      evts.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [pin, idleMin]);

  if (!pin || pin.length < 4 || !locked) return children;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 320, textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 8px' }}>SD Dynamics locked</h2>
        <p style={{ fontSize: 13, color: '#64748b' }}>Enter 4-digit PIN</p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
          style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center', width: '100%', padding: 10, marginBottom: 12 }}
        />
        {err && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{err}</div>}
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={() => {
            if (input === pin) { setLocked(false); setInput(''); setErr(''); }
            else setErr('Incorrect PIN');
          }}
        >
          Unlock
        </button>
      </div>
    </div>
  );
}
