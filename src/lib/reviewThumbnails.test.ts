import { describe, expect, it } from 'vitest'
import { resolveReviewThumbnails, selectDistinctReviews, type ThumbnailTour } from './reviewThumbnails'

const TOURS: ThumbnailTour[] = [
  {
    title: 'Cape Coast Castle and Kakum National Park Day Tour',
    location: 'Cape Coast, Ghana',
    supplierName: 'Expedition-Go Tours LTD',
    image: 'https://cdn.example/cape-coast.jpg',
  },
  {
    title: 'Accra Guided City Tour & Cultural Experience',
    location: 'Accra, Ghana',
    supplierName: 'Expedition-Go Tours LTD',
    photos: ['https://cdn.example/accra-1.jpg', 'https://cdn.example/accra-2.jpg'],
  },
  {
    title: 'Northern Safari',
    location: 'Tamale, Ghana',
    supplierName: 'Someone Else Ltd',
    image: 'https://cdn.example/other-operator.jpg',
  },
]

describe('resolveReviewThumbnails', () => {
  it('maps a review to the photo of the tour it is about', () => {
    const map = resolveReviewThumbnails(
      [{ id: 'r1', tourTitle: 'Cape Coast Castle & Kakum National Park Tour' }],
      TOURS,
    )
    expect(map.get('r1')).toBe('https://cdn.example/cape-coast.jpg')
  })

  it('falls back to the tour photo gallery', () => {
    const map = resolveReviewThumbnails(
      [{ id: 'r1', tourTitle: 'Accra Guided City Tour Experience' }],
      TOURS,
    )
    expect(map.get('r1')).toBe('https://cdn.example/accra-1.jpg')
  })

  it('prefers a thumbnail the review already carries', () => {
    const map = resolveReviewThumbnails(
      [{ id: 'r1', tourTitle: 'Cape Coast Castle Tour', tourThumbnail: 'https://cdn.example/scraped.jpg' }],
      TOURS,
    )
    expect(map.get('r1')).toBe('https://cdn.example/scraped.jpg')
  })

  it('fails closed for another operator\'s tour', () => {
    const map = resolveReviewThumbnails([{ id: 'r1', tourTitle: 'Northern Safari' }], TOURS)
    expect(map.has('r1')).toBe(false)
  })

  it('leaves unmatched reviews without an image', () => {
    const map = resolveReviewThumbnails(
      [{ id: 'r1', tourTitle: 'Travio Ghana LTD' }, { id: 'r2', tourTitle: 'Cape Coast Castle Day Tour' }],
      TOURS,
    )
    expect(map.has('r1')).toBe(false)
    expect(map.get('r2')).toBe('https://cdn.example/cape-coast.jpg')
  })

  it('copes with an empty catalogue', () => {
    expect(resolveReviewThumbnails([{ id: 'r1', tourTitle: 'Cape Coast Castle Tour' }], []).size).toBe(0)
  })
})

describe('selectDistinctReviews', () => {
  it('keeps one review per tour, in order', () => {
    const rows = [
      { id: 'a', tourTitle: 'Cape Coast Castle Day Tour' },
      { id: 'b', tourTitle: 'Cape  Coast   Castle Day Tour' },
      { id: 'c', tourTitle: 'Accra City Tour' },
      { id: 'd', tourTitle: 'cape coast castle day tour' },
    ]
    expect(selectDistinctReviews(rows).map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('keeps everything when every tour is different', () => {
    const rows = [{ id: 'a', tourTitle: 'A' }, { id: 'b', tourTitle: 'B' }]
    expect(selectDistinctReviews(rows)).toHaveLength(2)
  })

  it('drops rows with no tour title', () => {
    expect(selectDistinctReviews([{ id: 'a', tourTitle: '  ' }])).toEqual([])
  })
})
