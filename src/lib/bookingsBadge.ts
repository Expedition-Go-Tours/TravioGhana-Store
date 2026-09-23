/**
 * Shared persistence for the navbar "new bookings" badge marker.
 *
 * The navbar shows a badge while the number of the user's CONFIRMED/PENDING
 * bookings (bookingsCount) is higher than the last count the user has seen.
 * That "seen" number lives in localStorage so it survives reloads and can be
 * shared by every entry point that surfaces the bookings list (navbar icon,
 * dashboard top tab, bottom bar, mobile drawer).
 */

const BOOKINGS_SEEN_KEY = 'navBookingsSeen'

export function readBookingsSeen(): number {
  try {
    return Number(localStorage.getItem(BOOKINGS_SEEN_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

export function writeBookingsSeen(count: number): void {
  try {
    localStorage.setItem(BOOKINGS_SEEN_KEY, String(count))
  } catch {
    /* storage unavailable */
  }
}
