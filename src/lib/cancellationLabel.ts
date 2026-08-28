const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

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

/**
 * Renders a windowed free-cancellation policy with a concrete cutoff date,
 * e.g. policy "Free cancellation up to 24 hours before start time" with a
 * travel date of 2026-08-20 → "Free Cancellation before Aug 21st (local time)".
 *
 * Non-free policies, free-cancellation without an explicit window, or a
 * missing/invalid travel date all fall back to the original policy text.
 */
export function freeCancellationDateLabel(policy: string, dateISO?: string): string {
  if (!policy) return policy
  if (!/free\s*cancellation/i.test(policy)) return policy
  if (!/\d+\s*(hour|day|week)s?/i.test(policy)) return policy
  const day = nextDayLabel(dateISO || '')
  if (!day) return policy
  return `Free Cancellation before ${day} (local time)`
}
