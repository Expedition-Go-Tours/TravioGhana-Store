import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Route } from 'lucide-react'
import { estimateDrivingMinutes, fetchDrivingEta, formatDurationHM, straightLineKm, type LatLng } from '@/lib/drivingEta'

/** A designated pickup point/zone (a green pin on the map). */
export interface DesignatedPoint {
  lat: number
  lng: number
  label: string
}

interface OutOfRangeDistanceProps {
  /** The traveller's chosen (out-of-range) location. */
  from: LatLng
  /** Every designated pickup point/zone — each shows its distance & ETA. */
  points: DesignatedPoint[]
  /** Warning line shown above the list. */
  message: string
}

interface EtaEntry {
  minutes: number
  km: number
}

const cache = new Map<string, EtaEntry>()

function etaKey(from: LatLng, to: { lat: number; lng: number }): string {
  return `${from.lat.toFixed(5)},${from.lng.toFixed(5)}:${to.lat.toFixed(5)},${to.lng.toFixed(5)}`
}

/**
 * Card shown right under the location search bar when the chosen location is
 * NOT within the pickup zone/points: it lists ALL designated pickup
 * points/zones with each one's distance and travel time (hours & minutes).
 * Distance is always shown (straight-line, instant); the driving time comes
 * from the Mapbox Directions API, with an estimated fallback (~35 km/h) when
 * routing is unavailable.
 */
export default function OutOfRangeDistance({ from, points, message }: OutOfRangeDistanceProps) {
  return (
    <div className="rounded-xl border border-rose-200/70 bg-rose-50/60 px-3.5 py-2.5">
      <p className="flex items-start gap-2.5 text-sm font-medium leading-relaxed text-rose-700">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" />
        {message}
      </p>
      {points.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {points.map((p) => (
            <PointRow key={`${p.lat.toFixed(5)},${p.lng.toFixed(5)}`} from={from} point={p} />
          ))}
        </ul>
      )}
    </div>
  )
}

function PointRow({ from, point }: { from: LatLng; point: DesignatedPoint }) {
  const [eta, setEta] = useState<{ key: string; result: EtaEntry } | null>(null)
  const [failed, setFailed] = useState(false)
  const key = etaKey(from, point)

  // Adopt a cached route during render (React's "adjust state during render"
  // pattern) so repeated mounts never re-request the same pair.
  if (eta?.key !== key) {
    const cached = cache.get(key)
    if (cached) setEta({ key, result: cached })
  }

  useEffect(() => {
    if (eta?.key === key || failed) return
    let disposed = false
    void fetchDrivingEta(from, { lat: point.lat, lng: point.lng }).then((r) => {
      if (disposed) return
      if (r) {
        cache.set(key, r)
        setEta({ key, result: r })
      } else {
        setFailed(true)
      }
    })
    return () => {
      disposed = true
    }
  }, [key, eta?.key, failed, from, point])

  const straightKm = straightLineKm(from, point)
  const routeEta = eta?.key === key ? eta.result : null
  const loading = !routeEta && !failed

  const km = routeEta ? routeEta.km : straightKm
  const minutes = routeEta ? routeEta.minutes : estimateDrivingMinutes(straightKm)
  const approx = !routeEta

  const kmLabel = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`

  return (
    <li className="flex items-center justify-between gap-3 text-xs">
      <span className="min-w-0 truncate font-medium text-slate-700">{point.label}</span>
      <span className="flex shrink-0 items-center gap-1.5 font-semibold text-slate-700">
        {loading ? (
          <>
            <Loader2 size={12} className="animate-spin text-[#179237]" />
            Calculating…
          </>
        ) : (
          <>
            <Route size={12} className="shrink-0 text-[#179237]" />
            {approx ? '~' : '≈'} {kmLabel} · {formatDurationHM(minutes)} away
          </>
        )}
      </span>
    </li>
  )
}
