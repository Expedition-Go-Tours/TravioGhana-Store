/* Shared, side-effect-free presentation helpers for the customer bookings
   experience (list card + booking workspace). Kept dependency-free so both
   components and any future surface (e.g. confirmation) use one definition. */

import { toCalendarDate, toCalendarKey } from './calendarDate'

export interface PartyCount {
  adults: number
  children: number
  infants: number
  seniors?: number
  counts?: Record<string, number>
  total: number
}

const PARTY_META_KEYS = new Set(['phoneNumber', 'phone', 'location', 'details', 'name', 'email', 'specialRequests'])
const PARTY_ORDER = ['adults', 'children', 'infants', 'seniors']
const PARTY_LABELS: Record<string, [string, string]> = {
  adults: ['Adult', 'Adults'],
  children: ['Child', 'Children'],
  infants: ['Infant', 'Infants'],
  seniors: ['Senior', 'Seniors'],
  students: ['Student', 'Students'],
  youth: ['Youth', 'Youths'],
  youths: ['Youth', 'Youths'],
  seniorcitizens: ['Senior citizen', 'Senior citizens'],
  seniorcitizen: ['Senior citizen', 'Senior citizens'],
}

function partyCount(value: unknown): number {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value))) return 0
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function partyKeyForLabel(label: unknown): string {
  const key = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
  if (!key) return ''
  if (key === 'adult' || key === 'adults') return 'adults'
  if (key === 'child' || key === 'children' || key === 'kid' || key === 'kids') return 'children'
  if (key === 'infant' || key === 'infants' || key === 'baby' || key === 'babies') return 'infants'
  return key.endsWith('s') ? key : `${key}s`
}

