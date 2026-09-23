const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const HOUR_MS = 60 * 60 * 1000

/**
 * Platform-standard free-cancellation window. A booking made inside this window
 * (i.e. the selected travel date/time is less than this many hours away) has no
 * free cancellation and is presented as non-refundable — Viator's rule.
 */
export const STANDARD_CANCELLATION_WINDOW_HOURS = 48

/** Ordinal suffix for a day of the month, e.g. 1 → "st", 21 → "st". */
function ordinalSuffix(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return 'th'
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

/**
 * Returns the next day after `dateISO` (YYYY-MM-DD) as a compact
 * month + ordinal-day label, e.g. "2026-08-20" → "Aug 21st".
 * Returns null for empty/invalid input.
 */
export function nextDayLabel(dateISO: string): string | null {
  if (!dateISO) return null
  const date = new Date(`${dateISO}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  date.setDate(date.getDate() + 1)
  return `${MONTHS[date.getMonth()]} ${date.getDate()}${ordinalSuffix(date.getDate())}`
}

/** "Aug 21st" or, when a non-midnight time is set, "Aug 21st, 3:00 PM". */
function formatDeadline(date: Date): string {
  const day = `${MONTHS[date.getMonth()]} ${date.getDate()}${ordinalSuffix(date.getDate())}`
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
  if (!hasTime) return day
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day}, ${time}`
}

/** True when the policy can never be cancelled for a refund. */
export function isNonRefundablePolicy(policy: string): boolean {
  if (!policy) return true
  return /non[-\s]?refundable|no refunds?|all sales final/i.test(policy)
}

/**
 * Parse the free-cancellation window (in hours) out of a human policy string,
 * e.g. "Free cancellation up to 48 hours before start time" → 48,
 * "Free cancellation up to 2 days before" → 48. Returns null when the policy
 * carries no explicit window (the caller applies the platform standard).
 */
export function parseCancellationWindowHours(policy: string): number | null {
  if (!policy) return null
  const hourMatch = policy.match(/(\d+)\s*hours?/i)
  if (hourMatch) return parseInt(hourMatch[1], 10)
  const dayMatch = policy.match(/(\d+)\s*days?/i)
  if (dayMatch) return parseInt(dayMatch[1], 10) * 24
  const weekMatch = policy.match(/(\d+)\s*weeks?/i)
  if (weekMatch) return parseInt(weekMatch[1], 10) * 24 * 7
  return null
}

/** Local epoch-ms of the activity start (date + optional HH:mm slot). */
function activityStartMs(dateISO: string, selectedTime?: string | null): number | null {
  if (!dateISO) return null
  const time = selectedTime && /^\d{2}:\d{2}$/.test(selectedTime) ? selectedTime : '00:00'
  const d = new Date(`${dateISO}T${time}:00`)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

export interface CancellationStatus {
  /** Whether the selected date is still inside the free-cancellation window. */
  refundable: boolean
  /** Headline label, e.g. "Free Cancellation before Aug 19th (local time)". */
  label: string
  /** Supporting sentence shown when the window has closed. */
  sublabel?: string
}

/**
 * Date-aware cancellation status for a selected travel date (Viator's rule).
 *
 *  - A non-refundable policy is always non-refundable.
 *  - Otherwise the free-cancellation deadline is
 *    `activity start − policy window` (platform standard 48h when the policy
 *    carries no explicit window). Booking inside that window (the selected date
 *    is too close) has no free cancellation → "Non-refundable".
 *  - With no date selected, the raw policy label is shown.
 */
export function cancellationStatus(
  policy: string,
  dateISO?: string,
  selectedTime?: string | null,
  nowMs: number = Date.now(),
): CancellationStatus | null {
  if (!policy) return null
  if (isNonRefundablePolicy(policy)) {
    return { refundable: false, label: 'Non-refundable' }
  }
  if (!dateISO) {
    return { refundable: true, label: policy }
  }

  // Viator's rule: the tour's own cancellation window applies; the platform
  // standard (48h) is the fallback when the policy carries no explicit window.
  const windowHours = parseCancellationWindowHours(policy) ?? STANDARD_CANCELLATION_WINDOW_HOURS
  const start = activityStartMs(dateISO, selectedTime)
  if (start == null) {
    return { refundable: true, label: policy }
  }

  const deadline = start - windowHours * HOUR_MS
  if (nowMs >= deadline) {
    return {
      refundable: false,
      label: 'Non-refundable',
      sublabel: 'The free cancellation window has closed for this date.',
    }
  }

  return {
    refundable: true,
    label: `Free Cancellation before ${formatDeadline(new Date(deadline))} (local time)`,
  }
}

/**
 * Renders a windowed free-cancellation policy with the concrete cutoff date and
 * honours the date-aware rule: a selected date inside the cancellation window
 * (or a non-refundable policy) reads "Non-refundable".
 *
 * Kept as a string helper for existing callers (quick facts, booking summary).
 */
export function freeCancellationDateLabel(
  policy: string,
  dateISO?: string,
  selectedTime?: string | null,
  nowMs?: number,
): string {
  const status = cancellationStatus(policy, dateISO, selectedTime, nowMs)
  return status ? status.label : policy
}
