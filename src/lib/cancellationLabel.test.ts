import { describe, it, expect } from 'vitest'
import {
  cancellationStatus,
  parseCancellationWindowHours,
  isNonRefundablePolicy,
  STANDARD_CANCELLATION_WINDOW_HOURS,
} from './cancellationLabel'

const H = 60 * 60 * 1000

/** ISO date (YYYY-MM-DD) a given number of hours from `now`. */
function dateFromNow(nowMs: number, hoursAhead: number): string {
  return new Date(nowMs + hoursAhead * H).toISOString().slice(0, 10)
}

describe('cancellationLabel', () => {
  const now = Date.UTC(2026, 0, 10, 12, 0, 0) // 2026-01-10T12:00Z

  it('parses hour, day and week windows from the policy text', () => {
    expect(parseCancellationWindowHours('Free cancellation up to 48 hours before start time')).toBe(48)
    expect(parseCancellationWindowHours('Free cancellation up to 2 days before')).toBe(48)
    expect(parseCancellationWindowHours('Free cancellation up to 1 week before')).toBe(168)
    expect(parseCancellationWindowHours('Free cancellation')).toBeNull()
  })

  it('detects non-refundable policies', () => {
    expect(isNonRefundablePolicy('Non-refundable')).toBe(true)
    expect(isNonRefundablePolicy('All sales final')).toBe(true)
    expect(isNonRefundablePolicy('Free cancellation up to 24 hours before')).toBe(false)
  })

  it('is non-refundable for a non-refundable policy', () => {
    const s = cancellationStatus('Non-refundable', dateFromNow(now, 500), null, now)
    expect(s?.refundable).toBe(false)
    expect(s?.label).toBe('Non-refundable')
  })

  it('is refundable when the selected date is outside the policy window', () => {
    const s = cancellationStatus(
      'Free cancellation up to 24 hours before start time',
      dateFromNow(now, 72),
      null,
      now,
    )
    expect(s?.refundable).toBe(true)
    expect(s?.label).toMatch(/Free Cancellation before/)
  })

  it('is non-refundable once the selected date is inside the policy window', () => {
    const s = cancellationStatus(
      'Free cancellation up to 48 hours before start time',
      dateFromNow(now, 24),
      null,
      now,
    )
    expect(s?.refundable).toBe(false)
    expect(s?.sublabel).toMatch(/free cancellation window has closed/i)
  })

  it('falls back to the platform standard (48h) when the policy has no window', () => {
    expect(STANDARD_CANCELLATION_WINDOW_HOURS).toBe(48)
    const inside = cancellationStatus('Free cancellation', dateFromNow(now, 24), null, now)
    const outside = cancellationStatus('Free cancellation', dateFromNow(now, 96), null, now)
    expect(inside?.refundable).toBe(false)
    expect(outside?.refundable).toBe(true)
  })

  it('returns the raw policy label when no date is selected', () => {
    const s = cancellationStatus('Free cancellation up to 24 hours before start time', '', null, now)
    expect(s?.refundable).toBe(true)
    expect(s?.label).toBe('Free cancellation up to 24 hours before start time')
  })
})
