import { MapPin, Globe, Compass } from 'lucide-react'
import BookingsIcon from './BookingsIcon'

/**
 * Per-kind icon for search-dropdown suggestions (GetYourGuide-style):
 *   place  (Destination / city) -> location pin
 *   attraction                  -> Bookings (tickets) glyph
 *   region                      -> globe
 *   tour   (no photo)           -> compass
 */
export default function SearchSuggestionIcon({ kind, size = 18 }: { kind: string; size?: number }) {
  switch (kind) {
    case 'attraction':
      return <BookingsIcon size={size} />
    case 'region':
      return <Globe size={size} strokeWidth={2} />
    case 'tour':
      return <Compass size={size} strokeWidth={2} />
    case 'place':
    default:
      return <MapPin size={size} strokeWidth={2} />
  }
}
