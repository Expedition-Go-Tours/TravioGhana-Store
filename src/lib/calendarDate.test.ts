import { describe, expect, it } from 'vitest'
import {
  toCalendarDate,
  toCalendarKey,
  addDaysToKey,
  daysUntilKey,
} from './calendarDate'
import {
  formatFullDate,
  formatMediumDate,
  formatHeadingDate,
  toDateKey,
} from './bookingUi'

// The date that exposed the bug: a 19 Nov activity date stored at UTC midnight,
// which a US (UTC-5) browser rendered as "Wed, Nov 18" on the card and
// "Tuesday, Nov 17" on the group heading. Both must be 19 Nov everywhere.
const NOV_19 = '2026-11-19T00:00:00.000Z'

describe('calendar-date rendering (timezone-safe)', () => {
  it('anchors the stored UTC-midnight value to its calendar day', () => {
    const d = toCalendarDate(NOV_19)!
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(10) // Nov
    expect(d.getDate()).toBe(19)
  })

  it('formats the card date without a timezone shift', () => {
    expect(formatMediumDate(NOV_19)).toBe('Thu, Nov 19, 2026')
    expect(formatFullDate(NOV_19)).toBe('Thursday, November 19, 2026')
    expect(formatHeadingDate(NOV_19)).toBe('Thursday, Nov 19')
  })

  it('builds the group key from the calendar day, not local parts', () => {
    expect(toDateKey(NOV_19)).toBe('2026-11-19')
    expect(toCalendarKey(NOV_19)).toBe('2026-11-19')
  })

  it('keeps the heading and the card on the same day', () => {
    expect(formatHeadingDate(NOV_19)).toContain('19')
    expect(formatMediumDate(NOV_19)).toContain('19')
  })

  it('treats an empty or invalid value as a blank', () => {
    expect(formatHeadingDate('')).toBe('')
    expect(formatHeadingDate(null)).toBe('')
    expect(formatMediumDate('')).toBe('—')
    expect(formatFullDate('not-a-date')).toBe('—')
    expect(toDateKey('garbage')).toBe('')
  })

  it('adds and subtracts whole days across month and year boundaries', () => {
    expect(addDaysToKey('2026-11-19', 1)).toBe('2026-11-20')
    expect(addDaysToKey('2026-11-19', -2)).toBe('2026-11-17')
    expect(addDaysToKey('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDaysToKey('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('counts whole calendar days between keys', () => {
    expect(daysUntilKey('2026-11-19', '2026-11-03')).toBe(16)
    expect(daysUntilKey('2026-11-19', '2026-11-19')).toBe(0)
    expect(daysUntilKey('2026-11-18', '2026-11-19')).toBe(-1)
  })
})
