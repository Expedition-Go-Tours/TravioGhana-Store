/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

// Native require keeps the .cjs scraper helpers usable from the Vite test
// pipeline exactly as the scraper itself loads them.
const require = createRequire(import.meta.url)
const {
  buildTripAdvisorPageUrl,
  buildGetYourGuidePageUrl,
  dedupeReviews,
  parseTripAdvisorProductHeader,
  parseGetYourGuideProductHeader,
  excludeOneStarReviews,
  excludeOneStarFromProductHeader,
  productIdFrom,
} = require('../../scripts/review-scrape-utils.cjs')

const TA_URL =
  'https://www.tripadvisor.com/AttractionProductReview-g293797-d24189724-Cape_Coast_Castle_Elmina_Castle_Kakum_National_Park_Day_Tour-Accra_Greater_Accra.html'

describe('buildTripAdvisorPageUrl', () => {
  it('leaves page 1 untouched', () => {
    expect(buildTripAdvisorPageUrl(TA_URL, 1)).toBe(TA_URL)
  })

  it('inserts the -or offset TripAdvisor canonicalizes to', () => {
    expect(buildTripAdvisorPageUrl(TA_URL, 2)).toBe(
      'https://www.tripadvisor.com/AttractionProductReview-g293797-d24189724-or10-Cape_Coast_Castle_Elmina_Castle_Kakum_National_Park_Day_Tour-Accra_Greater_Accra.html',
    )
    expect(buildTripAdvisorPageUrl(TA_URL, 3)).toContain('-or20-')
  })

  it('replaces an existing offset instead of nesting it', () => {
    const page2 = buildTripAdvisorPageUrl(TA_URL, 2)
    expect(buildTripAdvisorPageUrl(page2, 5)).toContain('-or40-')
    expect(buildTripAdvisorPageUrl(page2, 5)).not.toContain('or10')
  })
})

describe('buildGetYourGuidePageUrl', () => {
  const GYG_URL = 'https://www.getyourguide.com/accra-l506/cape-coast-t834942/'

  it('leaves page 1 untouched', () => {
    expect(buildGetYourGuidePageUrl(GYG_URL, 1)).toBe(GYG_URL)
  })

  it('adds a page param and preserves query strings', () => {
    expect(buildGetYourGuidePageUrl(GYG_URL, 2)).toBe(`${GYG_URL}?page=2`)
    expect(buildGetYourGuidePageUrl(`${GYG_URL}?sort=recent`, 3)).toBe(`${GYG_URL}?sort=recent&page=3`)
  })
})

describe('dedupeReviews', () => {
  it('keeps the first occurrence of each id', () => {
    const reviews = dedupeReviews([
      { id: 'a', rating: 5 },
      { id: 'b', rating: 4 },
      { id: 'a', rating: 1 },
    ])

    expect(reviews).toEqual([
      { id: 'a', rating: 5 },
      { id: 'b', rating: 4 },
    ])
  })
})

describe('parseTripAdvisorProductHeader', () => {
  it('reads the current review badge format', () => {
    expect(parseTripAdvisorProductHeader('4.9 (595 reviews) Superb • 97% Recommend')).toEqual({
      rating: 4.9,
      reviewCount: 595,
      distribution: null,
    })
  })

  it('reads the product block, not the operator aggregate', () => {
    // Mirrors the live page: product header first, operator total later.
    const text =
      'Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour 4.9 of 5 bubbles(595 reviews) ' +
      'Recommended by 97% of travelers Excellent548Good33Average5Poor2Terrible7 ' +
      'Expedition-Go Tours Ltd 4.9 of 5 bubbles(938 reviews)'

    expect(parseTripAdvisorProductHeader(text)).toEqual({
      rating: 4.9,
      reviewCount: 595,
      distribution: { 5: 548, 4: 33, 3: 5, 2: 2, 1: 7 },
    })
  })

  it('returns nulls when no review header is present', () => {
    // The scraper always feeds the product badge first; with no badge and no
    // "of 5 bubbles" block there is nothing product-level to read.
    expect(parseTripAdvisorProductHeader('Welcome to TripAdvisor')).toEqual({
      rating: null,
      reviewCount: null,
      distribution: null,
    })
    expect(parseTripAdvisorProductHeader('')).toEqual({ rating: null, reviewCount: null, distribution: null })
  })
})

describe('parseGetYourGuideProductHeader', () => {
  it('reads a rating and count when the header is present', () => {
    expect(parseGetYourGuideProductHeader('4.8 (293 reviews)')).toEqual({
      rating: 4.8,
      reviewCount: 293,
      distribution: null,
    })
  })

  it('returns nulls when nothing matches', () => {
    expect(parseGetYourGuideProductHeader('Accra')).toEqual({ rating: null, reviewCount: null, distribution: null })
  })
})

describe('productIdFrom', () => {
  it('keys TripAdvisor products by their d-id', () => {
    expect(productIdFrom('TRIPADVISOR', TA_URL)).toBe('tripadvisor-24189724')
  })

  it('keys GetYourGuide products by their last path segment', () => {
    expect(productIdFrom('GETYOURGUIDE', 'https://www.getyourguide.com/accra-l506/cape-coast-t834942/')).toBe(
      'getyourguide-cape-coast-t834942',
    )
  })
})

describe('excludeOneStarReviews', () => {
  it('drops 1-star TripAdvisor / GetYourGuide rows but never Google rows', () => {
    const rows = [
      { id: 'ta1', source: 'TRIPADVISOR', rating: 1 },
      { id: 'ta2', source: 'TRIPADVISOR', rating: 5 },
      { id: 'gyg1', source: 'GETYOURGUIDE', rating: 1 },
      { id: 'g1', source: 'GOOGLE', rating: 1 },
    ]

    const kept = excludeOneStarReviews(rows) as { id: string }[]
    expect(kept.map((row) => row.id)).toEqual(['ta2', 'g1'])
  })
})

describe('excludeOneStarFromProductHeader', () => {
  it('removes the 1-star bucket and recomputes count and rating', () => {
    const header = excludeOneStarFromProductHeader({
      rating: 4.9,
      reviewCount: 595,
      distribution: { 5: 548, 4: 33, 3: 5, 2: 2, 1: 7 },
    })

    expect(header.reviewCount).toBe(588)
    expect(header.distribution).toEqual({ 5: 548, 4: 33, 3: 5, 2: 2 })
    // (548�5 + 33�4 + 5�3 + 2�2) / 588 = 4.92 ? 4.9
    expect(header.rating).toBe(4.9)
  })

  it('leaves headers without a distribution untouched', () => {
    const header = { rating: 4.6, reviewCount: 149, distribution: null }
    expect(excludeOneStarFromProductHeader(header)).toBe(header)
  })
})
