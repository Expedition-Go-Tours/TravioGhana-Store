import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RestaurantsPage from './RestaurantsPage'

vi.mock('../components/SEO', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => <footer /> }))
vi.mock('../components/Hero', () => ({ default: () => <div data-testid="hero" /> }))

const emptyPage = {
  data: { pages: [{ venues: [], pagination: { hasMore: false, nextCursor: null, limit: 12 } }] },
  isPending: false,
  isError: false,
  refetch: vi.fn(),
}

vi.mock('../hooks/useRestaurantVenues', () => ({
  useRestaurantVenues: () => emptyPage,
}))

vi.mock('../hooks/useRecentRestaurantReviews', () => ({
  useRecentRestaurantReviews: () => ({
    data: {
      pages: [
        {
          reviews: [],
          pagination: { hasMore: false, nextCursor: null, limit: 6 },
        },
      ],
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

describe('RestaurantsPage homepage', () => {
  it('renders every prototype section', () => {
    render(
      <MemoryRouter initialEntries={['/restaurants']}>
        <RestaurantsPage />
      </MemoryRouter>,
    )

    const headings = [
      'What are you in the mood for?',
      'Recommended For You',
      'Popular Restaurants',
      'Top Rated',
      'Likely To Book Out',
      'Special Offers',
      'New Listings',
      'Top Restaurants in Accra',
      'What Diners Are Saying',
    ]

    for (const heading of headings) {
      expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    }

    expect(screen.getByText(/not live table availability/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeTruthy()
  })
})
