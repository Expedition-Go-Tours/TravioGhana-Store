import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  combinedStatsFor,
  getMatchedTourReviews,
  selectMatchedProducts,
  type ExternalReview,
  type ExternalReviewData,
  type ExternalReviewStatsData,
  type ExternalReviewStatsProduct,
} from '../hooks/useExternalReviews'
import { declaredListingTours, listingTourTitle } from '../lib/reviewTourIdentity'
import { sameTourTitle } from '../lib/reviewTourLink'

/**
 * A scraped listing belongs to exactly one of our tours, and saying which is a
 * fact rather than a guess.
 *
 * Matching used to ask how much a platform title *resembled* each tour, with a
 * candidate list of one — so "resembled at all" was the whole test, and one
 * listing attached to every tour it vaguely resembled. The published damage was
 * real and is still on the live homepage: `Transport form Accra to Cape Coast`
 * showed 4.8 / 799, which is the 588-review Cape Coast Castle listing plus the
 * 211-review Cape Coast listing, neither of which is a transfer. Six of the
 * twelve ratings the homepage published belonged to tours that never sold the
 * listing.
 *
 * These read the committed payload, because the defect only appears with real
 * data: a fixture has no near-twin titles to confuse, and no two listings that
 * legitimately combine into 799.
 */
const ROOT = resolve(__dirname, '..', '..')
const data = JSON.parse(
  readFileSync(resolve(ROOT, 'public/data/externalReviewStats.json'), 'utf8'),
) as ExternalReviewStatsData

/** The operator whose listings were scraped — every gate below is scoped to it. */
const ENTITY = 'Expedition-Go Tours LTD'

const tour = (title: string) => ({ title, location: 'Accra, Ghana', supplierName: ENTITY })

const productsOn = (title: string): ExternalReviewStatsProduct[] =>
  selectMatchedProducts(data.products, tour(title))

const reviewsOn = (title: string): number =>
  productsOn(title).reduce((sum, product) => sum + (product.reviewCount ?? 0), 0)

/**
 * Tours that have no business claiming any listing. Several of them did: they
 * are near enough in wording to a real listing to score above zero, which was
 * the entire bug.
 */
const NOT_OURS = [
  'Transport form Accra to Cape Coast',
  'The Cape Coast Day tour with Assin Manso Slave River bath',
  'Cape Coast Castle and Kakum National Park Day Tour',
  'The Shia Hills Safari Quad-Bike Tour',
  'The Ghanaian cultural and Heritage Tour',
  'Akosombo: African spirituality shrine experience',
]

describe('a listing names one tour', () => {
  it('declares only listings the committed payload actually carries', () => {
    const declared = declaredListingTours()
    const carried = new Set(data.products.map((product) => product.id))
    expect(Object.keys(declared).length).toBeGreaterThanOrEqual(12)
    for (const [id, title] of Object.entries(declared)) {
      expect(carried.has(id), `declares ${id} (${title}) but the payload has no such listing`).toBe(true)
    }
  })

  /**
   * Failing closed is the point of the map — but it must never quietly cost
   * social proof. If a listing with real review totals is ever added to the
   * scraper without being declared, it would silently show nothing, so the gap
   * has to be loud.
   */
  it('declares every listing that carries review totals', () => {
    for (const product of data.products) {
      if (!product.reviewCount) continue
      expect(
        declaredListingTours()[product.id],
        `${product.id} ("${product.tourTitle}") carries ${product.reviewCount} reviews but was never declared`,
      ).toBeTypeOf('string')
    }
  })

  it('claims a listing for its own tour and no other', () => {
    const claimedBy = new Map<string, string[]>()
    // Deduplicated: two listings may legitimately declare the same tour, and
    // walking it twice would count the same claim twice.
    const roster = new Set([...Object.values(declaredListingTours()), ...NOT_OURS])
    for (const title of roster) {
      for (const product of productsOn(title)) {
        claimedBy.set(product.id, [...(claimedBy.get(product.id) ?? []), title])
      }
    }
    expect(claimedBy.size).toBeGreaterThan(0)
    for (const [id, titles] of claimedBy) {
      expect(titles, `${id} is claimed by ${titles.join(' and ')}`).toHaveLength(1)
    }
  })

  it('claims nothing for a listing whose own wording names no tour of ours', () => {
    const declared = declaredListingTours()
    const undeclared = data.products.filter((product) => !declared[product.id])
    // The two listings the data genuinely cannot place: an unplaceable listing
    // shows no rating rather than somebody else's. They still reach this rule —
    // undeclared listings fall through to their own platform wording, which is
    // then held to the same exact standard.
    expect(undeclared.length).toBeGreaterThan(0)
    const roster = new Set([...Object.values(declared), ...NOT_OURS])
    for (const product of undeclared) {
      const owners = [...roster].filter((title) => sameTourTitle(listingTourTitle(product), title))
      expect(owners, `${product.id} ("${product.tourTitle}") fell through onto ${owners.join(' and ')}`).toEqual([])
    }
  })

  it('gives nothing to a tour with no supplier, as before', () => {
    expect(selectMatchedProducts(data.products, { title: 'The Kumasi Cultural and Heritage Day Tour' })).toEqual([])
    expect(
      selectMatchedProducts(data.products, {
        title: 'The Kumasi Cultural and Heritage Day Tour',
        location: 'Accra, Ghana',
        supplierName: null,
      }),
    ).toEqual([])
    // Title alone must not be enough: another operator's identically-titled tour
    // takes nothing.
    expect(
      selectMatchedProducts(data.products, {
        title: 'The Kumasi Cultural and Heritage Day Tour',
        location: 'Accra, Ghana',
        supplierName: 'Kadelo Travels',
      }),
    ).toEqual([])
  })

  it('agrees with the tour the map declares', () => {
    for (const [id, title] of Object.entries(declaredListingTours())) {
      const product = data.products.find((candidate) => candidate.id === id)
      expect(product, `payload lost ${id}`).toBeDefined()
      expect(selectMatchedProducts([product!], tour(title))).toHaveLength(1)
    }
  })
})

