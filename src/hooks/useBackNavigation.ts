/**
 * "Go back" that actually returns the user to where they came from.
 *
 * A bare `navigate(-1)` is a dead end for anyone who landed on the page
 * directly — a pasted link, a share, a new tab. There is no in-app history, so
 * it either does nothing or drops them out of the site entirely. react-router
 * keeps an `idx` on the history state (0 for a fresh entry), which is how we
 * tell the two cases apart and fall through to a sensible parent page instead.
 *
 * @see AllToursPage, which used this inline before it was extracted.
 */
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

export function useBackNavigation(fallback: string) {
  const navigate = useNavigate()

  return useCallback(() => {
    const idx = typeof window !== 'undefined' ? (window.history.state?.idx ?? 0) : 0
    if (idx > 0) navigate(-1)
    else navigate(fallback)
  }, [navigate, fallback])
}
