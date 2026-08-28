import { useMemo, useState } from 'react'
import { Check, MapPin, X, Loader2, AlertCircle, Info, ExternalLink } from 'lucide-react'
import type { PickupAreaShape } from '@/lib/pickupZone'
import { findPickupAreaForAddress, distanceMeters, hasLocationOnlyAreas, pickupZoneStatus, type PickupZoneStatus } from '@/lib/pickupZone'
import type { ResolveTourSource, ResolvedTourPoint } from '@/lib/resolvePoints'
import type { PickupZoneMapTour } from './PickupZoneMap'
import LocationPicker from './LocationPicker'
import LocationMap from './LocationMap'
import MapErrorBoundary from './MapErrorBoundary'
import OutOfRangeDistance from './OutOfRangeDistance'
import TravelTimeChip from './TravelTimeChip'
import { toNumber } from '@/lib/mapUtils'
import { appleMapsDirectionsUrl, googleMapsDirectionsUrl } from '@/lib/geoapifyRouting'

const compactTime = (t?: string): string => (t ? t.replace('-', '–') : '')

// Pickup reference windows mirror the supplier's Step 13 options — how long
// before the activity start pickup happens.
const PICKUP_REF_LABELS: Record<string, string> = {
  '0-15': 'Pickup 0–15 min before the activity starts',
  '0-30': 'Pickup 0–30 min before the activity starts',
  '0-45': 'Pickup 0–45 min before the activity starts',
  '0-60': 'Pickup up to 1 hour before the activity starts',
  '0-90': 'Pickup up to 1.5 hours before the activity starts',
  '0-120': 'Pickup up to 2 hours before the activity starts',
}
function referenceStartLabel(value?: string): string {
  if (!value) return ''
  return PICKUP_REF_LABELS[value] || `Pickup ${value} before the activity starts`
}

export interface PickupLocationSectionTour {
  id?: string
  slug?: string
  meetingMode?: 'meeting_point' | 'pickup' | 'none'
  meetingPoint?: string
  meetingPointAddress?: string
  meetingPointLat?: number | null
  meetingPointLng?: number | null
  meetingPointPicture?: string
  pickupType?: 'area' | 'address'
  pickupTiming?: 'at_start' | 'before_start'
  pickupFinalLocationTiming?: 'day_before' | 'after_selection'
  referenceStartTime?: string
  pickupAreas?: PickupAreaShape[]
  pickupLocations?: { name?: string; address?: string; lat?: number | null; lng?: number | null }[]
  pickupDescription?: string
}

interface PickupLocationSectionProps {
  tour: PickupLocationSectionTour
  contact: { location: string; pickupLater: boolean; pickupLat: number | null; pickupLng: number | null; pickupArea: string }
  onContactChange: (key: string, value: string | boolean | number | null) => void
  locationValid: boolean
  touched: Record<string, boolean>
  onSetTouched: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void
  resolvedPoints: ResolvedTourPoint[]
  mapTour: ResolveTourSource | null
  resolvingPoints: boolean
  /** Opens the pickup-selection modal (multi-point tours — locations left,
      map right; the inline map is not shown for multi-point). */
  onOpenMap?: () => void
}

/**
 * Unified pickup location section for the booking page's Step 1.
 *
 * Renders "Choose your pickup location" with a search bar and map.
 * The map content varies by mode:
 * - Multiple specific pickup points → bus/transport icon pins
 * - Area-based pickup → geofence polygon overlay
 * - Single/no data → simplified search input
 */
