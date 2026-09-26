import { describe, it, expect } from 'vitest'
import {
  aggregateProducts,
  combineReviewStats,
  combinedExternalDistribution,
  computeExternalReviewStats,
  isVisibleExternalReview,
  scaleDistribution,
  selectMatchedProducts,
  selectSupplierReviewData,
  type ExternalReview,
  type ExternalReviewProduct,
  type ExternalReviewStatsData,
  type ExternalReviewStatsProduct,
} from './useExternalReviews'
import { matchTourForTitle } from '../lib/reviewTourLink'
import data from '../../public/data/externalReviews.json'

function review(
  partial: Partial<ExternalReview> & Pick<ExternalReview, 'id' | 'source' | 'rating'>,
): ExternalReview {
  return {
    reviewerName: 'Test Reviewer',
    reviewerAvatar: null,
    title: null,
    text: 'Review text',
    textTruncated: null,
    tourTitle: 'Some Tour',
    tourThumbnail: null,
    tourUrl: 'https://example.com/tour',
    tourLink: 'https://example.com/tour',
    coverPhoto: null,
    originalDate: null,
    productId: null,
    productRating: null,
    productReviewCount: null,
    ...partial,
  }
}

/**
 * The committed scraped dataset (JSON imports widen `source` to string, hence
 * the cast — the same pattern the row tests below use).
 */
const scrapedProducts = data.products as unknown as ExternalReviewProduct[]

describe('computeExternalReviewStats', () => {
  it('counts only the scraped TripAdvisor and GetYourGuide reviews', () => {
    const stats = computeExternalReviewStats([
      review({ id: 'ta1', source: 'TRIPADVISOR', rating: 5 }),
      review({ id: 'ta2', source: 'TRIPADVISOR', rating: 4 }),
      review({ id: 'gyg1', source: 'GETYOURGUIDE', rating: 4 }),
      review({ id: 'g1', source: 'GOOGLE', rating: 5 }),
      review({ id: 'g2', source: 'GOOGLE', rating: 5 }),
    ])

    expect(stats.totalReviews).toBe(3)
    expect(stats.averageRating).toBe(4.3)
    expect(stats.platforms).toEqual([
      { source: 'TRIPADVISOR', reviewCount: 2, averageRating: 4.5 },
      { source: 'GETYOURGUIDE', reviewCount: 1, averageRating: 4 },
      { source: 'GOOGLE', reviewCount: 2, averageRating: 5 },
    ])
  })

  it('counts rows individually, never their product totals', () => {
    const stats = computeExternalReviewStats([
      review({ id: 'ta1', source: 'TRIPADVISOR', rating: 5, productReviewCount: 911 }),
      review({ id: 'gyg1', source: 'GETYOURGUIDE', rating: 5, productReviewCount: 293 }),
    ])

    expect(stats.totalReviews).toBe(2)
    expect(stats.platforms.map((p) => p.reviewCount)).toEqual([1, 1])
  })

  it('returns zeros for an empty review set', () => {
    expect(computeExternalReviewStats([])).toEqual({
      totalReviews: 0,
      averageRating: null,
      platforms: [],
    })
  })

  it('counts nothing when only Google reviews exist', () => {
    const stats = computeExternalReviewStats([
      review({ id: 'g1', source: 'GOOGLE', rating: 5 }),
    ])

    expect(stats.totalReviews).toBe(0)
    expect(stats.averageRating).toBeNull()
    expect(stats.platforms).toEqual([
      { source: 'GOOGLE', reviewCount: 1, averageRating: 5 },
    ])
  })
})

