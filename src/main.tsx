import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import 'flag-icons/css/flag-icons.min.css'
import './i18n/config'
import { queryClient } from './lib/queryClient'
import { CurrencyProvider } from './contexts/CurrencyContext'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        <App />
      </CurrencyProvider>
    </QueryClientProvider>
  </StrictMode>,
)
