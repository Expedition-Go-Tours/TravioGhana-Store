import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { LocationSearchProvider } from '../context/LocationSearchContext'
import { SearchInputProvider } from '../context/SearchInputContext'
import Hero from './Hero'

vi.mock('../hooks/useRestaurantSearch', () => ({
  useRestaurantSearch: (value: string) => ({
    restaurants: value.trim().length >= 2
      ? [{
          id: 'v1',
          slug: 'the-place',
          name: 'The Place',
          neighbourhood: 'Osu',
          city: 'Accra',
          cuisines: ['Ghanaian'],
          coverPhoto: null,
          rating: 4.6,
          reviewCount: 12,
          external: null,
        }]
      : [],
    places: [],
    isSearching: false,
    hasQuery: value.trim().length >= 2,
  }),
}))

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

function renderHero(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <LocationSearchProvider>
          <SearchInputProvider>
            <LocationProbe />
            <Hero />
          </SearchInputProvider>
        </LocationSearchProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function headingText() {
  return screen.getByRole('heading', { level: 1 }).textContent?.replace(/\s+/g, ' ').trim()
}

describe('shared Hero', () => {
  it('keeps the tours copy and active switch on the homepage', () => {
    renderHero('/')

    expect(headingText()).toBe('Book Unforgettable Experiences in Ghana')
    expect(screen.getByPlaceholderText('Search cities, towns, attractions or regions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tours & Activities' })).toHaveAttribute('aria-current', 'page')
  })

  it('changes only the copy, search text and active switch for restaurants', () => {
    renderHero('/restaurants')

    expect(headingText()).toBe('Discover Your Next Favourite Table')
    expect(
      screen.getByText('Reserve restaurants, rooftop spots and authentic local dining experiences.'),
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search cities, neighbourhoods or cuisines')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Find a table' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Restaurants' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Tours & Activities' })).not.toHaveAttribute('aria-current')
  })

  it('routes restaurant suggestions and the submit button to restaurant URLs', () => {
    renderHero('/restaurants')
    const input = screen.getByRole('combobox', { name: 'Search restaurants by name or place' })

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Accra' } })
    fireEvent.mouseDown(screen.getByRole('option', { name: /The Place/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('/restaurants/the-place')

    fireEvent.change(input, { target: { value: 'jollof' } })
    fireEvent.submit(input.closest('form')!)
    expect(screen.getByTestId('location')).toHaveTextContent('/restaurants?q=jollof')
  })
})