/**
 * The arithmetic the homepage publishes, tour by tour.
 *
 * The numbers are not chosen: they are the review counts in the committed
 * payload, added up. `799` and `327` are what several tours must *not* show,
 * because that is what they showed when one listing was allowed to belong to
 * four tours at once.
 */
describe('the ratings the homepage publishes', () => {
  it('puts both Cape Coast listings on the castles tour', () => {
    expect(reviewsOn('Cape Coast Castle, Elmina Castle & Kakum National Park Tour')).toBe(799)
    const stats = combinedStatsFor(tour('Cape Coast Castle, Elmina Castle & Kakum National Park Tour'), data)
    expect(stats.externalCount).toBe(799)
    expect(stats.rating).toBeGreaterThan(0)
  })

  it('adds the GetYourGuide listing to the tour the TripAdvisor one is on', () => {
    expect(reviewsOn('From Accra : Waterfalls, Aburi Gardens & Cocoa Farm Tour')).toBe(229)
    expect(reviewsOn('Accra Guided City Tour: Cultural and Historical Experience')).toBe(327)
    expect(reviewsOn('Accra: Shai Hills Safari & Akosombo Boat Cruise Day Tour')).toBe(55)
  })

  it('keeps the single-listing tours at their own totals', () => {
    expect(reviewsOn('Private Accra International Airport Pickup & Dropoff')).toBe(6)
    expect(reviewsOn('The Kumasi Cultural and Heritage Day Tour')).toBe(1)
  })

  it('publishes nothing on the transport listing', () => {
    expect(productsOn('Transport form Accra to Cape Coast')).toEqual([])
    expect(reviewsOn('Transport form Accra to Cape Coast')).toBe(0)
    const stats = combinedStatsFor(tour('Transport form Accra to Cape Coast'), data)
    expect(stats.externalCount).toBe(0)
    expect(stats.rating).toBe(0)
  })

  it('publishes nothing on any tour that never sold one of these listings', () => {
    for (const title of NOT_OURS) {
      expect(productsOn(title), `${title} claimed a listing it never sold`).toEqual([])
    }
  })
})

/**
 * Rows whose `productId` is null cannot be resolved through the map, so the
 * title is all they have. They still have to be held to the same standard: a
 * title that *is* a tour, not one that merely resembles it. The 44 such rows in
 * the payload are business-level Google reviews titled "Travio Ghana LTD", but
 * the rule has to hold for a tour-titled row too — otherwise a fuzzy fallback
 * puts one row on every tour with a similar name.
 */
