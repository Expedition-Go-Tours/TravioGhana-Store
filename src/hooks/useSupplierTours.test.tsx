import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSupplierTours } from './useSupplierTours'

/**
 * The supplier rail is the one place the storefront claims "these are this
 * supplier's tours". Two failures are invisible without hitting the real
 * endpoint shape: the endpoint returns storefront *listing* rows
 * (`{ id, tour }`), and the tour-detail page has to exclude the tour being
 * viewed. Both are asserted here against the documented payload.
 */

const fetchMock = vi.fn()

vi.mock('../lib/api', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchMock(...args),
}))

const TOUR_ID = 'cmt8oi47x02m0646pkw9gurp9'
const LISTING_ID = 'cmted26j50001xazsjddirimz'
const OTHER_ID = 'cmted26jp0005xazsflml6w7m'

/** One row as the storefront endpoint emits it: listing id outside, tour inside. */
const listingRow = (listingId: string, tourId: string, title: string) => ({
  id: listingId,
  tour: {
    id: tourId,
    title,
    slug: title.toLowerCase().replace(/\s+/g, '-'),
    durationMinutes: 180,
    averageRating: 4.8,
    reviewCount: 12,
    city: 'Accra',
    country: 'Ghana',
    startingPrice: 85,
  },
})

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const lastUrl = () => String(fetchMock.mock.calls.at(-1)?.[0])

beforeEach(() => {
  fetchMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useSupplierTours', () => {
  it('requests the supplier-scoped endpoint with the row limit', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { tours: [] } }),
    })

    const { result } = renderHook(() => useSupplierTours('sup-1', null, 8), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(lastUrl()).toBe('/travioghana/suppliers/sup-1/tours?limit=8')
    expect(result.current.data).toEqual([])
  })

  it('excludes the tour being viewed so the page cannot list itself', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { tours: [] } }),
    })

    const { result } = renderHook(() => useSupplierTours('sup-1', TOUR_ID, 8), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(lastUrl()).toBe(`/travioghana/suppliers/sup-1/tours?limit=8&exclude=${TOUR_ID}`)
  })

  it('carries the tour id, not the listing row id, onto the card', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { tours: [listingRow(LISTING_ID, TOUR_ID, 'Kotoka Lounge Entry')] },
      }),
    })

    const { result } = renderHook(() => useSupplierTours('sup-1', null, 8), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const card = result.current.data?.[0]
    // The card id reaches TourCard's canonical `/tour/{id}/{slug}` URL, and the
    // public tour endpoint resolves a tour id or a slug — never a listing row.
    expect(card?.id).toBe(TOUR_ID)
    expect(card?.id).not.toBe(LISTING_ID)
    expect(card?.title).toBe('Kotoka Lounge Entry')
    expect(card?.slug).toBe('kotoka-lounge-entry')
  })

  it('maps each listing row to its own tour, keeping rows distinct', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          tours: [
            listingRow(LISTING_ID, TOUR_ID, 'Kotoka Lounge Entry'),
            listingRow(OTHER_ID, 'cmt9oi47x02m0646pkw9gu1', 'Cape Coast Castle Tour'),
          ],
        },
      }),
    })

    const { result } = renderHook(() => useSupplierTours('sup-1', null, 8), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((t) => t.id)).toEqual([
      TOUR_ID,
      'cmt9oi47x02m0646pkw9gu1',
    ])
  })

  it('reads the documented { data: { tours } } envelope', async () => {
    // The endpoint once returned the bare array on the populated branch and the
    // envelope only when empty, which silently emptied the rail in the one case
    // where it had something to show.
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        data: { tours: [listingRow(LISTING_ID, TOUR_ID, 'Kotoka Lounge Entry')] },
      }),
    })

    const { result } = renderHook(() => useSupplierTours('sup-1', null, 8), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]?.id).toBe(TOUR_ID)
  })

  it('still reads a bare-array response without throwing', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [listingRow(LISTING_ID, TOUR_ID, 'Kotoka Lounge Entry')],
    })

    const { result } = renderHook(() => useSupplierTours('sup-1', null, 8), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]?.id).toBe(TOUR_ID)
  })

  it('stays idle without a supplier id rather than fetching', () => {
    const { result } = renderHook(() => useSupplierTours(null, TOUR_ID, 8), { wrapper })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('surfaces a failed response as an error instead of an empty rail', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'boom' }),
    })

    const { result } = renderHook(() => useSupplierTours('sup-1', null, 8), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('boom')
  })
})