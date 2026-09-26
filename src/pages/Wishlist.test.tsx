import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { WishlistItem } from '../context/WishlistContext'
import type { SpecialOfferData } from '../hooks/useExpeditionTours'

/**
 * The wishlist page renders the very same TourCard the home page does, so a
 * saved tour looks identical to how it looked when it was saved — features,
 * badges and promo state included. The previous bespoke card had its own
 * layout and a Book now button.
 */

const state = vi.hoisted(() => ({
  items: [] as WishlistItem[],
  liveOffers: [] as { id: string; specialOffers: SpecialOfferData[] }[],
  removeFromWishlist: vi.fn(),
  addToWishlist: vi.fn(),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

vi.mock('../context/WishlistContext', () => ({
  useWishlist: () => ({
    wishlist: state.items,
    addToWishlist: state.addToWishlist,
    removeFromWishlist: state.removeFromWishlist,
    isInWishlist: (id: string) => state.items.some((i) => i.id === id),
    wishlistCount: state.items.length,
    isSyncing: false,
  }),
  toWishlistItem: () => ({ id: 'wishlist-test' }),
}))

vi.mock('../context/SellOutContext', () => ({
  useSellOutContext: () => ({ isLikelyToSellOut: () => false }),
}))

vi.mock('../hooks/useExternalReviews', () => ({
  useCombinedTourStats: () => ({ rating: 5, reviewCount: 12, externalCount: 0 }),
}))

// The live offers refresh — tests drive it through state.liveOffers.
vi.mock('../hooks/useHomepageSections', () => ({
  useHomepageOffers: () => ({ data: state.liveOffers }),
}))

vi.mock('../components/FormattedPrice', () => ({
  // Renders the numeric USD value the card received, which is what proves the
  // item's stored number mapped onto priceValue.
  default: ({ usdPrice }: { usdPrice?: number }) => <span data-testid="price">{usdPrice}</span>,
}))

vi.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: () => <div data-testid="wishlist-lottie" />,
}))

import Wishlist from './Wishlist'

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

const savedTour = (over: Partial<WishlistItem> = {}): WishlistItem => ({
  id: 'tour-1',
  tourId: 'tour-1',
  slug: 'accra-city-tour',
  title: 'Accra City Tour',
  location: 'Accra, Ghana',
  price: 120,
  duration: '8 hours',
  category: 'Tour',
  features: 'Guide included · Lunch included',
  imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/tour/accra.jpg',
  rating: 4.8,
  reviewCount: 42,
  addedDate: '2026-01-01T00:00:00.000Z',
  ...over,
})

/**
 * jsdom has no matchMedia. `matches: true` makes the page take its mobile
 * branch (the horizontal Continue Planning card), `false` its desktop branch
 * (the vertical TourCard grid).
 */
