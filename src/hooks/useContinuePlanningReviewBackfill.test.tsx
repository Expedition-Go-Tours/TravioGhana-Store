import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { apiFetch } from '../lib/api'
import { useContinuePlanningReviewBackfill } from './useContinuePlanningReviewBackfill'
import type { ContinuePlanningItem } from '../context/ContinuePlanningContext'

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
}))

const mockApiFetch = vi.mocked(apiFetch)

const base = (over: Partial<ContinuePlanningItem> = {}): ContinuePlanningItem => ({
  id: 'tour-a',
  tourId: 'tour-a',
  title: 'Alpha Tour',
  location: 'Accra, Ghana',
  price: 100,
  duration: '1 Day',
  features: '',
  imageUrl: '',
  rating: 0,
  reviewCount: 0,
  viewedAt: new Date(0).toISOString(),
  slug: 'alpha-tour',
  ...over,
})

describe('useContinuePlanningReviewBackfill', () => {
  beforeEach(() => {
    mockApiFetch.mockReset()
  })

  it('fills the supplier for a stored item that predates the field', async () => {
    mockApiFetch.mockResolvedValue({
      tour: {
        tour: {
          id: 'tour-a',
          slug: 'alpha-tour',
          title: 'Alpha Tour Updated',
          supplierName: 'Expedition-Go Tours LTD',
          city: 'Accra',
          country: 'Ghana',
        },
      },
    } as never)
    const update = vi.fn()

    renderHook(() => useContinuePlanningReviewBackfill([base()], update))

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith(
        'tour-a',
        expect.objectContaining({
          supplierName: 'Expedition-Go Tours LTD',
          title: 'Alpha Tour Updated',
          location: 'Accra, Ghana',
          slug: 'alpha-tour',
          tourId: 'tour-a',
        }),
      )
    })
    expect(mockApiFetch).toHaveBeenCalledWith('/travioghana/tours/tour-a')
  })

  it('does not look up an item that already has a supplier', () => {
    const update = vi.fn()
    renderHook(() =>
      useContinuePlanningReviewBackfill(
        [base({ supplierName: 'Expedition-Go Tours LTD' })],
        update,
      ),
    )

    expect(mockApiFetch).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('skips legacy items with no tour id or slug', () => {
    const update = vi.fn()
    renderHook(() =>
      useContinuePlanningReviewBackfill(
        [base({ tourId: undefined, slug: undefined })],
        update,
      ),
    )

    expect(mockApiFetch).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('does not loop when the lookup fails', async () => {
    mockApiFetch.mockRejectedValue(new Error('not found'))
    const update = vi.fn()

    const { rerender } = renderHook(() =>
      useContinuePlanningReviewBackfill([base()], update),
    )

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))
    expect(update).not.toHaveBeenCalled()

    rerender()
    await Promise.resolve()
    expect(mockApiFetch).toHaveBeenCalledTimes(1)
    expect(update).not.toHaveBeenCalled()
  })
})
