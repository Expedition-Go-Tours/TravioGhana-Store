import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'

interface SearchInputContextValue {
  searchValue: string
  setSearchValue: (v: string) => void
}

const SearchInputContext = createContext<SearchInputContextValue | null>(null)

export function SearchInputProvider({ children }: { children: ReactNode }) {
  const [searchValue, setSearchValue] = useState('')

  const value = useMemo(() => ({ searchValue, setSearchValue }), [searchValue])

  return (
    <SearchInputContext.Provider value={value}>
      {children}
    </SearchInputContext.Provider>
  )
}

export function useSearchInput(): SearchInputContextValue {
  const ctx = useContext(SearchInputContext)
  if (!ctx) throw new Error('useSearchInput must be used within a SearchInputProvider')
  return ctx
}
