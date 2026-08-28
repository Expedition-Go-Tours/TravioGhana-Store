import { ExternalLink } from 'lucide-react'
import { appleMapsDirectionsUrl, googleMapsDirectionsUrl } from '@/lib/geoapifyRouting'

interface DirectionsDestination {
  lat: number
  lng: number
  label: string
}

interface DirectionsPanelProps {
  /** The location the traveller wants directions to (null = render nothing). */
  destination: DirectionsDestination | null
  /** Embed without the bordered white strip (for use inside a summary card). */
  inline?: boolean
}

/**
 * "Get directions" control for a chosen location — offers Google/Apple Maps
 * turn-by-turn deep-links to the destination (the links work with or without
 * an origin, so no geolocation is requested).
 */
export default function DirectionsPanel({ destination, inline = false }: DirectionsPanelProps) {
  if (!destination) return null

  return (
    <div className={inline ? 'flex flex-wrap items-center gap-x-2 gap-y-1' : 'border-t border-slate-100 bg-white px-4 py-2.5'}>
      <span className="text-xs font-semibold text-slate-600">Directions:</span>
      <a
        href={googleMapsDirectionsUrl(null, destination, 'drive')}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 underline underline-offset-2 transition-colors hover:text-[#179237]"
      >
        Open in Google Maps <ExternalLink size={11} />
      </a>
      <span className="text-slate-300">·</span>
      <a
        href={appleMapsDirectionsUrl(null, destination)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 underline underline-offset-2 transition-colors hover:text-[#179237]"
      >
        Apple Maps <ExternalLink size={11} />
      </a>
    </div>
  )
}
