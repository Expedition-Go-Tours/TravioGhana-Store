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
import { useCuisinePhotos } from '../hooks/useCuisinePhotos'
import {
  useLikelyToBookOutRestaurants,
  useRecommendedRestaurants,
  useRestaurantSectionIds,
  useSpecialOfferRestaurants,
} from '../hooks/useRestaurantHomepage'

vi.mock('../hooks/useRestaurantVenues', () => ({
  useRestaurantVenues: vi.fn(),
}))

vi.mock('../hooks/useCuisinePhotos', () => ({
  useCuisinePhotos: vi.fn(),
}))

vi.mock('../hooks/useRestaurantHomepage', () => ({
  isRestaurantHomepageSection: (value: string | null) =>
    value === 'recommended' || value === 'likely-to-book-out' || value === 'offers',
  useRecommendedRestaurants: vi.fn(),
  useLikelyToBookOutRestaurants: vi.fn(),
  useSpecialOfferRestaurants: vi.fn(),
  useRestaurantSectionIds: vi.fn(),
}))

vi.mock('../hooks/useRecentRestaurantReviews', () => {
  const review = (id: string, venueName: string) => ({
    id,
    venueId: `venue-${id}`,
    venueName,
    venueSlug: venueName.toLowerCase().replace(/\s+/g, '-'),
    venueCity: 'Accra',
    venueCoverPhoto: null,
    rating: 4.8,
    title: 'Worth the queue',
    body: 'The jollof arrived smoky and the service was quick even on a busy Friday evening.',
    createdAt: '2026-11-24T00:00:00.000Z',
    author: { name: 'Ama', photoURL: null },
    verified: true,
  })

  return {
    useRecentRestaurantReviews: () => ({
      data: {
        pages: [
          {
            reviews: [review('r1', 'Buka Restaurant'), review('r2', 'Chop Bar')],
            stats: { averageRating: 4.6, totalReviews: 24 },
            pagination: { hasMore: false, nextCursor: null, limit: 6 },
          },
        ],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    }),
  }
})

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
const mockRecommended = vi.mocked(useRecommendedRestaurants)
const mockLikelyToBookOut = vi.mocked(useLikelyToBookOutRestaurants)
const mockSpecialOffers = vi.mocked(useSpecialOfferRestaurants)
const mockSectionIds = vi.mocked(useRestaurantSectionIds)
const mockCuisinePhotos = vi.mocked(useCuisinePhotos)

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

function rankedResult(venues: RestaurantVenue[]) {
  return {
    data: venues,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useRecommendedRestaurants>
}

function sectionIdsResult(ids?: string[]) {
  return {
    data: ids,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useRestaurantSectionIds>
}

function railVenue(id: string, name: string): RestaurantVenue {
  return { ...venue, id, name, slug: name.toLowerCase().replace(/\s+/g, '-') }
}

function railSection(title: string): HTMLElement {
  const section = screen.getByRole('heading', { name: title }).closest('section')
  if (!section) throw new Error(`No rail section found for ${title}`)
  return section
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
  mockRecommended.mockReset()
  mockRecommended.mockReturnValue(rankedResult([railVenue('v-rec', 'Recommended Pick')]))
  mockLikelyToBookOut.mockReset()
  mockLikelyToBookOut.mockReturnValue(rankedResult([railVenue('v-demand', 'Demand Pick')]))
  mockSpecialOffers.mockReset()
  mockSpecialOffers.mockReturnValue(rankedResult([railVenue('v-offer', 'Offer Pick')]))
  mockSectionIds.mockReset()
  mockSectionIds.mockReturnValue(sectionIdsResult())
  mockCuisinePhotos.mockReset()
  mockCuisinePhotos.mockReturnValue({
    data: { Ghanaian: 'https://cdn.example.test/restaurant-ghanaian.jpg' },
  } as unknown as ReturnType<typeof useCuisinePhotos>)
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
    expect(mockHook).toHaveBeenCalledTimes(4)
    expect(mockHook).toHaveBeenNthCalledWith(1, { sort: 'reviews' })
    expect(mockHook).toHaveBeenNthCalledWith(2, { sort: 'rating' })
    expect(mockHook).toHaveBeenNthCalledWith(3, { sort: 'newest' })
    expect(mockHook).toHaveBeenNthCalledWith(4, { city: 'Accra', sort: 'rating' })
    expect(mockRecommended).toHaveBeenCalledOnce()
    expect(mockLikelyToBookOut).toHaveBeenCalledOnce()
    expect(mockSpecialOffers).toHaveBeenCalledOnce()
  })

  it('renders the ranked rails from their dedicated hooks with section links', () => {
    renderPage('/restaurants')

    const recommended = railSection('Recommended For You')
    expect(within(recommended).getByText('Recommended Pick')).toBeInTheDocument()
    expect(
      within(recommended).getByText('Picked from diner interest, ratings and places near you.'),
    ).toBeInTheDocument()
    expect(within(recommended).getByRole('link', { name: 'See all' })).toHaveAttribute(
      'href',
      '/restaurants?section=recommended',
    )

    const demand = railSection('Likely To Book Out')
    expect(within(demand).getByText('Demand Pick')).toBeInTheDocument()
    expect(
      within(demand).getByText(
        'Based on recent Travio diner interest, not live table availability.',
      ),
    ).toBeInTheDocument()
    expect(within(demand).getByRole('link', { name: 'See all' })).toHaveAttribute(
      'href',
      '/restaurants?section=likely-to-book-out',
    )

    const offers = railSection('Special Offers')
    expect(within(offers).getByText('Offer Pick')).toBeInTheDocument()
    expect(within(offers).getByRole('link', { name: 'See all' })).toHaveAttribute(
      'href',
      '/restaurants?section=offers',
    )
  })

  it('presents diner reviews in a tours-style stats rail with a read-more modal', () => {
    const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
    const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 300 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 60 })

    try {
      renderPage('/restaurants')

      const reviews = railSection('What Diners Are Saying')
      expect(within(reviews).getByRole('link', { name: 'View All' })).toHaveAttribute(
        'href',
        '/restaurants?sort=reviews',
      )
      expect(within(reviews).getByRole('button', { name: 'Scroll left' })).toBeInTheDocument()
      expect(within(reviews).getByRole('button', { name: 'Scroll right' })).toBeInTheDocument()
      expect(within(reviews).getByText(/From/)).toHaveTextContent('From 24 reviews')
      expect(reviews.querySelectorAll('.rh-diner-reviews-card-wrap[aria-hidden="true"]')).toHaveLength(4)

      const firstCard = reviews.querySelector('.rh-diner-review-card') as HTMLElement
      expect(firstCard.querySelector('.rh-diner-review-card__avatar')).toHaveTextContent('A')
      expect(firstCard.querySelector('.rh-diner-review-card__thumb')).toBeNull()
      expect(firstCard.querySelectorAll('.rh-review-bubble')).toHaveLength(5)
      expect(within(firstCard).getByText('Helpful · 0')).toBeInTheDocument()

      const cta = within(reviews).getAllByRole('link', { name: 'View Restaurant' })[0]
      expect(cta).toHaveAttribute('href', '/restaurants/buka-restaurant#reviews')

      const readMore = within(reviews).getAllByRole('button', { name: 'Read more' })[0]
      fireEvent.click(readMore)

      const dialog = screen.getByRole('dialog', { name: 'Review of Buka Restaurant' })
      expect(within(dialog).getByText('The jollof arrived smoky and the service was quick even on a busy Friday evening.')).toBeInTheDocument()
      expect(within(dialog).getByRole('link', { name: 'View Restaurant' })).toHaveAttribute(
        'href',
        '/restaurants/buka-restaurant#reviews',
      )

      fireEvent.click(within(dialog).getByRole('button', { name: 'Close review' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    } finally {
      if (originalScrollHeight) {
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight)
      } else {
        delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight
      }
      if (originalClientHeight) {
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight)
      } else {
        delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight
      }
    }
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

  it('uses restaurant catalogue photos on cuisine tiles', () => {
    renderPage('/restaurants')

    const ghanaian = screen.getByRole('link', { name: 'See Ghanaian restaurants in Ghana' })
    expect(ghanaian.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example.test/restaurant-ghanaian.jpg',
    )

    // Cuisines without a matching venue keep a neutral tile, not stock art.
    const vegetarian = screen.getByRole('link', { name: 'See Vegetarian restaurants in Ghana' })
    expect(vegetarian.querySelector('img')).toBeNull()
    expect(vegetarian.querySelector('.rh-category-tile__placeholder')).toBeInTheDocument()
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
    mockRecommended.mockReturnValue(rankedResult([]))
    mockLikelyToBookOut.mockReturnValue(rankedResult([]))
    mockSpecialOffers.mockReturnValue(rankedResult([]))
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

  it('reorders the loaded list by section ids when a section is requested', () => {
    const second = railVenue('v2', 'Second Place')
    mockHook.mockReturnValue(
      queryResult({ data: { pages: [page([venue, second])] }, hasNextPage: false }),
    )
    mockSectionIds.mockReturnValue(sectionIdsResult(['v2', 'v1']))

    const { container } = renderPage('/restaurants?section=recommended')

    expect(mockSectionIds).toHaveBeenCalledWith('recommended', {
      city: undefined,
      lat: undefined,
      lng: undefined,
    })
    const names = Array.from(container.querySelectorAll('.restaurants-grid article')).map(
      (article) => article.textContent,
    )
    expect(names).toEqual(['Second Place', 'The Place'])
    expect(screen.queryByRole('button', { name: 'Show more restaurants' })).not.toBeInTheDocument()
  })

  it('shows the normal list while section ids are still loading', () => {
    const second = railVenue('v2', 'Second Place')
    mockHook.mockReturnValue(
      queryResult({ data: { pages: [page([venue, second])] }, hasNextPage: false }),
    )
    mockSectionIds.mockReturnValue(sectionIdsResult())

    const { container } = renderPage('/restaurants?section=offers')

    const names = Array.from(container.querySelectorAll('.restaurants-grid article')).map(
      (article) => article.textContent,
    )
    expect(names).toEqual(['The Place', 'Second Place'])
  })

  it('clears the section parameter with the other filters', () => {
    renderPage('/restaurants?section=offers&city=Accra')

    fireEvent.click(screen.getAllByRole('button', { name: 'Clear all' })[0])

    expect(screen.getByTestId('location')).toHaveTextContent('/restaurants')
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
    expect(screen.getByRole('complementary', { name: 'Restaurant filters' })).toHaveAttribute(
      'data-lenis-prevent',
    )
  })
})
