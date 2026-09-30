import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  enrichToursWithCombinedStats,
  type ExternalReviewStatsData,
} from '../hooks/useExternalReviews'
import { isScrapedReviewSupplier } from '../lib/supplierIdentity'
import { buildHomepageItemListSchema } from '../components/SEO'

/**
 * The homepage renders ratings it does not publish.
 *
 * Every homepage endpoint returns `averageRating: null, reviewCount: 0`, so
 * `buildHomepageItemListSchema` — correctly, given what it was handed — emitted
 * no `aggregateRating` at all: 0 of 24 ItemList entries carried one. The card
 * immediately below rendered 4.8 / 173 from the scraped platforms, computed by
 * `useCombinedTourStats`.
 *
 * Two consumers, two different answers to the same question. These tests pin the
 * schema to the number on screen. The fixture mirrors a real endpoint row
 * (null/0) against a real stats payload shape (official totals on a matched
 * product), because the bug only appears with that combination — which is
 * exactly why a fixture tour rated 4.8 passed while the live page published
 * nothing.
 */
const ROOT = resolve(__dirname, '..', '..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')

/** `Expedition-Go Tours LTD` is the operator whose listings were scraped. */
const SUPPLIER = { id: 's1', name: 'Expedition-Go Tours LTD', photo: null, rating: null }

/** The shape `useHomepageSections` receives — null/0, as the endpoints send it. */
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'cmt8ij61a00oc646p0sq1d8xq',
  title: 'Accra Guided City Tour: Cultural and Historical Experience',
  slug: 'accra-guided-city-tour',
  city: 'Accra',
  country: 'Ghana',
  supplier: SUPPLIER,
  averageRating: null,
  reviewCount: 0,
  startingPrice: 45,
  currency: 'USD',
  ...overrides,
})

const STATS: ExternalReviewStatsData = {
  stats: { totalReviews: 173, averageRating: 4.8, platforms: [] },
  products: [
    {
      id: 'tripadvisor-25217516',
      source: 'TRIPADVISOR',
      tourTitle: 'Accra Guided City Tour: Cultural and Historical Experience',
      tourUrl: 'https://www.tripadvisor.com/ShowProductReviews',
      rating: 4.8,
      reviewCount: 173,
      distribution: null,
      resolvedDistribution: null,
      official: true,
    },
  ],
  productAggregates: {},
  featuredReviews: [],
}

type Entry = { item: Record<string, any> }
const entries = (rows: any[]): Entry[] =>
  buildHomepageItemListSchema(rows).itemListElement as unknown as Entry[]

describe('homepage ItemList ratings', () => {
  it('guards its own fixture: the operator really is a scraped one', () => {
    // Without this, a rename of the operator silently empties every assertion
    // below into the "unmatched" case and the suite stays green for the wrong
    // reason.
    expect(isScrapedReviewSupplier(SUPPLIER.name)).toBe(true)
  })

  it('publishes the rating the card renders for a row whose own fields are null', () => {
    const rows = enrichToursWithCombinedStats([row()], STATS)

    expect(rows[0].averageRating).toBe(4.8)
    expect(rows[0].reviewCount).toBe(173)

    const [entry] = entries(rows)
    expect(entry.item.aggregateRating).toMatchObject({
      '@type': 'AggregateRating',
      ratingValue: 4.8,
      reviewCount: 173,
    })
  })

  it('takes the homepage from zero published ratings to one', () => {
    // The live page as of this change: 0 of 24 entries carried a rating.
    const raw = entries([row(), row({ id: 'other', title: 'The Mole National Park Tour' })])
    expect(raw.filter((e) => e.item.aggregateRating)).toHaveLength(0)

    const enriched = entries(
      enrichToursWithCombinedStats(
        [row(), row({ id: 'other', title: 'The Mole National Park Tour' })],
        STATS,
      ),
    )
    expect(enriched.filter((e) => e.item.aggregateRating)).toHaveLength(1)
  })

  it('publishes nothing while the stats payload is loading, rather than inventing a rating', () => {
    const rows = enrichToursWithCombinedStats([row()], undefined)

    expect(rows[0].averageRating).toBeNull()
    expect(rows[0].reviewCount).toBe(0)
    expect(entries(rows)[0].item.aggregateRating).toBeUndefined()
  })

  it('leaves a tour no scraped product matches at its own absent rating', () => {
    const input = row({ id: 'other', title: 'The Mole National Park Tour' })
    const [out] = enrichToursWithCombinedStats([input], STATS)

    expect(out.averageRating).toBeNull()
    expect(out.reviewCount).toBe(0)
    expect(entries([out])[0].item.aggregateRating).toBeUndefined()
  })

  it('never attributes scraped reviews to an operator whose listings were never scraped', () => {
    const input = row({ supplier: { ...SUPPLIER, name: 'Kwame Tours Ghana' } })
    const [out] = enrichToursWithCombinedStats([input], STATS)

    expect(out.averageRating).toBeNull()
    expect(out.reviewCount).toBe(0)
    expect(entries([out])[0].item.aggregateRating).toBeUndefined()
  })

  it('returns new rows rather than mutating the query cache in place', () => {
    const input = row()
    const before = JSON.stringify(input)
    enrichToursWithCombinedStats([input], STATS)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('is wired into the homepage schema — App.tsx passes enriched rows, not raw ones', () => {
    const source = read('src/App.tsx')

    // Reading the fields straight off the row is the bug this file exists for:
    // it compiles, the unit tests pass, and the live page publishes nothing.
    expect(source).toContain('enrichToursWithCombinedStats(')
    expect(source).toContain('buildHomepageItemListSchema(itemListTours)')
    expect(source).not.toContain('buildHomepageItemListSchema([')
  })

  it('routes the card and the schema through one function, not two copies', () => {
    const source = read('src/hooks/useExternalReviews.ts')

    expect(source).toContain('export function combinedStatsFor(')
    // The hook must delegate; a second copy here is how the two drift apart.
    expect(source).toMatch(/combinedStatsFor\(\{ title, location, supplierName, rating, reviewCount \}, data\)/)
  })
})
