import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import type { ComponentProps } from 'react'

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }))
vi.mock('../context/WishlistContext', () => ({
  useWishlist: () => ({
    isInWishlist: () => false,
    addToWishlist: vi.fn(),
    removeFromWishlist: vi.fn(),
  }),
  toWishlistItem: () => ({ id: 'wishlist-test' }),
}))
vi.mock('../context/SellOutContext', () => ({
  useSellOutContext: () => ({ isLikelyToSellOut: () => false }),
}))
vi.mock('../hooks/useExternalReviews', () => ({
  useCombinedTourStats: () => ({ rating: 5, reviewCount: 12, externalCount: 0 }),
}))
vi.mock('./FormattedPrice', () => ({
  default: ({ value }: { value?: string }) => <span data-testid="price">{value}</span>,
}))

import TourCard from './TourCard'

const baseProps: ComponentProps<typeof TourCard> = {
  title: 'Accra City Tour',
  slug: 'accra-city-tour',
  category: 'Day Tour',
  duration: '8 hours',
  features: 'Guide, Lunch',
  price: '$120',
  rating: '4.8',
  reviews: 42,
  location: 'Accra',
  image: 'https://example.com/photo.jpg',
}

function renderCard(extra: Partial<ComponentProps<typeof TourCard>> = {}) {
  return render(<TourCard {...baseProps} {...extra} />)
}

describe('TourCard navigation', () => {
  beforeAll(() => {
    // jsdom's matchMedia lacks addEventListener; TourCard subscribes to a
    // breakpoint for its mobile layout.
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
    navigateMock.mockClear()
    vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('opens a new tab by default (homepage, search, related, grid, …)', () => {
    const { container } = renderCard()
    fireEvent.click(container.querySelector('.tour-card')!)

    expect(window.open).toHaveBeenCalledWith('/tour/accra-city-tour', '_blank', 'noopener')
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('can opt a surface back into same-tab routing', () => {
    const { container } = renderCard({ openInNewTab: false })
    fireEvent.click(container.querySelector('.tour-card')!)

    expect(navigateMock).toHaveBeenCalledWith('/tour/accra-city-tour')
    expect(window.open).not.toHaveBeenCalled()
  })

  it('keeps modifier-click opening a new tab on same-tab cards', () => {
    const { container } = renderCard({ openInNewTab: false })
    fireEvent.click(container.querySelector('.tour-card')!, { ctrlKey: true })

    expect(window.open).toHaveBeenCalledWith('/tour/accra-city-tour', '_blank', 'noopener')
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