describe('combineReviewStats', () => {
  it('merges in-app ratings with matched scraped reviews as a weighted average', () => {
    const combined = combineReviewStats(
      { rating: 4, reviewCount: 2 },
      [
        review({ id: 'ta1', source: 'TRIPADVISOR', rating: 5 }),
        review({ id: 'ta2', source: 'TRIPADVISOR', rating: 5 }),
        review({ id: 'gyg1', source: 'GETYOURGUIDE', rating: 4 }),
      ],
    )

    expect(combined.externalCount).toBe(3)
    expect(combined.reviewCount).toBe(5)
    // (4×2 + 5 + 5 + 4) / 5 = 4.4
    expect(combined.rating).toBe(4.4)
  })

  it('uses scraped reviews alone when the tour has no in-app reviews yet', () => {
    const combined = combineReviewStats(
      { rating: 0, reviewCount: 0 },
      [
        review({ id: 'ta1', source: 'TRIPADVISOR', rating: 5 }),
        review({ id: 'gyg1', source: 'GETYOURGUIDE', rating: 4 }),
      ],
    )

    expect(combined).toEqual({ rating: 4.5, reviewCount: 2, externalCount: 2 })
  })

  it('ignores a stale in-app rating when the review count is zero', () => {
    const combined = combineReviewStats(
      { rating: 4.9, reviewCount: 0 },
      [review({ id: 'ta1', source: 'TRIPADVISOR', rating: 4 })],
    )

    expect(combined).toEqual({ rating: 4, reviewCount: 1, externalCount: 1 })
  })

  it('leaves local stats untouched when nothing matches', () => {
    const combined = combineReviewStats({ rating: 4.6, reviewCount: 12 }, [])

    expect(combined).toEqual({ rating: 4.6, reviewCount: 12, externalCount: 0 })
  })

  it('never counts Google rows (shown but not counted)', () => {
    const combined = combineReviewStats(
      { rating: 0, reviewCount: 0 },
      [
        review({ id: 'g1', source: 'GOOGLE', rating: 5 }),
        review({ id: 'g2', source: 'GOOGLE', rating: 4 }),
        review({ id: 'ta1', source: 'TRIPADVISOR', rating: 4 }),
      ],
    )

    expect(combined).toEqual({ rating: 4, reviewCount: 1, externalCount: 1 })
  })

  it('rounds the weighted average to one decimal', () => {
    const combined = combineReviewStats(
      { rating: 4.8, reviewCount: 1 },
      [review({ id: 'gyg1', source: 'GETYOURGUIDE', rating: 5 })],
    )

    // (4.8 + 5) / 2 = 4.9
    expect(combined.rating).toBe(4.9)
  })

  it('returns empty stats when there is nothing to count', () => {
    expect(combineReviewStats({ rating: 0, reviewCount: 0 }, []))
      .toEqual({ rating: 0, reviewCount: 0, externalCount: 0 })
  })

  it('counts the real scraped rows for a same-titled local tour', () => {
    const local = {
      title: 'Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour',
      location: 'Cape Coast, Ghana',
    }
    const matched = (data.reviews as unknown as ExternalReview[]).filter(
      (entry) => entry.source !== 'GOOGLE' && matchTourForTitle(entry.tourTitle, [local]) !== null,
    )

    // The stored dataset has no 1★ rows for either source: 571 TripAdvisor
    // rows plus the 76 GetYourGuide rows the heuristics attach.
    expect(matched.filter((entry) => entry.source === 'TRIPADVISOR').length).toBe(571)
    expect(matched.filter((entry) => entry.source === 'GETYOURGUIDE').length).toBe(76)
    expect(matched.length).toBe(647)
    expect(matched.every((entry) => entry.rating >= 2)).toBe(true)
    expect(matched.every((entry) => entry.text.trim() && !/^\(No review text\)$/i.test(entry.text))).toBe(true)

    const combined = combineReviewStats({ rating: 4.5, reviewCount: 2 }, matched)
    expect(combined.externalCount).toBe(647)
    expect(combined.reviewCount).toBe(649)
    // (4.5×2 + 2808 + 379) / 649 = 4.89 → 4.9
    expect(combined.rating).toBe(4.9)
  })
})

describe('combineReviewStats with official product totals', () => {
  it('uses the scraped product header totals instead of the sampled rows', () => {
    const combined = combineReviewStats(
      { rating: 4.5, reviewCount: 2 },
      [
        review({ id: 'ta1', source: 'TRIPADVISOR', rating: 5 }),
        review({ id: 'ta2', source: 'TRIPADVISOR', rating: 5 }),
      ],
      // TripAdvisor's "4.9 (595 reviews)" for the Cape Coast product.
      { rating: 4.9, reviewCount: 595 },
    )

    expect(combined.externalCount).toBe(595)
    expect(combined.reviewCount).toBe(597)
    // (4.5×2 + 4.9×595) / 597 = 4.899… → 4.9
    expect(combined.rating).toBe(4.9)
  })

  it('falls back to counted rows when no official total was captured', () => {
    const combined = combineReviewStats(
      { rating: 0, reviewCount: 0 },
      [review({ id: 'gyg1', source: 'GETYOURGUIDE', rating: 4 })],
      null,
    )

    expect(combined).toEqual({ rating: 4, reviewCount: 1, externalCount: 1 })
  })
})