function setMobileViewport(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

describe('Wishlist page', () => {
  beforeAll(() => {
    // jsdom's matchMedia lacks addEventListener; TourCard subscribes to a breakpoint.
    setMobileViewport(false)
  })

  beforeEach(() => {
    cleanup()
    state.items = []
    state.liveOffers = []
    state.removeFromWishlist.mockReset()
    state.addToWishlist.mockReset()
  })

  it('renders one home-page tour card per saved tour', () => {
    state.items = [
      savedTour(),
      savedTour({ id: 'tour-2', tourId: 'tour-2', title: 'Cape Coast Castles', location: 'Cape Coast, Ghana', price: 75, category: '' }),
    ]
    const { container } = render(<Wishlist />)

    const cards = container.querySelectorAll('.tour-card')
    expect(cards).toHaveLength(2)
    expect(screen.getByText('Accra City Tour')).toBeInTheDocument()
    expect(screen.getByText('Cape Coast Castles')).toBeInTheDocument()
    expect(screen.getByText('Accra, Ghana')).toBeInTheDocument()
    expect(screen.getByText('Cape Coast, Ghana')).toBeInTheDocument()
    // both prices reached the card as numbers
    expect([...screen.getAllByTestId('price')].map((el) => el.textContent)).toEqual(['120', '75'])
  })

  it('shows no Book now button — the card links to the tour instead', () => {
    state.items = [savedTour()]
    const { container } = render(<Wishlist />)

    expect(screen.queryByText(/book now/i)).not.toBeInTheDocument()
    expect(container.querySelector('.wishlist-book-btn')).toBeNull()
    // the card itself is the link surface
    expect(container.querySelector('.tour-card-title a, a .tour-card-title')).toBeTruthy()
  })

  it('keeps the heart (the removal control) on every card and explains it', () => {
    state.items = [savedTour(), savedTour({ id: 'tour-2', tourId: 'tour-2' })]
    const { container } = render(<Wishlist />)

    expect(container.querySelectorAll('.tour-card-wishlist')).toHaveLength(2)
    expect(screen.getByText(/tap the heart on a card to remove it/i)).toBeInTheDocument()
  })

  it('shows the type chip only when the saved item carries a category', () => {
    state.items = [savedTour(), savedTour({ id: 'tour-2', tourId: 'tour-2', category: '' })]
    const { container } = render(<Wishlist />)

    const cards = container.querySelectorAll('.tour-card')
    expect(cards[0].querySelector('.tour-card-image-type-badge')?.textContent).toBe('Tour')
    // An item saved before the category was captured shows no chip rather than
    // a fabricated type.
    expect(cards[1].querySelector('.tour-card-image-type-badge')).toBeNull()
  })

  it('renders the features line captured with the item', () => {
    state.items = [savedTour()]
    render(<Wishlist />)

    expect(screen.getByText('Guide included · Lunch included')).toBeInTheDocument()
  })

  it('shows the promo badge and strike-through price captured with the item', () => {
    state.items = [savedTour({ specialOffers: [offer()], discount: '-30%' })]
    const { container } = render(<Wishlist />)

    expect(container.querySelector('.tour-card-special-offer')?.textContent).toMatch(/special offer/i)
    expect(container.querySelector('.tour-card-price-strike')?.textContent).toBe('120')
    expect(container.querySelector('.tour-card-price-promo')?.textContent).toBe('84')
    expect(container.querySelector('.tour-card-discount')?.textContent).toBe('-30%')
  })

  it('prefers the live offer over the offer captured at save time', () => {
    state.items = [savedTour({ specialOffers: [offer({ discountPercentage: 10 })] })]
    state.liveOffers = [{ id: 'tour-1', specialOffers: [offer({ id: 'live', discountPercentage: 50 })] }]
    const { container } = render(<Wishlist />)

    // 50% off the stored $120 — the stale 10% snapshot is superseded.
    expect(container.querySelector('.tour-card-price-promo')?.textContent).toBe('60')
    expect(container.querySelector('.tour-card-price-strike')?.textContent).toBe('120')
  })

  it('keeps using the captured offer when the live list has no entry for the tour', () => {
    state.items = [savedTour({ specialOffers: [offer()] })]
    state.liveOffers = [{ id: 'some-other-tour', specialOffers: [offer({ id: 'live' })] }]
    const { container } = render(<Wishlist />)

    expect(container.querySelector('.tour-card-price-promo')?.textContent).toBe('84')
  })

  it('drops a captured promo once its offer has expired', () => {
    state.items = [savedTour({ specialOffers: [offer({ endDate: '2020-01-01T00:00:00.000Z' })], discount: '-30%' })]
    const { container } = render(<Wishlist />)

    // No badge, no strike-through, no stale "-30%" chip: full price only.
    expect(container.querySelector('.tour-card-special-offer')).toBeNull()
    expect(container.querySelector('.tour-card-price-strike')).toBeNull()
    expect(container.querySelector('.tour-card-price-promo')).toBeNull()
    expect(container.querySelector('.tour-card-discount')).toBeNull()
    expect(container.querySelector('.tour-card-price-value')?.textContent).toBe('120')
  })

  it('still renders the empty state when nothing is saved', () => {
    state.items = []
    const { container } = render(<Wishlist />)

    expect(screen.getByText('Your wishlist is empty')).toBeInTheDocument()
    expect(screen.getByText('Explore Tours')).toBeInTheDocument()
    expect(container.querySelectorAll('.tour-card')).toHaveLength(0)
  })
})

/**
 * On mobile the page abandons the vertical TourCard grid and stacks the
 * homepage's horizontal Continue Planning card instead — same cover photo,
 * facts, rating, price and removal heart, just wider than tall.
 */
describe('Wishlist page — mobile horizontal cards', () => {
  beforeEach(() => {
    // Sibling describe: replicate the shared state reset so no live offer or
    // saved item leaks in from an earlier test.
    state.items = []
    state.liveOffers = []
    state.removeFromWishlist.mockReset()
    state.addToWishlist.mockReset()
    setMobileViewport(true)
  })

  afterEach(() => {
    setMobileViewport(false)
  })

  it('renders one horizontal card per saved tour, not the vertical card', () => {
    state.items = [
      savedTour(),
      savedTour({ id: 'tour-2', tourId: 'tour-2', title: 'Cape Coast Castles', price: 75, category: '' }),
    ]
    const { container } = render(<Wishlist />)

    expect(container.querySelectorAll('.cp-card')).toHaveLength(2)
    expect(container.querySelectorAll('.tour-card')).toHaveLength(0)
    expect(screen.getByText('Accra City Tour')).toBeInTheDocument()
    expect(screen.getByText('Cape Coast Castles')).toBeInTheDocument()
    // both prices reached the card as numbers
    expect([...screen.getAllByTestId('price')].map((el) => el.textContent)).toEqual(['120', '75'])
  })

  it('does not show a short-description line on the card', () => {
    // The card carries the title, duration, icon facts, rating and price only —
    // the item's captured features/description text stays off it.
    state.items = [savedTour()]
    render(<Wishlist />)

    expect(screen.queryByText('Guide included · Lunch included')).not.toBeInTheDocument()
    expect(document.querySelector('.cp-card-features')).toBeNull()
  })

  it('keeps the heart as the removal control', () => {
    state.items = [savedTour()]
    const { container } = render(<Wishlist />)

    fireEvent.click(container.querySelector('.cp-card-wishlist')!)
    expect(state.removeFromWishlist).toHaveBeenCalledWith('tour-1')
  })

  it('shows the promo price and discount chip while the offer is live', () => {
    state.items = [savedTour({ specialOffers: [offer()], discount: '-30%' })]
    const { container } = render(<Wishlist />)

    expect(container.querySelector('.cp-card-price-strike')?.textContent).toBe('120')
    expect(container.querySelector('.cp-card-price-promo')?.textContent).toBe('84')
    expect(container.querySelector('.cp-card-discount-chip')?.textContent).toBe('-30%')
  })

  it('prefers the live offer over the offer captured at save time', () => {
    state.items = [savedTour({ specialOffers: [offer({ discountPercentage: 10 })] })]
    state.liveOffers = [{ id: 'tour-1', specialOffers: [offer({ id: 'live', discountPercentage: 50 })] }]
    const { container } = render(<Wishlist />)

    expect(container.querySelector('.cp-card-price-promo')?.textContent).toBe('60')
    expect(container.querySelector('.cp-card-price-strike')?.textContent).toBe('120')
  })

  it('drops a captured promo once its offer has expired', () => {
    state.items = [savedTour({ specialOffers: [offer({ endDate: '2020-01-01T00:00:00.000Z' })], discount: '-30%' })]
    const { container } = render(<Wishlist />)

    // No strike-through, no promo price, no stale "-30%" chip: full price only.
    expect(container.querySelector('.cp-card-price-strike')).toBeNull()
    expect(container.querySelector('.cp-card-price-promo')).toBeNull()
    expect(container.querySelector('.cp-card-discount-chip')).toBeNull()
    expect(container.querySelector('.cp-card-price')?.textContent).toBe('120')
  })
})
