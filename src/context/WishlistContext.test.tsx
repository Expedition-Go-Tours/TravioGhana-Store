import { describe, it, expect } from 'vitest'
import { toWishlistItem, mergeWishlistItem, type WishlistItem } from './WishlistContext'
import type { SpecialOfferData } from '../hooks/useExpeditionTours'

/**
 * The wishlist item is the snapshot the wishlist page renders from, so it must
 * carry every field a card paints — including the promo state. The login sync
 * then merges a server item back in without dropping those captured fields.
 */

const offer = (over: Partial<SpecialOfferData> = {}): SpecialOfferData => ({
  id: 'offer-1',
  name: 'Summer Sale',
  offerType: 'LIMITED_TIME',
  discountType: 'PERCENTAGE',
  discountPercentage: 30,
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
  earlyBirdAdvanceDays: null,
  lastMinuteWindowHours: null,
  targets: [],
  ...over,
})

describe('toWishlistItem', () => {
  it('captures the full card payload, promo state included', () => {
    const offers = [offer()]
    const item = toWishlistItem({
      id: 'tour-1',
      title: 'Accra City Tour',
      category: 'Tour',
      duration: '8 hours',
      features: 'Guide included · Lunch included',
      price: '$120',
      priceValue: 120,
      rating: '4.8',
      reviews: 42,
      location: 'Accra, Ghana',
      image: 'https://example.com/a.jpg',
      photos: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
      slug: 'accra-city-tour',
      supplierName: 'Expedition-Go Tours Ltd',
      source: 'expedition-go',
      languages: ['English'],
      difficulty: 'Easy',
      cancellationPolicy: 'Free cancellation up to 24 hours before start time',
      pickupIncluded: true,
      accommodationIncluded: true,
      meetingMode: 'pickup',
      discount: '-30%',
      specialOffers: offers,
    })

    expect(item).toMatchObject({
      id: 'tour-1',
      tourId: 'tour-1',
      slug: 'accra-city-tour',
      title: 'Accra City Tour',
      category: 'Tour',
      price: 120,
      duration: '8 hours',
      features: 'Guide included · Lunch included',
      photos: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
      languages: ['English'],
      difficulty: 'Easy',
      cancellationPolicy: 'Free cancellation up to 24 hours before start time',
      pickupIncluded: true,
      accommodationIncluded: true,
      meetingMode: 'pickup',
      discount: '-30%',
      supplierName: 'Expedition-Go Tours Ltd',
    })
    expect(item.specialOffers).toEqual(offers)
  })

  it('falls back to highlights for multi-day content and parses the price string', () => {
    const item = toWishlistItem({
      title: '3 Day Safari',
      days: '3 Days',
      highlights: 'Park fees · Guide · Accommodation',
      price: '$1,250',
      rating: '4.9',
      reviews: 10,
      location: 'Accra, Ghana',
      image: 'https://example.com/safari.jpg',
    } as never)

    expect(item.features).toBe('Park fees · Guide · Accommodation')
    expect(item.duration).toBe('3 Days')
    expect(item.price).toBe(1250)
    // No backend id means the legacy synthetic id, and no server sync.
    expect(item.tourId).toBeUndefined()
  })

  it('stores empty arrays as absent rather than empty values', () => {
    const item = toWishlistItem({
      title: 'Accra City Tour',
      category: 'Tour',
      duration: '8 hours',
      features: '',
      price: '$120',
      rating: '4.8',
      reviews: 0,
      location: 'Accra, Ghana',
      image: 'https://example.com/a.jpg',
      photos: [],
      languages: [],
      specialOffers: [],
    })

    expect(item.photos).toBeUndefined()
    expect(item.languages).toBeUndefined()
    expect(item.specialOffers).toBeUndefined()
    expect(item.discount).toBeUndefined()
  })
})

describe('mergeWishlistItem', () => {
  const server: WishlistItem = {
    id: 'tour-1',
    tourId: 'tour-1',
    title: 'Accra City Tour',
    location: 'Accra, Ghana',
    price: 120,
    duration: '8 hours',
    imageUrl: 'https://example.com/a.jpg',
    rating: 4.8,
    reviewCount: 42,
    addedDate: '2026-01-01T00:00:00.000Z',
  }

  it('fills display fields the server copy lacks from the local snapshot', () => {
    const local: WishlistItem = {
      ...server,
      features: 'Guide included · Lunch included',
      photos: ['https://example.com/a.jpg'],
      languages: ['English'],
      specialOffers: [offer()],
    }

    const merged = mergeWishlistItem(server, local)

    expect(merged.features).toBe('Guide included · Lunch included')
    expect(merged.photos).toEqual(['https://example.com/a.jpg'])
    expect(merged.languages).toEqual(['English'])
    expect(merged.specialOffers).toEqual([offer()])
  })

  it('keeps server values when the server copy has them', () => {
    const merged = mergeWishlistItem(
      { ...server, features: 'Server highlights', price: 99 },
      { ...server, features: 'Local highlights' },
    )

    expect(merged.features).toBe('Server highlights')
    expect(merged.price).toBe(99)
  })

  it('treats empty server arrays as missing and returns the server item without a local copy', () => {
    const local: WishlistItem = { ...server, photos: ['https://example.com/a.jpg'] }

    expect(mergeWishlistItem({ ...server, photos: [] }, local).photos).toEqual(['https://example.com/a.jpg'])
    expect(mergeWishlistItem(server)).toEqual(server)
  })
})