describe('aggregateProducts', () => {
  const product = (partial: Partial<ExternalReviewProduct>): ExternalReviewProduct => ({
    id: 'p1',
    source: 'TRIPADVISOR',
    tourTitle: 'Tour',
    tourUrl: 'https://example.com',
    rating: null,
    reviewCount: null,
    distribution: null,
    ...partial,
  })

  it('weights multiple matched products by their official counts', () => {
    const aggregate = aggregateProducts([
      product({ id: 'ta', source: 'TRIPADVISOR', rating: 4.9, reviewCount: 595 }),
      product({ id: 'gyg', source: 'GETYOURGUIDE', rating: 4.8, reviewCount: 9 }),
    ])

    // (4.9×595 + 4.8×9) / 604 = 4.898… → 4.9
    expect(aggregate).toEqual({ rating: 4.9, reviewCount: 604 })
  })

  it('subtracts a 1★ bucket that a stale dataset still carries', () => {
    const aggregate = aggregateProducts([
      product({
        rating: 4.9,
        reviewCount: 595,
        distribution: { 5: 548, 4: 33, 3: 5, 2: 2, 1: 7 },
      }),
    ])

    // 595 − 7 = 588; (4.9×595 − 7) / 588 = 4.95 → 4.9
    expect(aggregate).toEqual({ rating: 4.9, reviewCount: 588 })
  })

  it('returns null when no product carries official totals', () => {
    expect(aggregateProducts([product({ rating: 4.9, reviewCount: null })])).toBeNull()
    expect(aggregateProducts([])).toBeNull()
  })
})

describe('combinedExternalDistribution', () => {
  const product = (partial: Partial<ExternalReviewProduct>): ExternalReviewProduct => ({
    id: 'p1',
    source: 'TRIPADVISOR',
    tourTitle: 'Tour',
    tourUrl: 'https://example.com',
    rating: 4.9,
    reviewCount: 595,
    distribution: null,
    ...partial,
  })

  it('sums complete official distributions and drops the 1★ bucket', () => {
    const distribution = combinedExternalDistribution([
      product({ id: 'ta', distribution: { 5: 548, 4: 33, 3: 5, 2: 2, 1: 7 } }),
      product({ id: 'gyg', reviewCount: 2, distribution: { 5: 2, 4: 0, 3: 0, 2: 0, 1: 0 } }),
    ])

    expect(distribution).toEqual({ 5: 550, 4: 33, 3: 5, 2: 2, 1: 0 })
  })

  it('scales a sampled product up to its official total when no distribution exists', () => {
    const distribution = combinedExternalDistribution(
      [product({ id: 'gyg', source: 'GETYOURGUIDE', reviewCount: 10, distribution: null })],
      [
        review({ id: 'g1', source: 'GETYOURGUIDE', rating: 5, productId: 'gyg' }),
        review({ id: 'g2', source: 'GETYOURGUIDE', rating: 4, productId: 'gyg' }),
      ],
    )

    // 1×5★ / 1×4★ stretched to the official 10 reviews.
    expect(distribution).toEqual({ 5: 5, 4: 5, 3: 0, 2: 0, 1: 0 })
  })

  it('returns null when no product has official totals', () => {
    expect(combinedExternalDistribution([product({ reviewCount: null, distribution: null })])).toBeNull()
  })
})

describe('scaleDistribution', () => {
  it('splits proportionally with largest-remainder rounding', () => {
    expect(scaleDistribution({ 5: 2, 4: 1, 3: 0, 2: 0, 1: 0 }, 10)).toEqual({
      5: 7,
      4: 3,
      3: 0,
      2: 0,
      1: 0,
    })
  })

  it('assigns everything to a single sampled star', () => {
    expect(scaleDistribution({ 5: 20, 4: 0, 3: 0, 2: 0, 1: 0 }, 149)).toEqual({
      5: 149,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    })
  })

  it('always sums exactly to the requested total', () => {
    const scaled = scaleDistribution({ 5: 3, 4: 3, 3: 2, 2: 1, 1: 1 }, 97)
    expect(Object.values(scaled).reduce((a, b) => a + b, 0)).toBe(97)
  })

  it('returns zeros for an empty sample or zero total', () => {
    expect(scaleDistribution({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }, 50)).toEqual({
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    })
    expect(scaleDistribution({ 5: 5, 4: 0, 3: 0, 2: 0, 1: 0 }, 0)).toEqual({
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    })
  })
})

