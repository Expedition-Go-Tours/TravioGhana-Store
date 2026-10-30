import { describe, expect, it } from 'vitest'
import { getTourBlurb, toTourExcerpt } from './tourBlurbs'

describe('toTourExcerpt', () => {
  it('drops itinerary numbering and keeps the first sentence', () => {
    const text =
      '1. Start Your Journey from Accra to Cape Coast Begin your adventure with a scenic drive that takes approximately 3 hours.'
    expect(toTourExcerpt(text)).toBe(
      'Start Your Journey from Accra to Cape Coast Begin your adventure with a scenic drive that takes approximately 3 hours.',
    )
  })

  it('cuts long unpunctuated copy on a word boundary', () => {
    const text = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ')
    const out = toTourExcerpt(text)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(169)
    // The cut lands after a whole word, never mid-token.
    expect(out).toMatch(/\sword\d+…$/)
  })

  it('returns short descriptions untouched', () => {
    expect(toTourExcerpt('A short, complete blurb.')).toBe('A short, complete blurb.')
  })

  it('handles empty input', () => {
    expect(toTourExcerpt('   ')).toBe('')
  })
})

describe('getTourBlurb', () => {
  it('prefers the curated blurb for the known tours', () => {
    expect(getTourBlurb('Cape Coast Castle, Elmina Castle & Kakum National Park Tour', 'detail copy')).toContain(
      'Kakum National Park',
    )
  })

  it('matches curated blurbs across punctuation differences', () => {
    expect(getTourBlurb('From Accra : Waterfalls, Aburi Gardens & Cocoa Farm Tour', 'detail copy')).toContain(
      'Aburi Botanical Gardens',
    )
  })

  it('falls back to the cleaned description for everything else', () => {
    expect(getTourBlurb('A Tour We Have No Blurb For', '1. Real description of the day.')).toBe(
      'Real description of the day.',
    )
  })
})
