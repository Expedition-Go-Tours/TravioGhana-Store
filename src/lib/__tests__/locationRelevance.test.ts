import { describe, expect, it } from 'vitest'
import {
  hasRelevantLocationSuggestion,
  isClearlyOutsideGhana,
  locationQueryTokens,
  locationTextMatchesTokens,
} from '../locationRelevance'

const suggestion = (formatted: string, city = '', region = '', country = '') => ({
  formatted,
  city,
  region,
  country,
})

describe('locationQueryTokens', () => {
  it('lowercases, strips accents, and drops stopwords and single characters', () => {
    expect(locationQueryTokens('Hotels in Ósu')).toEqual(['hotels', 'osu'])
    expect(locationQueryTokens('A at to the')).toEqual([])
  })
})

describe('locationTextMatchesTokens', () => {
  it('matches whole words and word prefixes', () => {
    expect(locationTextMatchesTokens('Kaneshie Market, Accra', ['kanes'])).toBe(true)
    expect(locationTextMatchesTokens('Kaneshie Market, Accra', ['market'])).toBe(true)
    expect(locationTextMatchesTokens('Kaneshie Market, Accra', ['kaneshie', 'market'])).toBe(true)
  })

  it('does not match inside another word', () => {
    expect(locationTextMatchesTokens('Tosu Village', ['osu'])).toBe(false)
    expect(locationTextMatchesTokens('Spintex Road, Accra', ['osu'])).toBe(false)
  })

  it('treats an empty token list as a match', () => {
    expect(locationTextMatchesTokens('anything', [])).toBe(true)
  })
})

describe('hasRelevantLocationSuggestion', () => {
  it('requires every meaningful query token to match one suggestion', () => {
    const results = [suggestion('Kaneshie, Accra, Ghana', 'Accra', 'Greater Accra', 'Ghana')]
    expect(hasRelevantLocationSuggestion('Kaneshie Market', results)).toBe(false)
    expect(hasRelevantLocationSuggestion('Kaneshie', results)).toBe(true)
    expect(hasRelevantLocationSuggestion('Kaneshie Accra', results)).toBe(true)
  })

  it('is true when any suggestion matches all tokens', () => {
    const results = [
      suggestion('Accra Mall, Spintex Road, Accra, Ghana', 'Accra'),
      suggestion('Kaneshie Market, Accra, Ghana', 'Accra'),
    ]
    expect(hasRelevantLocationSuggestion('Kaneshie Market', results)).toBe(true)
  })

  it('matches across the displayed suggestion fields', () => {
    const results = [suggestion('Somewhere', 'Accra', 'Greater Accra Region', 'Ghana')]
    expect(hasRelevantLocationSuggestion('Accra Ghana', results)).toBe(true)
  })

  it('is false for an empty list and true when the query has no meaningful tokens', () => {
    expect(hasRelevantLocationSuggestion('Kaneshie Market', [])).toBe(false)
    expect(hasRelevantLocationSuggestion('the near', [])).toBe(true)
  })

  it('handles irrelevant fuzzy matches (the target case)', () => {
    const results = [suggestion('Accra, Ghana', 'Accra', 'Greater Accra', 'Ghana')]
    expect(hasRelevantLocationSuggestion('Kaneshie Market', results)).toBe(false)
    expect(hasRelevantLocationSuggestion('hotels in Osu', results)).toBe(false)
  })
})

describe('isClearlyOutsideGhana', () => {
  it('flags non-Ghana country codes', () => {
    expect(isClearlyOutsideGhana({ countryCode: 'ng', country: 'Nigeria' })).toBe(true)
    expect(isClearlyOutsideGhana({ countryCode: 'IT' })).toBe(true)
    expect(isClearlyOutsideGhana({ countryCode: 'gh' })).toBe(false)
  })

  it('falls back to the country name when the code is missing', () => {
    expect(isClearlyOutsideGhana({ country: 'Nigeria' })).toBe(true)
    expect(isClearlyOutsideGhana({ country: 'Ghana' })).toBe(false)
  })

  it('keeps suggestions with no country data (never over-filter)', () => {
    expect(isClearlyOutsideGhana({})).toBe(false)
    expect(isClearlyOutsideGhana({ country: '', countryCode: '' })).toBe(false)
  })
})
