import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as mapboxgl from 'mapbox-gl/esm'
import { RefreshCw } from 'lucide-react'
import 'mapbox-gl/dist/mapbox-gl.css'
import { reverseGeocode } from '@/lib/locations'
import {
  DEFAULT_CENTER,
  DRAGGABLE_PIN_COLOR,
  SELECTED_PIN_COLOR,
  buildTourPoints,
  pinMatchesSelection,
  pulsingPinElement,
  ringsToFeatureCollection,
  routeOriginMarkerElement,
  routeToFeatureCollection,
  selectedPinElement,
  toNumber,
  type MapPoint,
  type PickupMapSource,
  type SelectedPoint,
} from '@/lib/mapUtils'
import type { GeoapifyRoute } from '@/lib/geoapifyRouting'
import { getMapboxToken, MAPBOX_STYLE } from '@/lib/mapbox'
import { pickupZoneRings } from '@/lib/pickupZone'
import type { PickupZoneMapTour } from './PickupZoneMap'

/** Pickup-area pin (green) — matches the app's brand accent. */
const PICKUP_PIN_COLOR = '#179237'
/** Extra (landmark) pins. */
const EXTRA_PIN_COLOR = '#d97706'

interface MapboxPickupMapProps {
  tour: PickupZoneMapTour
  userMarker?: { lat: number | null; lng: number | null; label?: string | null } | null
  onUserPointChange?: (lat: number, lng: number) => void
  /** Reverse-geocoded formatted address for a point picked on the map. */
  onUserAddressChange?: (address: string) => void
  /** Extra non-interactive pins (e.g. nearby landmarks) layered on the map. */
  extraPoints?: MapPoint[]
  /** Fired when the pin's label is tapped. */
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
  /** Fired when the map fatally fails (token/style/CDN down) — the layered
      LocationMap then falls back to MapLibre/Google/text. */
  onFatalFailure?: () => void
  /** Height classes for the map container (defaults to the standard booking height). */
  mapHeight?: string
  /** A directions route to draw on the map (origin → destination polyline,
      with a blue origin marker). Cleared when null. */
  route?: GeoapifyRoute | null
}

/**
 * The booking page's pickup map on Mapbox GL JS (2D only). Renders the
 * supplier's drawn pickup zones (green), exclusion zones (red dashed), the
 * pickup points (green pins), the meeting point (indigo pin) and the
 * traveller's draggable blue pin.
 *
 * This is the PRIMARY renderer of the layered LocationMap; any fatal failure
 * (bad token, billing, style CDN) degrades to the MapLibre + OSM stack.
 */
