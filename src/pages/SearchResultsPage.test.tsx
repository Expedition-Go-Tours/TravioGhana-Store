import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Search result cards used to render with TourCard's default `sizes` (50vw) and
 * no priority — the browser fetched the 1200w image (~200KB) for a ~310px card
 * and lazy-loaded the visible first row. These tests pin the grid descriptor and
 * the first-row priority.
 */

const mocks = vi.hoisted(() => ({
  tours: Array.from({ length: 6 }, (_, i) => ({ id: `tour-${i}`, title: `Tour ${i}` })),
}))

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams('q=cape+coast')],
  useNavigate: () => vi.fn(),
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...rest }: { children?: unknown }) => <div {...(rest as object)}>{children as never}</div>,
  },
}))

vi.mock('../hooks/usePlaceResolve', () => ({
  usePlaceResolve: () => ({ data: null, isFetching: false }),
}))

vi.mock('../lib/api', () => ({
  fetchWithAuth: vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: { tours: mocks.tours } }),
  })),
}))

vi.mock('../hooks/useExpeditionTours', () => ({
  mapRawTourToListing: (t: unknown) => t,
}))

vi.mock('../hooks/useHomepageSections', () => ({
  mergeOffersIntoTours: (tours: unknown[]) => tours,
}))

vi.mock('../components/TourCard', () => ({
  default: ({ id, priority, sizes }: { id?: string; priority?: boolean; sizes?: string }) => (
    <div data-testid={`card-${id}`} data-priority={String(!!priority)} data-sizes={sizes} />
  ),
}))

vi.mock('../components/SearchContextChip', () => ({ default: () => null }))
vi.mock('../components/NoToursEmptyState', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => null }))
vi.mock('../components/SEO', () => ({ default: () => null }))

import SearchResultsPage from './SearchResultsPage'

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SearchResultsPage />
    </QueryClientProvider>,
  )
}

describe('SearchResultsPage — card images', () => {
  it('passes the grid-accurate sizes descriptor to every card', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId('card-tour-0')).toBeTruthy())

    for (const tour of mocks.tours) {
      const sizes = screen.getByTestId(`card-${tour.id}`).getAttribute('data-sizes') || ''
      expect(sizes).toContain('(max-width: 600px) 100vw')
      expect(sizes).toContain('(max-width: 900px) 50vw')
      expect(sizes).toContain('(max-width: 1200px) 33vw')
      expect(sizes).toContain('25vw')
    }
  })

  it('marks only the first four cards priority', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId('card-tour-0')).toBeTruthy())

    for (const [index, tour] of mocks.tours.entries()) {
      const priority = screen.getByTestId(`card-${tour.id}`).getAttribute('data-priority')
      expect(priority, `card ${index}`).toBe(index < 4 ? 'true' : 'false')
    }
  })
})
