import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ComponentProps } from 'react'

/**
 * The search results grid is 4-up, but TourCard's default `sizes` claims 50vw,
 * which made the browser fetch the 1200w variant (~200KB) for a ~310px card.
 * These tests pin the `sizes` override passthrough and the priority handling.
 */

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../context/WishlistContext', () => ({
  useWishlist: () => ({ isInWishlist: () => false, addToWishlist: vi.fn(), removeFromWishlist: vi.fn() }),
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
  image: 'https://res.cloudinary.com/demo/image/upload/v1/tour/accra.jpg',
}

function cardImage(extra: Partial<ComponentProps<typeof TourCard>> = {}) {
  const { container } = render(<TourCard {...baseProps} {...extra} />)
  return container.querySelector('img.optimized-img') as HTMLImageElement
}

describe('TourCard responsive images', () => {
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

  afterEach(() => cleanup())

  it('defaults to the 50vw descriptor with 600/1200 candidates', () => {
    const img = cardImage()
    expect(img.getAttribute('sizes')).toBe('(max-width: 768px) 100vw, 50vw')
    expect(img.getAttribute('srcset')).toContain('w_600,h_400')
    expect(img.getAttribute('srcset')).toContain('w_1200,h_800')
  })

  it('forwards a grid-accurate sizes override so the browser picks the 600w candidate', () => {
    const img = cardImage({ sizes: '25vw' })
    expect(img.getAttribute('sizes')).toBe('25vw')
    // Same candidates; the descriptor is what steers the browser to the 600w one.
    expect(img.getAttribute('srcset')).toContain('w_600,h_400')
    expect(img.getAttribute('srcset')).toContain('w_1200,h_800')
  })

  it('marks a priority card eager with high fetch priority', () => {
    const img = cardImage({ priority: true })
    expect(img.getAttribute('loading')).toBe('eager')
    expect(img.getAttribute('fetchpriority')).toBe('high')
  })
})
