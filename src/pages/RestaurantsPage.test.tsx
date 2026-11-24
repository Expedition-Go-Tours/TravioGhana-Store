import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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

function setHook(overrides: Record<string, unknown> = {}) {
  const value = {
    data: { pages: [page([venue])] },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    ...overrides,
  }
  mockHook.mockReturnValue(value as unknown as ReturnType<typeof useRestaurantVenues>)
}

function renderPage(entry = '/restaurants') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <RestaurantsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockHook.mockReset()
  setHook()
})

describe('RestaurantsPage', () => {
  it('passes URL filters to the venue hook and renders the venue list', () => {
    renderPage('/restaurants?city=Accra&cuisine=Ghanaian&sort=newest&featured=true')

    expect(mockHook).toHaveBeenCalledWith(
      expect.objectContaining({
        city: 'Accra',
        cuisine: 'Ghanaian',
        sort: 'newest',
        featured: true,
      }),
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Restaurants in Ghana' })).toBeInTheDocument()
    expect(screen.getByText('The Place')).toBeInTheDocument()
  })

  it('submits the search box as a URL filter', () => {
    renderPage('/restaurants')

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search restaurants' }), {
      target: { value: 'kumasi' },
    })
    fireEvent.submit(screen.getByRole('searchbox', { name: 'Search restaurants' }).closest('form')!)

    expect(mockHook).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'kumasi' }))
  })

  it('requests the next cursor page', () => {
    const fetchNextPage = vi.fn()
    setHook({ fetchNextPage })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Show more restaurants' }))

    expect(fetchNextPage).toHaveBeenCalledOnce()
  })

  it('shows a retry action when the API fails', () => {
    const refetch = vi.fn()
    setHook({ data: undefined, isError: true, error: new Error('Network down'), refetch })
    renderPage()

    expect(screen.getByText('We could not load restaurants')).toBeInTheDocument()
    expect(screen.getByText('Network down')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(refetch).toHaveBeenCalledOnce()
  })

  it('offers a clear action for an empty filtered result', () => {
    setHook({ data: { pages: [page([])] }, hasNextPage: false })
    renderPage('/restaurants?city=Accra')

    expect(screen.getByText('No restaurants match yet')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])

    expect(mockHook).toHaveBeenLastCalledWith(expect.objectContaining({ city: undefined }))
  })
})
