import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import './i18n/config'
import { queryClient } from './lib/queryClient'
import { CurrencyProvider } from './contexts/CurrencyContext'
import App from './App.tsx'

// A freshly deployed SPA may drop hashed chunks that an already-open tab still
// references. Vite emits `vite:preloadError` when it can't fetch one of those
// chunks — instead of stranding the user on a crashed route, reload once so
// they pick up the new index.html manifest. Guarded so it can never loop.
if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
  const CHUNK_RELOAD_KEY = 'expedition.chunkReloaded'
  window.addEventListener('vite:preloadError', ((event: Event) => {
    ;(event as { preventDefault?: () => void }).preventDefault?.()
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
    } catch {
      /* storage unavailable — fall through to a plain reload */
    }
    window.location.reload()
  }) as EventListener)
}

// Light, app-wide map warm-up after first paint was removed: fetching the
// ~250 KB tile style JSON + worker on every homepage load competes with LCP on
// mobile data and most visitors never open a map. `index.html` keeps the
// preconnect, and the full warm-up (style + worker + engine) now runs only on
// booking intent (see BookingWidget → preloadMapEngine).

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <CurrencyProvider>
          <App />
        </CurrencyProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>,
)
