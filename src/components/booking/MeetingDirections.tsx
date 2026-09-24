import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, LocateFixed } from 'lucide-react'
import { appleMapsDirectionsUrl, googleMapsDirectionsUrl } from '../../lib/geoapifyRouting'
import { reverseGeocode } from '../../lib/locations'
import { useLocationSharing } from '../../hooks/useLocationSharing'

interface MeetingDirectionsDestination {
  lat: number
  lng: number
  label: string
}

interface MeetingDirectionsProps {
  /** Meeting-point destination (null = render nothing). */
  destination: MeetingDirectionsDestination | null
  /** Reports the traveller's shared location so the booking form can fill
      travellers.location. Fired once per resolved position + address. */
  onLocationResolved?: (location: { lat: number; lng: number; address?: string }) => void
}

/**
 * Directions to the meeting point, gated behind the traveller's location
 * opt-in. The Google/Apple Maps links are only built once location sharing is
 * on AND a position resolved — the deep-links then carry the traveller's
 * current location as their origin, so directions genuinely start from where
 * they are. When sharing is off the links are not rendered at all.
 *
 * The browser permission prompt can only appear from the explicit
 * "Turn on location" / "Retry" controls (user gestures).
 */
export default function MeetingDirections({ destination, onLocationResolved }: MeetingDirectionsProps) {
  const { enabled, permission, status, coords, enable, disable, retry } = useLocationSharing()
  const reportedRef = useRef<string | null>(null)

  // Reverse-geocode the resolved position for display + the booking payload.
  // State is only set from promise callbacks, never synchronously on mount.
  const [geocoded, setGeocoded] = useState<{ key: string; address: string } | null>(null)
  const coordsKey = coords ? `${coords.lat},${coords.lng}` : null
  useEffect(() => {
    if (!coords || !coordsKey) return
    let active = true
    reverseGeocode(coords.lat, coords.lng)
      .then((result) => {
        if (active) setGeocoded({ key: coordsKey, address: result?.formatted ?? '' })
      })
      .catch(() => {
        if (active) setGeocoded({ key: coordsKey, address: '' })
      })
    return () => {
      active = false
    }
  }, [coords, coordsKey])

  const address = coordsKey != null && geocoded?.key === coordsKey ? geocoded.address : ''
  const geocoding = coords != null && geocoded?.key !== coordsKey

  // Report each distinct position once, after its address settles.
  useEffect(() => {
    if (!coords || !coordsKey || geocoding) return
    if (!onLocationResolved) return
    if (reportedRef.current === coordsKey) return
    reportedRef.current = coordsKey
    onLocationResolved({ lat: coords.lat, lng: coords.lng, address: address || undefined })
  }, [coords, coordsKey, geocoding, address, onLocationResolved])

  useEffect(() => {
    if (!coords) reportedRef.current = null
  }, [coords])

  if (!destination) return null

  const unsupported = status === 'unsupported' || permission === 'unsupported'
  const blocked = status === 'denied'
  const requesting = status === 'requesting'
  const ready = status === 'ready' && coords != null

  const dest = { lat: destination.lat, lng: destination.lng }

  return (
    <div className="space-y-1.5 pl-[22px] text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-slate-600">Directions:</span>

        {requesting ? (
          <span className="inline-flex items-center gap-1 font-medium text-slate-500">
            <Loader2 size={11} className="animate-spin" />
            Getting your location…
          </span>
        ) : ready && coords ? (
          <>
            <a
              href={googleMapsDirectionsUrl(coords, dest, 'drive')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline underline-offset-2 transition-colors hover:text-emerald-900"
            >
              Open in Google Maps <ExternalLink size={11} />
            </a>
            <span className="text-slate-300">·</span>
            <a
              href={appleMapsDirectionsUrl(coords, dest)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline underline-offset-2 transition-colors hover:text-emerald-900"
            >
              Apple Maps <ExternalLink size={11} />
            </a>
            <span className="text-slate-400">from your current location</span>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              void enable()
            }}
            disabled={unsupported}
            className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline underline-offset-2 transition-colors hover:text-emerald-900 disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
          >
            <LocateFixed size={11} />
            {enabled ? 'Allow location access' : 'Turn on location'}
          </button>
        )}
      </div>

      {ready ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-400">
          <span>
            Your location: {address || (geocoding ? 'Locating your address…' : `${coords?.lat.toFixed(5)}, ${coords?.lng.toFixed(5)}`)}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={true}
            aria-label="Turn off location sharing"
            onClick={disable}
            className="font-semibold text-slate-500 underline underline-offset-2 transition-colors hover:text-slate-700"
          >
            Turn off
          </button>
        </p>
      ) : !requesting ? (
        <p className={blocked ? 'text-amber-600' : 'text-slate-400'}>
          {unsupported
            ? 'Location isn’t available on this device — open the destination in your maps app instead.'
            : blocked
              ? 'Location access is blocked. Enable it in your browser settings, then retry.'
              : status === 'error'
                ? 'We couldn’t get your location. Check that location services are on, then retry.'
                : enabled
                  ? 'Allow location access to get directions from where you are.'
                  : 'Turn on location to get directions from where you are.'}
        </p>
      ) : null}

      {!ready && !requesting && (blocked || status === 'error') && !unsupported && (
        <button
          type="button"
          onClick={() => {
            void retry()
          }}
          className="font-semibold text-emerald-700 underline underline-offset-2 transition-colors hover:text-emerald-900"
        >
          Retry
        </button>
      )}
    </div>
  )
}