export default function PickupLocationSection({
  tour,
  contact,
  onContactChange,
  locationValid,
  touched,
  onSetTouched,
  resolvedPoints,
  mapTour,
  resolvingPoints,
  onOpenMap,
}: PickupLocationSectionProps) {
  // ── Mode detection ──
  const pickupLocations = tour.pickupLocations || []
  const pickupAreas = tour.pickupAreas || []
  // Area-based pickup supersedes leftover specific pickup locations — the
  // multi-point flow only applies when there are several locations AND no areas.
  const hasMultiplePoints = pickupLocations.length > 1 && pickupAreas.length === 0
  const zonesDrawn = useMemo(
    () => pickupAreas.some((a) => Array.isArray(a.polygon) && a.polygon.length >= 3),
    [pickupAreas],
  )
  const hasPointAreas = useMemo(() => hasLocationOnlyAreas(pickupAreas), [pickupAreas])
  // Multi-point: show radio buttons when there are multiple named pickup locations
  const isMultiPoint = hasMultiplePoints

  // ── Radio selection (null = no selection yet) — used by multi-point AND
  //     zone tours: "Yes, I can add it now" reveals the search bar + map;
  //     "I don't know yet" defers the pickup location. Initialised from a
  //     restored draft so a saved "later" choice shows the right radio. ──
  const [pickupChoice, setPickupChoice] = useState<'now' | 'later' | null>(
    contact.pickupLater ? 'later' : null,
  )

  // ── Check if searched location is near any pickup point ──
  // The comparison runs against the RESOLVED points (the exact entries the map
  // pins are built from), not the raw tour data — a designated point whose
  // coordinates were geocoded by the resolve pipeline must still match, or it
  // would be flagged as "not one of our pickup points".
  const isNearPickupPoint = useMemo(() => {
    if (!isMultiPoint || contact.pickupLat == null || contact.pickupLng == null) return null
    // Find the closest pickup point
    let minDist = Infinity
    let closestPoint: { name: string; address: string } | null = null
    for (const loc of resolvedPoints) {
      if (loc.kind !== 'point' || loc.lat == null || loc.lng == null) continue
      const dist = distanceMeters(contact.pickupLat, contact.pickupLng, loc.lat, loc.lng)
      if (dist < minDist) {
        minDist = dist
        closestPoint = { name: loc.name || '', address: loc.address || '' }
      }
    }
    // Backend parity: the server accepts an autocomplete-sourced address
    // within 200 m of a designated pickup point (geoUtils.js
    // resolvePickupSelection). The client verdict must not be more lenient
    // than the server or the booking would pass here and fail at submit.
    return minDist <= 200 ? closestPoint : null
  }, [isMultiPoint, contact.pickupLat, contact.pickupLng, resolvedPoints])

  // ── Pickup areas with names (for zone chips / list) ──
  const pickupAreasList = useMemo(
    () => pickupAreas.filter((a): a is PickupAreaShape & { name: string } => !!a && !!a.name),
    [pickupAreas],
  )

  // ── Zone status feedback ──
  const zoneStatus: PickupZoneStatus = useMemo(
    () =>
      !contact.pickupLater
        ? pickupZoneStatus({ name: contact.location, lat: contact.pickupLat, lng: contact.pickupLng }, pickupAreas)
        : 'none',
    [contact.pickupLater, contact.location, contact.pickupLat, contact.pickupLng, pickupAreas],
  )
  const matchedArea = useMemo(
    () =>
      contact.pickupLat != null && contact.pickupLng != null && (zoneStatus === 'in_area' || zoneStatus === 'excluded')
        ? findPickupAreaForAddress({ lat: contact.pickupLat, lng: contact.pickupLng, name: contact.location }, pickupAreas)
        : null,
    [zoneStatus, contact.pickupLat, contact.pickupLng, contact.location, pickupAreas],
  )

  // ── Meeting point coordinates (for TravelTimeChip) ──
  const meetingPointCoords = useMemo(() => {
    const lat = toNumber(tour.meetingPointLat)
    const lng = toNumber(tour.meetingPointLng)
    return lat != null && lng != null ? { lat, lng } : null
  }, [tour.meetingPointLat, tour.meetingPointLng])

  // ── Geofence check ──
  const geofenced = zonesDrawn || hasPointAreas

  // ── Show map? ──
  const showZoneMap =
    zonesDrawn ||
    hasPointAreas ||
    resolvedPoints.some((p) => p.lat != null && p.lng != null) ||
    !!(tour.meetingPoint || tour.meetingPointAddress) ||
    (tour.pickupAreas?.length ?? 0) > 0 ||
    (tour.pickupLocations?.length ?? 0) > 0

  // ── Handlers ──
  const handlePickupAreaSelect = (name: string) => {
    if (contact.pickupArea === name) {
      onContactChange('pickupArea', '')
      onContactChange('pickupLat', null)
      onContactChange('pickupLng', null)
    } else {
      onContactChange('pickupArea', name)
      onContactChange('location', '')
      const area = pickupAreasList.find((a) => a.name === name)
      onContactChange('pickupLat', area && area.lat != null ? area.lat : null)
      onContactChange('pickupLng', area && area.lng != null ? area.lng : null)
    }
  }

  // Tapping a green pickup-point/zone pin on the map selects it directly: the
  // point's label (name first, matching what the pin shows) lands in the
  // location search bar and the coordinates are committed — without dropping
  // a separate blue pin on top of the green one (the green pin itself marks
  // the chosen spot). The match runs against the resolved points, since those
  // are what the map pins are built from. Zone pins keep the zone-selection
  // semantics (pickupArea set) so area-based validity still passes.
  const handlePinClick = (label: string): void => {
    const point = resolvedPoints.find((p) => (p.name || p.address) === label)
    if (!point || point.lat == null || point.lng == null) return
    if (point.kind === 'zone') {
      onContactChange('pickupArea', point.name || point.address || '')
    } else {
      onContactChange('pickupArea', '')
    }
    onContactChange('location', point.name || point.address || label)
    onContactChange('pickupLat', point.lat)
    onContactChange('pickupLng', point.lng)
    onSetTouched((t) => ({ ...t, location: true }))
  }

  // ── Location error message ──
  const locationInvalidMessage = !locationValid && touched.location
    ? zoneStatus === 'excluded'
      ? `This address is inside a no-pickup zone${matchedArea?.name ? ` for \u201C${matchedArea.name}\u201D` : ''}.`
      : zoneStatus === 'outside'
        ? geofenced
          ? 'This location is outside the pickup zone.'
          : 'This address is not inside your pickup area.'
        : zoneStatus === 'no_coords' && geofenced && contact.location.trim().length >= 3
          ? 'Pick an address from the suggestions to confirm it is inside the zone.'
          : geofenced
            ? 'Enter an address inside the pickup zone.'
            : 'Please enter your pickup location'
    : undefined

  // Map pin verdict — when the traveller's searched/dragged location is NOT
  // inside the pinned pickup zones/points, the map shows a red pin with an ×
  // ("location not included") instead of the plain blue pin.
  const userOutOfRange = useMemo(() => {
    if (contact.pickupLat == null || contact.pickupLng == null) return false
    if (contact.location.trim().length < 3) return false
    if (isMultiPoint) return isNearPickupPoint === null
    return geofenced && (zoneStatus === 'outside' || zoneStatus === 'excluded')
  }, [contact.pickupLat, contact.pickupLng, contact.location, isMultiPoint, isNearPickupPoint, geofenced, zoneStatus])

  // Label of the pickup point the traveller's chosen coordinates land on —
  // a pin tap commits the point's exact coordinates, so a tight radius only
  // matches a real pin selection (never a loose search near a point). The
  // matching map pin renders in the bright green check-mark style and the
  // legend shows "Selected pickup point" instead of the blue user pin.
  const selectedPinLabel = useMemo(() => {
    if (contact.pickupLat == null || contact.pickupLng == null) return null
    for (const p of resolvedPoints) {
      if (p.kind !== 'point' || p.lat == null || p.lng == null) continue
      if (distanceMeters(contact.pickupLat, contact.pickupLng, p.lat, p.lng) <= 25) {
        return p.name || p.address || ''
      }
    }
    return null
  }, [resolvedPoints, contact.pickupLat, contact.pickupLng])

  // Coordinate + label of the chosen pickup POINT — non-null only when the
  // traveller picked a designated pickup point (selectedPinLabel set). A plain
  // map click or free-typed address is NOT a designated point: it must keep
  // rendering the draggable user pin, so selectedPin stays null there.
  const selectedPin = useMemo<{ lat: number; lng: number; label?: string } | null>(() => {
    if (selectedPinLabel == null || contact.pickupLat == null || contact.pickupLng == null) return null
    return {
      lat: contact.pickupLat,
      lng: contact.pickupLng,
      label: selectedPinLabel,
    }
  }, [contact.pickupLat, contact.pickupLng, selectedPinLabel])

  // Every designated pickup point/zone (the map's green pins) that has
  // coordinates — each one is listed on the out-of-range card with its own
  // distance & travel time. Polygon-only zones use the polygon's first vertex.
  const designatedPoints = useMemo(() => {
    const list: { lat: number; lng: number; label: string }[] = []
    for (const p of resolvedPoints) {
      if (p.kind === 'meeting') continue
      const lat = p.lat ?? (p.kind === 'zone' ? (p.polygon?.[0]?.[0] ?? null) : null)
      const lng = p.lng ?? (p.kind === 'zone' ? (p.polygon?.[0]?.[1] ?? null) : null)
      if (lat == null || lng == null) continue
      list.push({ lat, lng, label: p.name || p.address || 'pickup location' })
    }
    return list
  }, [resolvedPoints])

  // Number of supplier pickup points — shown on the "Pickup locations (N)"
  // link that opens the selection modal for multi-point tours.
  const pickupPointsCount = useMemo(
    () => resolvedPoints.filter((p) => p.kind === 'point').length,
    [resolvedPoints],
  )

  // ── No zones or locations configured yet — show a graceful fallback ──
  if (pickupAreas.length === 0 && pickupLocations.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-bold tracking-tight text-slate-900">
          Pickup location
        </h3>
        <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 px-5 py-4 text-sm text-slate-600">
          <p>Pickup details will be confirmed after booking. The tour operator will contact you to arrange pickup.</p>
        </div>
      </div>
    )
  }

  // ── Render ──
  return (
    <div className="space-y-5">
      {/* Heading — multi-point and zone tours ask a question (radio flow),
          other single-location tours use a direct label. */}
      {isMultiPoint || geofenced ? (
        <h3 className="text-xl font-bold tracking-tight text-slate-900">
          Would you like to choose your pickup point?
        </h3>
      ) : (
        <h3 className="text-xl font-bold tracking-tight text-slate-900">
          Choose your pickup location
        </h3>
      )}

      {/* Multi-point: Radio selection with inline content */}
      {isMultiPoint && (
        <div className="space-y-3">
          {/* "Yes" option — shows a link to the pickup-point modal (locations
              list left, map right). No inline map for multi-point tours. */}
          <div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300">
              <input
                type="radio"
                name="pickup-choice"
                checked={pickupChoice === 'now'}
                onChange={() => {
                  setPickupChoice('now')
                  onContactChange('pickupLater', false)
                }}
                className="pickup-radio shrink-0"
              />
              <span className="text-sm font-medium text-slate-800">Yes, I can add it now</span>
            </label>
            {pickupChoice === 'now' && (
              <div className="mt-4 space-y-4">
                {/* Link that opens the pickup-selection modal. */}
                <button
                  type="button"
                  onClick={onOpenMap}
                  className="flex w-full flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-emerald-300 sm:flex-row sm:items-center"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#179237]">
                      <MapPin className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">
                        Pickup locations ({pickupPointsCount})
                      </span>
                      <span className="block text-xs text-slate-500">
                        Tap to choose your pickup point on the map.
                      </span>
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 pl-[52px] text-xs font-semibold text-emerald-600 underline underline-offset-2 sm:ml-auto sm:pl-0">
                    Select on Map
                    <MapPin className="size-3.5" />
                  </span>
                </button>

                {/* Pickup info — the supplier's pickup description and the
                    reference window before the activity start. */}
                {(tour.pickupDescription || referenceStartLabel(tour.referenceStartTime)) && (
                  <div className="rounded-xl border border-slate-200/40 bg-slate-50/30 px-3.5 py-3">
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 font-semibold text-slate-700">
                        <Info className="size-3.5 text-emerald-600" />
                        Pickup info
                      </p>
                      {tour.pickupDescription && (
                        <p className="flex items-start gap-2 pl-[22px] leading-relaxed text-slate-500">
                          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[#179237]" />
                          <span>{tour.pickupDescription}</span>
                        </p>
                      )}
                      {referenceStartLabel(tour.referenceStartTime) && (
                        <p className="flex items-start gap-2 pl-[22px] text-slate-500">
                          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[#179237]" />
                          <span>{referenceStartLabel(tour.referenceStartTime)}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Out-of-range: distance & travel time to every pickup point */}
                {userOutOfRange && contact.pickupLat != null && contact.pickupLng != null && (
                  <OutOfRangeDistance
                    from={{ lat: contact.pickupLat, lng: contact.pickupLng }}
                    points={designatedPoints}
                    message={`${contact.location} is not one of our pickup points — available pickup points:`}
                  />
                )}

                {/* Selected pickup location confirmation */}
                {selectedPin && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-3.5 py-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#179237]" />
                    <div className="min-w-0 flex-1 text-sm text-emerald-900">
                      <p className="font-semibold">
                        Traveler's pickup location: <span className="underline underline-offset-2">{selectedPinLabel || contact.location}</span>
                      </p>
                      {contact.pickupLat != null && contact.pickupLng != null && (
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <span className="font-semibold text-emerald-700">Directions:</span>
                          <a
                            href={googleMapsDirectionsUrl(null, { lat: contact.pickupLat, lng: contact.pickupLng }, 'drive')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline underline-offset-2 transition-colors hover:text-emerald-900"
                          >
                            Open in Google Maps <ExternalLink size={11} />
                          </a>
                          <span className="text-emerald-300">·</span>
                          <a
                            href={appleMapsDirectionsUrl(null, { lat: contact.pickupLat, lng: contact.pickupLng })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline underline-offset-2 transition-colors hover:text-emerald-900"
                          >
                            Apple Maps <ExternalLink size={11} />
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* "I don't know yet" option with message below it */}
          <div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300">
              <input
                type="radio"
                name="pickup-choice"
                checked={pickupChoice === 'later'}
                onChange={() => {
                  setPickupChoice('later')
                  onContactChange('pickupLater', true)
                  onContactChange('location', '')
                  onContactChange('pickupArea', '')
                  onContactChange('pickupLat', null)
                  onContactChange('pickupLng', null)
                }}
                className="pickup-radio shrink-0"
              />
              <span className="text-sm font-medium text-slate-800">I don't know yet</span>
            </label>
            {/* Message appears right under "I don't know yet" when selected */}
            {pickupChoice === 'later' && (
              <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                <p className="text-sm font-medium text-sky-800">
                  Add your pickup location 24 hours before your activity (ideally sooner) so your activity provider can accommodate you
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pickup location search + map — non-multi-point tours (zone-based and
          single-location). Zone tours ask the same Yes/No radio question as
          multi-point tours: "Yes" reveals the search bar + map, "No" defers
          the pickup location. */}
      {!isMultiPoint ? (
        <div className="space-y-3">
          {/* "Yes" option with search + map below it */}
          <div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300">
              <input
                type="radio"
                name="pickup-choice"
                checked={pickupChoice === 'now'}
                onChange={() => {
                  setPickupChoice('now')
                  onContactChange('pickupLater', false)
                }}
                className="pickup-radio shrink-0"
              />
              <span className="text-sm font-medium text-slate-800">Yes, I can add it now</span>
            </label>
            {/* Search + map appears right under "Yes" when selected */}
            {pickupChoice === 'now' && (
              <div className="mt-4 space-y-4">
                {/* Search bar */}
                <LocationPicker
                  value={contact.location}
                  onChange={(v) => onContactChange('location', v)}
                  onCoordsChange={(lat, lng) => {
                    onContactChange('pickupLat', lat)
                    onContactChange('pickupLng', lng)
                    if (lat != null && lng != null) {
                      onContactChange('pickupArea', '')
                      onSetTouched((t) => ({ ...t, location: true }))
                    }
                  }}
                  onBlur={() => onSetTouched((t) => ({ ...t, location: true }))}
                  placeholder="Search for hotel, address, etc."
                  valid={locationValid}
                  error={locationInvalidMessage}
                  minimal
                />

                {/* Live zone verdict */}
                {!contact.pickupArea && zoneStatus === 'in_area' && matchedArea && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-3.5 py-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#179237]" />
                    <div className="text-sm text-emerald-900">
                      <p className="font-semibold">
                        Great, your location is within the <span className="underline underline-offset-2">{matchedArea.name}</span> pickup zone.
                      </p>
                      {matchedArea.time && (
                        <p className="mt-0.5 text-xs text-emerald-700">
                          Pickup {compactTime(matchedArea.time)} min before the activity starts
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {/* Out-of-range: distance & travel time to every pickup zone */}
                {!contact.pickupArea && zoneStatus === 'outside' && geofenced && contact.pickupLat != null && contact.pickupLng != null && (
                  <OutOfRangeDistance
                    from={{ lat: contact.pickupLat, lng: contact.pickupLng }}
                    points={designatedPoints}
                    message="This address isn't inside any of the pickup zones — available pickup zones:"
                  />
                )}
                {!contact.pickupArea && zoneStatus === 'excluded' && matchedArea && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-rose-200/70 bg-rose-50/60 px-3.5 py-2.5">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-rose-500" />
                    <p className="text-sm text-rose-700">
                      This address falls inside a no-pickup zone{matchedArea.name ? ` for \u201C${matchedArea.name}\u201D` : ''} — choose a different address or zone.
                    </p>
                  </div>
                )}

                {/* Selected pickup location confirmation */}
                {(contact.pickupArea || (zoneStatus === 'in_area' && matchedArea)) && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-3.5 py-2.5">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[#179237]" />
                    <div className="min-w-0 flex-1 text-sm text-emerald-900">
                      <p className="font-semibold">
                        Traveler's pickup location:{' '}
                        <span className="underline underline-offset-2">{contact.location || contact.pickupArea || matchedArea?.name}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-emerald-700">
                        The exact pickup point and time are confirmed with you directly.
                      </p>
                    </div>
                    {contact.pickupArea && (
                      <button
                        type="button"
                        onClick={() => handlePickupAreaSelect(contact.pickupArea)}
                        className="shrink-0 rounded p-1 text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
                        aria-label={`Remove pickup zone ${contact.pickupArea}`}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )}

                {/* Multi-point: Red pin message when searched location is not near any pickup point */}
                {isMultiPoint && !contact.pickupArea && contact.pickupLat != null && contact.pickupLng != null && isNearPickupPoint === null && contact.location.trim().length >= 3 && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-rose-200/70 bg-rose-50/60 px-3.5 py-2.5">
                    <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-500">
                      <AlertCircle className="size-3 text-white" />
                    </div>
                    <p className="text-sm text-rose-700">
                      <span className="font-semibold">{contact.location}</span> is not one of our pickup points. Choose from the available pickup points or adjust your search.
                    </p>
                  </div>
                )}

                {/* Multi-point: Confirmation when searched location is near a pickup point */}
                {isMultiPoint && !contact.pickupArea && isNearPickupPoint && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-3.5 py-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#179237]" />
                    <p className="text-sm text-emerald-900">
                      Great, your location is near the <span className="font-semibold underline underline-offset-2">{isNearPickupPoint.name || isNearPickupPoint.address}</span> pickup point.
                    </p>
                  </div>
                )}

                {/* Map */}
                {showZoneMap && (
                  <div className="space-y-1">
                    {resolvingPoints && (
                      <p className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-slate-400">
                        <Loader2 className="size-3 animate-spin" />
                        Locating pickup points…
                      </p>
                    )}
                    <MapErrorBoundary resetKey={mapTour || tour}>
                      <LocationMap
                        tour={(mapTour || tour) as PickupZoneMapTour}
                        userMarker={selectedPin ? null : { lat: contact.pickupLat, lng: contact.pickupLng, label: contact.location }}
                        userOutOfRange={userOutOfRange}
                        userChosen={contact.pickupLat != null && contact.pickupLng != null && !selectedPin}
                        selectedPin={selectedPin}
                        selectedPinLabel={selectedPinLabel}
                        onPinClick={handlePinClick}
                        onUserPointChange={(lat, lng) => {
                          onContactChange('pickupLat', lat)
                          onContactChange('pickupLng', lng)
                          onContactChange('pickupArea', '')
                          onSetTouched((t) => ({ ...t, location: true }))
                        }}
                        onUserAddressChange={(address) => {
                          onContactChange('location', address)
                        }}
                      />
                    </MapErrorBoundary>
                    <TravelTimeChip
                      from={
                        contact.pickupLat != null && contact.pickupLng != null
                          ? { lat: contact.pickupLat, lng: contact.pickupLng }
                          : null
                      }
                      to={meetingPointCoords}
                      destinationLabel="the meeting point"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* "I don't know yet" option with message below it */}
          <div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300">
              <input
                type="radio"
                name="pickup-choice"
                checked={pickupChoice === 'later'}
                onChange={() => {
                  setPickupChoice('later')
                  onContactChange('pickupLater', true)
                  onContactChange('location', '')
                  onContactChange('pickupArea', '')
                  onContactChange('pickupLat', null)
                  onContactChange('pickupLng', null)
                }}
                className="pickup-radio shrink-0"
              />
              <span className="text-sm font-medium text-slate-800">I don't know yet</span>
            </label>
            {/* Message appears right under "I don't know yet" when selected */}
            {pickupChoice === 'later' && (
              <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                <p className="text-sm font-medium text-sky-800">
                  Add your pickup location 24 hours before your activity (ideally sooner) so your activity provider can accommodate you
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
