import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { LocationSearchProvider } from '../context/LocationSearchContext'
import { SearchInputProvider } from '../context/SearchInputContext'
import RestaurantsPage from './RestaurantsPage'
import {
  useRestaurantVenues,
  type RestaurantVenue,
  type RestaurantVenuePage,
} from '../hooks/useRestaurantVenues'

vi.mock('../hooks/useRestaurantVenues', () => ({
  useRestaurantVenues: vi.fn(),
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

vi.mock('../components/RestaurantCard', () => ({
  default: ({ venue }: { venue: { name: string } }) => <article>{venue.name}</article>,
}))

vi.mock('../components/SEO', () => ({ default: () => null }))
vi.mock('../components/Footer', () => ({ default: () => <footer /> }))
vi.mock('../hooks/useRestaurantSearch', () => ({
  useRestaurantSearch: () => ({
    restaurants: [],
    places: [],
    isSearching: false,
    hasQuery: false,
  }),
}))

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
  highDemand: false,
  offers: [],
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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <LocationSearchProvider>
          <SearchInputProvider>
            <LocationProbe />
            <RestaurantsPage />
          </SearchInputProvider>
        </LocationSearchProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockHook.mockReset()
  mockHook.mockReturnValue(queryResult())
})

describe('RestaurantsPage home', () => {
  it('renders the full prototype-style landing view', () => {
    renderPage('/restaurants')

    expect(screen.getByRole('heading', { name: 'Discover Your Next Favourite Table' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recommended For You' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Popular Restaurants' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Top Rated' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Likely To Book Out' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Special Offers' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'New Listings' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Top Restaurants in Accra' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What Diners Are Saying' })).toBeInTheDocument()
    expect(mockHook).toHaveBeenCalledTimes(7)
    expect(mockHook).toHaveBeenNthCalledWith(1, { featured: true, sort: 'rating' })
    expect(mockHook).toHaveBeenNthCalledWith(2, { sort: 'reviews' })
    expect(mockHook).toHaveBeenNthCalledWith(3, { sort: 'rating' })
    expect(mockHook).toHaveBeenNthCalledWith(4, { highDemand: true, sort: 'demand' })
    expect(mockHook).toHaveBeenNthCalledWith(5, { hasOffer: true, sort: 'rating' })
    expect(mockHook).toHaveBeenNthCalledWith(6, { sort: 'newest' })
    expect(mockHook).toHaveBeenNthCalledWith(7, { city: 'Accra', sort: 'rating' })
  })

  it('uses the shared hero shell and keeps Restaurants active in the switch', () => {
    const { container } = renderPage('/restaurants')

    expect(container.querySelector('.hero')).toBeInTheDocument()
    expect(container.querySelector('.rh-home-hero')).not.toBeInTheDocument()
    expect(
      screen.getByText('Reserve restaurants, rooftop spots and authentic local dining experiences.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Find a table' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Restaurants' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Tours & Activities' })).not.toHaveAttribute('aria-current')
  })

  it('links cuisine tiles to lowercase cuisine filters', () => {
    renderPage('/restaurants')

    expect(
      screen.getByRole('link', { name: 'See Ghanaian restaurants in Ghana' }),
    ).toHaveAttribute('href', '/restaurants?cuisine=ghanaian')
    expect(screen.getByRole('heading', { name: 'What are you in the mood for?' })).toBeInTheDocument()
  })

  it('turns a home search into URL filters', () => {
    renderPage('/restaurants')

    const search = screen.getByRole('combobox', { name: 'Search restaurants by name or place' })
    fireEvent.change(search, { target: { value: 'kumasi' } })
    fireEvent.submit(search.closest('form')!)

    expect(screen.getByTestId('location')).toHaveTextContent('/restaurants?q=kumasi')
  })

  it('shows a graceful message when a rail has no venues', () => {
    mockHook.mockReturnValue(queryResult({ data: { pages: [page([])] }, hasNextPage: false }))
    renderPage('/restaurants')

    expect(screen.getAllByText('No restaurants here yet. New places are added as we verify them.')).toHaveLength(7)
  })
})

describe('RestaurantsPage results', () => {
  it('keeps the results layout and offers the vertical switch without a hero', () => {
    const { container } = renderPage('/restaurants?city=Accra')

    expect(container.querySelector('.hero')).not.toBeInTheDocument()
    expect(container.querySelector('.rh-results-layout')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Restaurants' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Tours & Activities' })).toHaveAttribute('href', '/')
  })

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
      lat: undefined,
      lng: undefined,
      radiusKm: undefined,
      place: undefined,
      sort: 'newest',
    })
    expect(screen.getByRole('heading', { name: 'Restaurants in Ghana' })).toBeInTheDocument()
    expect(screen.getByText('The Place')).toBeInTheDocument()
  })

  it('passes a map place point and radius to the venue hook', () => {
    renderPage('/restaurants?lat=5.56&lng=-0.19&radiusKm=10&place=Osu')

    expect(mockHook).toHaveBeenCalledWith({
      q: undefined,
      city: undefined,
      cuisine: undefined,
      dietary: undefined,
      priceBand: undefined,
      minRating: undefined,
      minReviews: undefined,
      featured: undefined,
      lat: 5.56,
      lng: -0.19,
      radiusKm: 10,
      place: 'Osu',
      sort: undefined,
    })
    expect(screen.getByText('Showing 1 place near Osu')).toBeInTheDocument()
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
