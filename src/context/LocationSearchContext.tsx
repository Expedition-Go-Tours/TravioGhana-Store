import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react'

export interface LocationSearchData {
  currentLocation: string | null
  previousLocations: string[]
}

interface LocationSearchContextValue extends LocationSearchData {
  setLocation: (city: string) => void
  resetLocation: () => void
  hasActiveSearch: boolean
}

const LocationSearchContext = createContext<LocationSearchContextValue | null>(null)

const STORAGE_KEY = 'expedition_go_location_search'

function loadStorage(): LocationSearchData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        currentLocation: parsed.currentLocation ?? null,
        previousLocations: Array.isArray(parsed.previousLocations) ? parsed.previousLocations.slice(0, 2) : [],
      }
    }
  } catch { /* corrupt storage */ }
  return { currentLocation: null, previousLocations: [] }
}

export function LocationSearchProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LocationSearchData>(loadStorage)
  const dataRef = useRef(data)

  useEffect(() => {
    dataRef.current = data
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  const setLocation = useCallback((city: string) => {
    setData(prev => {
      const normalized = city.trim()
      if (!normalized) return prev
      // No-op if same as current
      if (prev.currentLocation?.toLowerCase() === normalized.toLowerCase()) return prev

      // Shift current to history front, deduplicate
      const newPrevious = prev.currentLocation
        ? [
            prev.currentLocation,
            ...prev.previousLocations.filter(
              p => p.toLowerCase() !== normalized.toLowerCase() && p.toLowerCase() !== prev.currentLocation!.toLowerCase(),
            ),
          ].slice(0, 2)
        : prev.previousLocations

      return { currentLocation: normalized, previousLocations: newPrevious }
    })
  }, [])

  const resetLocation = useCallback(() => {
    setData({ currentLocation: null, previousLocations: [] })
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  // Memoize value to prevent unnecessary re-renders of consumers
  const value = useMemo(() => ({
    currentLocation: data.currentLocation,
    previousLocations: data.previousLocations,
    setLocation,
    resetLocation,
    hasActiveSearch: data.currentLocation !== null,
  }), [data.currentLocation, data.previousLocations, setLocation, resetLocation])

  return (
    <LocationSearchContext.Provider value={value}>
      {children}
    </LocationSearchContext.Provider>
  )
}

export function useLocationSearch(): LocationSearchContextValue {
  const ctx = useContext(LocationSearchContext)
  if (!ctx) throw new Error('useLocationSearch must be used within a LocationSearchProvider')
  return ctx
}
