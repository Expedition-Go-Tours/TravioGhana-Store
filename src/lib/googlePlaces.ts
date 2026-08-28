import { loadGoogleMapsLibrary } from './googleMaps'

/**
 * Google Places helpers for the booking experience — Nearby Search around a
 * traveller's pickup point, and Place Details for pin info windows. Uses the
 * modern `Place` API (google.maps.places.Place) via lazy library import, so it
 * works whether the Maps JS API was loaded by @vis.gl/react-google-maps or by
 * the app's own loader. Every failure resolves to an empty result so callers
 * can fall back to the backend location service (Geoapify/Overpass).
 */

export interface GoogleNearbyPlace {
  name: string
  lat: number | null
  lng: number | null
  category: string | null
  /** Place id — enables the info-window Place Details lookup. */
  placeId?: string | null
  rating?: number | null
}

export interface GooglePlaceDetails {
  name?: string
  formattedAddress?: string
  rating?: number | null
  userRatingCount?: number | null
  openNow?: boolean | null
  typesLabel?: string
}

const NEARBY_TYPES = ['cafe', 'restaurant', 'hotel', 'tourist_attraction'] as const

/** Human label for a Place type (falls back to the raw type string). */
export function placeTypeLabel(type?: string | null): string | undefined {
  if (!type) return undefined
  const labels: Record<string, string> = {
    cafe: 'Café',
    restaurant: 'Restaurant',
    hotel: 'Hotel',
    tourist_attraction: 'Attraction',
    monument: 'Monument',
    landmark: 'Landmark',
    museum: 'Museum',
    park: 'Park',
    bar: 'Bar',
    lodging: 'Lodging',
    point_of_interest: 'Point of interest',
    establishment: 'Place',
  }
  return labels[type] || type
}

/**
 * Places Nearby Search (modern `Place.searchNearby`) for cafes, restaurants,
 * hotels and attractions around [lat, lng]. Returns up to 10 places, or []
 * when the lookup fails so the caller falls back to the backend service.
 */
export async function fetchNearbyPlacesGoogle(
  lat: number,
  lng: number,
  radiusKm = 3,
): Promise<GoogleNearbyPlace[]> {
  try {
    const { Place } = await loadGoogleMapsLibrary('places')
    const { places } = await Place.searchNearby({
      locationRestriction: { center: { lat, lng }, radius: Math.max(1, radiusKm) * 1000 },
      includedTypes: [...NEARBY_TYPES],
      fields: ['displayName', 'location', 'types', 'rating', 'id'],
      maxResultCount: 10,
    })
    return places
      .map((p) => ({
        name: p.displayName ?? '',
        lat: p.location?.lat() ?? null,
        lng: p.location?.lng() ?? null,
        category: p.types?.[0] ?? null,
        placeId: p.id ?? null,
        rating: p.rating ?? null,
      }))
      .filter((p) => p.name && p.lat != null && p.lng != null)
  } catch {
    return []
  }
}

/**
 * Place Details for a pin's info window (address, rating, review count, open
 * now). Returns null when the lookup fails — the info window then shows just
 * the pin label.
 */
export async function fetchPlaceDetails(placeId: string): Promise<GooglePlaceDetails | null> {
  try {
    const { Place } = await loadGoogleMapsLibrary('places')
    const { place } = await new Place({ id: placeId }).fetchFields({
      fields: [
        'displayName',
        'formattedAddress',
        'rating',
        'userRatingCount',
        'currentOpeningHours',
        'types',
      ],
    })
    const hoursOpen = await place.isOpen()
    return {
      name: place.displayName ?? undefined,
      formattedAddress: place.formattedAddress ?? undefined,
      rating: place.rating ?? null,
      userRatingCount: place.userRatingCount ?? null,
      openNow: hoursOpen ?? null,
      typesLabel: placeTypeLabel(place.types?.[0]),
    }
  } catch {
    return null
  }
}
