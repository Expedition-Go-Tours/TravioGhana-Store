import { useState } from 'react'
import { AlertTriangle, Link2, Loader2, MapPin } from 'lucide-react'
import { parseGoogleMapsLocation } from '@/lib/googleMapsLink'
import { reverseGeocode } from '@/lib/locations'

export interface PastedPinLocation {
  lat: number
  lng: number
  label: string
}

interface PasteMapsLinkPanelProps {
  /** Called with the resolved pin once "Place Pin" succeeds. */
  onApply: (location: PastedPinLocation) => void
  /** Positioning classes for the dropdown-anchored panel. */
  className?: string
}

/**
 * "Can't find your location? Paste a Google Maps link" panel, shared by the
 * booking form's LocationPicker and the PickupSelectModal search.
 *
 * The pasted link is parsed locally (no network request to Google); the
 * resulting coordinates are reverse-geocoded for a readable label, falling
 * back to the place name inside the link, then to the bare coordinates —
 * mirroring the map's drag-to-pick behaviour.
 */
export default function PasteMapsLinkPanel({ onApply, className = '' }: PasteMapsLinkPanelProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handlePlacePin = async (): Promise<void> => {
    if (busy) return
    const parsed = parseGoogleMapsLocation(value)
    if (!parsed.ok) {
      setError(
        parsed.reason === 'short-link'
          ? 'That’s a shortened Google link — open it, then copy the full link from your browser’s address bar and paste it here.'
          : 'Couldn’t find coordinates in that. Paste a Google Maps link or coordinates like 5.6037, -0.1870.',
      )
      return
    }
    setBusy(true)
    setError(null)
    const resolved = await reverseGeocode(parsed.lat, parsed.lng).catch(() => null)
    const label =
      resolved?.formatted ||
      parsed.label ||
      `${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)}`
    setBusy(false)
    onApply({ lat: parsed.lat, lng: parsed.lng, label })
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/60 ${className}`}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <Link2 className="size-3.5 shrink-0 text-[#179237]" />
        Paste your Google Maps link
      </p>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          if (error) setError(null)
        }}
        rows={2}
        autoFocus
        aria-label="Google Maps link"
        placeholder="https://www.google.com/maps/place/…"
        className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#179237] focus:ring-2 focus:ring-[#179237]/15"
      />
      {error && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium leading-relaxed text-rose-600">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => void handlePlacePin()}
          disabled={busy || value.trim().length === 0}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <MapPin className="size-3.5" />}
          {busy ? 'Placing pin…' : 'Place Pin'}
        </button>
      </div>
    </div>
  )
}
