import { describe, it, expect } from 'vitest'
import { buildE164Phone, isValidPhoneInput, COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from './phone'

describe('buildE164Phone', () => {
  it('combines a country code and national number into E.164', () => {
    expect(buildE164Phone('+233', '241234567')).toBe('+233241234567')
  })

  it('strips formatting from the national number', () => {
    expect(buildE164Phone('+233', '024 123 4567')).toBe('+233241234567')
    expect(buildE164Phone('+1', '(202) 555-1234')).toBe('+12025551234')
  })

  it('normalizes a leading "0" national prefix for a valid country', () => {
    expect(buildE164Phone('+233', '0241234567')).toBe('+233241234567')
  })

  it('keeps input that is already a full international number', () => {
    expect(buildE164Phone('+233', '+233 24 123 4567')).toBe('+233241234567')
    expect(buildE164Phone('+1', '+12025551234')).toBe('+12025551234')
  })

  it('accepts a country code without the "+" prefix', () => {
    expect(buildE164Phone('233', '241234567')).toBe('+233241234567')
  })

  it('returns null for an empty national number', () => {
    expect(buildE164Phone('+233', '')).toBeNull()
    expect(buildE164Phone('+233', '   ')).toBeNull()
  })

  it('returns null for a number that is too short to be valid', () => {
    expect(buildE164Phone('+1', '555')).toBeNull()
  })

  it('returns null for an invalid international number', () => {
    expect(buildE164Phone('+1', '15551234')).toBeNull()
    expect(buildE164Phone('+1', '5551234')).toBeNull()
  })

  it('returns null for digits without any country code', () => {
    expect(buildE164Phone('', '241234567')).toBeNull()
  })

  it('returns null for a country code with no number', () => {
    expect(buildE164Phone('+233', '0')).toBeNull()
  })
})

describe('isValidPhoneInput', () => {
  it('accepts valid country + national number pairs', () => {
    expect(isValidPhoneInput('+233', '024 123 4567')).toBe(true)
    expect(isValidPhoneInput('+1', '202 555 1234')).toBe(true)
    expect(isValidPhoneInput('+44', '20 7946 0958')).toBe(true)
    expect(isValidPhoneInput('+254', '700123456')).toBe(true)
  })

  it('rejects numbers that do not form a valid phone number', () => {
    expect(isValidPhoneInput('+1', '123')).toBe(false)
    expect(isValidPhoneInput('', '241234567')).toBe(false)
    expect(isValidPhoneInput('+233', 'abc')).toBe(false)
  })
})

describe('COUNTRY_CODES', () => {
  it('is a comprehensive list derived from libphonenumber-js', () => {
    expect(COUNTRY_CODES.length).toBeGreaterThanOrEqual(100)
  })

  it('covers the key travel markets', () => {
    const values = new Set(COUNTRY_CODES.map((c) => c.value))
    expect(values.has('+233')).toBe(true)
    expect(values.has('+1')).toBe(true)
    expect(values.has('+44')).toBe(true)
    expect(values.has('+234')).toBe(true)
    expect(values.has('+27')).toBe(true)
  })

  it('labels each option with a country name and calling code', () => {
    expect(COUNTRY_CODES.find((c) => c.value === '+233')?.label).toBe('Ghana (+233)')
    expect(COUNTRY_CODES.find((c) => c.value === '+44')?.label).toBe('United Kingdom (+44)')
    for (const opt of COUNTRY_CODES) {
      expect(opt.label).toMatch(/\([+]\d+\)$/)
      expect(opt.value).toMatch(/^[+]\d+$/)
    }
  })

  it('pins Ghana first as the default country', () => {
    expect(COUNTRY_CODES[0].value).toBe(DEFAULT_COUNTRY_CODE)
    expect(DEFAULT_COUNTRY_CODE).toBe('+233')
  })

  it('does not duplicate a calling code across entries', () => {
    const values = COUNTRY_CODES.map((c) => c.value)
    expect(new Set(values).size).toBe(values.length)
  })
})
