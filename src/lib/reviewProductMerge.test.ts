/// <reference types="node" />
/**
 * `mergeProducts` decides what a product's official rating and review count are
 * in the committed dataset — and those two numbers are the only thing standing
 * between a tour page and its `aggregateRating` in the Product schema, because
 * `buildProductSchema` emits that block only when BOTH values are truthy.
 *
 * The bug this pins: a scrape run whose header read failed returned
 * `rating: null, reviewCount: null` for products it had *successfully*
 * re-scraped, and those nulls overwrote good values from the previous run. The
 * individual review rows kept accumulating (1,125 → 1,243 rows), so every
 * health check that looked at row counts stayed green, while all 8 TripAdvisor
 * totals sat at null and the site quietly stopped publishing review markup.
 *
 * A header read that returns nulls means "we did not learn it this run", never
 * "it is zero". These tests use the real two-dataset shape from that incident.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { mergeProducts } = require('../../scripts/sync-reviews.cjs')

const product = (over: Record<string, unknown> = {}) => ({
  id: 'tripadvisor-24189724',
  source: 'TRIPADVISOR',
  tourTitle: 'Cape Coast Castle & Kakum Day Tour',
  tourUrl: 'https://www.tripadvisor.com/AttractionProductReview-g293797-d24189724-x.html',
  rating: 4.9,
  reviewCount: 588,
  distribution: { 2: 2, 3: 5, 4: 33, 5: 548 },
  ...over,
})

const broken = product({ rating: null, reviewCount: null, distribution: null })

describe('mergeProducts: a header this run could not read', () => {
  it('keeps the previous rating and count instead of nulling them', () => {
    const [merged] = mergeProducts([broken], [product()])
    expect(merged.rating).toBe(4.9)
    expect(merged.reviewCount).toBe(588)
    expect(merged.distribution).toEqual({ 2: 2, 3: 5, 4: 33, 5: 548 })
  })

  it('recovers the header for every product in a fully-blocked run', () => {
    // The exact incident shape: all 8 TripAdvisor headers came back empty.
    const previous = Array.from({ length: 8 }, (_, i) =>
      product({ id: `tripadvisor-000000000000000000000${i}` }))
    const current = previous.map((p) => ({ ...p, rating: null, reviewCount: null, distribution: null }))

    const merged = mergeProducts(current, previous)
    expect(merged.filter((p: any) => p.reviewCount != null)).toHaveLength(8)
  })

  it('carries forward only the fields that are missing, not all three', () => {
    // Rating arrived, count did not: the fresh rating must win, the old count
    // must survive. Blanket-overwriting would undo a real correction.
    const partial = product({ rating: 4.2, reviewCount: null, distribution: null })
    const [merged] = mergeProducts([partial], [product()])
    expect(merged.rating).toBe(4.2)
    expect(merged.reviewCount).toBe(588)
  })

  it('lets a genuinely re-read value win, so a rating correction still lands', () => {
    const improved = product({ rating: 4.6, reviewCount: 640, distribution: { 5: 640 } })
    const [merged] = mergeProducts([improved], [product()])
    expect(merged.rating).toBe(4.6)
    expect(merged.reviewCount).toBe(640)
    expect(merged.distribution).toEqual({ 5: 640 })
  })
})

describe('mergeProducts: it must stay a merge, not a filter', () => {
  it('adds a brand-new product and keeps one the run dropped entirely', () => {
    const fresh = product({ id: 'tripadvisor-newproduct00000000' })
    const dropped = product({ id: 'tripadvisor-dropped00000000' })

    const merged = mergeProducts([fresh], [dropped])
    const ids = merged.map((p: any) => p.id)

    expect(ids).toContain('tripadvisor-newproduct00000000')
    expect(ids).toContain('tripadvisor-dropped00000000')
    expect(merged).toHaveLength(2)
  })

  it('does not invent a header for a product that never had one', () => {
    const [merged] = mergeProducts([broken], [product({ rating: null, reviewCount: null, distribution: null })])
    expect(merged.rating).toBeNull()
    expect(merged.reviewCount).toBeNull()
  })

  it('treats a zero count as a real value, not a missing one', () => {
    // A product genuinely at 0 reviews must not be backfilled with an old count.
    const zeroed = product({ rating: null, reviewCount: 0, distribution: null })
    const [merged] = mergeProducts([zeroed], [product()])
    expect(merged.reviewCount).toBe(0)
    // rating was still null, so the previous rating is all that carries over
    expect(merged.rating).toBe(4.9)
  })

  it('does not mutate either input array', () => {
    const previous = [product()]
    const current = [broken]
    const before = JSON.stringify(previous)
    mergeProducts(current, previous)
    expect(JSON.stringify(previous)).toBe(before)
    expect(current[0].rating).toBeNull()
  })
})
