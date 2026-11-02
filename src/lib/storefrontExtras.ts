/**
 * Sprint 1 storefront extras — shareable wishlists, the sold-out waitlist, and
 * the trust facts shown next to a price.
 *
 * One module so the three new surfaces share a single request contract: the
 * backend answers `{ status, data }`, `apiFetch` unwraps `data`, and every
 * failure surfaces as an `ApiError` with the server's own message.
 */

import { apiFetch } from './api'

/** Trust facts for a tour, derived from real bookings and verified reviews. */
export interface TourTrust {
  /** Approved reviews linked to an actual booking. Null below the sample size. */
  verifiedReviewCount: number | null
  totalReviewCount: number
  /** Placed in the last 7 days. Null below the sample size. */
  bookingsLast7Days: number | null
  averageRating: number | null
}

/**
 * Trust facts for a tour page. Returns null rather than throwing: this is
 * decoration next to the price, and a failed request must never break the page.
 */
export async function fetchTourTrust(tourId: string): Promise<TourTrust | null> {
  if (!tourId) return null
  try {
    return await apiFetch<TourTrust>(`/travioghana/tours/${encodeURIComponent(tourId)}/trust`)
  } catch {
    return null
  }
}

export interface WaitlistResult {
  ok: boolean
  reason?: string
  alreadyJoined?: boolean
  email?: string
}

/** Join the waitlist for a date that is currently full. Guests may join. */
export async function joinWaitlist(input: {
  tourId: string
  travelDate: string
  email: string
}): Promise<WaitlistResult> {
  const res = await fetch('/travioghana/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, reason: payload.message || 'Could not join the waitlist. Try again.' }
  return { ok: true, ...payload.data }
}

/** Leave the waitlist by email (the link in the notification email). */
export async function leaveWaitlist(email: string): Promise<boolean> {
  const res = await fetch('/travioghana/waitlist', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email }),
  })
  return res.ok
}

export interface WishlistShare {
  token: string
  url: string
}

/** Mint (or reuse) the signed-in traveller's shareable wishlist link. */
export async function createWishlistShare(): Promise<WishlistShare> {
  return apiFetch<WishlistShare>('/travioghana/wishlist/share', { method: 'POST' })
}

/** Revoke the link — an old URL stops working immediately. */
export async function revokeWishlistShare(): Promise<boolean> {
  const data = await apiFetch<{ revoked: boolean }>('/travioghana/wishlist/share', { method: 'DELETE' })
  return !!data?.revoked
}

/**
 * Read someone else's shared wishlist. Returns the backend's raw listing rows
 * (the same shape `/tours` returns) — the page runs them through
 * `mapRawTourToListing` exactly as search results do, so a shared card is
 * identical to the card on the tour page.
 *
 * Throws for a revoked/expired/unknown token so the page can show "no longer
 * available" instead of an empty list.
 */
export async function fetchSharedWishlist(token: string): Promise<any[]> {
  const data = await apiFetch<{ tours: any[] }>(
    `/travioghana/wishlist/shared/${encodeURIComponent(token)}`
  )
  return data?.tours ?? []
}
