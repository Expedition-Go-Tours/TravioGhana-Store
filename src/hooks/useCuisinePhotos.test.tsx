import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../lib/api'
import { useCuisinePhotos } from './useCuisinePhotos'

vi.mock('../lib/api', () => ({ apiFetch: vi.fn() }))

const mockFetch = vi.mocked(apiFetch)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useCuisinePhotos', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('takes one top-rated venue photo per cuisine from the catalogue', async () => {
    mockFetch
      .mockResolvedValueOnce({
        venues: [{ coverPhoto: 'https://cdn.example.test/ghanaian.jpg', photos: [] }],
      })
      .mockResolvedValueOnce({
        venues: [{ coverPhoto: null, photos: ['https://cdn.example.test/vegetarian.jpg'] }],
      })

    const { result } = renderHook(
      () =>
        useCuisinePhotos([
          { label: 'Ghanaian', query: { cuisine: 'ghanaian' } },
          { label: 'Vegetarian', query: { dietary: ['vegetarian'] } },
        ]),
      { wrapper },
    )

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toEqual({
      Ghanaian: 'https://cdn.example.test/ghanaian.jpg',
      Vegetarian: 'https://cdn.example.test/vegetarian.jpg',
    })
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      '/v1/restaurant-venues?brand=ghana&limit=1&sort=rating&cuisine=ghanaian',
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/v1/restaurant-venues?brand=ghana&limit=1&sort=rating&dietary=vegetarian',
    )
  })

  it('keeps the photos it got when another cuisine lookup fails', async () => {
    mockFetch
      .mockResolvedValueOnce({
        venues: [{ coverPhoto: 'https://cdn.example.test/chinese.jpg', photos: [] }],
      })
      .mockRejectedValueOnce(new Error('network down'))

    const { result } = renderHook(
      () =>
        useCuisinePhotos([
          { label: 'Chinese', query: { cuisine: 'chinese' } },
          { label: 'Italian', query: { cuisine: 'italian' } },
        ]),
      { wrapper },
    )

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toEqual({ Chinese: 'https://cdn.example.test/chinese.jpg' })
  })
})
