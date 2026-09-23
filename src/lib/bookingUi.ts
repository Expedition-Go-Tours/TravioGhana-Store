/* Shared, side-effect-free presentation helpers for the customer bookings
   experience (list card + booking workspace). Kept dependency-free so both
   components and any future surface (e.g. confirmation) use one definition. */

export interface PartyCount {
  adults: number
  children: number
  infants: number
  total: number
}

export function toFiniteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function formatFullDate(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** e.g. "Mon, Aug 18, 2026" — compact date used on cards. */
export function formatMediumDate(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** e.g. "Mon, Aug 18" without the year, used for date-group headings. */
export function formatHeadingDate(value?: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
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

/** "2 Adults", "1 Adult, 1 Child", or "3 People" when details are flat. */
export function partyLabel(party?: PartyCount | null): string {
  if (!party || party.total === 0) return ''
  const parts: string[] = []
  if (party.adults) parts.push(`${party.adults} ${party.adults === 1 ? 'Adult' : 'Adults'}`)
  if (party.children) parts.push(`${party.children} ${party.children === 1 ? 'Child' : 'Children'}`)
  if (party.infants) parts.push(`${party.infants} ${party.infants === 1 ? 'Infant' : 'Infants'}`)
  if (parts.length) return parts.join(' · ')
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
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
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
