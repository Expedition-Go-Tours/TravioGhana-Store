import { describe, expect, it } from 'vitest'

import { mapOfferToCardProps } from './LastMinuteDealsSection'
import { tourPath } from '../lib/tourPath'
import type { HomepageOfferTour, SpecialOfferData } from '../hooks/useHomepageSections'

/**
 * The last-minute section mapped `id: t.offerId` — the *offer row's* id, not the
 * tour's. The two are different entities and are never equal: 0 of 10 in the
 * live /homepage/offers response.
 *
 * `id` is the card's identity everywhere downstream, so the mistake showed up in
 * three places at once:
 *
 *   1. TourCard's href, built with tourPath(id, slug) -> /tour/{offerId}/{slug},
 *      while the page self-canonicals to /tour/{tourId}/{slug}. Both render the
 *      same tour, so the link worked; it just pointed at a URL the site itself
 *      calls non-canonical, and the homepage JSON-LD disagreed with the HTML
 *      about which id the tour had.
 *   2. `toWishlistItem` -> tourId, so the same tour saved from this rail and
 *      from any other section became two separate wishlist entries.
 *   3. The sell-out tag, which matches on id before falling back to title, so
 *      it could only ever match on title here.
 *
 * Worth being precise about what this was *not*: the links did not 404. An
 * earlier check against GET /tours/:id said they did, but that endpoint returns
 * "Tour not found" for every id on this prefix — valid tours included — so it
 * could not distinguish a correct id from an incorrect one. The slug is what
 * actually resolves the route. These tests assert the id and the URL the card
 * produces; the liveness of the URL is the backend's business, not this
 * mapper's.
 */

/** A real offer row's two distinct ids, as the API returns them. */
const TOUR_ID = 'cmt8hjkii00bo646phdiznmrr'
const OFFER_ID = 'cmt8txcri0465646pa9y6d76n'

function offer(over: Partial<HomepageOfferTour> = {}): HomepageOfferTour {
  return {
    id: TOUR_ID,
    title: 'Cape Coast Castle, Elmina Castle & Kakum National Park Tour',
    slug: 'cape-coast-castle-elmina-castle-kakum-national-park-tour',
    coverPhoto: 'https://res.cloudinary.com/demo/cape-coast.jpg',
    photos: [],
    category: 'Historical & Cultural',
    city: 'Cape Coast',
    country: 'Ghana',
    averageRating: 4.7,
    reviewCount: 22,
    totalBookings: 130,
    startingPrice: 90,
    currency: 'USD',
    durationMinutes: 540,
    difficulty: null,
    tags: ['castle', 'unesco'],
    supplier: null,
    // The offer row's own identity, and the fields that belong to it.
    offerId: OFFER_ID,
    offerName: 'Early Booking',
    offerType: 'PERCENTAGE',
    discountType: 'PERCENTAGE',
    discountPercentage: 15,
    fixedDiscountValue: null,
    startDate: null,
    endDate: null,
    specialOffers: [],
    ...over,
  }
}