describe('a row with no listing id', () => {
  const row = (id: string, tourTitle: string): ExternalReview => ({
    id,
    source: 'TRIPADVISOR',
    reviewerName: 'Test Reviewer',
    reviewerAvatar: null,
    rating: 5,
    title: null,
    text: 'Review text',
    textTruncated: null,
    tourTitle,
    tourThumbnail: null,
    tourUrl: 'https://example.com/tour',
    tourLink: 'https://example.com/tour',
    coverPhoto: null,
    originalDate: null,
    productId: null,
    productRating: null,
    productReviewCount: null,
  })

  const withRows = (reviews: ExternalReview[]): ExternalReviewData => ({ products: [], reviews })

  it('shows on the one tour it names', () => {
    const data = withRows([row('r-exact', 'The Kumasi Cultural and Heritage Day Tour')])
    const matched = getMatchedTourReviews(data, tour('The Kumasi Cultural and Heritage Day Tour'))
    expect(matched.rows.map((review) => review.id)).toEqual(['r-exact'])
  })

  /**
   * The near-twin is the whole point: `Cape Coast Castle and Kakum National
   * Park Day Tour` and `Cape Coast Castle, Elmina Castle & Kakum National Park
   * Tour` share five of six distinctive tokens, so title *similarity* scores it
   * high against both this tour and the transfer. Neither may show it.
   */
  it('shows nowhere when it only resembles a tour', () => {
    const near = 'Cape Coast Castle and Kakum National Park Day Tour'
    const data = withRows([row('r-near', near)])
    expect(getMatchedTourReviews(data, tour('Cape Coast Castle, Elmina Castle & Kakum National Park Tour')).rows).toEqual([])
    expect(getMatchedTourReviews(data, tour('Transport form Accra to Cape Coast')).rows).toEqual([])
    expect(getMatchedTourReviews(data, tour('Cape Coast Castle and Kakum National Park Day Tour')).rows).toHaveLength(1)
  })
})

describe('sameTourTitle', () => {
  it('ignores punctuation, spacing and marketing padding', () => {
    expect(sameTourTitle('From Accra : Waterfalls, Aburi Gardens & Cocoa Farm Tour', 'From Accra: Waterfalls, Aburi Gardens & Cocoa Farm Day Tour')).toBe(true)
    expect(sameTourTitle('Cape Coast Castle, Elmina Castle & Kakum National Park Tour', 'Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour')).toBe(true)
    // '&' normalises to 'and', which is then a stop word either way.
    expect(sameTourTitle('Cape Coast Castle, Elmina Castle & Kakum National Park Tour', 'Cape Coast Castle, Elmina Castle and Kakum National Park Day Tour')).toBe(true)
    expect(sameTourTitle('From Accra : Waterfalls, Aburi Gardens & Cocoa Farm Tour', 'From Accra: Waterfalls, Aburi Gardens and Cocoa Farm Tour')).toBe(true)
    // Conservative singularizer: "Waterfalls" is the same word as "Waterfall".
    expect(sameTourTitle('From Accra : Waterfalls, Aburi Gardens & Cocoa Farm Tour', 'From Accra: Waterfall, Aburi Gardens & Cocoa Farm Day Tour')).toBe(true)
  })

  /**
   * The distinction the similarity score could not make: two titles can share
   * every token that matters and still describe different products, and one can
   * score highly on overlap while naming something else entirely.
   */
  it('refuses tours that differ in what they actually visit', () => {
    expect(sameTourTitle('Cape Coast Castle, Elmina Castle & Kakum National Park Tour', 'Cape Coast Castle and Kakum National Park Day Tour')).toBe(false)
    expect(sameTourTitle('Cape Coast Castle, Elmina Castle & Kakum National Park Tour', 'Transport form Accra to Cape Coast')).toBe(false)
    expect(sameTourTitle('Accra: Shai Hills Safari & Akosombo Boat Cruise Day Tour', 'The Shia Hills Safari Quad-Bike Tour')).toBe(false)
    expect(sameTourTitle('From Accra : Waterfalls, Aburi Gardens & Cocoa Farm Tour', 'Waterfalls Massage With Aburi Gardens & Cocoa Farm Activity')).toBe(false)
  })

  it('refuses empty, missing and business-level titles', () => {
    expect(sameTourTitle('', 'The Kumasi Cultural and Heritage Day Tour')).toBe(false)
    expect(sameTourTitle(null, 'The Kumasi Cultural and Heritage Day Tour')).toBe(false)
    expect(sameTourTitle(undefined, undefined)).toBe(false)
    expect(sameTourTitle('Travio Ghana LTD', 'The Kumasi Cultural and Heritage Day Tour')).toBe(false)
    expect(sameTourTitle('The Kumasi Cultural and Heritage Day Tour', 'The Kumasi Cultural and Heritage Day Tour')).toBe(true)
  })
})
