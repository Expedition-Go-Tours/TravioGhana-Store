import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const fetchMock = vi.fn()

vi.mock('../lib/api', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchMock(...args),
}))

/**
 * A location-scoped homepage serves two things per section: the place's own
 * rows, and a labelled "nearby rail" (`recommendedBackfill`) that continues the
 * carousel when the place itself has little supply. Both are rendered as cards,
 * but only the local rows were ever run through the badge/offers pipeline — the
 * rail arrived via the `...data` spread and was mapped straight onto cards.
 *
 * The result was a scoped rail whose first cards looked right and whose rest did
 * not: `difficulty` rendered (the endpoint ships it) while pickup, language,
 * cancellation and offer — which exist nowhere in the payload and can only come
 * from enrichment — did not.
 */

const LOCAL_ID = 'cmur6ozh200267qyccvhcrboq'
const RAIL_ID = 'cmt8q531m032q646pb6u8c6as'
const RAIL_OFFER_ID = 'cmt8oi47x02m0646pkw9gurp9'
const UNKNOWN_ID = 'cmted26j50001xazsjddirimz'

/** The slim row shape the homepage endpoints emit — no badge fields at all. */
const row = (id: string, title: string) => ({
  id,
  title,
  slug: title.toLowerCase().replace(/\s+/g, '-'),
  category: 'Tour',
  city: 'Accra',
  country: 'Ghana',
  durationMinutes: 720,
  startingPrice: 300,
  difficulty: 'moderate',
  averageRating: 4.8,
  reviewCount: 799,
  supplier: { id: 'sup-1', name: 'Expedition-Go Tours LTD' },
  coverPhoto: '',
  photos: [],
  tags: [],
})

const ok = (payload: unknown) => ({ ok: true, status: 200, json: async () => payload })

/** `recommendedBackfill` as the scoped endpoint ships it. */
const rail = (...tours: ReturnType<typeof row>[]) => ({ label: 'Nearby experiences', tours })

const scopedPayload = {
  recommended: [row(LOCAL_ID, 'The Kumasi Cultural and Heritage Day Tour')],
  recommendedBackfill: rail(row(RAIL_ID, 'Cape Coast Castle'), row(RAIL_OFFER_ID, 'Accra Food Tasting Tour')),
  topRated: [row(LOCAL_ID, 'The Kumasi Cultural and Heritage Day Tour')],
  topRatedBackfill: rail(row(UNKNOWN_ID, 'A tour with no badge match')),
  sellOut: [],
  sellOutBackfill: null,
  trending: [],
  new: [],
  newExperiencesBackfill: rail(),
  offers: [
    {
      ...row(RAIL_OFFER_ID, 'Accra Food Tasting Tour'),
      specialOffers: [{ id: 'off-1', discountType: 'PERCENTAGE', discountPercentage: 10 }],
    },
  ],
  attractions: [],
  mood: [],
  destinations: [],
  city: 'Ashanti Region',
}

/** `/tours/badges` — the only place badge fields exist. */
const badgePayload = {
  data: {
    tours: [
      {
        id: LOCAL_ID,
        languages: ['English'],
        cancellationPolicy: 'Free cancellation',
        pickupIncluded: true,
        meetingMode: 'pickup',
        accommodationIncluded: false,
      },
      {
        id: RAIL_ID,
        languages: ['English'],
        cancellationPolicy: 'Free cancellation',
        pickupIncluded: true,
        meetingMode: 'pickup',
        accommodationIncluded: true,
      },
      {
        id: RAIL_OFFER_ID,
        languages: ['English'],
        cancellationPolicy: 'Free cancellation',
        pickupIncluded: false,
        meetingMode: 'meeting_point',
        accommodationIncluded: false,
      },
      // Deliberately carries no languages/cancellation, so a rail row with no
      // match is proven to come back unchanged rather than half-filled.
      { id: UNKNOWN_ID, pickupIncluded: true },
    ],
  },
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const urls = () => fetchMock.mock.calls.map((c) => String(c[0]))

/** Fresh module instance per test: the badge and offer maps are module-cached. */
async function loadHomepageSections() {
  vi.resetModules()
  return import('./useHomepageSections')
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: string) => {
    const u = String(url)
    if (u.includes('/tours/badges')) return ok(badgePayload)
    if (u.includes('/homepage?') || u.endsWith('/homepage')) return ok({ data: scopedPayload })
    return ok({ data: {} })
  })
})

