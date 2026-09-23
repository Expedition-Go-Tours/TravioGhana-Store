import { useMemo } from 'react'
import { useTourFilterOptions } from './useExpeditionTours'
import { STATIC_DESTINATIONS, buildTourLink, matchDestination } from '../lib/reviewTourLink'

/** Local-first "Check Availability" link for an external review. */
export function useReviewTourLink(title: string): string {
  const { data } = useTourFilterOptions()

  const available = useMemo(() => {
    const api = data?.destinations ?? []
    return api.length > 0 ? api : STATIC_DESTINATIONS
  }, [data?.destinations])

  return useMemo(() => buildTourLink(matchDestination(title, available)), [title, available])
}
