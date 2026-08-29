import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { MapPin, RefreshCw } from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { reverseGeocode } from '@/lib/locations'
import {
  DEFAULT_CENTER,
  DRAGGABLE_PIN_COLOR,
  SELECTED_PIN_COLOR,
  TILE_STYLE,
  TOUR_PIN_COLOR,
  USER_PIN_COLOR,
  buildTourPoints,
  cameraFromGeoData,
  createMapLibreMap,
  pinMatchesSelection,
  pinSvg,
  pulsingPinElement,
  ringsToFeatureCollection,
  routeOriginMarkerElement,
  routeToFeatureCollection,
  selectedPinSvg,
  toNumber,
  warmMapResources,
  type MapPoint,
  type PickupMapSource,
  type SelectedPoint,
} from '@/lib/mapUtils'
import type { GeoapifyRoute } from '@/lib/geoapifyRouting'
import { pickupZoneRings, type PickupAreaShape } from '@/lib/pickupZone'

/**
 * The booking page's tour object — the supplier's meeting/pickup config with
 * the drawn geoshapes that PickupMapSource doesn't declare.
 */
export interface PickupZoneMapTour {
  meetingMode?: 'meeting_point' | 'pickup' | 'none'
  meetingPoint?: string
  meetingPointAddress?: string
  meetingPointLat?: number | null
  meetingPointLng?: number | null
  pickupAreas?: (PickupAreaShape | null | undefined)[]
  pickupLocations?: { name?: string; address?: string; lat?: number | null; lng?: number | null }[]
  pickupDescription?: string
}

/**
 * GetYourGuide-style pickup map for the checkout. Renders the supplier's
 * drawn zones (green), exclusion zones (red dashed), the pickup/meeting
 * points, and a draggable blue pin for the traveller's chosen location.
 *
 * Production notes (mirroring the supplier dashboard's map system):
 *  - the tile style is warmed up (preconnect + force-cached fetch) before the
 *    first map opens, so the checkout never cold-starts against the tile CDN;
 *  - all map state lives in refs; sources/overlays are created exactly once
 *    and live-updated, so React re-renders never recreate the map;
 *  - a failing style degrades to the OSM embed / text + Google Maps link
 *    instead of leaving a blank box;
 *  - torn-down completely on unmount (no leaked maps, markers or timers).
 *
 * When the tour has no coordinates at all (legacy name/address-only config)
 * it falls back to an OSM embed located by the address string.
 */