describe('isVisibleExternalReview', () => {
  it('hides 1-star TripAdvisor / GetYourGuide rows only', () => {
    expect(isVisibleExternalReview(review({ id: 'ta1', source: 'TRIPADVISOR', rating: 1 }))).toBe(false)
    expect(isVisibleExternalReview(review({ id: 'gyg1', source: 'GETYOURGUIDE', rating: 1 }))).toBe(false)
    expect(isVisibleExternalReview(review({ id: 'ta2', source: 'TRIPADVISOR', rating: 2 }))).toBe(true)
    expect(isVisibleExternalReview(review({ id: 'gyg2', source: 'GETYOURGUIDE', rating: 5 }))).toBe(true)
  })

  it('keeps the stricter Google policy (nothing at 3 stars or below)', () => {
    expect(isVisibleExternalReview(review({ id: 'g1', source: 'GOOGLE', rating: 3 }))).toBe(false)
    expect(isVisibleExternalReview(review({ id: 'g2', source: 'GOOGLE', rating: 4 }))).toBe(true)
  })

  it('hides rating-only reviews and the placeholder text', () => {
    expect(isVisibleExternalReview(review({ id: 'ta1', source: 'TRIPADVISOR', rating: 5, text: '(No review text)' }))).toBe(false)
    expect(isVisibleExternalReview(review({ id: 'gyg1', source: 'GETYOURGUIDE', rating: 5, text: '   ' }))).toBe(false)
    expect(isVisibleExternalReview(review({ id: 'gyg2', source: 'GETYOURGUIDE', rating: 5, text: '' }))).toBe(false)
    expect(isVisibleExternalReview(review({ id: 'ta2', source: 'TRIPADVISOR', rating: 5, text: 'Great tour!' }))).toBe(true)
  })
})

/**
 * Regression: the scraped dataset is one company's TripAdvisor / GetYourGuide
 * listings (it carries no operator field), while matching is title-based. A
 * competitor publishing the same itinerary must never inherit that social proof
 * — reported as a Kadelo Travels tour showing "500+ reviews" with zero in-app
 * reviews of its own.
 */
describe('scraped review supplier scope', () => {
  const ENTITY = 'Expedition-Go Tours LTD'
  const capeCoastTitle = 'Cape Coast Castle and Kakum National Park Day Tour'

  const kadeloTour = { title: capeCoastTitle, location: 'Accra, Ghana', supplierName: 'Kadelo Travels' }
  const entityTour = { title: capeCoastTitle, location: 'Accra, Ghana', supplierName: ENTITY }

  it("matches the scraped Cape Coast products for the operator's own tour", () => {
    const matched = selectMatchedProducts(scrapedProducts, entityTour)
    expect(matched.length).toBeGreaterThan(0)
    const total = matched.reduce((sum, p) => sum + (Number(p.reviewCount) || 0), 0)
    expect(total).toBeGreaterThan(500)
  })

  it("gives another operator's identically-titled tour nothing", () => {
    expect(selectMatchedProducts(scrapedProducts, kadeloTour)).toEqual([])
  })

  it('fails closed when a tour carries no supplier at all', () => {
    expect(selectMatchedProducts(scrapedProducts, { title: capeCoastTitle, location: 'Accra, Ghana' })).toEqual([])
    expect(
      selectMatchedProducts(scrapedProducts, { title: capeCoastTitle, location: 'Accra, Ghana', supplierName: null }),
    ).toEqual([])
  })

  it('still matches the same product list when the supplier fields match loosely', () => {
    const looselyNamed = { ...entityTour, supplierName: 'Expedition Go Tours Ltd' }
    expect(selectMatchedProducts(scrapedProducts, looselyNamed).length).toBeGreaterThan(0)
  })
})