function partyCategoryLabel(key: string, count: number): string {
  const known = PARTY_LABELS[key]
  if (known) return count === 1 ? known[0] : known[1]
  const singular = key.endsWith('s') ? key.slice(0, -1) : key
  const word = count === 1 ? singular : key
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/** Parse the booking travellers blob without letting named details replace the counts. */
export function partyFromTravelers(travelers: unknown): PartyCount {
  const source = travelers && typeof travelers === 'object' && !Array.isArray(travelers)
    ? (travelers as Record<string, unknown>)
    : {}
  const counts: Record<string, number> = {}

  for (const [key, value] of Object.entries(source)) {
    if (PARTY_META_KEYS.has(key)) continue
    const count = partyCount(value)
    if (count > 0) counts[key] = (counts[key] || 0) + count
  }

  if (Object.keys(counts).length === 0 && Array.isArray(source.details)) {
    for (const detail of source.details) {
      if (!detail || typeof detail !== 'object') continue
      const row = detail as Record<string, unknown>
      const key = partyKeyForLabel(row.ageGroup || row.type)
      if (!key) continue
      const count = partyCount(row.count ?? row.qty ?? 1)
      if (count > 0) counts[key] = (counts[key] || 0) + count
    }
  }

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  return {
    adults: counts.adults || 0,
    children: counts.children || 0,
    infants: counts.infants || 0,
    seniors: counts.seniors || 0,
    counts,
    total,
  }
}

export function toFiniteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function formatFullDate(value?: string | null): string {
  // Activity dates are calendar dates, not instants — see lib/calendarDate.
  const d = toCalendarDate(value)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** e.g. "Mon, Aug 18, 2026" — compact date used on cards. */
export function formatMediumDate(value?: string | null): string {
  const d = toCalendarDate(value)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** e.g. "Mon, Aug 18" without the year, used for date-group headings. */
export function formatHeadingDate(value?: string | null): string {
  const d = toCalendarDate(value)
  if (!d) return ''
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export function formatTimeString(value?: string | null): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/am|pm/i.test(raw)) return raw
  const m = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (m) {
    let h = Number(m[1])
    const mm = m[2]
    const period = h >= 12 ? 'PM' : 'AM'
    h = h % 12 === 0 ? 12 : h % 12
    return `${h}:${mm} ${period}`
  }
  return raw
}

/** "2 Adults", "1 Adult, 1 Senior", or "3 People" when details are flat. */
export function partyLabel(party?: PartyCount | null): string {
  if (!party || party.total === 0) return ''

  const counts = party.counts && Object.keys(party.counts).length > 0
    ? party.counts
    : {
        adults: party.adults,
        children: party.children,
        infants: party.infants,
        seniors: party.seniors || 0,
      }

  const entries = Object.entries(counts)
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .sort(([a], [b]) => {
      const ai = PARTY_ORDER.indexOf(a)
      const bi = PARTY_ORDER.indexOf(b)
      if (ai !== -1 || bi !== -1) {
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      }
      return a.localeCompare(b)
    })

  if (entries.length > 0) {
    return entries
      .map(([key, count]) => `${count} ${partyCategoryLabel(key, count)}`)
      .join(' · ')
  }

  return `${party.total} ${party.total === 1 ? 'Person' : 'People'}`
}

/* ------------------------------------------------------------------ */
/* Cancellation policy — mirrors the backend's evaluateCancellationPolicy
   (utils/bookingHelpers.js) so the UI never offers a cancel the API will
   reject. Reads the supplier-authored policy from
   tour.bookingAndTickets.cancellationPolicy. */
/* ------------------------------------------------------------------ */
export interface CancellationVerdict {
  type: 'standard' | 'all_sales_final'
  allowed: boolean
  windowHours: number
  refundPct: number
  deadline: Date | null
}

function parseJsonish(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function evaluateCancellationPolicy(
  bookingAndTickets: unknown,
  travelDate?: string | null
): CancellationVerdict {
  const bt = parseJsonish(bookingAndTickets) as Record<string, unknown> | null
  const raw = bt && typeof bt === 'object' ? bt.cancellationPolicy : undefined

  let type: CancellationVerdict['type'] = 'standard'
  let windowHours = 24
  let refundPct = 100

  if (typeof raw === 'string') {
    type = /non.?refund|all.?sales.?final/i.test(raw) ? 'all_sales_final' : 'standard'
  } else if (raw && typeof raw === 'object') {
    const pol = raw as Record<string, unknown>
    type = pol.type === 'all_sales_final' ? 'all_sales_final' : 'standard'
    windowHours = toFiniteNumber(pol.cancellationWindowHours) ?? 24
    refundPct = toFiniteNumber(pol.refundPercentage) ?? 100
  }

  if (type === 'all_sales_final') {
    return { type, allowed: true, windowHours: 0, refundPct: 0, deadline: null }
  }

  const base = travelDate ? new Date(travelDate) : null
  const valid = base && !Number.isNaN(base.getTime()) ? base : null
  if (!valid) return { type, allowed: false, windowHours, refundPct, deadline: null }

  const deadline = new Date(valid.getTime() - windowHours * 3600 * 1000)
  const hoursUntil = (valid.getTime() - Date.now()) / (3600 * 1000)
  return { type, allowed: hoursUntil >= windowHours, windowHours, refundPct, deadline }
}

/** e.g. "Sep 9, 9:00 PM" — deadline line (accepts ISO strings or Dates). */
export function formatDeadlineLabel(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  const showYear = d.getFullYear() !== new Date().getFullYear()
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(showYear ? { year: 'numeric' } : {}),
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Date-key (YYYY-MM-DD) used for grouping + equality tests. */
export function toDateKey(value?: string | null): string {
  return toCalendarKey(value)
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export interface StatusMeta {
  label: string
  kind: 'ok' | 'attention' | 'done' | 'cancelled' | 'neutral'
}

/**
 * Semantic booking-status chip used on cards + workspace.
 *
 * `refundState` is customer-facing ('open' refund pending / 'closed' money
 * back) and, when present, takes precedence over the raw status so a booking
 * that is refunded or mid-refund reads that way instead of as plain
 * cancelled/confirmed.
 */
export function bookingStatusMeta(
  status?: string | null,
  paymentTiming?: string | null,
  paymentStatus?: string | null,
  refundState?: 'open' | 'closed' | null
): StatusMeta {
  if (refundState === 'open') return { label: 'Refund pending', kind: 'attention' }
  if (refundState === 'closed') return { label: 'Refunded', kind: 'done' }

  switch (status) {
    case 'COMPLETED':
      return { label: 'Completed', kind: 'done' }
    case 'CANCELLED':
      return { label: 'Cancelled', kind: 'cancelled' }
    case 'CONFIRMED':
      return { label: 'Confirmed', kind: 'ok' }
    case 'NO_SHOW':
      return { label: 'No show', kind: 'cancelled' }
    case 'PENDING':
      // Paid bookings read "Confirmed" (any SUCCEEDED payment is a confirmed
      // booking from the traveller's perspective); only unpaid reserve-now-
      // pay-later reservations stay labeled "Reserved".
      if (paymentStatus === 'SUCCEEDED') return { label: 'Confirmed', kind: 'ok' }
      if (paymentTiming === 'later') return { label: 'Reserved', kind: 'attention' }
      return { label: 'Pending', kind: 'attention' }
    default:
      return { label: String(status || '—').replace(/_/g, ' '), kind: 'neutral' }
  }
}
