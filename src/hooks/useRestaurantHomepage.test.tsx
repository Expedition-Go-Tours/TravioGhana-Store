import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { apiFetch } from '../lib/api'
import type { RestaurantVenue } from './useRestaurantVenues'
import {
  useRecommendedRestaurants,
  useRestaurantSectionIds,
} from './useRestaurantHomepage'

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
}))

const mockApiFetch = vi.mocked(apiFetch)

const venue = { id: 'v1', name: 'The Place' } as RestaurantVenue

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockApiFetch.mockReset()
})

describe('restaurant homepage hooks', () => {
  it('reads venues from the ranking endpoint and selects the venues array', async () => {
    mockApiFetch.mockResolvedValue({ venues: [venue] })

    const { result } = renderHook(
      () => useRecommendedRestaurants({ city: 'Accra', lat: 5.5, lng: -0.2 }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.data).toEqual([venue]))
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/v1/restaurant-venues/homepage/recommended?brand=ghana&limit=8&city=Accra&lat=5.5&lng=-0.2',
    )
  })

  it('reads algorithmically selected venue ids for a section', async () => {
    mockApiFetch.mockResolvedValue({ venueIds: ['v2', 'v1'] })

    const { result } = renderHook(
      () => useRestaurantSectionIds('likely-to-book-out', { city: 'Accra' }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.data).toEqual(['v2', 'v1']))
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/v1/restaurant-venues/homepage/section-venue-ids?brand=ghana&section=likely-to-book-out&city=Accra',
    )
  })

  it('does not request ids for an unknown section', () => {
    renderHook(() => useRestaurantSectionIds('not-a-section'), { wrapper })

    expect(mockApiFetch).not.toHaveBeenCalled()
  })
})
