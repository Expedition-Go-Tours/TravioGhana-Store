import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { ComponentProps } from 'react'
import type { SpecialOfferData } from '../hooks/useExpeditionTours'

/**
 * Un-hearting a card used to be silent while saving one toasted. The wishlist
 * page lost its own confirmation when it moved to this card, so removal now
 * answers with the same kind of toast the save does.
 *
 * Saving must also snapshot the card's full display payload — features,
 * badges and the promo it is showing — because the wishlist card is rendered
 * from that snapshot.
 */

const state = vi.hoisted(() => ({
  inWishlist: true,
  captured: null as Record<string, unknown> | null,
  removeFromWishlist: vi.fn(),
  addToWishlist: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { success: state.success, error: state.error } }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../context/WishlistContext', () => ({
  useWishlist: () => ({
    isInWishlist: () => state.inWishlist,
    addToWishlist: state.addToWishlist,
    removeFromWishlist: state.removeFromWishlist,
  }),
  // Record the snapshot the card passes, then echo the card's own id so the
  // toast assertions still prove what the card did.
  toWishlistItem: (tour: Record<string, unknown>) => {
    state.captured = tour
    return { id: tour.id }
  },
}))
vi.mock('../context/SellOutContext', () => ({
  useSellOutContext: () => ({ isLikelyToSellOut: () => false }),
}))
vi.mock('../hooks/useExternalReviews', () => ({
  useCombinedTourStats: () => ({ rating: 5, reviewCount: 12, externalCount: 0 }),
}))
vi.mock('./FormattedPrice', () => ({
  default: ({ usdPrice }: { usdPrice?: number }) => <span data-testid="price">{usdPrice}</span>,
}))

import TourCard from './TourCard'

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

const baseProps: ComponentProps<typeof TourCard> = {
  id: 'tour-1',
  title: 'Accra City Tour',
  slug: 'accra-city-tour',
  category: 'Tour',
  duration: '8 hours',
  features: 'Guide, Lunch',
  price: '120',
  priceValue: 120,
  rating: '4.8',
  reviews: 42,
  location: 'Accra',
  image: 'https://res.cloudinary.com/demo/image/upload/v1/tour/accra.jpg',
  imageClean: true,
  hideFeatures: true,
}

describe('TourCard wishlist heart', () => {
  beforeAll(() => {
    // jsdom's matchMedia lacks addEventListener; TourCard subscribes to a breakpoint.
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
  })

  beforeEach(() => {
    cleanup()
    state.inWishlist = true
    state.captured = null
    state.removeFromWishlist.mockReset()
    state.addToWishlist.mockReset()
    state.success.mockReset()
    state.error.mockReset()
  })

  it('removes a saved tour and confirms it with a toast', () => {
    render(<TourCard {...baseProps} />)

    fireEvent.click(screen.getByRole('button', { name: /remove from wishlist/i }))

    expect(state.removeFromWishlist).toHaveBeenCalledWith('tour-1')
    expect(state.success).toHaveBeenCalledWith('Removed from wishlist')
    expect(state.addToWishlist).not.toHaveBeenCalled()
  })

  it('still toasts when saving an unsaved tour', () => {
    state.inWishlist = false
    render(<TourCard {...baseProps} />)

    fireEvent.click(screen.getByRole('button', { name: /add to wishlist/i }))

    expect(state.addToWishlist).toHaveBeenCalledWith({ id: 'tour-1' })
    expect(state.success).toHaveBeenCalledWith('Added to wishlist')
    expect(state.removeFromWishlist).not.toHaveBeenCalled()
  })

  it('snapshots the full card payload, promo included, when saving', () => {
    state.inWishlist = false
    const specialOffers = [offer()]
    render(
      <TourCard
        {...baseProps}
        photos={['https://res.cloudinary.com/demo/image/upload/v1/tour/accra-2.jpg']}
        discount="-30%"
        specialOffers={specialOffers}
        languages={['English']}
        difficulty="Easy"
        cancellationPolicy="Free cancellation up to 24 hours before start time"
        pickupIncluded
        meetingMode="pickup"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /add to wishlist/i }))

    // Everything the wishlist card needs to render identically is in the snapshot.
    expect(state.captured).toMatchObject({
      id: 'tour-1',
      slug: 'accra-city-tour',
      category: 'Tour',
      features: 'Guide, Lunch',
      priceValue: 120,
      discount: '-30%',
      specialOffers,
      photos: ['https://res.cloudinary.com/demo/image/upload/v1/tour/accra-2.jpg'],
      languages: ['English'],
      difficulty: 'Easy',
      cancellationPolicy: 'Free cancellation up to 24 hours before start time',
      pickupIncluded: true,
      meetingMode: 'pickup',
    })
  })
})
