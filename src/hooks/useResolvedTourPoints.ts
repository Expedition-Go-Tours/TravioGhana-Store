import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  resolveTourPoints,
  resolvedPointsToTour,
  type ResolveTourSource,
  type ResolvedTourPoint,
} from '@/lib/resolvePoints'

export interface UseResolvedTourPointsResult {
  /** Points with every coordinate resolved where geocoding succeeded. */
  points: ResolvedTourPoint[]
  /** The resolved points merged into a map-consumable tour object. */
  mapTour: ResolveTourSource | null
  loading: boolean
  /** Number of points geocoding failed to resolve (still listed, flagged). */
  unresolvedCount: number
  /** Re-runs the geocode pipeline (retry after a failure or sign-in). */
  retry: () => void
}

/**
 * Geocode pipeline for the booking maps: resolves the tour's meeting point,
 * pickup areas and pickup locations into exact lat/lng (forward-geocoding any
 * entry missing coordinates via /locations/search). The resolved list feeds
 * the pickup selection modal; the `mapTour` derivative feeds the layered map
 * components unchanged.
 */
export function useResolvedTourPoints(tour: ResolveTourSource | null | undefined): UseResolvedTourPointsResult {
  const [points, setPoints] = useState<ResolvedTourPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    // State is only touched in async callbacks (never synchronously in the
    // effect body) to keep the react-hooks rules happy.
    Promise.resolve().then(() => {
      if (!cancelled) setLoading(true)
    })
    void resolveTourPoints(tour).then((resolved) => {
      if (!cancelled) {
        setPoints(resolved)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [tour, nonce])

  const retry = useCallback(() => setNonce((n) => n + 1), [])

  const mapTour = useMemo(
    () => (tour ? resolvedPointsToTour(points, tour) : null),
    [points, tour],
  )

  return {
    points,
    mapTour,
    loading,
    unresolvedCount: points.filter((p) => p.unresolved).length,
    retry,
  }
}