export default function PickupZoneMap({
  tour,
  userMarker,
  userOutOfRange,
  userChosen,
  selectedPinLabel,
  selectedPin,
  suppressDraggablePin,
  focusPoint,
  onUserPointChange,
  onUserAddressChange,
  extraPoints,
  onFatalFailure,
  mapDisabled,
  onPinClick,
  mapHeight = 'h-[320px] sm:h-[340px]',
  route,
}: {
  tour: PickupZoneMapTour
  userMarker?: { lat: number | null; lng: number | null; label?: string | null } | null
  onUserPointChange?: (lat: number, lng: number) => void
  /** Reverse-geocoded formatted address for a point picked on the map. */
  onUserAddressChange?: (address: string) => void
  /** Extra non-interactive pins (e.g. nearby landmarks) layered on the map. */
  extraPoints?: MapPoint[]
  /** Fired when the map fatally fails (tile/style CDN down) — the layered
      LocationMap uses this to switch to Google Maps. */
  onFatalFailure?: () => void
  /** When true, never attempt to build the map — render the text fallback
      directly (used after the Google fallback also fails). */
  mapDisabled?: boolean
  /** Fired with the pin's label when a tour pickup/meeting pin is tapped. */
  onPinClick?: (label: string) => void
  /** True when the traveller's location is outside the pickup zones/points —
      the pin renders red with an × ("location not included"). */
  userOutOfRange?: boolean
  /** True when the traveller has a confirmed chosen pickup location — the
      legend shows a "Your pickup location" entry. */
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
}) {
  const [osmFailed, setOsmFailed] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapFailed, setMapFailed] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const embedRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const tourPinsRef = useRef<maplibregl.Marker[]>([])
  /** Tour-pin marker elements keyed by label + coords — the live-update
      effect swaps their artwork in place when the selected pin changes, and
      opens/closes the label tooltip for the green-tick selection. */
  const tourPinElsRef = useRef<{ label: string; lat: number; lng: number; el: HTMLElement; marker: maplibregl.Marker }[]>([])
  const extraPinsRef = useRef<maplibregl.Marker[]>([])
  const userPinRef = useRef<maplibregl.Marker | null>(null)
  /** Variant the existing user pin was built with, so a changed verdict swaps
      the blue pin for the red × ("not included") pin (and vice versa). */
  const userPinVariantRef = useRef<'default' | 'error'>('default')
  /** Last out-of-range point the camera was moved to, so the jump fires only
      once per point (not on every unrelated render). */
  const lastOutOfRangeKeyRef = useRef('')
  /** Last point the camera flew to from the side-list focus, so it fires only
      once per focus change (not on every unrelated render). */
  const lastFocusKeyRef = useRef('')
  const mapReadyRef = useRef(false)
  const paintedRef = useRef(false)
  const mapFailTimerRef = useRef<number | null>(null)
  const loadWatchdogRef = useRef<number | null>(null)
  const paintedWatchdogRef = useRef<number | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const selectedPinRef = useRef<SelectedPoint | null>(null)
  const selectedPinLabelRef = useRef<string | null>(null)
  const suppressDraggablePinRef = useRef<boolean | undefined>(undefined)
  const focusPointRef = useRef<{ lat: number; lng: number } | null>(null)
  /** True right after the draggable pin is dropped — the map fires a click
      after a marker drag; that ghost click must not re-trigger click-to-pick
      (which would fly the camera off to zoom 15 / re-open the prompt). */
  const dragJustEndedRef = useRef(false)
  const onUserPointChangeRef = useRef(onUserPointChange)
  const onUserAddressChangeRef = useRef(onUserAddressChange)
  const onFatalFailureRef = useRef(onFatalFailure)
  const onPinClickRef = useRef(onPinClick)
  /** Last name shown in the user pin's tooltip — re-uses it so a freshly
      dragged pin never re-opens the tooltip with the stale address while the
      reverse geocode for the new position is still in flight. */
  const lastUserPopupTextRef = useRef<string | null>(null)
  /** The directions route currently drawn on the map (null = no route). */
  const routeRef = useRef<GeoapifyRoute | null>(null)
  /** Marker for the route ORIGIN (the traveller's starting point). */
  const routeOriginRef = useRef<maplibregl.Marker | null>(null)
  /** Last route the camera was fitted to, so the fit fires only once per route. */
  const lastRouteFitKeyRef = useRef('')
  useEffect(() => {
    onUserPointChangeRef.current = onUserPointChange
    onUserAddressChangeRef.current = onUserAddressChange
    onFatalFailureRef.current = onFatalFailure
    onPinClickRef.current = onPinClick
    selectedPinRef.current = selectedPin ?? null
    selectedPinLabelRef.current = selectedPinLabel ?? null
    suppressDraggablePinRef.current = suppressDraggablePin
    focusPointRef.current = focusPoint ?? null
    routeRef.current = route ?? null
  }, [onUserPointChange, onUserAddressChange, onFatalFailure, onPinClick, selectedPin, selectedPinLabel, suppressDraggablePin, focusPoint, route])

  const failMap = (): void => {
    setMapFailed(true)
    paintedRef.current = false
    onFatalFailureRef.current?.()
  }

  // Supplier's pickup/meeting points (green pins) + the traveller's pin.
  const tourPoints = useMemo(() => buildTourPoints(tour as PickupMapSource), [tour])

  // Drawn geoshapes + exclusion zones from the supplier's Step-13 config.
  // Location-only areas (a saved point, no drawn polygon) render as a
  // LOCATION_AREA_RADIUS_M circle — only when it's the tour's single pickup
  // spot (no other areas and no pickup locations), so the map matches the
  // "Pickup zone" legend without blobbing multi-location tours.
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

  // The traveller's typed/dragged pickup location (blue pin).
  const userPoint = useMemo(() => {
    const lat = toNumber(userMarker?.lat)
    const lng = toNumber(userMarker?.lng)
    return lat != null && lng != null ? { lat, lng } : null
  }, [userMarker?.lat, userMarker?.lng])

  const points: MapPoint[] = useMemo(
    () => [...tourPoints, ...(userPoint ? [{ lat: userPoint.lat, lng: userPoint.lng, kind: 'user' as const }] : [])],
    [tourPoints, userPoint],
  )
  const userPointKey = userPoint ? `${userPoint.lat.toFixed(6)},${userPoint.lng.toFixed(6)}` : ''

  // Re-center control — re-fits the camera to every zone/point, mirroring the
  // Google map's Re-center button.
  const handleRecenter = useCallback((): void => {
    const map = mapRef.current
    if (!map) return
    const camera = cameraFromGeoData({ zones, rings: exclusions, points: tourPoints, userPoint })
    if (camera.bounds) {
      map.fitBounds(camera.bounds, { padding: camera.padding, maxZoom: camera.maxZoom, duration: 0 })
    } else if (camera.center != null && camera.zoom != null) {
      map.jumpTo({ center: camera.center, zoom: camera.zoom })
    }
  }, [zones, exclusions, tourPoints, userPoint])

  const hasMapData =
    zones.length > 0 || exclusions.length > 0 || tourPoints.length > 0 || userPoint != null

  // Textual fallback when the supplier only entered names/addresses (no
  // coordinates): still render a map by asking Google to locate the address.
  const fallbackQuery = useMemo(() => {
    // Infer effective mode when meetingMode is undefined.
    const hasMeeting = !!(tour.meetingPoint || tour.meetingPointAddress)
    const hasPickup = (tour.pickupAreas?.length ?? 0) > 0 || (tour.pickupLocations?.length ?? 0) > 0
    const mode = tour.meetingMode ?? (hasMeeting ? 'meeting_point' : hasPickup ? 'pickup' : undefined)

    if (mode === 'meeting_point') {
      return tour.meetingPointAddress || tour.meetingPoint || ''
    }
    if (mode === 'pickup') {
      const area = (tour.pickupAreas || []).find((a) => a && (a.address || a.name))
      if (area) return area.address || area.name || ''
      const loc = (tour.pickupLocations || []).find((l) => l && (l.address || l.name))
      if (loc) return loc.address || loc.name || ''
      return tour.pickupDescription || ''
    }
    return ''
  }, [tour.meetingMode, tour.meetingPointAddress, tour.meetingPoint, tour.pickupAreas, tour.pickupLocations, tour.pickupDescription])

  // Build the map once: warmed OpenFreeMap style, zone/exclusion overlays,
  // tour pins and an initial camera that fits the whole service area.
  useEffect(() => {
    if (mapFailed || mapDisabled || !hasMapData || !containerRef.current) return
    if (mapRef.current) return
    warmMapResources()
    const container = containerRef.current
    const map = createMapLibreMap(container, {
      style: TILE_STYLE,
      center: DEFAULT_CENTER,
      zoom: 6,
      localIdeographFontFamily: 'sans-serif',
    })
    if (!map) {
      // No WebGL / unsupported device â†’ degrade to the textual fallback.
      window.setTimeout(failMap, 0)
      return
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    // MapLibre only auto-resizes on *window* resize — the container can grow or
    // shrink after creation (e.g. the modal's flex layout settling, the
    // "Nearby landmarks" section appearing below the map). Watch the container
    // and resize the map to match so the canvas always fills the frame.
    const ro = new ResizeObserver(() => {
      const m = mapRef.current
      if (m && m !== map) return
      if (m) m.resize()
    })
    ro.observe(container)
    resizeObserverRef.current = ro

    // A worker/style failure can be silent (e.g. the worker asset 404s without
    // ever raising a map 'error'), leaving a permanent spinner. If the style
    // hasn't loaded within the grace period, degrade to the fallback stack.
    loadWatchdogRef.current = window.setTimeout(failMap, 12000)

    // Click-to-pick (mirrors the supplier's LocationMapPicker): sets the
    // traveller's pickup coordinates, drops the pin and zooms to street level.
    // Skipped on multi-point tours (suppressDraggablePin) — the traveller
    // must pick one of the supplier's fixed points instead.
    const onClick = (e: maplibregl.MapMouseEvent): void => {
      if (suppressDraggablePinRef.current) return
      // A mouseup right after dropping the draggable pin fires a ghost click —
      // skip it so the camera doesn't fly off right after the drop.
      if (dragJustEndedRef.current) {
        dragJustEndedRef.current = false
        return
      }
      const { lat, lng } = e.lngLat
      onUserPointChangeRef.current?.(lat, lng)
      map.flyTo({ center: [lng, lat], zoom: 15, duration: 900 })
      // Fire-and-forget: fill the pickup address with the closest place name.
      void reverseGeocode(lat, lng).then((r) => {
        if (r?.formatted) onUserAddressChangeRef.current?.(r.formatted)
      })
    }
    map.on('click', onClick)

    map.on('load', () => {
      // Ignore late events from a stale (unmounted) instance — StrictMode
      // remounts effects, and a replaced map's 'load' must not mark the live
      // map ready before its own style is loaded.
      if (!mapRef.current || mapRef.current !== map) return
      // Style loaded — a success beats any pre-load error, so disarm the
      // failover timer and the load watchdog before drawing overlays.
      if (loadWatchdogRef.current != null) {
        window.clearTimeout(loadWatchdogRef.current)
        loadWatchdogRef.current = null
      }
      if (mapFailTimerRef.current != null) {
        window.clearTimeout(mapFailTimerRef.current)
        mapFailTimerRef.current = null
      }

      if (zones.length > 0) {
        map.addSource('pz-zones', { type: 'geojson', data: ringsToFeatureCollection(zones) })
        map.addLayer({ id: 'pz-zones-fill', type: 'fill', source: 'pz-zones', paint: { 'fill-color': 'rgba(23,146,55,.14)' } })
        map.addLayer({ id: 'pz-zones-line', type: 'line', source: 'pz-zones', paint: { 'line-color': '#179237', 'line-width': 2 } })
      }
      if (exclusions.length > 0) {
        map.addSource('pz-excl', { type: 'geojson', data: ringsToFeatureCollection(exclusions) })
        map.addLayer({ id: 'pz-excl-fill', type: 'fill', source: 'pz-excl', paint: { 'fill-color': 'rgba(220,38,38,.14)' } })
        map.addLayer({
          id: 'pz-excl-line',
          type: 'line',
          source: 'pz-excl',
          paint: { 'line-color': '#dc2626', 'line-width': 2, 'line-dasharray': [2, 1] },
        })
      }

      // Supplier pins — the overlay that was missing and left location-only
      // tours as "bare land". Pulsating glow marks pickup/meeting points.
      tourPinElsRef.current = []
      for (const p of tourPoints) {
        const marker = new maplibregl.Marker({ element: pulsingPinElement(TOUR_PIN_COLOR), anchor: 'bottom' })
        marker.setLngLat([p.lng, p.lat])
        if (p.label) {
          tourPinElsRef.current.push({ label: p.label, lat: p.lat, lng: p.lng, el: marker.getElement(), marker })
          // Stop the click from bubbling to the map's click-to-pick handler —
          // otherwise the reverse-geocoded address overwrites the selected pin
          // name in the location search bar.
          marker.getElement().addEventListener('click', (e: MouseEvent) => {
            e.stopPropagation()
            onPinClickRef.current?.(p.label || '')
          })
          marker.setPopup(new maplibregl.Popup({ offset: 18 }).setText(p.label))
        }
        tourPinsRef.current.push(marker.addTo(map))
      }

      const camera = cameraFromGeoData({ zones, rings: exclusions, points: tourPoints, userPoint })
      if (camera.bounds) {
        map.fitBounds(camera.bounds, { padding: camera.padding, maxZoom: camera.maxZoom, duration: 0 })
      } else if (camera.center != null && camera.zoom != null) {
        map.jumpTo({ center: camera.center, zoom: camera.zoom })
      }      mapReadyRef.current = true
      setMapReady(true)

      // Tiles-painted watchdog: 'load' can fire with only the style's
      // background rendered (e.g. tile requests failing silently on a blocked
      // CDN) — if the map never paints within the grace period, degrade to
      // the fallback stack instead of leaving a blank box.
      let paintedChecks = 0
      paintedWatchdogRef.current = window.setInterval(() => {
        if (!mapRef.current || mapRef.current !== map) {
          if (paintedWatchdogRef.current != null) {
            window.clearInterval(paintedWatchdogRef.current)
            paintedWatchdogRef.current = null
          }
          return
        }
        if (map.loaded()) {
          paintedRef.current = true
          if (paintedWatchdogRef.current != null) {
            window.clearInterval(paintedWatchdogRef.current)
            paintedWatchdogRef.current = null
          }
          return
        }
        paintedChecks += 1
        if (paintedChecks >= 10) {
          if (paintedWatchdogRef.current != null) {
            window.clearInterval(paintedWatchdogRef.current)
            paintedWatchdogRef.current = null
          }
          failMap()
        }
      }, 1000)
    })

    // A dead WebGL context paints nothing and fires no map 'error' — fail
    // over immediately so the fallback stack takes over.
    map.on('webglcontextlost', () => {
      if (!mapRef.current || mapRef.current !== map) return
      failMap()
    })

    // A failing style/tile CDN must not leave a permanent blank box in the
    // checkout — degrade to the fallback after a grace period. Errors on a
    // map that HAS painted are transient (single raster tile 404s self-heal);
    // errors before the first paint mean the basemap is dead.
    map.on('error', () => {
      if (!mapRef.current || mapRef.current !== map) return
      if (paintedRef.current) return
      if (mapFailTimerRef.current == null) {
        mapFailTimerRef.current = window.setTimeout(failMap, 5000)
      }
    })

    mapRef.current = map
    return () => {
      if (loadWatchdogRef.current != null) {
        window.clearTimeout(loadWatchdogRef.current)
        loadWatchdogRef.current = null
      }
      if (mapFailTimerRef.current != null) {
        window.clearTimeout(mapFailTimerRef.current)
        mapFailTimerRef.current = null
      }
      if (paintedWatchdogRef.current != null) {
        window.clearInterval(paintedWatchdogRef.current)
        paintedWatchdogRef.current = null
      }
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      tourPinsRef.current.forEach((m) => m.remove())
      tourPinsRef.current = []
      tourPinElsRef.current = []
      extraPinsRef.current.forEach((m) => m.remove())
      extraPinsRef.current = []
      if (userPinRef.current) {
        userPinRef.current.remove()
        userPinRef.current = null
      }
      if (routeOriginRef.current) {
        routeOriginRef.current.remove()
        routeOriginRef.current = null
      }
      map.off('click', onClick)
      map.remove()
      mapRef.current = null
      mapReadyRef.current = false
      paintedRef.current = false
      setMapReady(false)
    }
    // Overlays are live-updated by the effect below; the map itself is built
    // once per (fallback, data-availability) state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapFailed, mapDisabled, hasMapData])

  // Live-update overlays as the traveller picks/drags a location. The user
  // marker's LABEL is a dependency too: after a drag, the reverse geocode
  // resolves asynchronously and only the label changes (same coordinates) —
  // without it the effect wouldn't re-run and the pin tooltip would keep
  // showing the pre-drag address while the booking form shows the new one.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !hasMapData) return
    const setSource = (id: string, rings: [number, number][][]): void => {
      try {
        const source = map.getSource(id)
        if (source && 'setData' in source) {
          (source as maplibregl.GeoJSONSource).setData(ringsToFeatureCollection(rings))
        }
      } catch {
        // Source not present yet — the build effect adds it on 'load'.
      }
    }
    if (zones.length > 0) setSource('pz-zones', zones)
    if (exclusions.length > 0) setSource('pz-excl', exclusions)

    // Restyle the tour pins in place for the selected pickup point: the
    // matching pin swaps to the bright green check-mark artwork (with its
    // glow tinted to match); every other pin stays the plain green. The
    // marker elements keep their position — only the inner SVG is replaced.
    const selected = selectedPinRef.current
    for (const { label, lat, lng, el, marker } of tourPinElsRef.current) {
      const isSelected = pinMatchesSelection({ lat, lng, label }, selected)
        || (!!selectedPinLabelRef.current && label === selectedPinLabelRef.current)
      el.querySelector<HTMLElement>('.pin-glow')?.style.setProperty(
        '--pin-color',
        isSelected ? SELECTED_PIN_COLOR : TOUR_PIN_COLOR,
      )
      const body = el.querySelector<HTMLElement>('.map-pin-body')
      if (body) body.innerHTML = isSelected ? selectedPinSvg() : pinSvg(TOUR_PIN_COLOR)
      // The green-tick pin labels itself: open the tooltip on the selected
      // location (so the zoomed-to spot shows its name) and keep every other
      // pin's tooltip closed.
      const popup = marker.getPopup()
      if (popup) {
        if (isSelected) {
          if (!popup.isOpen()) {
            // The popup is positioned from the MARKER (setLngLat ran before
            // setPopup), so copy the marker's coordinates onto the popup
            // before opening it — otherwise it renders at a null position.
            popup.setLngLat(marker.getLngLat())
            popup.addTo(map)
          }
        } else {
          popup.remove()
        }
      }
    }

    // Refresh the extra (landmark) pins — non-interactive amber dots.
    extraPinsRef.current.forEach((m) => m.remove())
    extraPinsRef.current = []
    for (const p of extraPoints || []) {
      const el = document.createElement('div')
      el.style.cssText = 'filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.25)); cursor: default;'
      el.innerHTML = `<svg width="20" height="26" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg"><path d="M13 0C5.8 0 0 5.8 0 13c0 9.75 13 21 13 21s13-11.25 13-21C26 5.8 20.2 0 13 0z" fill="#d97706"/><circle cx="13" cy="13" r="5" fill="#fff"/></svg>`
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      marker.setLngLat([p.lng, p.lat])
      if (p.label) {
        marker.setPopup(new maplibregl.Popup({ offset: 18 }).setText(p.label))
      }
      extraPinsRef.current.push(marker.addTo(map))
    }

    // Refresh the traveller's pin (draggable — repositioning updates the
    // live zone verdict, mirroring the GetYourGuide pickup map). The existing
    // marker is moved in place with setLngLat — never recreated — so a drop
    // never skids the pin to a stale position. When the out-of-range verdict
    // changes, the marker element must be recreated to swap the green pin for
    // the red × ("not included") pin and back. Multi-point tours
    // (suppressDraggablePin) have no draggable pin — the traveller picks one
    // of the supplier's fixed points.
    const suppressDraggable = !!suppressDraggablePinRef.current
    const pinVariant: 'default' | 'error' = userOutOfRange ? 'error' : 'default'
    // The pin's tooltip mirrors the chosen location name. `force` re-opens it
    // even when the text didn't change (a recreated pin after a verdict swap);
    // otherwise the last shown text is re-used so a pin dropped at a new spot
    // never flashes the stale address while its reverse geocode is in flight.
    const applyUserPinTooltip = (marker: maplibregl.Marker, force = false): void => {
      const label = userMarker?.label?.trim() || ''
      if (!label) return
      if (!force && label === lastUserPopupTextRef.current) return
      lastUserPopupTextRef.current = label
      const popup = marker.getPopup()
      if (popup) {
        popup.setText(label)
        if (!popup.isOpen()) popup.addTo(map)
      }
    }
    if (userPinRef.current) {
      if (userPoint && !suppressDraggable) {
        if (userPinVariantRef.current !== pinVariant) {
          userPinRef.current.remove()
          userPinRef.current = null
          userPinVariantRef.current = pinVariant
        } else {
          userPinRef.current.setLngLat([userPoint.lng, userPoint.lat])
          applyUserPinTooltip(userPinRef.current)
        }
      } else {
        userPinRef.current.remove()
        userPinRef.current = null
      }
    }
    if (!userPinRef.current && userPoint && !suppressDraggable) {
      // Draggable pin with the same pulsating glow as the tour pins, plus a
      // tooltip that shows the chosen location name.
      const marker = new maplibregl.Marker({ element: pulsingPinElement(DRAGGABLE_PIN_COLOR, 'grab', pinVariant), anchor: 'bottom', draggable: true })
      // Hide the tooltip while dragging — it would float at the pre-drag
      // position and snap to the new spot on drop.
      marker.on('dragstart', () => {
        marker.getPopup()?.remove()
      })
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLngLat()
        onUserPointChangeRef.current?.(lat, lng)
        dragJustEndedRef.current = true
        // Reverse geocode the new position so the search bar updates — the
        // returned address flows back in as userMarker.label and reopens the
        // tooltip with the fresh name.
        void reverseGeocode(lat, lng).then((r) => {
          if (r?.formatted) onUserAddressChangeRef.current?.(r.formatted)
        })
      })
      const popup = new maplibregl.Popup({ offset: 28, closeButton: false, closeOnClick: false })
      marker.setPopup(popup)
      userPinVariantRef.current = pinVariant
      userPinRef.current = marker.setLngLat([userPoint.lng, userPoint.lat]).addTo(map)
      applyUserPinTooltip(marker, true)
    }

    // Directions route overlay — draws the traveller's route polyline (when a
    // route is set) with a blue origin marker; cleared when the route is null.
    const overlay = routeRef.current
    if (routeOriginRef.current) {
      routeOriginRef.current.remove()
      routeOriginRef.current = null
    }
    if (overlay && overlay.geometry.length >= 2) {
      try {
        if (!map.getSource('pz-route')) {
          map.addSource('pz-route', { type: 'geojson', data: routeToFeatureCollection(overlay) })
          map.addLayer({ id: 'pz-route-casing', type: 'line', source: 'pz-route', paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 } })
          map.addLayer({ id: 'pz-route-line', type: 'line', source: 'pz-route', paint: { 'line-color': '#2563eb', 'line-width': 4, 'line-opacity': 0.95 } })
        } else {
          ;(map.getSource('pz-route') as maplibregl.GeoJSONSource).setData(routeToFeatureCollection(overlay))
        }
        const first = overlay.geometry[0]
        routeOriginRef.current = new maplibregl.Marker({ element: routeOriginMarkerElement(), anchor: 'center' })
          .setLngLat([first[0], first[1]])
          .addTo(map)
      } catch {
        // Style/source not ready — retried on the next data change.
      }
    } else {
      try {
        if (map.getLayer('pz-route-casing')) map.removeLayer('pz-route-casing')
        if (map.getLayer('pz-route-line')) map.removeLayer('pz-route-line')
        if (map.getSource('pz-route')) map.removeSource('pz-route')
      } catch {
        // Source/layer absent — nothing to clear.
      }
    }
  }, [zones, exclusions, userPoint, mapReady, hasMapData, extraPoints, userOutOfRange, selectedPin, selectedPinLabel, suppressDraggablePin, route, userMarker?.label])

  // Out-of-range location: move the camera to the point immediately so the
  // red × pin is front and centre — no need to hit Re-center first.
  useEffect(() => {
    const m = mapRef.current
    if (!m || !mapReady || !userOutOfRange || !userPoint) return
    const key = `${userPoint.lat.toFixed(6)},${userPoint.lng.toFixed(6)}`
    if (lastOutOfRangeKeyRef.current === key) return
    lastOutOfRangeKeyRef.current = key
    m.flyTo({ center: [userPoint.lng, userPoint.lat], zoom: 13, duration: 800 })
  }, [mapReady, userOutOfRange, userPoint])

  // Fly to a location picked from the modal's side list (zoom in on it).
  useEffect(() => {
    const m = mapRef.current
    const fp = focusPointRef.current
    if (!m || !mapReady || !fp) return
    const key = `${fp.lat.toFixed(6)},${fp.lng.toFixed(6)}`
    if (lastFocusKeyRef.current === key) return
    lastFocusKeyRef.current = key
    m.flyTo({ center: [fp.lng, fp.lat], zoom: 15, duration: 700 })
  }, [mapReady, focusPoint, selectedPin])

  // Fit the camera to the whole directions route (origin → destination) when
  // it first appears, so the traveller sees the full journey rather than only
  // the destination the side-list focus zoomed to.
  useEffect(() => {
    const m = mapRef.current
    const overlay = routeRef.current
    if (!m || !mapReady || !overlay || overlay.geometry.length < 2) return
    const first = overlay.geometry[0]
    const last = overlay.geometry[overlay.geometry.length - 1]
    const key = `${first[0].toFixed(6)},${first[1].toFixed(6)}:${last[0].toFixed(6)},${last[1].toFixed(6)}`
    if (lastRouteFitKeyRef.current === key) return
    lastRouteFitKeyRef.current = key
    const camera = cameraFromGeoData({
      zones: [],
      rings: [],
      points: [
        { lat: first[1], lng: first[0], kind: 'user' },
        { lat: last[1], lng: last[0], kind: 'tour' },
      ],
    })
    if (camera.bounds) {
      m.fitBounds(camera.bounds, { padding: camera.padding, maxZoom: camera.maxZoom, duration: 0 })
    } else if (camera.center != null && camera.zoom != null) {
      m.jumpTo({ center: camera.center, zoom: camera.zoom })
    }
  }, [mapReady, route, selectedPin])

  // Legacy name/address-only config: OSM embed, located by the address text.
  const mapView = useMemo(() => {
    if (hasMapData || points.length === 0 || containerWidth <= 0) return null
    const H = 200
    const W = containerWidth
    const lats = points.map((m) => m.lat)
    const lngs = points.map((m) => m.lng)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const cLat = (minLat + maxLat) / 2
    const cLng = (minLng + maxLng) / 2
    // Degrees-per-pixel must be equal in both axes so the bbox matches the
    // container aspect; use the larger of the two so every marker fits.
    const wDeg = Math.max(maxLng - minLng, 0.001) + 0.01
    const hDeg = Math.max(maxLat - minLat, 0.001) + 0.01
    const dpp = Math.max(wDeg / W, hDeg / H)
    const bbW = dpp * W
    const bbH = dpp * H
    const bbMinLng = cLng - bbW / 2
    const bbMaxLng = cLng + bbW / 2
    const bbMinLat = cLat - bbH / 2
    const bbMaxLat = cLat + bbH / 2
    const bbox = `${bbMinLng}%2C${bbMinLat}%2C${bbMaxLng}%2C${bbMaxLat}`
    const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`
    const pins = points.map((m) => {
      const isUser = userPointKey === `${m.lat.toFixed(6)},${m.lng.toFixed(6)}`
      return { lat: m.lat, lng: m.lng, x: ((m.lng - bbMinLng) / bbW) * 100, y: (1 - (m.lat - bbMinLat) / bbH) * 100, isUser }
    })
    return { embedUrl, pins }
  }, [hasMapData, points, containerWidth, userPointKey])

  const mapPoint = userPoint ?? tourPoints[0] ?? null
  const mapsLink = mapPoint
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${mapPoint.lat},${mapPoint.lng}`)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackQuery || tour.meetingPointAddress || tour.meetingPoint || '')}`

  useEffect(() => {
    if (hasMapData) return
    const el = embedRef.current
    if (!el) return
    const update = (): void => setContainerWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasMapData])

  if (!hasMapData && !fallbackQuery) return null

  return (
    <div className="h-full px-0 py-3">
      <div className={`relative ${mapHeight} w-full touch-none overflow-hidden rounded-xl border border-slate-200/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)]`}>
        {hasMapData && !mapFailed && !mapDisabled ? (
          <>
            {/* maplibre-gl's CSS forces `.maplibregl-map { position: relative }`,
                which defeats Tailwind's `absolute inset-0` — size the container
                in flow so it fills the fixed-height frame instead of collapsing
                and cutting the map. */}
            <div ref={containerRef} className="z-0 h-full w-full" />
            {mapReady && (
              <button
                type="button"
                title="Re-center map on pickup zones"
                onClick={handleRecenter}
                className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#047857] shadow-sm transition-colors hover:bg-slate-50"
              >
                Re-center
              </button>
            )}
            {mapReady && (zones.length > 0 || exclusions.length > 0 || tourPoints.length > 1 || userPoint || userChosen || !!selectedPinLabel) && (
              <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex flex-col gap-1.5 rounded-lg bg-white/90 px-2.5 py-2 text-[10px] font-medium text-slate-700 shadow-sm backdrop-blur-sm">
                {tourPoints.length > 1 && (
                  <span className="flex items-center gap-1.5">
                    <svg
                      viewBox="0 0 32 40"
                      width="13"
                      height="16"
                      className="shrink-0"
                      aria-hidden="true"
                    >
                      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill={TOUR_PIN_COLOR} />
                      <circle cx="16" cy="16" r="6" fill="white" stroke={TOUR_PIN_COLOR} strokeWidth="2" />
                    </svg>
                    Pickup points
                  </span>
                )}
                {selectedPinLabel && (
                  <span className="flex items-center gap-1.5">
                    <svg
                      viewBox="0 0 32 40"
                      width="13"
                      height="16"
                      className="shrink-0"
                      aria-hidden="true"
                    >
                      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill={SELECTED_PIN_COLOR} />
                      <circle cx="16" cy="16" r="9" fill="white" />
                      <path d="M11 16.5l3.2 3.2L21 13" stroke={SELECTED_PIN_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                    Selected pickup point
                  </span>
                )}
                {zones.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ background: '#179237' }} /> Pickup zone
                  </span>
                )}
                {exclusions.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ background: '#dc2626' }} /> No pickup
                  </span>
                )}
                {(userPoint || userChosen) && (
                  <span className="flex items-center gap-1.5">
                    <svg
                      viewBox="0 0 32 40"
                      width="13"
                      height="16"
                      className="shrink-0"
                      aria-hidden="true"
                    >
                      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill={userOutOfRange ? '#dc2626' : DRAGGABLE_PIN_COLOR} />
                      <circle cx="16" cy="16" r="6" fill="white" stroke={userOutOfRange ? '#dc2626' : DRAGGABLE_PIN_COLOR} strokeWidth="2" />
                    </svg>
                    Your pickup location
                  </span>
                )}
              </div>
            )}
          </>
        ) : mapView && !osmFailed ? (
          <>
            <iframe
              title="Location map"
              src={mapView.embedUrl}
              className="absolute inset-0 h-full w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              onError={() => setOsmFailed(true)}
            />
            {mapView.pins.map((p, i) => (
              <span
                key={i}
                className="absolute z-10"
                style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -100%)' }}
              >
                {!p.isUser && selectedPin && pinMatchesSelection({ lat: p.lat, lng: p.lng }, selectedPin) ? (
                  <span className="block" dangerouslySetInnerHTML={{ __html: selectedPinSvg() }} />
                ) : (
                  <MapPin className="size-6" color={p.isUser ? USER_PIN_COLOR : TOUR_PIN_COLOR} fill="currentColor" />
                )}
              </span>
            ))}
          </>
        ) : (
          <div ref={embedRef} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50 px-4 text-center">
            <MapPin className="size-5 shrink-0 text-slate-300" />
            <p className="text-xs leading-relaxed text-slate-500">
              {tour.meetingPointAddress || tour.meetingPoint || fallbackQuery || 'Meeting location will be confirmed after booking.'}
            </p>
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
            >
              Open in Google Maps
            </a>
            {mapFailed && !mapDisabled && (
              <button
                type="button"
                onClick={() => {
                  setMapFailed(false)
                  setMapReady(false)
                }}
                className="mt-1 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
              >
                <RefreshCw size={12} />
                Retry map
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}