describe('scraped headline numbers with the real dataset', () => {
  const ENTITY = 'Expedition-Go Tours LTD'
  const title = 'Cape Coast Castle and Kakum National Park Day Tour'
  const local = { title, location: 'Accra, Ghana' }

  function headline(supplierName: string, inApp: { rating: number; reviewCount: number }) {
    const products = selectMatchedProducts(scrapedProducts, { ...local, supplierName })
    return combineReviewStats(inApp, [], aggregateProducts(products))
  }

  it("keeps the operator's own 588 + 208 scraped reviews on its tour", () => {
    // Real in-app numbers for the storefront's Cape Coast tour (4 reviews).
    const stats = headline(ENTITY, { rating: 5, reviewCount: 4 })
    expect(stats.externalCount).toBeGreaterThan(500)
    expect(stats.reviewCount).toBe(stats.externalCount + 4)
  })

  it('leaves another operator with its in-app numbers only (none yet)', () => {
    const stats = headline('Kadelo Travels', { rating: 0, reviewCount: 0 })
    expect(stats.externalCount).toBe(0)
    expect(stats.reviewCount).toBe(0)
  })
})

describe('selectSupplierReviewData', () => {
  const scrapedSupplier = 'Expedition-Go Tours LTD'

  function statsProduct(
    over: Partial<ExternalReviewStatsProduct> & Pick<ExternalReviewStatsProduct, 'id' | 'tourTitle'>,
  ): ExternalReviewStatsProduct {
    return {
      source: 'TRIPADVISOR',
      tourUrl: 'https://example.com/product',
      rating: null,
      reviewCount: null,
      distribution: null,
      resolvedDistribution: null,
      official: false,
      ...over,
    }
  }

  function statsData(over: Partial<ExternalReviewStatsData> = {}): ExternalReviewStatsData {
    return {
      stats: { totalReviews: 0, averageRating: null, platforms: [] },
      products: [],
      productAggregates: {},
      featuredReviews: [],
      ...over,
    }
  }

  it("merges every product matched to the supplier's tours into one summary", () => {
    const data = statsData({
      products: [
        statsProduct({
          id: 'p1',
          tourTitle: 'Accra City Tour',
          rating: 4.8,
          reviewCount: 100,
          distribution: { 5: 90, 4: 7, 3: 2, 2: 1 },
          resolvedDistribution: { 5: 90, 4: 7, 3: 2, 2: 1, 1: 0 },
          official: true,
        }),
        statsProduct({
          id: 'p2',
          tourTitle: 'Cape Coast Castles',
          rating: 4.9,
          reviewCount: 50,
          resolvedDistribution: { 5: 50, 4: 0, 3: 0, 2: 0, 1: 0 },
          official: true,
        }),
      ],
      featuredReviews: [
        review({ id: 'r1', source: 'TRIPADVISOR', rating: 5, tourTitle: 'Accra City Tour', productId: 'p1' }),
        review({ id: 'r2', source: 'TRIPADVISOR', rating: 5, tourTitle: 'Cape Coast Castles', productId: 'p2' }),
        review({ id: 'r3', source: 'TRIPADVISOR', rating: 5, tourTitle: 'Somewhere Else', productId: 'other' }),
      ],
    })

    const result = selectSupplierReviewData(data, [
      { title: 'Accra City Tour', location: 'Accra, Ghana', supplierName: scrapedSupplier },
      { title: 'Cape Coast Castles', location: 'Cape Coast, Ghana', supplierName: scrapedSupplier },
    ])

    // (100 × 4.8 + 50 × 4.9) / 150 = 4.83 → 4.8
    expect(result.summary.count).toBe(150)
    expect(result.summary.rating).toBe(4.8)
    expect(result.summary.distribution?.[5]).toBe(140)
    // Only the rows belonging to the matched products survive.
    expect(result.reviews.map((r) => r.id)).toEqual(['r1', 'r2'])
  })

  it('fails closed for other operators and falls back to their in-app totals', () => {
    const data = statsData({
      products: [statsProduct({ id: 'p1', tourTitle: 'Accra City Tour', rating: 4.8, reviewCount: 100 })],
    })

    const result = selectSupplierReviewData(data, [
      { title: 'Accra City Tour', supplierName: 'Kadelo Travels', rating: '4.5', reviews: 10 },
    ])

    expect(result.summary).toEqual({ rating: 4.5, count: 10, distribution: null })
    expect(result.reviews).toEqual([])
  })

  it('returns an empty summary when there is nothing to show', () => {
    expect(selectSupplierReviewData(undefined, [])).toEqual({
      summary: { rating: null, count: 0, distribution: null },
      reviews: [],
    })
  })
})