describe('useHomepageByCity — nearby rail', () => {
  it('backfills the badge fields the rail payload never carries', async () => {
    const { useHomepageByCity } = await loadHomepageSections()
    const { result } = renderHook(() => useHomepageByCity('Ashanti Region'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const railTours = result.current.data?.recommendedBackfill?.tours ?? []
    expect(railTours).toHaveLength(2)

    const capeCoast = railTours.find((t) => t.id === RAIL_ID)
    expect(capeCoast?.languages).toEqual(['English'])
    expect(capeCoast?.cancellationPolicy).toBe('Free cancellation')
    expect(capeCoast?.pickupIncluded).toBe(true)
    expect(capeCoast?.accommodationIncluded).toBe(true)
    expect(capeCoast?.meetingMode).toBe('pickup')
  })

  it('merges live offers onto the rail so it renders its offer badge', async () => {
    const { useHomepageByCity } = await loadHomepageSections()
    const { result } = renderHook(() => useHomepageByCity('Ashanti Region'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const withOffer = result.current.data?.recommendedBackfill?.tours.find((t) => t.id === RAIL_OFFER_ID)
    expect(withOffer?.specialOffers).toHaveLength(1)
    expect(withOffer?.specialOffers?.[0].discountPercentage).toBe(10)
  })

  it('leaves the local rows enriched exactly as they were before', async () => {
    const { useHomepageByCity } = await loadHomepageSections()
    const { result } = renderHook(() => useHomepageByCity('Ashanti Region'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const local = result.current.data?.recommended?.[0]
    expect(local?.id).toBe(LOCAL_ID)
    expect(local?.pickupIncluded).toBe(true)
    expect(local?.languages).toEqual(['English'])
    expect(local?.cancellationPolicy).toBe('Free cancellation')
  })

  it('leaves a rail row with no badge match unchanged rather than half-filled', async () => {
    const { useHomepageByCity } = await loadHomepageSections()
    const { result } = renderHook(() => useHomepageByCity('Ashanti Region'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const unmatched = result.current.data?.topRatedBackfill?.tours.find((t) => t.id === UNKNOWN_ID)
    expect(unmatched?.pickupIncluded).toBe(true)
    expect(unmatched?.languages).toBeUndefined()
    expect(unmatched?.cancellationPolicy).toBeUndefined()
  })

  it('passes an absent or empty rail through untouched', async () => {
    const { useHomepageByCity } = await loadHomepageSections()
    const { result } = renderHook(() => useHomepageByCity('Ashanti Region'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.sellOutBackfill).toBeNull()
    expect(result.current.data?.newExperiencesBackfill?.tours).toEqual([])
  })

  it('fetches the badge batch once for the whole payload, rail included', async () => {
    const { useHomepageByCity } = await loadHomepageSections()
    const { result } = renderHook(() => useHomepageByCity('Ashanti Region'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(urls().filter((u) => u.includes('/tours/badges'))).toHaveLength(1)
    expect(urls().filter((u) => u.includes('/homepage?'))).toHaveLength(1)
  })
})

describe('useHomepage — global payload', () => {
  it('stays untouched when the payload ships no rail', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url)
      if (u.includes('/tours/badges')) return ok(badgePayload)
      if (u.endsWith('/homepage')) {
        return ok({ data: { ...scopedPayload, recommendedBackfill: undefined } })
      }
      return ok({ data: {} })
    })

    const { useHomepage } = await loadHomepageSections()
    const { result } = renderHook(() => useHomepage(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.recommendedBackfill).toBeUndefined()
    expect(result.current.data?.recommended?.[0]?.pickupIncluded).toBe(true)
  })
})
