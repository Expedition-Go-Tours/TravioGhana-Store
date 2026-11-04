import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import ConsentGatedAnalytics from './components/ConsentGatedAnalytics'
import './index.css'
import './i18n/config'
import { queryClient } from './lib/queryClient'
import { installChunkReloadGuard } from './lib/chunkReloadGuard'
import { initGoogleAnalytics } from './lib/googleAnalytics'
import { CurrencyProvider } from './contexts/CurrencyContext'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'

// A freshly deployed SPA may drop hashed chunks that an already-open tab still
// references. Recover by reloading so the tab picks up the new index.html
// manifest. See src/lib/chunkReloadGuard.ts — in particular why the handler
// must not call preventDefault() unless it actually reloads.
installChunkReloadGuard()

// Apply the visitor's Google Analytics consent and follow later changes. The
// tag itself is static in index.html — see src/lib/googleAnalytics.ts for why
// it cannot sit behind a loader.
initGoogleAnalytics()

// Service worker: precaches the built assets so the installed app opens
// offline. autoUpdate activates a new build's worker in the background — the
// running page keeps the code it already loaded until the next navigation, and
// installChunkReloadGuard (above) covers the one visible symptom of an update
// landing mid-session. Skipped in dev and behind the VITE_ENABLE_PWA=0 kill
// switch (the worker itself then unregisters; see vite.config.ts).
if (import.meta.env.PROD && import.meta.env.VITE_ENABLE_PWA !== '0') {
  registerSW({ immediate: true })
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
          {/* Vercel Analytics behind the analytics consent, like GA4. */}
          <ConsentGatedAnalytics />
        </CurrencyProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>,
)
