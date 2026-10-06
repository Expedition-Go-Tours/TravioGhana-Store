import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * The supplier rail is the one place the storefront claims "these are this
 * supplier's tours". Two failures are invisible without hitting the real
 * endpoint shape: the endpoint returns storefront *listing* rows
 * (`{ id, tour }`), and the tour-detail page has to exclude the tour being
 * viewed. Both are asserted here against the documented payload.
 *
 * It was also the only listing surface that never ran the badge pass, so it
 * rendered no difficulty, guide language, cancellation or pickup — and no
 * offer — while every section around it showed the full set. The same three
 * calls the rest of the site makes are asserted here too, and because the
 * badge and offer maps are module-cached, every test loads a fresh module.
 */

const fetchMock = vi.fn()

vi.mock('../lib/api', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchMock(...args),
}))

const TOUR_ID = 'cmt8oi47x02m0646pkw9gurp9'
const LISTING_ID = 'cmted26j50001xazsjddirimz'
const OTHER_ID = 'cmted26jp0005xazsflml6w7m'
const OTHER_TOUR_ID = 'cmt9oi47x02m0646pkw9gu1'
/** A tour that is on the rail but has no entry in the badge batch. */
const UNMATCHED_TOUR_ID = 'cmtunmatched00000000000001'

/** One row as the storefront endpoint emits it: listing id outside, tour inside. */
const listingRow = (listingId: string, tourId: string, title: string, extra: Record<string, unknown> = {}) => ({
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
    ...extra,
  },
})

/**
 * `/tours/badges` — the only place badge fields exist. Note there is no
 * `difficulty` key on the old shape of this response in the tests below that
 * assert it, because the endpoint has always returned it; the pipeline used to
 * drop it.
 */
const badgeTours = [
  {
    id: TOUR_ID,
    difficulty: 'moderate',
    languages: ['English'],
    cancellationPolicy: 'Free cancellation',
    pickupIncluded: true,
    meetingMode: 'pickup',
    accommodationIncluded: true,
  },
  {
    id: OTHER_TOUR_ID,
    difficulty: 'easy',
    languages: ['French'],
    cancellationPolicy: 'Non-refundable',
    pickupIncluded: false,
    meetingMode: 'meeting_point',
    accommodationIncluded: false,
  },
]

const offer = {
  id: 'off-1',
  name: 'Early bird',
  offerType: 'EARLY_BIRD',
  discountType: 'PERCENTAGE',
  discountPercentage: 10,
  fixedDiscountValue: null,
  startDate: null,
  endDate: null,
  promoCode: null,
}

const offerTours = [{ id: TOUR_ID, specialOffers: [offer] }]

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const ok = (payload: unknown) => ({ ok: true, status: 200, json: async () => payload })

/**
 * The supplier endpoint answers with whatever the test passed; everything the
 * enrichment steps then ask for is routed to its own payload. Without this the
 * badge and offer calls would receive the supplier's own body and quietly
 * resolve to empty maps.
 */
function respond(supplierPayload: unknown) {
  fetchMock.mockImplementation(async (url: unknown) => {
    const u = String(url)
    if (u.includes('/tours/badges')) return ok({ data: { tours: badgeTours } })
    if (u.includes('/tours?limit=500')) return ok({ data: { tours: [] } })
    if (u.includes('/homepage/offers')) return ok({ data: { tours: offerTours } })
    return ok(supplierPayload)
  })
}

const urls = () => fetchMock.mock.calls.map((c) => String(c[0]))

/** Fresh module per test: the badge and offer maps are module-cached. */
async function loadHook() {
  vi.resetModules()
  return (await import('./useSupplierTours')).useSupplierTours
}