export default function MapboxPickupMap({
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
  onPinClick,
  onFatalFailure,
  mapHeight = 'h-[320px] sm:h-[340px]',
  route,
}: MapboxPickupMapProps) {
  const [mapReady, setMapReady] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const tourPinsRef = useRef<mapboxgl.Marker[]>([])
  const extraPinsRef = useRef<mapboxgl.Marker[]>([])
  const userPinRef = useRef<mapboxgl.Marker | null>(null)
  /** Variant the existing user pin was built with, so a changed verdict swaps
      the green pin for the red × ("not included") pin (and vice versa). */
  const userPinVariantRef = useRef<'default' | 'error'>('default')
  /** Last out-of-range point the camera was moved to, so the jump fires only
      once per point (not on every unrelated render). */
  const lastOutOfRangeKeyRef = useRef('')
  const mapReadyRef = useRef(false)
  const paintedRef = useRef(false)
  const mapFailTimerRef = useRef<number | null>(null)
  const loadWatchdogRef = useRef<number | null>(null)
  const paintedWatchdogRef = useRef<number | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const hasFittedRef = useRef(false)
  /** True right after the draggable pin is dropped — the map fires a click
      after a marker drag; that ghost click must not re-trigger click-to-pick
      (which would fly the camera off to zoom 15 / re-open the prompt). */
  const dragJustEndedRef = useRef(false)
  const onUserPointChangeRef = useRef(onUserPointChange)
  const onUserAddressChangeRef = useRef(onUserAddressChange)
  const onPinClickRef = useRef(onPinClick)
  const onFatalFailureRef = useRef(onFatalFailure)
  const selectedPinRef = useRef<SelectedPoint | null>(null)
  const selectedPinLabelRef = useRef<string | null>(null)
  const suppressDraggablePinRef = useRef<boolean | undefined>(undefined)
  const focusPointRef = useRef<{ lat: number; lng: number } | null>(null)
  const lastFocusKeyRef = useRef('')
  /** The traveller's chosen location name (drives the user pin's tooltip). */
  const userMarkerLabelRef = useRef<string | null>(null)
  /** Last name shown in the user pin's tooltip — re-uses it so a freshly
      dragged pin never re-opens the tooltip with the stale address while the
      reverse geocode for the new position is still in flight. */
  const lastUserPopupTextRef = useRef<string | null>(null)
  /** The directions route currently drawn on the map (null = no route). */
  const routeRef = useRef<GeoapifyRoute | null>(null)
  /** Marker for the route ORIGIN (the traveller's starting point). */
  const routeOriginRef = useRef<mapboxgl.Marker | null>(null)
  /** Last route the camera was fitted to, so the fit fires only once per route. */
  const lastRouteFitKeyRef = useRef('')
  useEffect(() => {
    onUserPointChangeRef.current = onUserPointChange
    onUserAddressChangeRef.current = onUserAddressChange
    onPinClickRef.current = onPinClick
    onFatalFailureRef.current = onFatalFailure
    selectedPinRef.current = selectedPin ?? null
    selectedPinLabelRef.current = selectedPinLabel ?? null
    suppressDraggablePinRef.current = suppressDraggablePin
    focusPointRef.current = focusPoint ?? null
    userMarkerLabelRef.current = userMarker?.label ?? null
    routeRef.current = route ?? null
  }, [onUserPointChange, onUserAddressChange, onPinClick, onFatalFailure, selectedPin, selectedPinLabel, suppressDraggablePin, focusPoint, userMarker, route])

  const failMap = (): void => {
    setMapReady(false)
    mapReadyRef.current = false
    paintedRef.current = false
    onFatalFailureRef.current?.()
  }

  // Pickup points and the meeting point are both green pins (the map renders
  // one pin per pickup/meeting spot — no separate violet/indigo marker).
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

  const cameraPoints = useMemo(() => {
    const coords: [number, number][] = []
    for (const ring of zones) for (const [lat, lng] of ring) coords.push([lng, lat])
    for (const ring of exclusions) for (const [lat, lng] of ring) coords.push([lng, lat])
    for (const p of tourPoints) coords.push([p.lng, p.lat])
    if (userPoint) coords.push([userPoint.lng, userPoint.lat])
    if (route && route.geometry.length >= 2) {
      const first = route.geometry[0]
      const last = route.geometry[route.geometry.length - 1]
      coords.push([first[0], first[1]], [last[0], last[1]])
    }
    return coords
  }, [zones, exclusions, tourPoints, userPoint, route])

  // Fits the camera to every zone/point — the initial fit AND the Re-center
  // button (mirroring the Google map's Re-center control) share this.
  const fitToCamera = useCallback(
    (map: mapboxgl.Map): void => {
      if (cameraPoints.length === 0) return
      if (cameraPoints.length === 1) {
        map.jumpTo({ center: cameraPoints[0], zoom: 13 })
      } else {
        const bounds = new mapboxgl.LngLatBounds()
        for (const [lng, lat] of cameraPoints) bounds.extend([lng, lat])
        map.fitBounds(bounds, { padding: 50, maxZoom: 15 })
      }
    },
    [cameraPoints],
  )

  const handleRecenter = useCallback((): void => {
    const map = mapRef.current
    if (map) fitToCamera(map)
  }, [fitToCamera])

  // Build the map once; overlays are live-updated by the effect below.
  useEffect(() => {
    if (mapRef.current) return
    const container = containerRef.current
    if (!container) return
    const token = getMapboxToken()
    if (!token) {
      window.setTimeout(failMap, 0)
      return
    }

    // Create the map one frame after mount. React StrictMode runs effects
    // twice (mount â†’ cleanup â†’ mount); creating the map synchronously would
    // tear it down and immediately recreate it, and mapbox-gl's shared worker
    // pool does not survive that create/remove/create cycle — the live map
    // silently never fetches tiles. Deferring creation to the next frame
    // collapses the double invocation into a single map build.
    let disposed = false
    let disposeMap: (() => void) | null = null
    const frame = window.requestAnimationFrame(() => {
      if (disposed || mapRef.current) return

      let created: mapboxgl.Map
      try {
        created = new mapboxgl.Map({
          container,
          style: MAPBOX_STYLE,
          center: [DEFAULT_CENTER[0], DEFAULT_CENTER[1]],
          zoom: 6,
          // Locked 2D: mercator projection, no tilting.
          projection: 'mercator',
          maxPitch: 0,
        })
      } catch {
        window.setTimeout(failMap, 0)
        return
      }
      mapRef.current = created

      // mapbox-gl only auto-resizes on *window* resize (no container
      // ResizeObserver) — the map would stay at its initial canvas size when
      // the container changes (e.g. the sm: responsive height or the step's
      // layout settling), leaving the basemap cut. Watch the container and
      // resize the map to match so it always fills the frame.
      const ro = new ResizeObserver(() => {
        const m = mapRef.current
        if (m && m !== created) return
        if (m) m.resize()
      })
      ro.observe(container)
      resizeObserverRef.current = ro

      // A failing style/token must not leave a permanent blank box — degrade
      // to the fallback stack after a grace period.
      loadWatchdogRef.current = window.setTimeout(failMap, 12000)

      created.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

      const onClick = (e: mapboxgl.MapMouseEvent): void => {
        if (suppressDraggablePinRef.current) return
        // A mouseup right after dropping the draggable pin fires a ghost click —
        // skip it so the camera doesn't fly off right after the drop.
        if (dragJustEndedRef.current) {
          dragJustEndedRef.current = false
          return
        }
        const { lng, lat } = e.lngLat
        onUserPointChangeRef.current?.(lat, lng)
        created.flyTo({ center: [lng, lat], zoom: 15, duration: 900 })
        // Fire-and-forget: fill the pickup address with the closest place name.
        void reverseGeocode(lat, lng).then((r) => {
          if (r?.formatted) onUserAddressChangeRef.current?.(r.formatted)
        })
      }
      created.on('click', onClick)

      created.on('load', () => {
        // Ignore late events from a stale (unmounted) instance — StrictMode
        // remounts effects, and a replaced map's 'load' must not mark the live
        // map ready before its own style is loaded.
        if (!mapRef.current || mapRef.current !== created) return
        if (loadWatchdogRef.current != null) {
          window.clearTimeout(loadWatchdogRef.current)
          loadWatchdogRef.current = null
        }
        if (mapFailTimerRef.current != null) {
          window.clearTimeout(mapFailTimerRef.current)
          mapFailTimerRef.current = null
        }

        if (zones.length > 0) {
          created.addSource('pz-zones', { type: 'geojson', data: ringsToFeatureCollection(zones) })
          created.addLayer({ id: 'pz-zones-fill', type: 'fill', source: 'pz-zones', paint: { 'fill-color': 'rgba(23,146,55,.14)' } })
          created.addLayer({ id: 'pz-zones-line', type: 'line', source: 'pz-zones', paint: { 'line-color': '#179237', 'line-width': 2 } })
        }
        if (exclusions.length > 0) {
          created.addSource('pz-excl', { type: 'geojson', data: ringsToFeatureCollection(exclusions) })
          created.addLayer({ id: 'pz-excl-fill', type: 'fill', source: 'pz-excl', paint: { 'fill-color': 'rgba(220,38,38,.14)' } })
          created.addLayer({
            id: 'pz-excl-line',
            type: 'line',
            source: 'pz-excl',
            paint: { 'line-color': '#dc2626', 'line-width': 2, 'line-dasharray': [2, 1] },
          })
        }

        // Pins/zones can arrive AFTER the style loads (the geocode pipeline
        // resolves the tour async) — the overlay effect below owns all overlays
        // and re-creates them whenever the tour data changes.
        created.jumpTo({ center: [DEFAULT_CENTER[0], DEFAULT_CENTER[1]], zoom: 6 })

        mapReadyRef.current = true
        setMapReady(true)

        // Tiles-painted watchdog: 'load' can fire with only the style's
        // background rendered (e.g. tile requests failing on a dead/quota'd
        // token) — if the map never paints within the grace period, degrade to
        // the fallback stack instead of leaving a blank box.
        let paintedChecks = 0
        paintedWatchdogRef.current = window.setInterval(() => {
          if (!mapRef.current || mapRef.current !== created) {
            if (paintedWatchdogRef.current != null) {
              window.clearInterval(paintedWatchdogRef.current)
              paintedWatchdogRef.current = null
            }
            return
          }
          if (created.loaded()) {
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
      created.on('webglcontextlost', () => {
        if (!mapRef.current || mapRef.current !== created) return
        failMap()
      })

      // A failing style/tile CDN must not leave a permanent blank box — degrade
      // after a grace period. Errors on a map that HAS painted are transient
      // (single raster tile 404s self-heal); errors before the first paint mean
      // the basemap is dead and the fallback stack should take over.
      created.on('error', () => {
        if (!mapRef.current || mapRef.current !== created) return
        if (paintedRef.current) return
        if (mapFailTimerRef.current == null) {
          mapFailTimerRef.current = window.setTimeout(failMap, 5000)
        }
      })

      disposeMap = () => {
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
        created.off('click', onClick)
        created.remove()
        mapRef.current = null
        mapReadyRef.current = false
        paintedRef.current = false
        // A fresh map mount must re-fit the camera to the pins (StrictMode
        // remounts effects without resetting refs, which would otherwise leave
        // the second map stuck on the default camera).
        hasFittedRef.current = false
        setMapReady(false)
      }
    })

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      disposeMap?.()
    }
    // The map is built once per mount; overlays update live via the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live-update overlays as the tour data or the traveller's location changes.
  // The geocode pipeline resolves the tour async, so zones/pins can arrive
  // after the map built — this effect owns ALL overlays and re-creates them
  // whenever the data changes (never re-mounts the map).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    // Zone/exclusion layers: create if the style loaded without them (late
    // data), otherwise push the new geometry into the existing sources.
    const ensureZoneLayer = (id: 'pz-zones' | 'pz-excl', rings: [number, number][][]): void => {
      try {
        if (!map.getLayer(id)) {
          map.addSource(id, { type: 'geojson', data: ringsToFeatureCollection(rings) })
          if (id === 'pz-zones') {
            map.addLayer({ id: 'pz-zones-fill', type: 'fill', source: id, paint: { 'fill-color': 'rgba(23,146,55,.14)' } })
            map.addLayer({ id: 'pz-zones-line', type: 'line', source: id, paint: { 'line-color': '#179237', 'line-width': 2 } })
          } else {
            map.addLayer({ id: 'pz-excl-fill', type: 'fill', source: id, paint: { 'fill-color': 'rgba(220,38,38,.14)' } })
            map.addLayer({ id: 'pz-excl-line', type: 'line', source: id, paint: { 'line-color': '#dc2626', 'line-width': 2, 'line-dasharray': [2, 1] } })
          }
        } else {
          const source = map.getSource(id)
          if (source && 'setData' in source) {
            (source as mapboxgl.GeoJSONSource).setData(ringsToFeatureCollection(rings))
          }
        }
      } catch {
        // Style not fully loaded yet — retried on the next data change.
      }
    }
    if (zones.length > 0) ensureZoneLayer('pz-zones', zones)
    if (exclusions.length > 0) ensureZoneLayer('pz-excl', exclusions)

    // Supplier pins — all pickup/meeting points in green with the pulsating
    // glow halo (no separate violet/indigo marker).
    tourPinsRef.current.forEach((m) => m.remove())
    tourPinsRef.current = []
    const addPin = (p: MapPoint, color: string): void => {
      const isSelected = pinMatchesSelection({ lat: p.lat, lng: p.lng, label: p.label }, selectedPinRef.current)
        || (!!selectedPinLabelRef.current && p.label != null && p.label === selectedPinLabelRef.current)
      const marker = new mapboxgl.Marker({
        element: isSelected ? selectedPinElement() : pulsingPinElement(color),
        anchor: 'bottom',
      })
      marker.setLngLat([p.lng, p.lat])
      if (p.label) {
        marker.setPopup(new mapboxgl.Popup({ offset: 25 }).setText(p.label))
        // Stop the click from bubbling to the map's click-to-pick handler —
        // otherwise the reverse-geocoded address overwrites the selected pin
        // name in the location search bar.
        marker.getElement().addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation()
          onPinClickRef.current?.(p.label || '')
        })
      }
      tourPinsRef.current.push(marker.addTo(map))
      // The green-tick pin labels itself — open the tooltip on the selected
      // location so the zoomed-to spot shows its name. The popup is positioned
      // from the MARKER (setLngLat ran before setPopup), so copy the marker's
      // coordinates onto the popup before opening it — otherwise it renders at
      // a null position.
      if (isSelected && p.label) {
        const popup = marker.getPopup()
        if (popup && !popup.isOpen()) {
          popup.setLngLat(marker.getLngLat())
          popup.addTo(map)
        }
      }
    }
    for (const p of tourPoints) addPin(p, PICKUP_PIN_COLOR)

    // Refresh the extra (landmark) pins — amber dots.
    extraPinsRef.current.forEach((m) => m.remove())
    extraPinsRef.current = []
    for (const p of extraPoints || []) {
      const marker = new mapboxgl.Marker({ color: EXTRA_PIN_COLOR, anchor: 'bottom' })
      marker.setLngLat([p.lng, p.lat])
      if (p.label) {
        marker.setPopup(new mapboxgl.Popup({ offset: 25 }).setText(p.label))
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
    const applyUserPinTooltip = (marker: mapboxgl.Marker, force = false): void => {
      const label = userMarkerLabelRef.current?.trim() || ''
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
      const marker = new mapboxgl.Marker({ element: pulsingPinElement(DRAGGABLE_PIN_COLOR, 'grab', pinVariant), anchor: 'bottom', draggable: true })
      // Hide the tooltip while dragging — it would float at the pre-drag
      // position and snap to the new spot on drop.
      marker.on('dragstart', () => {
        marker.getPopup()?.remove()
      })
      marker.on('dragend', () => {
        const { lng, lat } = marker.getLngLat()
        onUserPointChangeRef.current?.(lat, lng)
        dragJustEndedRef.current = true
        // Reverse geocode the new position so the search bar updates — the
        // returned address flows back in as userMarker.label and reopens the
        // tooltip with the fresh name.
        void reverseGeocode(lat, lng).then((r) => {
          if (r?.formatted) onUserAddressChangeRef.current?.(r.formatted)
        })
      })
      const popup = new mapboxgl.Popup({ offset: 28, closeButton: false, closeOnClick: false })
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
          ;(map.getSource('pz-route') as mapboxgl.GeoJSONSource).setData(routeToFeatureCollection(overlay))
        }
        const first = overlay.geometry[0]
        routeOriginRef.current = new mapboxgl.Marker({ element: routeOriginMarkerElement(), anchor: 'center' })
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

    // Fit the camera once real coordinates arrive (the build-time camera is
    // the Accra fallback); never refit on later user interactions.
    if (cameraPoints.length > 0 && !hasFittedRef.current) {
      hasFittedRef.current = true
      fitToCamera(map)
    }
  }, [zones, exclusions, userPoint, mapReady, extraPoints, tourPoints, cameraPoints, fitToCamera, userOutOfRange, selectedPin, selectedPinLabel, suppressDraggablePin, route])

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
    const bounds = new mapboxgl.LngLatBounds()
    bounds.extend([first[0], first[1]])
    bounds.extend([last[0], last[1]])
    m.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 })
  }, [mapReady, route, selectedPin])

  return (
    <div className="h-full px-0 py-3">
      <div className={`relative ${mapHeight} w-full touch-none overflow-hidden rounded-xl border border-slate-200/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)]`}>
        {/* The mapbox-gl CSS forces `.mapboxgl-map { position: relative }`, which
            defeats Tailwind's `absolute inset-0` — the container would collapse to
            a few pixels instead of filling the fixed-height frame and the canvas
            ends up a mismatched size, cutting the map. Size it in flow with
            h-full/w-full instead (the frame owns the height). */}
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
        {!mapReady && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50">
            <RefreshCw size={14} className="animate-spin text-slate-400" />
            <span className="ml-2 text-xs font-medium text-slate-400">Loading map…</span>
          </div>
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
                  <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill={PICKUP_PIN_COLOR} />
                  <circle cx="16" cy="16" r="6" fill="white" stroke={PICKUP_PIN_COLOR} strokeWidth="2" />
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
      </div>
    </div>
  )
}
