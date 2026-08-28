import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { customPointStatus, isDuplicateCustomPoint } from '@/lib/customPickupPoints'
import { reverseGeocode } from '@/lib/locations'
import type { ResolvedTourPoint } from '@/lib/resolvePoints'
import type { PickupAreaShape } from '@/lib/pickupZone'

export type AddCustomPointResult =
  | { status: 'added'; point: ResolvedTourPoint }
  | { status: 'outside_zone'; point: null }
  | { status: 'duplicate'; point: null }

/**
 * Traveller-added pickup spots ("double-click the map to add a location").
 *
 * The spot is gated against the supplier's drawn pickup zones (outside →
 * toast), deduped against previously added spots (~50 m), then reverse
 * geocoded into a selectable ResolvedTourPoint. Used by the booking page's
 * Step 2 list and the "Choose on map" modal.
 */
export function useCustomPickupPoints(areas: PickupAreaShape[] | null | undefined) {
  const [points, setPoints] = useState<ResolvedTourPoint[]>([])
  const counterRef = useRef(0)

  const addPoint = useCallback(
    async (lat: number, lng: number): Promise<AddCustomPointResult> => {
      const status = customPointStatus(lat, lng, areas || [])
      if (status === 'outside') {
        toast.error('Double-click a spot inside a pickup zone to add it.')
        return { status: 'outside_zone', point: null }
      }
      if (isDuplicateCustomPoint(lat, lng, points)) {
        toast.info('That spot is already in your list.')
        return { status: 'duplicate', point: null }
      }

      const r = await reverseGeocode(lat, lng)
      const label = r?.formatted || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      counterRef.current += 1
      const point: ResolvedTourPoint = {
        id: `custom-${counterRef.current}`,
        kind: 'point',
        name: '',
        address: label,
        lat,
        lng,
        query: label,
      }
      setPoints((prev) => [...prev, point])
      return { status: 'added', point }
    },
    [areas, points],
  )

  const removePoint = useCallback((id: string) => {
    setPoints((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return { points, addPoint, removePoint }
}
