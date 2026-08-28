import { describe, it, expect } from 'vitest'
import { categoryBucket, categoryKey, categoryPayloadKey, sumCountsToBuckets } from './travelerBuckets'

describe('categoryKey', () => {
  it('normalizes a label into a lowercase key', () => {
    expect(categoryKey('Adult')).toBe('adult')
    expect(categoryKey('Senior Citizen')).toBe('seniorcitizen')
    expect(categoryKey('Infant (0-5)')).toBe('infant05')
  })

  it('handles empty labels', () => {
    expect(categoryKey('')).toBe('')
    expect(categoryKey(undefined as unknown as string)).toBe('')
  })
})

describe('categoryBucket', () => {
  it('maps the three standard categories to their buckets', () => {
    expect(categoryBucket('Adult')).toBe('adults')
    expect(categoryBucket('Child')).toBe('children')
    expect(categoryBucket('Infant')).toBe('infants')
  })

  it('maps child-like labels to children', () => {
    expect(categoryBucket('Child')).toBe('children')
    expect(categoryBucket('Kid')).toBe('children')
  })

  it('maps infant-like labels to infants', () => {
    expect(categoryBucket('Baby')).toBe('infants')
    expect(categoryBucket('Toddler')).toBe('infants')
  })

  it('returns null for non-standard categories so they stay under their own key', () => {
    expect(categoryBucket('Senior')).toBeNull()
    expect(categoryBucket('Student')).toBeNull()
    expect(categoryBucket('Youth')).toBeNull()
    expect(categoryBucket('Teen')).toBeNull()
  })
})

describe('categoryPayloadKey', () => {
  it('uses the canonical bucket for standard categories', () => {
    expect(categoryPayloadKey('Adult')).toBe('adults')
    expect(categoryPayloadKey('Child')).toBe('children')
    expect(categoryPayloadKey('Infant')).toBe('infants')
  })

  it('pluralizes non-standard categories so the backend can match them', () => {
    expect(categoryPayloadKey('Senior')).toBe('seniors')
    expect(categoryPayloadKey('Student')).toBe('students')
    expect(categoryPayloadKey('Youth')).toBe('youths')
  })
})

describe('sumCountsToBuckets', () => {
  it('keeps standard categories in their buckets and passes through extras', () => {
    expect(sumCountsToBuckets({ adult: 2, child: 1, infant: 1, senior: 1, student: 1 })).toEqual({
      adults: 2,
      children: 1,
      infants: 1,
      seniors: 1,
      students: 1,
    })
  })

  it('guarantees the three canonical keys are always present', () => {
    expect(sumCountsToBuckets({ senior: 2 })).toEqual({ adults: 0, children: 0, infants: 0, seniors: 2 })
  })

  it('ignores zero/negative counts', () => {
    expect(sumCountsToBuckets({ adult: 0, child: -1, infant: 0 })).toEqual({
      adults: 0,
      children: 0,
      infants: 0,
    })
  })

  it('returns all-zero canonical buckets when there are no counts', () => {
    expect(sumCountsToBuckets({})).toEqual({ adults: 0, children: 0, infants: 0 })
  })
})
