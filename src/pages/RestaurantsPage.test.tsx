import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import RestaurantsPage from './RestaurantsPage'
import {
  useRestaurantVenues,
  type RestaurantVenue,
  type RestaurantVenuePage,
} from '../hooks/useRestaurantVenues'

vi.mock('../hooks/useRestaurantVenues', () => ({
  useRestaurantVenues: vi.fn(),
}))

vi.mock('../components/RestaurantCard', () => ({
  default: ({ venue }: { venue: { name: string } }) => <article>{venue.name}</article>,
}))

vi.mock('../components/SEO', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => <footer /> }))

const mockHook = vi.mocked(useRestaurantVenues)

const venue: RestaurantVenue = {
  id: 'v1',
  slug: 'the-place',
  name: 'The Place',
  city: 'Accra',
  region: 'Greater Accra',
  country: 'Ghana',
  neighbourhood: 'Osu',
  addressLine: '1 Street',
  cuisines: ['Ghanaian'],
  dietary: [],
  priceBand: 2,
  amenities: [],
  coverPhoto: null,
  photos: [],
  rating: 4.6,
  reviewCount: 12,
  recentRating: null,
  recentReviewCount: 0,
  external: { source: 'GOOGLE', rating: 4.4, reviewCount: 80 },
  verifiedReviewCount: 3,
  rank: { position: 1, of: 20 },
  featured: true,
  displayOrder: 0,
}

function page(venues: RestaurantVenue[]): RestaurantVenuePage {
  return {
    venues,
    pagination: { limit: 12, hasMore: venues.length > 0, nextCursor: 'cursor-2' },
  }
}

function queryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: { pages: [page([venue])] },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useRestaurantVenues>
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

function renderPage(entry = '/restaurants') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <RestaurantsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockHook.mockReset()
  mockHook.mockReturnValue(queryResult())
})

describe('RestaurantsPage home', () => {
  it('renders the prototype-style landing view with two rails', () => {
    renderPage('/restaurants')

    expect(screen.getByRole('heading', { name: 'Find a good meal nearby' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Top rated on Travio' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recently added' })).toBeInTheDocument()
    expect(mockHook).toHaveBeenCalledTimes(2)
    expect(mockHook).toHaveBeenNthCalledWith(1, { sort: 'rating' })
    expect(mockHook).toHaveBeenNthCalledWith(2, { sort: 'newest' })
  })

  it('turns a home search into URL filters', () => {
    renderPage('/restaurants')

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search restaurants' }), {
      target: { value: 'kumasi' },
    })
    fireEvent.submit(screen.getByRole('searchbox', { name: 'Search restaurants' }).closest('form')!)

    expect(screen.getByTestId('location')).toHaveTextContent('/restaurants?q=kumasi')
  })

  it('shows a graceful message when a rail has no venues', () => {
    mockHook.mockReturnValue(queryResult({ data: { pages: [page([])] }, hasNextPage: false }))
    renderPage('/restaurants')

    expect(screen.getAllByText('No restaurants here yet. New places are added as we verify them.')).toHaveLength(2)
  })
})

describe('RestaurantsPage results', () => {
  it('passes URL filters to the venue hook and renders the venue list', () => {
    renderPage('/restaurants?city=Accra&cuisine=Ghanaian&sort=newest&featured=true')

    expect(mockHook).toHaveBeenCalledWith({
      q: undefined,
      city: 'Accra',
      cuisine: 'ghanaian',
      dietary: undefined,
      priceBand: undefined,
      minRating: undefined,
      minReviews: undefined,
      featured: true,
      sort: 'newest',
    })
    expect(screen.getByRole('heading', { name: 'Restaurants in Ghana' })).toBeInTheDocument()
    expect(screen.getByText('The Place')).toBeInTheDocument()
  })

  it('submits the filter search box as a URL filter', () => {
    renderPage('/restaurants?city=Accra')

    const search = screen.getByRole('searchbox', { name: 'Search restaurants' })
    fireEvent.change(search, { target: { value: 'jollof' } })
    fireEvent.submit(search.closest('form')!)

    expect(screen.getByTestId('location')).toHaveTextContent('/restaurants?city=Accra&q=jollof')
  })

  it('removes an active filter chip', () => {
    renderPage('/restaurants?city=Accra&cuisine=Ghanaian')

    fireEvent.click(screen.getByRole('button', { name: 'Remove Accra filter' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/restaurants?cuisine=Ghanaian')
  })

  it('toggles dietary filters without losing existing filters', () => {
    renderPage('/restaurants?city=Accra')

    const dietary = screen.getByRole('group', { name: 'Dietary needs' })
    fireEvent.click(within(dietary).getByLabelText('Vegetarian'))

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/restaurants?city=Accra&dietary=vegetarian',
    )
  })

  it('requests the next cursor page', () => {
    const fetchNextPage = vi.fn()
    mockHook.mockReturnValue(queryResult({ fetchNextPage }))
    renderPage('/restaurants?city=Accra')

    fireEvent.click(screen.getByRole('button', { name: 'Show more restaurants' }))

    expect(fetchNextPage).toHaveBeenCalledOnce()
  })

  it('shows a retry action when the API fails', () => {
    const refetch = vi.fn()
    mockHook.mockReturnValue(
      queryResult({ data: undefined, isError: true, error: new Error('Network down'), refetch }),
    )
    renderPage('/restaurants?city=Accra')

    expect(screen.getByText('We could not load restaurants')).toBeInTheDocument()
    expect(screen.getByText('Network down')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(refetch).toHaveBeenCalledOnce()
  })

  it('offers a clear action for an empty filtered result', () => {
    mockHook.mockReturnValue(queryResult({ data: { pages: [page([])] }, hasNextPage: false }))
    renderPage('/restaurants?city=Accra')

    expect(screen.getByText('No restaurants match yet')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])

    expect(screen.getByTestId('location')).toHaveTextContent('/restaurants')
  })

  it('reveals filters on small screens', () => {
    renderPage('/restaurants?city=Accra')

    const toggle = screen.getByRole('button', { name: /Show filters/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: /Hide filters/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })
})
