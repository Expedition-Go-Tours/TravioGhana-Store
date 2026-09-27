import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import './i18n/config'
import { queryClient } from './lib/queryClient'
import { installChunkReloadGuard } from './lib/chunkReloadGuard'
import { CurrencyProvider } from './contexts/CurrencyContext'
import App from './App.tsx'

// A freshly deployed SPA may drop hashed chunks that an already-open tab still
// references. Recover by reloading so the tab picks up the new index.html
// manifest. See src/lib/chunkReloadGuard.ts — in particular why the handler
// must not call preventDefault() unless it actually reloads.
installChunkReloadGuard()

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
