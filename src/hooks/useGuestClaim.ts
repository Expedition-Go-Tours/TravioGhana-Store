import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthUser } from './useAuthUser'
import { fetchWithAuth } from '../lib/api'

export interface ClaimableBooking {
  id: string
  bookingNumber: string
  tourTitle: string
  travelDate: string
  status: string
  amount: number
  currency: string
  leadTravelerName: string
}

export interface GuestClaimPreview {
  canClaim: boolean
  needsVerification: boolean
  count: number
  bookings: ClaimableBooking[]
}

const DISMISS_KEY = 'travio_guest_claim_dismissed'
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000

function wasDismissed(userId: string): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const map = JSON.parse(raw) as Record<string, number>
    const at = Number(map?.[userId] || 0)
    return Number.isFinite(at) && Date.now() - at < DISMISS_MS
  } catch {
    return false
  }
}

function rememberDismissal(userId: string): void {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    map[userId] = Date.now()
    localStorage.setItem(DISMISS_KEY, JSON.stringify(map))
  } catch {
    // private mode / disabled storage — the prompt simply reappears next time
  }
}

/**
 * One-time offer to attach guest bookings to the signed-in account.
 *
 * The server decides eligibility: an unverified account gets
 * `needsVerification` and no bookings, so this hook never has to guess from a
 * client-side flag. Dismissal is remembered per account for 30 days.
 */
export function useGuestClaim() {
  const user = useAuthUser()
  const queryClient = useQueryClient()
  // Tag the preview with the account it belongs to. Without this, signing out
  // and in as someone else could briefly show the previous account's list
  // while the new preview is in flight.
  const [preview, setPreview] = useState<(GuestClaimPreview & { forUserId: string }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.id || wasDismissed(user.id)) return
    const userId = user.id

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetchWithAuth('/auth/guest-bookings')
        if (!res.ok) return
        const payload = await res.json().catch(() => ({}))
        const data = (payload?.data ?? payload) as GuestClaimPreview | undefined
        if (
          !cancelled
          && data?.canClaim
          && data.count > 0
          && Array.isArray(data.bookings)
          && data.bookings.length > 0
        ) {
          setPreview({ ...data, forUserId: userId })
        }
      } catch {
        // A failed preview must never interrupt the page.
      }
    })()

    return () => {
      cancelled = true
    }
    // Re-run after the verify-email page refreshes the user (same id, new
    // emailVerified), otherwise the prompt would wait for the next login.
  }, [user?.id, user?.emailVerified])

  const dismiss = useCallback(() => {
    if (user?.id) rememberDismissal(user.id)
    setPreview(null)
  }, [user])

  const claim = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      // Omit bookingIds: the server claims every matching guest booking, not
      // just the 20 the modal can show.
      const res = await fetchWithAuth('/auth/guest-bookings/claim', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload?.message || 'We could not add those bookings. Please try again.')
        return null
      }
      await queryClient.invalidateQueries({ queryKey: ['expedition', 'bookings'] })
      setPreview(null)
      return (payload?.data ?? payload) as { claimed: number }
    } catch {
      setError('We could not add those bookings. Check your connection and try again.')
      return null
    } finally {
      setBusy(false)
    }
  }, [queryClient])

  const visiblePreview = preview && user?.id === preview.forUserId ? preview : null

  return { user, preview: visiblePreview, busy, error, claim, dismiss }
}
