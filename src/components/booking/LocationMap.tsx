import { useMemo, useState } from 'react'
import { buildTourPoints, toNumber, type MapPoint, type PickupMapSource, type SelectedPoint } from '@/lib/mapUtils'
import { getMapboxToken } from '@/lib/mapbox'
import { pickupZoneRings } from '@/lib/pickupZone'
import type { GeoapifyRoute } from '@/lib/geoapifyRouting'
import MapboxPickupMap from './MapboxPickupMap'
import PickupZoneMap, { type PickupZoneMapTour } from './PickupZoneMap'

interface LocationMapProps {
  tour: PickupZoneMapTour
  userMarker?: { lat: number | null; lng: number | null; label?: string | null } | null
  onUserPointChange?: (lat: number, lng: number) => void
  /** Reverse-geocoded formatted address for a point picked on the map. */
  onUserAddressChange?: (address: string) => void
  /** Extra non-interactive pins (e.g. nearby landmarks) layered on the map. */
  extraPoints?: MapPoint[]
  /** Fired with the pin's label when a tour pickup/meeting pin is tapped. */
  onPinClick?: (label: string) => void
  /** True when the traveller's location is outside the pickup zones/points —
      the pin renders red with an × ("location not included"). */
  userOutOfRange?: boolean
  /** True when the traveller has a confirmed chosen pickup location (shown as
      "Your pickup location" in the map legend, even when the pin is hidden). */
  userChosen?: boolean
  /** The pickup/meeting point the traveller selected — that pin renders in
      the bright green check-mark style and the legend shows a "Selected
      pickup point" entry. Matched by label or tight coordinates. */
  selectedPin?: SelectedPoint | null
  /** Label of the selected pickup/meeting point (legacy prop). */
  selectedPinLabel?: string | null
  /** When true (multi-point pickups) no draggable user pin is shown and map
      clicks don't place a custom location — the traveller picks a fixed point. */
  suppressDraggablePin?: boolean
  /** When set (and changed), the map flies to this point — used to zoom onto a
      location clicked in the modal's side list. */
  focusPoint?: { lat: number; lng: number } | null
  /** Height classes for the map container (defaults to the standard booking height). */
  mapHeight?: string
  /** A directions route to draw on the map (origin → destination polyline,
      with a blue origin marker). Cleared when null. */
  route?: GeoapifyRoute | null
}

/**
 * Layered pickup map for the booking area — MapLibre GL with OpenFreeMap
 * "Liberty" tiles (keyless, the same stack the supplier platform uses) is
 * the PRIMARY renderer; any fatal failure degrades to Mapbox GL (2D) when a
 * token is configured, then the textual fallback (address + Google Maps
 * link).
 *
 *  1. MapLibre + OpenFreeMap Liberty — primary (no key required)
 *  2. Mapbox GL JS (2D)              — fallback on MapLibre fatal failure (token required)
 *  3. Text + Google Maps link        — last resort (PickupZoneMap `mapDisabled`)
 */
export default function LocationMap({ tour, userMarker, onUserPointChange, onUserAddressChange, extraPoints, onPinClick, mapHeight, userOutOfRange, userChosen, selectedPin, selectedPinLabel, suppressDraggablePin, focusPoint, route }: LocationMapProps) {
  const [osmFailed, setOsmFailed] = useState(false)
  const [mapboxFailed, setMapboxFailed] = useState(false)

  // Mapbox token — evaluated once per mount; a missing token skips layer 2.
  const mapboxToken = useMemo(() => getMapboxToken(), [])

  const tourPoints = useMemo(() => buildTourPoints(tour as PickupMapSource), [tour])
  // Drawn geoshapes + location-only radius circles (mirrors the child map
  // renderers, so the map-data gate never disagrees with what they draw).
  const zones = useMemo(
    () => pickupZoneRings(tour.pickupAreas, tour.pickupLocations?.filter(Boolean).length ?? 0),
    [tour.pickupAreas, tour.pickupLocations],
  )
  const exclusions = useMemo(
    () =>
      (tour.pickupAreas || [])
        .flatMap((a) => (Array.isArray(a?.exclusions) ? a.exclusions : []))
        .filter((e): e is [number, number][] => Array.isArray(e) && e.length >= 3),
    [tour.pickupAreas],
  )
  const userPoint = useMemo(() => {
    const lat = toNumber(userMarker?.lat)
    const lng = toNumber(userMarker?.lng)
    return lat != null && lng != null ? { lat, lng } : null
  }, [userMarker?.lat, userMarker?.lng])

  const hasMapData =
    zones.length > 0 || exclusions.length > 0 || tourPoints.length > 0 || userPoint != null

  // No map data at all → let PickupZoneMap render its OSM-embed/text fallback
  // (neither renderer draws anything without coordinates anyway).
  if (!hasMapData) {
    return (
      <PickupZoneMap
        tour={tour}
        userMarker={userMarker}
        onUserPointChange={onUserPointChange}
        onUserAddressChange={onUserAddressChange}
        extraPoints={extraPoints}
        onPinClick={onPinClick}
        mapHeight={mapHeight}
        userOutOfRange={userOutOfRange}
        userChosen={userChosen}
        selectedPin={selectedPin}
        selectedPinLabel={selectedPinLabel}
        suppressDraggablePin={suppressDraggablePin}
        focusPoint={focusPoint}
        route={route}
      />
    )
  }

  // 1. PRIMARY — MapLibre + OpenFreeMap "Liberty" (keyless, supplier stack).
  if (!osmFailed) {
    return (
      <PickupZoneMap
        tour={tour}
        userMarker={userMarker}
        onUserPointChange={onUserPointChange}
        onUserAddressChange={onUserAddressChange}
        extraPoints={extraPoints}
        onPinClick={onPinClick}
        mapHeight={mapHeight}
        userOutOfRange={userOutOfRange}
        userChosen={userChosen}
        selectedPin={selectedPin}
        selectedPinLabel={selectedPinLabel}
        suppressDraggablePin={suppressDraggablePin}
        focusPoint={focusPoint}
        onFatalFailure={() => setOsmFailed(true)}
        route={route}
      />
    )
  }

  // 2. FALLBACK — Mapbox GL (2D) when a token is configured.
  if (mapboxToken && !mapboxFailed) {
    return (
      <MapboxPickupMap
        tour={tour}
        userMarker={userMarker}
        userOutOfRange={userOutOfRange}
        userChosen={userChosen}
        selectedPin={selectedPin}
        selectedPinLabel={selectedPinLabel}
        suppressDraggablePin={suppressDraggablePin}
        focusPoint={focusPoint}
        onUserPointChange={onUserPointChange}
        onUserAddressChange={onUserAddressChange}
        extraPoints={extraPoints}
        onPinClick={onPinClick}
        mapHeight={mapHeight}
        onFatalFailure={() => setMapboxFailed(true)}
        route={route}
      />
    )
  }

  // 3. Last resort — text + Google Maps link (no map attempt, no retry loop).
  return (
    <PickupZoneMap
      tour={tour}
      userMarker={userMarker}
      onUserPointChange={onUserPointChange}
      onUserAddressChange={onUserAddressChange}
      extraPoints={extraPoints}
      onPinClick={onPinClick}
      mapHeight={mapHeight}
      userOutOfRange={userOutOfRange}
      userChosen={userChosen}
      selectedPin={selectedPin}
      selectedPinLabel={selectedPinLabel}
      suppressDraggablePin={suppressDraggablePin}
      focusPoint={focusPoint}
      mapDisabled
      route={route}
    />
  )
}
