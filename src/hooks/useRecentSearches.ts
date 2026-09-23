import { useState, useCallback, useEffect } from 'react'
import { readGated, writeGated } from '../lib/consentGatedStorage'

export interface RecentSearch {
  slug: string
  title: string
  type: 'destination' | 'tour'
  image?: string
  /**
   * Region of the searched thing (city/town/attraction/tour), so re-selecting a
   * recent entry personalizes the homepage exactly like the live suggestion did.
   */
  region?: string
  /** Legacy: canonical city, kept so entries already in localStorage still work. */
  city?: string
}

const STORAGE_KEY = 'recent-searches'
const MAX_ITEMS = 5

function load(): RecentSearch[] {
  try {
    const raw = readGated(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RecentSearch[]
  } catch {
    return []
  }
}

function save(items: RecentSearch[]) {
  try {
    writeGated(STORAGE_KEY, JSON.stringify(items))
  } catch { /* quota exceeded etc */ }
}

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(load)

  useEffect(() => {
    save(recentSearches)
  }, [recentSearches])

  const addSearch = useCallback((item: RecentSearch) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((r) => r.slug !== item.slug)
      return [item, ...filtered].slice(0, MAX_ITEMS)
    })
  }, [])

  const removeSearch = useCallback((slug: string) => {
    setRecentSearches((prev) => prev.filter((r) => r.slug !== slug))
  }, [])

  const clearAll = useCallback(() => {
    setRecentSearches([])
  }, [])

  return { recentSearches, addSearch, removeSearch, clearAll }
}
