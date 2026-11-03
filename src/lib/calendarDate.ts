/**
 * Calendar-date helpers for tour activity dates.
 *
 * A booking's `travelDate` is a *calendar date* (e.g. "19 Nov 2026" in Accra),
 * stored on the backend as UTC midnight (`2026-11-19T00:00:00.000Z`). It is
 * NOT an instant: a US visitor reading it with `new Date(...).toLocaleDateString()`
 * saw the previous day, and the bookings list then shifted it a *second* time
 * when it re-parsed the bare `YYYY-MM-DD` key as UTC. Both bugs came from
 * treating a date-only value as a timestamp.
 *
 * `toCalendarDate` re-anchors the value to *local midnight of the stored UTC
 * calendar day*, so every local formatter and weekday lookup reads the
 * intended day regardless of the viewer's timezone.
 *
 * Only use these for date-only values (`travelDate`, offer validity dates).
 * Real instants (`createdAt`, `cancelledAt`, cancellation deadlines) must keep
 * local-time formatting.
 */

/** Parse a date-only value into a local-midnight Date for its calendar day. */
export function toCalendarDate(value?: string | Date | null): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** `YYYY-MM-DD` key for a date-only value, built from its calendar day. */
export function toCalendarKey(value?: string | Date | null): string {
  const d = toCalendarDate(value)
  if (!d) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Today's key in the viewer's local calendar (used for Today/Tomorrow labels). */
export function calendarTodayKey(): string {
  return toCalendarKey(new Date())
}

/** Add (or subtract) whole days to a `YYYY-MM-DD` key, staying a calendar date. */
export function addDaysToKey(key: string, days: number): string {
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return key
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Whole calendar days from `fromKey` (default today) to `targetKey`, or null. */
export function daysUntilKey(targetKey: string, fromKey = calendarTodayKey()): number | null {
  const t = targetKey.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const f = fromKey.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!t || !f) return null
  const a = new Date(Number(t[1]), Number(t[2]) - 1, Number(t[3]))
  const b = new Date(Number(f[1]), Number(f[2]) - 1, Number(f[3]))
  return Math.round((a.getTime() - b.getTime()) / 86400000)
}
