import { describe, it, expect, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEffect } from 'react'
import {
  ContinuePlanningProvider,
  useContinuePlanning,
  toContinuePlanningItem,
  type ContinuePlanningItem,
} from './ContinuePlanningContext'
import { resetPendingWrites } from '../lib/consentGatedStorage'

/**
 * Continue Planning identity regression tests.
 *
 * Items used to be keyed by `btoa(title|location)` — a synthetic hash that is
 * not the tour's backend id and is not unique per tour. That broke card clicks
 * (/tour/<hash> 404s: "Tour not found") and let one tour evict another when
 * their title+location collided. These tests pin the real-id behaviour and the
 * slug-based de-duplication that keeps legacy (hash-keyed) entries working.
 */

let api: ReturnType<typeof useContinuePlanning> | null = null

function Capture() {
  const value = useContinuePlanning()
  // Assign in an effect (not during render) so the component stays pure.
  useEffect(() => {
    api = value
  }, [value])
  return null
}

function setup() {
  render(
    <ContinuePlanningProvider>
      <Capture />
    </ContinuePlanningProvider>,
  )
}

const legacyHash = (title: string, location: string) =>
  btoa(`${title}|${location}`).replace(/=/g, '')

const base = (over: Partial<ContinuePlanningItem> = {}): ContinuePlanningItem => ({
  id: 'id',
  title: 'Alpha Tour',
  location: 'Accra, Ghana',
  price: 100,
  duration: '1 Day',
  features: '',
  imageUrl: '',
  rating: 4.7,
  reviewCount: 12,
  viewedAt: new Date(0).toISOString(),
  ...over,
})

describe('toContinuePlanningItem', () => {
  it('uses the real backend tour id and records it as tourId', () => {
    const item = toContinuePlanningItem({
      id: 'tour-a',
      title: 'Alpha Tour',
      location: 'Accra, Ghana',
      image: '',
      price: '$120',
      rating: '4.7',
      reviews: 12,
      duration: '1 Day',
    } as never)

    expect(item.id).toBe('tour-a')
    expect(item.tourId).toBe('tour-a')
  })

  it('falls back to the legacy title|location hash for static tours without an id', () => {
    const item = toContinuePlanningItem({
      title: 'Alpha Tour',
      location: 'Accra, Ghana',
      image: '',
      price: '$120',
      rating: '4.7',
      reviews: 12,
      duration: '1 Day',
    } as never)

    expect(item.id).toBe(legacyHash('Alpha Tour', 'Accra, Ghana'))
    expect(item.tourId).toBeUndefined()
  })
})

describe('ContinuePlanningProvider — de-duplication', () => {
  beforeEach(() => {
    resetPendingWrites()
    api = null
  })

  it('keeps two different tours that share the same title and location', () => {
    setup()
    const sharedHash = legacyHash('Alpha Tour', 'Accra, Ghana')

    act(() => {
      api!.addToContinuePlanning(base({ id: sharedHash, slug: 'alpha-tour', tourId: 'tour-a' }))
    })
    act(() => {
      api!.addToContinuePlanning(base({ id: sharedHash, slug: 'alpha-tour-2', tourId: 'tour-b' }))
    })

    expect(api!.continuePlanning).toHaveLength(2)
    expect(api!.continuePlanning.map((i) => i.tourId)).toEqual(['tour-b', 'tour-a'])
  })

  it('upgrades a legacy hash-keyed entry in place when the tour is viewed again', () => {
    setup()

    act(() => {
      api!.addToContinuePlanning(base({ id: legacyHash('Alpha Tour', 'Accra, Ghana'), slug: 'alpha-tour' }))
    })
    expect(api!.continuePlanning).toHaveLength(1)
    expect(api!.continuePlanning[0].tourId).toBeUndefined()

    act(() => {
      api!.addToContinuePlanning(base({ id: 'tour-a', slug: 'alpha-tour', tourId: 'tour-a' }))
    })

    expect(api!.continuePlanning).toHaveLength(1)
    expect(api!.continuePlanning[0]).toMatchObject({ id: 'tour-a', tourId: 'tour-a', slug: 'alpha-tour' })
  })

  it('moves a re-viewed tour to the front without duplicating it', () => {
    setup()

    act(() => {
      api!.addToContinuePlanning(base({ id: 'tour-a', slug: 'alpha-tour', tourId: 'tour-a' }))
    })
    act(() => {
      api!.addToContinuePlanning(base({ id: 'tour-b', slug: 'beta-tour', tourId: 'tour-b' }))
    })
    expect(api!.continuePlanning.map((i) => i.tourId)).toEqual(['tour-b', 'tour-a'])

    act(() => {
      api!.addToContinuePlanning(base({ id: 'tour-a', slug: 'alpha-tour', tourId: 'tour-a' }))
    })

    expect(api!.continuePlanning).toHaveLength(2)
    expect(api!.continuePlanning.map((i) => i.tourId)).toEqual(['tour-a', 'tour-b'])
  })
})
