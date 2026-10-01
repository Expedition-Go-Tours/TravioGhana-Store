/// <reference types="node" />
/**
 * `keepPreviousForListings` decides how many review rows survive a scrape run,
 * and therefore whether the run clears its own floor guard at
 * `sync-reviews.cjs` line ~870 (refuse to shrink the committed dataset by
 * more than ~10%).
 *
 * The bug this pins: the previous implementation grouped by PLATFORM and asked
 * one binary question — "did this source yield exactly zero rows?" — so a
 * platform that yielded anything at all had its entire previous body
 * discarded. GetYourGuide yielded 182 of 311 stored rows; all 311 were
 * dropped; the dataset read 1,114 against a floor of 1,118 and the run failed
 * over 4 rows while the honest total was 1,241. One blocked listing (Cape
 * Coast, 127 rows) was the entire difference.
 *
 * The guarantee is unchanged — a listing the scrape could not reach keeps its
 * rows instead of silently vanishing. Only the granularity moved, down to the
 * level `mergeProducts` already operates at for official totals.
 *
 * These tests use the real listing shape from that incident.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { keepPreviousForListings } = require('../../scripts/sync-reviews.cjs')

const review = (over: Record<string, unknown> = {}) => ({
  id: 'r0',
  source: 'GETYOURGUIDE',
  productId: 'getyourguide-from-accra-the-cape-coast-day-tour-guided-experience-t834942',
  tourUrl: 'https://www.getyourguide.com/accra-l506/from-accra-the-cape-coast-day-tour-guided-experience-t834942/',
  tourTitle: 'From Accra: The Cape Coast Day Tour Guided Experience',
  rating: 5,
  originalDate: '2026-08-31T00:00:00.000Z',
  ...over,
})

const cape = (id: string) => review({ id })
const city = (id: string) =>
  review({ id, productId: 'getyourguide-accra-guided-city-tour-experience-t839108' })

const ids = (rows: any[]) => rows.map((r) => r.id)

describe('keepPreviousForListings: a listing the scrape could not reach', () => {
  it('keeps a blocked listing even when its platform DID yield rows', () => {
    // The regression itself. GYG produced a row for Accra City, so under the
    // old source-level rule every stored GYG row was discarded — including
    // Cape Coast's, which is where the 129 missing rows went.
    const fresh = [city('new-city-1')]
    const previous = [city('old-city-1'), cape('old-cape-1'), cape('old-cape-2')]

    const merged = keepPreviousForListings(fresh, previous)

    expect(ids(merged)).toEqual(['new-city-1', 'old-cape-1', 'old-cape-2'])
  })

  it('preserves every listing of a fully blocked platform', () => {
    // The shape from the incident: TripAdvisor and Google yield nothing.
    const previous = [
      review({ id: 'ta-1', source: 'TRIPADVISOR', productId: 'tripadvisor-24189724' }),
      review({ id: 'ta-2', source: 'TRIPADVISOR', productId: 'tripadvisor-24189724' }),
      review({ id: 'ta-3', source: 'TRIPADVISOR', productId: 'tripadvisor-25217516' }),
      review({ id: 'g-1', source: 'GOOGLE', productId: undefined }),
    ]

    const merged = keepPreviousForListings([], previous)

    expect(ids(merged)).toEqual(['ta-1', 'ta-2', 'ta-3', 'g-1'])
  })

  it('keeps a listing the run never visited at all', () => {
    // Nothing for Cape Coast was even attempted this run, so no fresh row
    // carries its key.
    const fresh = [city('new-city-1')]
    const previous = [cape('old-cape-1'), city('old-city-1')]

    const merged = keepPreviousForListings(fresh, previous)

    expect(ids(merged)).toContain('old-cape-1')
  })
})

describe('keepPreviousForListings: it must stay a merge, not a rescue', () => {
  it('lets a re-scraped listing use only its fresh rows', () => {
    // Cape Coast came back with 2 rows; the 5 stale ones must not be glued on
    // beside them, or every run would balloon.
    const fresh = [cape('new-1'), cape('new-2')]
    const previous = [cape('old-1'), cape('old-2'), cape('old-3'), cape('old-4'), cape('old-5')]

    const merged = keepPreviousForListings(fresh, previous)

    expect(ids(merged)).toEqual(['new-1', 'new-2'])
  })

  it('adds a brand-new listing the previous dataset never had', () => {
    const fresh = [review({ id: 'brand-new', productId: 'getyourguide-new-listing-t99999' })]
    const previous = [cape('old-cape-1')]

    const merged = keepPreviousForListings(fresh, previous)

    expect(ids(merged)).toContain('brand-new')
    expect(ids(merged)).toContain('old-cape-1')
    expect(merged).toHaveLength(2)
  })

  it('returns only fresh rows when there is no previous dataset', () => {
    const fresh = [cape('n1'), city('n2')]
    expect(ids(keepPreviousForListings(fresh, [])).sort()).toEqual(['n1', 'n2'])
  })

  it('never emits the same row twice', () => {
    const fresh = [city('new-city-1')]
    const previous = [city('old-city-1'), cape('old-cape-1')]

    const merged = keepPreviousForListings(fresh, previous)

    expect(new Set(ids(merged)).size).toBe(merged.length)
  })

  it('does not mutate either input array', () => {
    const fresh = [city('new-1')]
    const previous = [cape('old-1')]
    const beforeF = JSON.stringify(fresh)
    const beforeP = JSON.stringify(previous)

    keepPreviousForListings(fresh, previous)

    expect(JSON.stringify(fresh)).toBe(beforeF)
    expect(JSON.stringify(previous)).toBe(beforeP)
  })
})

describe('keepPreviousForListings: how a listing is identified', () => {
  it('falls back to tourUrl for rows that carry no productId', () => {
    // Google's 44 business-level rows have no productId. Grouped by source
    // alone they would be dropped the moment Google yielded anything.
    const fresh = [{ id: 'g-new', source: 'GOOGLE', tourUrl: 'https://maps.example/accra' }]
    const previous = [{ id: 'g-old', source: 'GOOGLE', tourUrl: 'https://maps.example/accra' }]

    const merged = keepPreviousForListings(fresh, previous)

    expect(ids(merged)).toEqual(['g-new'])
  })

  it('keeps Google rows when Google yields nothing', () => {
    const previous = [
      { id: 'g-old', source: 'GOOGLE', tourUrl: 'https://maps.example/accra' },
      { id: 'g-old-2', source: 'GOOGLE', tourUrl: 'https://maps.example/accra' },
    ]

    expect(ids(keepPreviousForListings([], previous))).toEqual(['g-old', 'g-old-2'])
  })

  it('degrades to source-level grouping for a row with no identity at all', () => {
    // A row we cannot place keeps the old rule rather than being dropped:
    // no row is worse off than it was before this change.
    const fresh = [{ id: 'x-new', source: 'TRIPADVISOR' }]
    const previous = [{ id: 'x-old', source: 'TRIPADVISOR' }]

    expect(ids(keepPreviousForListings(fresh, previous))).toEqual(['x-new'])
  })

  it('keeps unidentified rows when their source yields nothing', () => {
    const previous = [{ id: 'x-old', source: 'TRIPADVISOR' }]
    expect(ids(keepPreviousForListings([], previous))).toEqual(['x-old'])
  })

  it('never lets one source inherit another source listing', () => {
    const fresh = [review({ id: 'gyg-only' })]
    const previous = [
      { id: 'ta-1', source: 'TRIPADVISOR', tourUrl: 'https://www.tripadvisor.com/AttractionProductReview-g293797-d24189724-x.html' },
    ]

    const merged = keepPreviousForListings(fresh, previous)

    expect(ids(merged).sort()).toEqual(['gyg-only', 'ta-1'])
  })
})

describe('keepPreviousForListings: the incident arithmetic', () => {
  it('reproduces the failed run and lands over the floor', () => {
    // Real shape of run 36853279631: TA yielded 0 (888 stored), Google 0
    // (44), GetYourGuide 182 of 311 because Cape Coast went dark. The old
    // rule produced 1,114 against a floor of 1,118 and failed the run.
    const rows = (n: number, make: (i: number) => any) =>
      Array.from({ length: n }, (_, i) => make(i))

    const previous = [
      ...rows(571, (i) => review({ id: `ta-cap-${i}`, source: 'TRIPADVISOR', productId: 'tripadvisor-24189724' })),
      ...rows(104, (i) => review({ id: `ta-wat-${i}`, source: 'TRIPADVISOR', productId: 'tripadvisor-25225851' })),
      ...rows(167, (i) => review({ id: `ta-cty-${i}`, source: 'TRIPADVISOR', productId: 'tripadvisor-25217516' })),
      ...rows(39, (i) => review({ id: `ta-shi-${i}`, source: 'TRIPADVISOR', productId: 'tripadvisor-25275033' })),
      ...rows(6, (i) => review({ id: `ta-air-${i}`, source: 'TRIPADVISOR', productId: 'tripadvisor-25225556' })),
      ...rows(1, (i) => review({ id: `ta-kum-${i}`, source: 'TRIPADVISOR', productId: 'tripadvisor-25225555' })),
      ...rows(44, (i) => review({ id: `g-${i}`, source: 'GOOGLE', productId: undefined, tourUrl: 'https://maps.example/accra' })),
      ...rows(127, (i) => cape(`old-cap-${i}`)),
      ...rows(94, (i) => city(`old-cty-${i}`)),
      ...rows(81, (i) => review({ id: `old-bot-${i}`, productId: 'getyourguide-boti-falls-umbrella-rock-aburi-gardens-cocoa-farm-tour-t866545' })),
      ...rows(9, (i) => review({ id: `old-mni-${i}`, productId: 'getyourguide-accra-mini-safari-rock-climbing-museum-boat-cruise-tour-t1170966' })),
    ]
    expect(previous).toHaveLength(1243)

    const fresh = [
      ...rows(93, (i) => city(`new-cty-${i}`)),
      ...rows(80, (i) => review({ id: `new-bot-${i}`, productId: 'getyourguide-boti-falls-umbrella-rock-aburi-gardens-cocoa-farm-tour-t866545' })),
      ...rows(9, (i) => review({ id: `new-mni-${i}`, productId: 'getyourguide-accra-mini-safari-rock-climbing-museum-boat-cruise-tour-t1170966' })),
    ]
    expect(fresh).toHaveLength(182)

    const merged = keepPreviousForListings(fresh, previous)
    const floor = Math.floor(previous.length * 0.9)

    // 888 (TA) + 44 (Google) + 127 (Cape Coast, blocked) + 182 (fresh)
    expect(merged).toHaveLength(1241)
    expect(merged.length).toBeGreaterThanOrEqual(floor)
    expect(floor).toBe(1118)

    // The 127 Cape Coast rows are what the old rule destroyed.
    expect(merged.filter((r: any) => String(r.id).startsWith('old-cap-'))).toHaveLength(127)
    // ...and the re-scraped listings are fresh, not doubled up.
    expect(merged.filter((r: any) => String(r.id).startsWith('old-cty-'))).toHaveLength(0)
  })
})
