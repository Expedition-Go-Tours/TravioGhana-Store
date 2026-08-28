import { useEffect, useState } from 'react'
import { Bus, Car, Footprints, Loader2, Route } from 'lucide-react'
import { loadGoogleMapsLibrary, shouldAttemptGoogleMaps } from '@/lib/googleMaps'

/**
 * ETA chip for the booking map: when the traveller has a pickup location and
 * the tour has a meeting point with coordinates, show the travel time/distance
 * between them (driving, walking or transit) — the "commutes" reassurance that
 * sits under the pickup map. Hidden entirely when Google Maps is unavailable
 * (no key / billing) or when either coordinate is missing.
 *
 * State discipline: cache hits are adopted during render (no effect round-trip,
 * no synchronous setState in effects); only async callbacks touch state.
 */

type TravelMode = 'DRIVING' | 'WALKING' | 'TRANSIT'

interface TravelTimeChipProps {
  /** The traveller's pickup coordinates (contact.pickupLat/Lng). */
  from: { lat: number; lng: number } | null
  /** The tour's meeting point coordinates. */
  to: { lat: number; lng: number } | null
  /** Label for the destination (defaults to "the meeting point"). */
  destinationLabel?: string
}

interface EtaResult {
  minutes: number
  km: number
}

const cache = new Map<string, EtaResult>()

const MODES: { id: TravelMode; label: string }[] = [
  { id: 'DRIVING', label: 'Drive' },
  { id: 'WALKING', label: 'Walk' },
  { id: 'TRANSIT', label: 'Transit' },
]

const MODE_ICON = {
  DRIVING: Car,
  WALKING: Footprints,
  TRANSIT: Bus,
} as const

function etaKey(mode: TravelMode, from: { lat: number; lng: number }, to: { lat: number; lng: number }): string {
  return `${mode}:${from.lat.toFixed(5)},${from.lng.toFixed(5)}:${to.lat.toFixed(5)},${to.lng.toFixed(5)}`
}

export default function TravelTimeChip({ from, to, destinationLabel = 'the meeting point' }: TravelTimeChipProps) {
  const [mode, setMode] = useState<TravelMode>('DRIVING')
  const [eta, setEta] = useState<{ key: string; result: EtaResult } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)

  const visible = !!from && !!to && shouldAttemptGoogleMaps()
  const key = visible ? etaKey(mode, from!, to!) : ''

  // Adopt a cached route during render — React's documented "adjust state
  // during render" pattern, so repeated mode toggles never re-request.
  if (visible && eta?.key !== key) {
    const cachedEntry = cache.get(key)
    if (cachedEntry) setEta({ key, result: cachedEntry })
  }

  useEffect(() => {
    if (!visible || eta?.key === key || failedKey === key) return
    let disposed = false
    void loadGoogleMapsLibrary('routes')
      .then((routes) => {
        if (disposed) return
        new routes.DirectionsService().route(
          {
            origin: { lat: from!.lat, lng: from!.lng },
            destination: { lat: to!.lat, lng: to!.lng },
            travelMode: mode as google.maps.TravelMode,
          },
          (res, status) => {
            if (disposed) return
            const leg = res?.routes?.[0]?.legs?.[0]
            if (status !== 'OK' || !leg) {
              setFailedKey(key)
              return
            }
            const minutes = Math.max(1, Math.round((leg.duration?.value ?? 0) / 60))
            const km = (leg.distance?.value ?? 0) / 1000
            const entry = { minutes, km }
            cache.set(key, entry)
            setEta({ key, result: entry })
          },
        )
      })
      .catch(() => {
        if (!disposed) setFailedKey(key)
      })
    return () => {
      disposed = true
    }
  }, [visible, key, mode, from, to, eta?.key, failedKey])

  if (!visible || failedKey === key) return null

  const result = eta?.key === key ? eta.result : null
  const loading = result == null

  return (
    <div className="flex flex-wrap items-center gap-2 px-1 pb-1 pt-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
        {loading ? (
          <Loader2 size={12} className="animate-spin text-[#179237]" />
        ) : (
          <>
            <Route size={12} className="text-[#179237]" />
            ≈ {result.minutes} min · {result.km < 1 ? `${Math.round(result.km * 1000)} m` : `${result.km.toFixed(1)} km`} to {destinationLabel}
          </>
        )}
      </span>
      <div className="flex items-center gap-1" role="group" aria-label="Travel mode">
        {MODES.map((m) => {
          const active = m.id === mode
          const MIcon = MODE_ICON[m.id]
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              aria-pressed={active}
              title={`${m.label} directions`}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                active
                  ? 'border-[#179237] bg-[#179237] text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-[#179237]/50 hover:text-[#179237]'
              }`}
            >
              <MIcon size={11} />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
