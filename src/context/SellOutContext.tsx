import { createContext, useContext, useMemo, type ReactNode } from 'react'

interface SellOutContextValue {
  isLikelyToSellOut: (input: { id?: string; title: string }) => boolean
}

const SellOutContext = createContext<SellOutContextValue | null>(null)

// The Continue Planning items store a synthetic id (btoa(title|location)),
// so id membership alone can't cover them — fall back to a normalized title
// match against the homepage sell-out list.
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function SellOutProvider({ tours, children }: { tours: { id: string; title: string }[]; children: ReactNode }) {
  const value = useMemo<SellOutContextValue>(() => {
    const ids = new Set<string>()
    const titles = new Set<string>()
    for (const t of tours) {
      if (t.id) ids.add(t.id)
      if (t.title) titles.add(normalizeTitle(t.title))
    }
    return {
      isLikelyToSellOut: ({ id, title }) =>
        (!!id && ids.has(id)) || (!!title && titles.has(normalizeTitle(title))),
    }
  }, [tours])

  return <SellOutContext.Provider value={value}>{children}</SellOutContext.Provider>
}

// Defaults to a no-op when no provider is mounted — TourCard also renders on
// pages outside the homepage (search results, all tours, tour detail), where
// there is no sell-out list to match against.
export function useSellOutContext(): SellOutContextValue {
  const ctx = useContext(SellOutContext)
  return ctx ?? { isLikelyToSellOut: () => false }
}
