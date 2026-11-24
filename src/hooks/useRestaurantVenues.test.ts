import { describe, expect, it } from 'vitest'
import { buildRestaurantVenuePath } from './useRestaurantVenues'

function paramsOf(path: string): URLSearchParams {
  return new URLSearchParams(path.slice(path.indexOf('?') + 1))
}

describe('buildRestaurantVenuePath', () => {
  it('defaults to Ghana, rating order and a 12-item page', () => {
    const path = buildRestaurantVenuePath({})
    const params = paramsOf(path)

    expect(path.startsWith('/v1/restaurant-venues?')).toBe(true)
    expect(params.get('brand')).toBe('ghana')
    expect(params.get('sort')).toBe('rating')
    expect(params.get('limit')).toBe('12')
    expect(params.has('cursor')).toBe(false)
  })

  it('sends only filters the backend accepts', () => {
    const params = paramsOf(
      buildRestaurantVenuePath({
        q: 'rapids',
        city: 'Accra',
        cuisine: 'Ghanaian',
        priceBand: 2,
        minRating: 4.5,
        featured: true,
        sort: 'newest',
      }, 'next-page'),
    )

    expect(Object.fromEntries(params.entries())).toEqual({
      brand: 'ghana',
      limit: '12',
      sort: 'newest',
      q: 'rapids',
      city: 'Accra',
      cuisine: 'Ghanaian',
      priceBand: '2',
      minRating: '4.5',
      featured: 'true',
      cursor: 'next-page',
    })
  })

  it('omits empty filter values instead of sending blank query keys', () => {
    const params = paramsOf(
      buildRestaurantVenuePath({ q: '', city: '', priceBand: undefined, featured: false }),
    )

    expect(params.has('q')).toBe(false)
    expect(params.has('city')).toBe(false)
    expect(params.has('priceBand')).toBe(false)
    expect(params.has('featured')).toBe(false)
  })
})