beforeEach(() => {
  fetchMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useSupplierTours', () => {
  it('requests the supplier-scoped endpoint with the row limit', async () => {
    const useSupplierTours = await loadHook()
    respond({ data: { tours: [] } })

    const { result } = renderHook(() => useSupplierTours('sup-1', null, 8), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(urls()).toContain('/travioghana/suppliers/sup-1/tours?limit=8')
    expect(result.current.data).toEqual([])
  })

  it('excludes the tour being viewed so the page cannot list itself', async () => {
    const useSupplierTours = await loadHook()
    respond({ data: { tours: [] } })

    const { result } = renderHook(() => useSupplierTours('sup-1', TOUR_ID, 8), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(urls()).toContain(`/travioghana/suppliers/sup-1/tours?limit=8&exclude=${TOUR_ID}`)
  })

  it('carries the tour id, not the listing row id, onto the card', async () => {
    const useSupplierTours = await loadHook()
    respond({
      data: { tours: [listingRow(LISTING_ID, TOUR_ID, 'Kotoka Lounge Entry')] },
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
    const useSupplierTours = await loadHook()
    respond({
      data: {
        tours: [
          listingRow(LISTING_ID, TOUR_ID, 'Kotoka Lounge Entry'),
          listingRow(OTHER_ID, OTHER_TOUR_ID, 'Cape Coast Castle Tour'),
        ],
      },
    })

    const { result } = renderHook(() => useSupplierTours('sup-1', null, 8), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((t) => t.id)).toEqual([
      TOUR_ID,
      OTHER_TOUR_ID,
    ])
  })

  it('reads the documented { data: { tours } } envelope', async () => {
    // The endpoint once returned the bare array on the populated branch and the
    // envelope only when empty, which silently emptied the rail in the one case
    // where it had something to show.
    const useSupplierTours = await loadHook()
    respond({
      status: 'success',
      data: { tours: [listingRow(LISTING_ID, TOUR_ID, 'Kotoka Lounge Entry')] },
    })

    const { result } = renderHook(() => useSupplierTours('sup-1', null, 8), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]?.id).toBe(TOUR_ID)
  })

  it('still reads a bare-array response without throwing', async () => {
    const useSupplierTours = await loadHook()
    respond([listingRow(LISTING_ID, TOUR_ID, 'Kotoka Lounge Entry')])

    const { result } = renderHook(() => useSupplierTours('sup-1', null, 8), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]?.id).toBe(TOUR_ID)
  })

  it('stays idle without a supplier id rather than fetching', async () => {
    const useSupplierTours = await loadHook()

    const { result } = renderHook(() => useSupplierTours(null, TOUR_ID, 8), { wrapper })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('surfaces a failed response as an error instead of an empty rail', async () => {
    const useSupplierTours = await loadHook()
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'boom' }),
    })

    const { result } = renderHook(() => useSupplierTours('sup-1', null, 8), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('boom')
  })

  it('carries the supplier name so the scraped-review matcher can run', async () => {
    const useSupplierTours = await loadHook()
    respond({
      data: {
        tours: [
          listingRow(LISTING_ID, TOUR_ID, 'Kotoka Lounge Entry', {
            supplierName: 'Expedition-Go Tours LTD',
          }),
        ],
      },
    })

    const { result } = renderHook(() => useSupplierTours('sup-1', null, 8), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // TourCard forwards this straight to useCombinedTourStats, which only
    // consults the scraped platforms for our own listings. Left off, every card
    // in this rail resolved to a hard 0 beside tours rated 4.8 elsewhere.
    expect(result.current.data?.[0]?.supplierName).toBe('Expedition-Go Tours LTD')
  })

  it('backfills the badge fields the endpoint never projects', async () => {
    const useSupplierTours = await loadHook()
    // The supplier endpoint selects none of these columns — they exist only on
    // the badge batch, which this rail never used to fetch.
    respond({ data: { tours: [listingRow(LISTING_ID, TOUR_ID, 'Kotoka Lounge Entry')] } })

    const { result } = renderHook(() => useSupplierTours('sup-1', null, 8), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const card = result.current.data?.[0]
    expect(card?.difficulty).toBe('moderate')
    expect(card?.languages).toEqual(['English'])
    expect(card?.cancellationPolicy).toBe('Free cancellation')
    expect(card?.pickupIncluded).toBe(true)
    expect(card?.meetingMode).toBe('pickup')
    expect(card?.accommodationIncluded).toBe(true)
  })

  it('merges the live special offer the payload has no room for', async () => {
    const useSupplierTours = await loadHook()
    respond({ data: { tours: [listingRow(LISTING_ID, TOUR_ID, 'Kotoka Lounge Entry')] } })

    const { result } = renderHook(() => useSupplierTours('sup-1', null, 8), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.[0]?.specialOffers).toHaveLength(1)
    expect(result.current.data?.[0]?.specialOffers?.[0].discountPercentage).toBe(10)
  })

  it('leaves a tour with no badge match alone rather than half-filling it', async () => {
    const useSupplierTours = await loadHook()
    respond({
      data: {
        tours: [listingRow(LISTING_ID, UNMATCHED_TOUR_ID, 'A tour with no badge match')],
      },
    })

    const { result } = renderHook(() => useSupplierTours('sup-1', null, 8), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const card = result.current.data?.[0]
    expect(card?.id).toBe(UNMATCHED_TOUR_ID)
    expect(card?.difficulty).toBeUndefined()
    expect(card?.languages).toBeUndefined()
    expect(card?.cancellationPolicy).toBeUndefined()
    expect(card?.pickupIncluded).toBeUndefined()
    expect(card?.specialOffers).toBeUndefined()
  })

  it('fetches the badge batch and the offer list once for the rail', async () => {
    const useSupplierTours = await loadHook()
    respond({ data: { tours: [listingRow(LISTING_ID, TOUR_ID, 'Kotoka Lounge Entry')] } })

    const { result } = renderHook(() => useSupplierTours('sup-1', null, 8), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(urls().filter((u) => u.includes('/tours/badges'))).toHaveLength(1)
    expect(urls().filter((u) => u.includes('/homepage/offers'))).toHaveLength(1)
  })
})
