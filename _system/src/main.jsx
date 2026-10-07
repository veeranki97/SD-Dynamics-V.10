import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'

function AppErrorBoundary({ children }) {
  // Minimal class-free boundary via state in a small wrapper is hard without class —
  // use window error for blank-page recovery tip
  return children
}

window.addEventListener('error', (ev) => {
  console.error('[App crash]', ev.error || ev.message)
})
window.addEventListener('unhandledrejection', (ev) => {
  console.error('[App rejection]', ev.reason)
})
import './index.css'
import './styles/sidebar-autohide.css'

const updateSW = registerSW({
  onNeedRefresh() {
    console.info('[PWA] New version available — applying on next idle / blur')
    const apply = () => {
      try { updateSW(true) } catch { /* ignore */ }
    }
    const onBlur = () => { apply(); window.removeEventListener('blur', onBlur) }
    window.addEventListener('blur', onBlur)
    setTimeout(apply, 5 * 60 * 1000)
  },
  onOfflineReady() {
    console.info('[PWA] App ready to work offline')
  },
})

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(reg => {
    if (!reg) return
    if (reg.waiting) {
      try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }) } catch { /* ignore */ }
    }
    let alreadyReloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (alreadyReloaded) return
      alreadyReloaded = true
      window.location.reload()
    })
  }).catch(() => {})
  let chunkReloadFired = false
  window.addEventListener('error', (e) => {
    const msg = String(e?.message || e?.error?.message || '')
    if (!chunkReloadFired && /dynamically imported module|Loading chunk|Failed to fetch dynamically/i.test(msg)) {
      chunkReloadFired = true
      setTimeout(() => window.location.reload(), 200)
    }
  })
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String(e?.reason?.message || e?.reason || '')
    if (!chunkReloadFired && /dynamically imported module|Loading chunk|Failed to fetch dynamically/i.test(msg)) {
      chunkReloadFired = true
      setTimeout(() => window.location.reload(), 200)
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
