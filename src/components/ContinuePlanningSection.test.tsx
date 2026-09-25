import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ContinuePlanningItem } from '../context/ContinuePlanningContext'

/**
 * Continue Planning navigation regression tests.
 *
 * Cards used to navigate with `tourPath(item.id, slug)` where `item.id` was
 * the synthetic `btoa(title|location)` hash — every click landed on
 * /tour/<hash>/<slug> and the detail page answered "Tour not found". Cards must
 * navigate with the real backend id (legacy items fall back to the slug-only
 * URL the API resolves) and open in a new tab, matching TourCard.
 */

const mocks = vi.hoisted(() => ({
  items: [] as ContinuePlanningItem[],
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children }: { to?: unknown; children?: unknown }) => (
    <a href={typeof to === 'string' ? to : '#'}>{children as never}</a>
  ),
}))

vi.mock('../context/ContinuePlanningContext', () => ({
  useContinuePlanning: () => ({ continuePlanning: mocks.items }),
}))

vi.mock('../context/WishlistContext', () => ({
  useWishlist: () => ({ isInWishlist: () => false, addToWishlist: vi.fn(), removeFromWishlist: vi.fn() }),
  toWishlistItem: (tour: unknown) => tour,
}))

vi.mock('../context/SellOutContext', () => ({
  useSellOutContext: () => ({ isLikelyToSellOut: () => false }),
}))

vi.mock('../hooks/useExternalReviews', () => ({
  useCombinedTourStats: () => ({ rating: 4.7, reviewCount: 12 }),
}))

vi.mock('../contexts/CurrencyContext', () => ({
  useCurrency: () => ({ currency: { code: 'USD', symbol: '$' }, convertPrice: (n: number) => n, loading: false }),
}))

vi.mock('../hooks/useExpeditionTours', () => ({
  bestOfferDiscountAmount: () => 0,
}))

import ContinuePlanningSection from './ContinuePlanningSection'

const item = (over: Partial<ContinuePlanningItem> = {}): ContinuePlanningItem => ({
  id: 'hash',
  title: 'Alpha Tour',
  location: 'Accra, Ghana',
  price: 100,
  duration: '1 Day',
  features: '',
  imageUrl: 'https://example.com/photo.jpg',
  rating: 4.7,
  reviewCount: 12,
  viewedAt: new Date(0).toISOString(),
  ...over,
})

describe('ContinuePlanningSection — card navigation', () => {
  let openSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mocks.items = []
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    // jsdom has no matchMedia; the component subscribes to the mobile query.
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    // The slide preloads the photo with `new Image()` and only renders the real
    // card once it "loads". jsdom never fires that event, so resolve it on src.
    class ImageStub {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        this.onload?.()
      }
    }
    vi.stubGlobal('Image', ImageStub)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const cardTitleLink = () => document.querySelector<HTMLAnchorElement>('.cp-card-title a')!

  it('opens the tour in a new tab with the real id and slug', () => {
    mocks.items = [item({ id: 'tour-a', tourId: 'tour-a', slug: 'alpha-tour' })]

    render(<ContinuePlanningSection />)
    expect(screen.getByText('Alpha Tour')).toBeTruthy()

    // The title is a real crawlable link that opens the new tab natively.
    const anchor = cardTitleLink()
    expect(anchor.getAttribute('href')).toBe('/tour/tour-a/alpha-tour')
    expect(anchor.getAttribute('target')).toBe('_blank')
    expect(anchor.getAttribute('rel')).toBe('noopener')

    fireEvent.click(document.querySelector('.cp-card')!)
    expect(openSpy).toHaveBeenCalledWith('/tour/tour-a/alpha-tour', '_blank', 'noopener')
  })

  it('does not double-open when the title link itself is clicked', () => {
    mocks.items = [item({ id: 'tour-a', tourId: 'tour-a', slug: 'alpha-tour' })]

    render(<ContinuePlanningSection />)
    fireEvent.click(cardTitleLink())

    // The browser handles the anchor's target="_blank" navigation; the card's
    // own handler must not fire a second window.open on top of it.
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('falls back to the slug-only URL for legacy items without a real id', () => {
    mocks.items = [item({ id: 'QWxwaGE', slug: 'alpha-tour' })]

    render(<ContinuePlanningSection />)
    expect(cardTitleLink().getAttribute('href')).toBe('/tour/alpha-tour')

    fireEvent.click(document.querySelector('.cp-card')!)
    expect(openSpy).toHaveBeenCalledWith('/tour/alpha-tour', '_blank', 'noopener')
  })

  it('slugifies the title when a legacy item has no slug either', () => {
    mocks.items = [item({ id: 'QWxwaGE', title: 'Alpha Tour!' })]

    render(<ContinuePlanningSection />)
    fireEvent.click(document.querySelector('.cp-card')!)

    expect(openSpy).toHaveBeenCalledWith('/tour/alpha-tour', '_blank', 'noopener')
  })
})