describe('mapOfferToCardProps', () => {
  it('gives the card the tour id, not the offer id', () => {
    // The one-line defect. Asserted with both ids present in the fixture, so a
    // future "simplification" back to offerId cannot pass.
    expect(mapOfferToCardProps(offer()).id).toBe(TOUR_ID)
    expect(mapOfferToCardProps(offer()).id).not.toBe(OFFER_ID)
  })

  it('builds a card link under the tour id, matching the page canonical', () => {
    // The defect as the user met it. The route resolves either segment, so the
    // old link rendered the right tour — but the page self-canonicals to the
    // tourId form, so the card pointed at a URL the site calls non-canonical.
    const card = mapOfferToCardProps(offer())
    const href = tourPath(card.id, card.slug)
    expect(href).toBe(`/tour/${TOUR_ID}/cape-coast-castle-elmina-castle-kakum-national-park-tour`)
    expect(href).not.toContain(OFFER_ID)
  })

  it('matches the sell-out list on id, not only on title', () => {
    // SellOutProvider keys on id first and falls back to a normalized title.
    // With an offerId the id half could never match, so a sell-out tour shown
    // in this rail lost its badge whenever the title differed at all — a
    // retitle, a stray space, punctuation.
    const card = mapOfferToCardProps(offer())
    const sellOutIds = new Set([TOUR_ID])
    expect(sellOutIds.has(card.id)).toBe(true)
  })

  it('stores a tourId that de-duplicates against every other section', () => {
    // Wishlist.toCardProps uses `item.tourId || item.id`, and the wishlist keys
    // on it. An offer id meant the same tour saved from this rail and from the
    // recommended rail were two entries — the visitor's fault list silently
    // doubled.
    const card = mapOfferToCardProps(offer())
    const wishlistKey = card.id
    const keySavedFromRecommendedRail = TOUR_ID
    expect(wishlistKey).toBe(keySavedFromRecommendedRail)
  })

  it('still carries the offer data, which is what this section is for', () => {
    // Guards against a fix that "resolves" the bug by dropping the offer
    // fields — the discount label is the section's reason to exist.
    const card = mapOfferToCardProps(offer())
    expect(card.discount).toBe('-15%')
    expect(card.price).toBe('$90')
    expect(card.priceValue).toBe(90)
  })

  it('reads the percentage off the offer rather than assuming one', () => {
    // The fixture above uses 15%, so a hardcoded `-15%` would pass every other
    // assertion here. Pin a second, different rate.
    expect(mapOfferToCardProps(offer({ discountPercentage: 30 })).discount).toBe('-30%')
  })

  it('keeps specialOffers on the card', () => {
    // Note the offer row's own `id` inside the offer data is legitimate — it is
    // the badge's identity, not the card's. Only the card's `id` had to change.
    const specialOffers: SpecialOfferData[] = [
      {
        id: OFFER_ID,
        name: 'Early Booking',
        offerType: 'EARLY_BIRD',
        discountType: 'PERCENTAGE',
        discountPercentage: 15,
        fixedDiscountValue: null,
        startDate: null,
        endDate: null,
        promoCode: null,
        timeSlotMode: 'ALL_DAYS',
        specificWeekdays: [],
        capacityType: 'UNLIMITED',
        maxSpots: null,
        spotsSold: null,
        minQuantity: null,
        minSpendAmount: null,
        maxRedemptionsPerCustomer: null,
        stackable: false,
        earlyBirdAdvanceDays: 30,
        lastMinuteWindowHours: null,
        targets: [{ tourId: TOUR_ID, tourOptionKey: null, tourOptionLabel: null }],
      },
    ]
    const card = mapOfferToCardProps(offer({ specialOffers }))
    expect(card.specialOffers).toBe(specialOffers)
    // The card links to the tour; the badge still carries the offer's id.
    expect(card.id).toBe(TOUR_ID)
    expect(card.specialOffers![0].id).toBe(OFFER_ID)
  })

  it('computes a fixed-amount discount as a percentage of the starting price', () => {
    const card = mapOfferToCardProps(
      offer({ discountType: 'FIXED_AMOUNT', discountPercentage: null, fixedDiscountValue: 45 })
    )
    // $45 off a $90 tour.
    expect(card.discount).toBe('-50%')
  })

  it('omits a discount it cannot compute', () => {
    // A fixed discount with no price has no percentage; a zero one would be a
    // claim that the tour is free.
    expect(mapOfferToCardProps(offer({ discountType: 'FIXED_AMOUNT', discountPercentage: null, fixedDiscountValue: 45, startingPrice: null })).discount).toBeUndefined()
    expect(mapOfferToCardProps(offer({ discountPercentage: null, fixedDiscountValue: null })).discount).toBeUndefined()
  })

  it('carries the slug, so a retitled tour keeps a working link', () => {
    // The id is the identity; the slug is decorative but a live page should
    // still show it, since it is what the search listing used.
    expect(mapOfferToCardProps(offer()).slug).toBe('cape-coast-castle-elmina-castle-kakum-national-park-tour')
  })

  it('formats a multi-day duration in days and a short one in hours', () => {
    expect(mapOfferToCardProps(offer({ durationMinutes: 2880 })).duration).toBe('2 days')
    expect(mapOfferToCardProps(offer({ durationMinutes: 540 })).duration).toBe('9 hours')
    expect(mapOfferToCardProps(offer({ durationMinutes: null })).duration).toBe('')
  })

  it('does not crash on a tour with an empty offer id', () => {
    // Defensive: a missing offerId must not become the card's identity.
    const card = mapOfferToCardProps(offer({ offerId: '' }))
    expect(card.id).toBe(TOUR_ID)
  })
})
