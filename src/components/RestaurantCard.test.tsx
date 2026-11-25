import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RestaurantCard from './RestaurantCard'
import type { RestaurantVenue } from '../hooks/useRestaurantVenues'

vi.mock('./shared/OptimizedImage', () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}))

const venue: RestaurantVenue = {
  id: 'v1',
  slug: 'the-place',
  name: 'The Place',
  city: 'Accra',
  region: 'Greater Accra',
  country: 'Ghana',
  neighbourhood: 'Osu',
  addressLine: null,
  cuisines: ['Ghanaian', 'Seafood'],
  dietary: ['vegetarian'],
  priceBand: 2,
  amenities: ['Outdoor seating'],
  coverPhoto: 'https://images.example.com/cover.jpg',
  photos: ['https://images.example.com/second.jpg'],
  rating: 4.6,
  reviewCount: 42,
  recentRating: 4.7,
  recentReviewCount: 12,
  external: { source: 'GOOGLE', rating: 4.4, reviewCount: 80 },
  verifiedReviewCount: 3,
  rank: { position: 4, of: 120 },
  featured: true,
  displayOrder: 0,
  highDemand: true,
  offers: [
    {
      id: 'offer-1',
      title: '20% off lunch',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      promoCode: null,
      endsAt: null,
    },
  ],
}

function renderCard() {
  return render(
    <MemoryRouter>
      <RestaurantCard venue={venue} />
    </MemoryRouter>,
  )
}

describe('RestaurantCard', () => {
  it('uses the TourCard structure with a crawlable restaurant link', () => {
    const { container } = renderCard()

    expect(container.querySelector('.tour-card.restaurant-card')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'The Place' })).toHaveAttribute(
      'href',
      '/restaurants/the-place',
    )
    expect(container.querySelector('.tour-card-image-type-badge')?.textContent).toContain('Ghanaian')
  })

  it('prioritises a live offer over the demand badge', () => {
    renderCard()

    expect(screen.getByText('Special Offer')).toBeTruthy()
    expect(screen.getByText('20% off lunch')).toBeTruthy()
    expect(screen.queryByText('Likely to book out')).toBeNull()
  })

  it('shows the demand badge with an honest explanation when there is no offer', () => {
    render(
      <MemoryRouter>
        <RestaurantCard venue={{ ...venue, offers: [] }} />
      </MemoryRouter>,
    )

    const badge = screen.getByText('Likely to book out')
    expect(badge).toBeTruthy()
    expect(badge).toHaveAttribute(
      'title',
      'Based on recent Travio diner interest, not live table availability.',
    )
  })

  it('renders TourCard-style tags, rating and price band', () => {
    const { container } = renderCard()

    expect(container.querySelector('.restaurant-card__price-badge')?.textContent).toBe('Mid-range')
    expect(container.querySelector('.tour-card-price-value')?.textContent).toBe('Mid-range')
    expect(screen.getByText('Vegetarian')).toBeTruthy()
    expect(screen.getByText('3 verified')).toBeTruthy()
    expect(container.querySelector('.tour-card-rating-value')?.textContent).toBe('4.6')
    expect(screen.getByText('Google 4.4 · 80 external reviews')).toBeTruthy()
  })
})
