import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'

export interface CurrencyInfo {
  code: string
  symbol: string
  locale: string
  decimals: number
  label: string
}

export const availableCurrencies: CurrencyInfo[] = [
  { code: 'USD', symbol: '$', locale: 'en-US', decimals: 2, label: 'US Dollar' },
  { code: 'EUR', symbol: '€', locale: 'de-DE', decimals: 2, label: 'Euro' },
  { code: 'GBP', symbol: '£', locale: 'en-GB', decimals: 2, label: 'British Pound' },
  { code: 'JPY', symbol: '¥', locale: 'ja-JP', decimals: 0, label: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', locale: 'en-AU', decimals: 2, label: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', locale: 'en-CA', decimals: 2, label: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'CHF', locale: 'de-CH', decimals: 2, label: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', locale: 'zh-CN', decimals: 2, label: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', locale: 'en-IN', decimals: 2, label: 'Indian Rupee' },
  { code: 'SGD', symbol: 'S$', locale: 'en-SG', decimals: 2, label: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', locale: 'en-HK', decimals: 2, label: 'Hong Kong Dollar' },
  { code: 'THB', symbol: '฿', locale: 'en-TH', decimals: 2, label: 'Thai Baht' },
  { code: 'GHS', symbol: '₵', locale: 'en-GH', decimals: 2, label: 'Ghana Cedi' },
  { code: 'NGN', symbol: '₦', locale: 'en-NG', decimals: 2, label: 'Nigerian Naira' },
]

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 151.50,
  AUD: 1.53,
  CAD: 1.37,
  CHF: 0.88,
  CNY: 7.24,
  INR: 83.50,
  SGD: 1.35,
  HKD: 7.82,
  THB: 36.50,
  GHS: 15.50,
  NGN: 1500,
}

const CACHE_KEY = 'eg_currency_rates'
const CACHE_TTL = 24 * 60 * 60 * 1000

const STORAGE_KEY = 'eg_currency'

function getCurrencyInfo(code: string): CurrencyInfo {
  return availableCurrencies.find((c) => c.code === code) ?? availableCurrencies[0]
}

interface CachedRates {
  rates: Record<string, number>
  timestamp: number
}

interface CurrencyContextValue {
  currency: CurrencyInfo
  setCurrency: (code: string) => void
  convertPrice: (usdPrice: number) => number
  formatPrice: (usdPrice: number) => string
  loading: boolean
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencyCode, setCurrencyCode] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'USD' } catch { return 'USD' }
  })
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  useEffect(() => {
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, currencyCode) } catch { /* noop */ }
  }, [currencyCode])

  useEffect(() => {
    let cancelled = false

    async function fetchRates() {
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const parsed: CachedRates = JSON.parse(cached)
          if (Date.now() - parsed.timestamp < CACHE_TTL) {
            if (!cancelled) {
              setRates(parsed.rates)
              setLoading(false)
            }
            return
          }
        }

        const res = await fetch('https://open.er-api.com/v6/latest/USD')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        if (!cancelled) {
          const apiRates: Record<string, number> = { USD: 1, ...data.rates }
          setRates(apiRates)
          setLoading(false)

          const toCache: CachedRates = { rates: apiRates, timestamp: Date.now() }
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(toCache)) } catch { /* noop */ }
        }
      } catch {
        if (!cancelled) {
          setRates(FALLBACK_RATES)
          setLoading(false)
        }
      }
    }

    fetchRates()
    return () => { cancelled = true }
  }, [])

  const convertPrice = useCallback(
    (usdPrice: number) => {
      const rate = rates[currencyCode] ?? 1
      return usdPrice * rate
    },
    [currencyCode, rates]
  )

  const formatPrice = useCallback(
    (usdPrice: number) => {
      const info = getCurrencyInfo(currencyCode)
      const converted = convertPrice(usdPrice)
      try {
        return new Intl.NumberFormat(info.locale, {
          style: 'currency',
          currency: currencyCode,
          minimumFractionDigits: info.decimals,
          maximumFractionDigits: info.decimals,
        }).format(converted)
      } catch {
        return `${info.symbol}${converted.toFixed(info.decimals)}`
      }
    },
    [currencyCode, convertPrice]
  )

  const setCurrency = useCallback((code: string) => {
    setCurrencyCode(code)
  }, [])

  return (
    <CurrencyContext.Provider
      value={{
        currency: getCurrencyInfo(currencyCode),
        setCurrency,
        convertPrice,
        formatPrice,
        loading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}
