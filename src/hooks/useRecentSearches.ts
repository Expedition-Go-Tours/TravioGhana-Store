import { useState, useCallback, useEffect } from 'react'

export interface RecentSearch {
  slug: string
  title: string
  type: 'destination' | 'tour'
}

const STORAGE_KEY = 'recent-searches'
const MAX_ITEMS = 5

function load(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RecentSearch[]
  } catch {
    return []
  }
}

function save(items: RecentSearch[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
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
