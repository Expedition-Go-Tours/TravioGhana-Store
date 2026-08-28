import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Car, Check, ChevronDown, Clock, Compass, List, Loader2, MapPin, Pencil, RefreshCw, Search, X } from 'lucide-react'
import { reverseGeocode } from '@/lib/locations'
import { pinMatchesSelection } from '@/lib/mapUtils'
import DirectionsPanel from './DirectionsPanel'
import { useLocationAutocomplete, type LocationSuggestion } from '@/hooks/useLocationAutocomplete'
import { hasLocationOnlyAreas, pickupZoneStatus } from '@/lib/pickupZone'
import type { ResolveTourSource, ResolvedTourPoint } from '@/lib/resolvePoints'
import type { PickupZoneMapTour } from './PickupZoneMap'
import LocationMap from './LocationMap'
import MapErrorBoundary from './MapErrorBoundary'

export interface PickupSelectModalTour {
  meetingMode?: 'meeting_point' | 'pickup' | 'none'
  meetingPoint?: string
  pickupDescription?: string
  referenceStartTime?: string
}

interface PickupSelectModalProps {
  open: boolean
  onClose: () => void
  tour: PickupSelectModalTour
  /** Points with every coordinate resolved (geocoded where missing). */
  points: ResolvedTourPoint[]
  /** The resolved points merged into a map-consumable tour object. */
  mapTour: ResolveTourSource | null
  contact: { location: string; pickupLater: boolean; pickupLat: number | null; pickupLng: number | null; pickupArea: string }
  onContactChange: (key: string, value: string | boolean | number | null) => void
  /** True while the geocode pipeline is resolving coordinates. */
  loading?: boolean
}

const compactTime = (t?: string): string => (t ? t.replace('-', '–') : '')

const pointDisplayName = (p: ResolvedTourPoint): string => p.name || p.address || 'Pickup point'

/**
 * The booking page's pickup/meeting selection modal. Browse the map (OSM-first
 * layered map) and the grouped list; tap a pin or a row to select a pickup
 * zone or pickup point. The selection is reverse-geocoded to an exact address.
 * "Select" writes the selection back into the form's contact state — on
 * multi-pickup tours it first asks "is this your pickup point?" in a popup.
 *
 * The modal content lives in a child component mounted only while `open`, so
 * the selection state is re-initialised from the form on every open.
 */
export default function PickupSelectModal(props: PickupSelectModalProps) {
  const { open, onClose } = props
  return (
    <AnimatePresence>
      {open && <PickupSelectModalContent {...props} onClose={onClose} />}
    </AnimatePresence>
  )
}

function PickupSelectModalContent({
  onClose,
  tour,
  points,
  mapTour,
  contact,
  onContactChange,
  loading,
}: PickupSelectModalProps) {
  // Lock the page scroll while the modal is open (and during its exit
  // animation) so the page underneath never scrolls/taps through. BOTH the
  // root element and body must be locked: `html { overflow-x: clip }` in
  // index.css means body's overflow no longer propagates to the viewport,
  // so hiding body alone would leave the page scrollable under the modal.
  useEffect(() => {
    const root = document.documentElement
    const prevRootOverflow = root.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    root.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      root.style.overflow = prevRootOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [])

  // The content mounts fresh on every open, so the initial state is seeded
  // from the form's confirmed pickup location (if any): the matching point is
  // pre-highlighted in the list and the map zooms to it — "Show on map"
  // reflects what the traveller actually chose, not a blank unchecked list.
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const pickupLat = contact.pickupLat
    const pickupLng = contact.pickupLng
    if (pickupLat == null || pickupLng == null) return null
    const match = points.find(
      (p) =>
        p.kind !== 'meeting' &&
        p.lat != null &&
        p.lng != null &&
        pinMatchesSelection(
          { lat: p.lat, lng: p.lng, label: p.name || p.address || null },
          { lat: pickupLat, lng: pickupLng, label: contact.location || null },
        ),
    )
    return match ? match.id : null
  })
  const [addressPreview, setAddressPreview] = useState('')
  /** Mobile-only: the pickup list lives in a top sheet overlaying the map.
      Collapsed by default so the map is the hero; desktop ignores this state
      (the list is a static left column there). */
  const [listOpen, setListOpen] = useState(false)

  // Geoapify-backed search — find a pickup address anywhere (even outside the
  // drawn zones) and pin it on the map. Same search hook as the booking form's
  // LocationPicker: Geoapify first, backend location service as fallback.
  const { search, retry, clear, results, loading: searching, error: searchError } = useLocationAutocomplete()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchHighlight, setSearchHighlight] = useState(-1)
  const [searchMarker, setSearchMarker] = useState<{ lat: number; lng: number } | null>(null)
  const [searchCommitted, setSearchCommitted] = useState(false)
  /** True when the searched address falls outside the supplier's pickup zone. */
  const [searchOutOfRange, setSearchOutOfRange] = useState(false)
  /** True when the searched address is confirmed inside a pickup zone. */
  const [searchInZone, setSearchInZone] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Dragging the blue pin on the map asks the traveller to confirm the spot
  // before it becomes their pickup location.
  const [dragPreview, setDragPreview] = useState<{ lat: number; lng: number } | null>(null)
  const [dragAddress, setDragAddress] = useState('')
  /** True when the dropped pin is outside the supplier's pickup zone. */
  const [dragOutOfRange, setDragOutOfRange] = useState(false)

  // On multi-pickup tours, tapping a row/pin selects it and zooms the map;
  // the "is this your pickup point?" popup only appears when the footer
  // "Select" button is pressed.
  const [pendingPoint, setPendingPoint] = useState<ResolvedTourPoint | null>(null)
  /** Point clicked in the side list — the map flies to it (zoom in). Seeded
      from the form's confirmed pickup location so reopening the modal zooms
      straight to the traveller's chosen spot. */
  const [focusPoint, setFocusPoint] = useState<{ lat: number; lng: number } | null>(
    contact.pickupLat != null && contact.pickupLng != null
      ? { lat: contact.pickupLat, lng: contact.pickupLng }
      : null,
  )

  const selectable = useMemo(() => points.filter((p) => p.kind !== 'meeting'), [points])
  const meetingPoint = useMemo(() => points.find((p) => p.kind === 'meeting') || null, [points])
  const zones = useMemo(() => selectable.filter((p) => p.kind === 'zone'), [selectable])
  const spots = useMemo(() => selectable.filter((p) => p.kind === 'point'), [selectable])

  // Tours with several pickup spots: no free address search — the traveller
  // must choose from the listed options only.
  const multiplePickups = selectable.length > 1

  // Supplier-set pickup area/zone — drags and searches outside it are rejected.
  const zoneAreas = useMemo(
    () =>
      zones.map((z) => ({
        name: z.name,
        address: z.address,
        lat: z.lat,
        lng: z.lng,
        time: z.time,
        polygon: z.polygon,
        exclusions: z.exclusions,
      })),
    [zones],
  )
  const zonesDrawn = zones.some((z) => Array.isArray(z.polygon) && z.polygon.length >= 3)
  const geofenced = zonesDrawn || hasLocationOnlyAreas(zoneAreas)
  // All selectable points (custom double-click points were removed).
  const allPoints = points

  const isInPickupArea = (lat: number, lng: number): boolean =>
    !geofenced || pickupZoneStatus({ name: '', lat, lng }, zoneAreas) === 'in_area'

  // Map pin verdict — an out-of-range search or a dragged drop outside the
  // zone shows the red × ("location not included") pin on the map.
  const mapUserOutOfRange = searchOutOfRange || (dragPreview ? dragOutOfRange : false)

  const selectPoint = (point: ResolvedTourPoint): void => {
    setSelectedId(point.id)
    setSearchMarker(null)
    setSearchCommitted(false)
    setSearchQuery('')
    setSearchOpen(false)
    setDragPreview(null)
    setDragAddress('')
    setDragOutOfRange(false)
    // A picked location reveals the full map again on mobile — the bottom
    // sheet slides away so the chosen pin is front and centre.
    setListOpen(false)
    // The final location shows the same name as the pin's tooltip on the map
    // (name || address) — what the traveller sees on the map is what lands
    // on the booking form, no reverse-geocoded address drift.
    setAddressPreview(point.name || point.address || '')
    // Fly the map to the clicked location (zoom in) — for every side-list row.
    if (point.lat != null && point.lng != null) {
      setFocusPoint({ lat: point.lat, lng: point.lng })
    }
  }

  // "Yes" on the pickup-point popup — commit the choice to the form and close.
  const confirmPendingPoint = (): void => {
    const point = pendingPoint
    setPendingPoint(null)
    if (!point) return
    if (point.kind === 'zone') {
      onContactChange('pickupArea', point.name || point.address)
      onContactChange('location', '')
      // Keep coordinates so the blue pin shows the traveller's pickup spot.
      onContactChange('pickupLat', point.lat)
      onContactChange('pickupLng', point.lng)
    } else {
      onContactChange('pickupArea', '')
      onContactChange('location', addressPreview || point.address || point.name)
      onContactChange('pickupLat', point.lat)
      onContactChange('pickupLng', point.lng)
    }
    onClose()
  }

  // Picked a Geoapify search result: pin it on the map and treat it as the
  // pickup address (committed to the form on Confirm). The search box is
  // cleared — the selection lives in the left-panel "Your location" row.
  const selectSearchResult = (suggestion: LocationSuggestion): void => {
    // Tours with a supplier-set pickup zone only accept addresses inside it.
    if (suggestion.latitude != null && suggestion.longitude != null && !isInPickupArea(suggestion.latitude, suggestion.longitude)) {
      setSearchOutOfRange(true)
      setSearchInZone(false)
      setSearchOpen(false)
      setSearchHighlight(-1)
      // Still pin the location on the map — as the red × ("not included")
      // pin — so the traveller sees exactly where it falls.
      setSearchMarker({ lat: suggestion.latitude, lng: suggestion.longitude })
      setSelectedId(null)
      setSearchCommitted(false)
      setDragPreview(null)
      setDragAddress('')
        return
    }
    setSearchOutOfRange(false)
    // Only surface the "within the pickup zone" confirmation when the tour
    // actually has a geofenced zone the address could be inside.
    setSearchInZone(geofenced)
    setSelectedId(null)
    setSearchQuery('')
    setSearchOpen(false)
    setSearchHighlight(-1)
    setSearchCommitted(true)
    setDragPreview(null)
    setDragAddress('')
    if (suggestion.latitude != null && suggestion.longitude != null) {
      setSearchMarker({ lat: suggestion.latitude, lng: suggestion.longitude })
      setAddressPreview(suggestion.formatted)
    } else {
      setSearchMarker(null)
      setAddressPreview(suggestion.formatted)
    }
  }

  // Manual fallback: commit exactly what the traveller typed (no coords → no pin).
  const commitSearchManual = (value: string): void => {
    const v = value.trim()
    setSelectedId(null)
    setSearchMarker(null)
    setSearchCommitted(true)
    setSearchQuery('')
    setSearchOpen(false)
    setSearchHighlight(-1)
    setSearchOutOfRange(false)
    setSearchInZone(false)
    setDragPreview(null)
    setDragAddress('')
    setAddressPreview(v)
  }

  const handleSearchInput = (v: string): void => {
    setSearchQuery(v)
    setSearchHighlight(-1)
    // Editing the text invalidates the previously pinned search result.
    setSearchMarker(null)
    setSearchCommitted(false)
    setSearchOutOfRange(false)
    setSearchInZone(false)
    setDragPreview(null)
    setDragAddress('')
    if (v.trim().length >= 3) {
      search(v)
      setSearchOpen(true)
    } else {
      clear()
      setSearchOpen(false)
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent): void => {
    if (!searchOpen) {
      if (e.key === 'Enter' && searchQuery.trim().length >= 3) {
        e.preventDefault()
        commitSearchManual(searchQuery)
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        if (results.length === 0) break
        e.preventDefault()
        setSearchHighlight((prev) => (prev < results.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        if (results.length === 0) break
        e.preventDefault()
        setSearchHighlight((prev) => (prev > 0 ? prev - 1 : results.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (results.length > 0 && searchHighlight >= 0) {
          selectSearchResult(results[searchHighlight])
        } else if (searchQuery.trim().length >= 2) {
          commitSearchManual(searchQuery)
        }
        break
      case 'Escape':
        setSearchOpen(false)
        setSearchHighlight(-1)
        break
      default:
        break
    }
  }

  // Close the search dropdown on outside click.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleClearSearch = (): void => {
    setSearchQuery('')
    setSearchOpen(false)
    setSearchHighlight(-1)
    setSearchMarker(null)
    setSearchCommitted(false)
    setSearchOutOfRange(false)
    setSearchInZone(false)
    setDragPreview(null)
    setDragAddress('')
    clear()
  }

  // Blue pin dragged on the map → hold the spot and ask for confirmation.
  // Drops outside the supplier's pickup zone are rejected with an inline error.
  const handleDragEnd = (lat: number, lng: number): void => {
    setDragPreview({ lat, lng })
    setDragAddress('')
    setDragOutOfRange(!isInPickupArea(lat, lng))
    void reverseGeocode(lat, lng).then((r) => {
      setDragAddress(r?.formatted ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    })
  }

  // Traveller confirmed the dragged spot — it becomes their pickup location
  // and shows up in the left panel (blue "Your location" row). The search box
  // is cleared — the selection lives in the left panel.
  const confirmDrag = (): void => {
    if (!dragPreview || dragOutOfRange) return
    const label = dragAddress || `${dragPreview.lat.toFixed(5)}, ${dragPreview.lng.toFixed(5)}`
    setSearchMarker(dragPreview)
    setSearchCommitted(true)
    setSelectedId(null)
    setSearchQuery('')
    setAddressPreview(label)
    setDragPreview(null)
    setDragAddress('')
    setDragOutOfRange(false)
    setSearchOpen(false)
  }

  // Traveller cancelled the drag — the pin reverts to the previous marker.
  const cancelDrag = (): void => {
    setDragPreview(null)
    setDragAddress('')
    setDragOutOfRange(false)
  }

  const handlePinClick = (label: string): void => {
    const point = allPoints.find((p) => p.name === label || p.address === label)
    if (point && point.kind !== 'meeting') selectPoint(point)
  }

  const handleConfirm = (): void => {
    const selected = allPoints.find((p) => p.id === selectedId)
    if (selected && selected.kind === 'zone') {
      onContactChange('pickupArea', selected.name || selected.address)
      onContactChange('location', '')
      // Keep coordinates so the blue pin shows the traveller's pickup spot.
      onContactChange('pickupLat', selected.lat)
      onContactChange('pickupLng', selected.lng)
    } else if (selected) {
      onContactChange('pickupArea', '')
      onContactChange('location', addressPreview || selected.address || selected.name)
      onContactChange('pickupLat', selected.lat)
      onContactChange('pickupLng', selected.lng)
    } else if (searchCommitted) {
      // A Geoapify search result — exact address (+ coordinates when pinned).
      onContactChange('pickupArea', '')
      onContactChange('location', addressPreview || searchQuery)
      onContactChange('pickupLat', searchMarker ? searchMarker.lat : null)
      onContactChange('pickupLng', searchMarker ? searchMarker.lng : null)
    }
    onClose()
  }

  // "Select" in the footer. Multi-pickup tours show the confirmation popup
  // ("is this your pickup point?") and only commit the choice when the
  // traveller says yes; every other tour writes the selection straight to
  // the form and closes.
  const handleSelect = (): void => {
    const selected = allPoints.find((p) => p.id === selectedId)
    if (multiplePickups && selected) {
      setPendingPoint(selected)
      return
    }
    handleConfirm()
  }

  const handlePickupLater = (): void => {
    onContactChange('pickupLater', true)
    onContactChange('location', '')
    onContactChange('pickupArea', '')
    onContactChange('pickupLat', null)
    onContactChange('pickupLng', null)
    onClose()
  }

  const selected = allPoints.find((p) => p.id === selectedId) || null
  /** A selected pickup POINT is already marked by its highlighted green pin —
      no blue user pin on top of it, and no blue "Your pickup location" legend
      entry (the "Selected pickup point" entry takes over). */
  const pointSelected = selected != null && selected.kind === 'point'
  const selectedPinLabel = pointSelected ? selected.name || selected.address || '' : null
  /** Coordinate + label of the selected pickup point — lets the map highlight
      the green-with-tick pin even if the label strings drift. */
  const selectedPin = useMemo<{ lat: number; lng: number; label?: string } | null>(() => {
    if (!pointSelected || selected == null || selected.lat == null || selected.lng == null) return null
    return { lat: selected.lat, lng: selected.lng, label: selectedPinLabel ?? undefined }
  }, [pointSelected, selected, selectedPinLabel])
  const canConfirm = !!selected || searchCommitted

  // The directions DESTINATION — the selected pickup point on MULTI-pickup
  // tours only (single-point tours keep the modal free of directions).
  const directionsDestination = useMemo(() => {
    if (!multiplePickups) return null
    const sel = allPoints.find((p) => p.id === selectedId)
    if (sel && sel.lat != null && sel.lng != null) {
      return { lat: sel.lat, lng: sel.lng, label: pointDisplayName(sel) }
    }
    return null
  }, [multiplePickups, allPoints, selectedId])

  // Highlights the traveller's selection in the left list — either picked live
  // in this session, or the previously confirmed location seeded from the
  // form on open ("Show on map" reflects the chosen spot).
  const isRowSelected = (p: ResolvedTourPoint): boolean => p.id === selectedId

  const group = (label: string, icon: 'car' | 'pin', items: ResolvedTourPoint[]) =>
    items.length > 0 ? (
      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {icon === 'car' ? <Car className="size-3" /> : <MapPin className="size-3" />}
          {label}
          <span className="font-semibold text-slate-300">({items.length})</span>
        </p>
        <ul className="space-y-1">
          {items.map((p) => {
            const sel = isRowSelected(p)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => selectPoint(p)}
                  aria-pressed={sel}
                  className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    sel
                      ? 'border-[#179237] bg-[#179237]/5 ring-1 ring-[#179237]/40'
                      : 'border-slate-200 bg-white hover:border-[#179237]/50'
                  }`}
                >
                  <span
                    className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
                      sel ? 'border-[#179237] bg-[#179237] text-white' : 'border-slate-300 text-transparent'
                    }`}
                  >
                    <Check className="size-2.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-semibold ${sel ? 'text-[#179237]' : 'text-slate-800'}`}>
                      {pointDisplayName(p)}
                    </span>
                    {p.address && p.address !== p.name && (
                      <span className="block truncate text-xs text-slate-500">{p.address}</span>
                    )}
                    {p.unresolved && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                        <RefreshCw className="size-3" /> Exact location pending
                      </span>
                    )}
                  </span>
                  {p.time && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      pickup {compactTime(p.time)}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    ) : null

  return (
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-2xl"
        initial={{ opacity: 0, y: -48 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -32 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Choose your pickup"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-emerald-50 text-[#179237]">
              <MapPin className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-slate-900">Choose your pickup</h3>
              <p className="text-xs text-slate-400">
                Tap a pin or a location to select it.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close pickup selector"
          >
            <X size={18} />
          </button>
        </div>

        {/* Multi-pickup tours: no free address search — choose from the
            listed pickup locations only. */}
        {multiplePickups ? (
          <div className="shrink-0 border-b border-slate-100 px-5 py-3">
            <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#179237]" />
              These are the available pickup locations — please choose from those options only.
            </p>
          </div>
        ) : (
        /* Search — full-width, right under the title. The dropdown overlays
            the content below (it is NOT inside the scrollable body, so it is
            never clipped and no scrollbar gutter shows beside it). */
        <div ref={searchRef} className="relative shrink-0 border-b border-slate-100 px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => {
                if (results.length > 0) setSearchOpen(true)
              }}
              placeholder="Search for your address…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#179237] focus:ring-2 focus:ring-[#179237]/15"
              aria-expanded={searchOpen}
              aria-autocomplete="list"
              aria-controls={searchOpen ? 'pickup-search-listbox' : undefined}
              aria-activedescendant={searchHighlight >= 0 ? `pickup-search-option-${searchHighlight}` : undefined}
            />
            {searching ? (
              <Loader2 className="absolute right-3 top-1/2 size-4 -mt-2 animate-spin text-[#179237]" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {searchOpen && (
            <ul
              id="pickup-search-listbox"
              role="listbox"
              className="scrollbar-hide absolute inset-x-5 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/60"
            >
              {searching && (
                <li className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
                  <Loader2 size={14} className="animate-spin text-[#179237]" />
                  Searching locations…
                </li>
              )}
              {!searching && searchError && (
                <li className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-rose-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-rose-600">Could not load location suggestions.</p>
                      <p className="mt-0.5 text-xs text-slate-400">You can still type a location manually.</p>
                    </div>
                    <button
                      type="button"
                      onClick={retry}
                      className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
                    >
                      <RefreshCw size={12} />
                      Retry
                    </button>
                  </div>
                </li>
              )}
              {!searching &&
                results.map((r, index) => (
                  <li
                    key={`${r.source}-${index}`}
                    id={`pickup-search-option-${index}`}
                    role="option"
                    aria-selected={index === searchHighlight}
                    onClick={() => selectSearchResult(r)}
                    onMouseEnter={() => setSearchHighlight(index)}
                    className={`cursor-pointer px-4 py-2.5 text-sm ${
                      index === searchHighlight ? 'bg-emerald-50 text-emerald-900' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.formatted}</div>
                        {[r.city, r.region, r.country].filter(Boolean).length > 0 && (
                          <div className="truncate text-xs text-slate-400">
                            {[r.city, r.region, r.country].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              {!searching && searchQuery.trim().length >= 3 && (
                <li
                  role="option"
                  aria-selected={searchHighlight === results.length}
                  onClick={() => commitSearchManual(searchQuery)}
                  onMouseEnter={() => setSearchHighlight(results.length)}
                  className={`cursor-pointer border-t border-slate-100 px-4 py-3 text-sm ${
                    searchHighlight === results.length ? 'bg-emerald-50 text-emerald-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <Pencil size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">Use “{searchQuery.trim()}” as your pickup location</div>
                      <div className="mt-0.5 text-xs text-slate-400">Not in the list? We’ll use exactly what you typed.</div>
                    </div>
                  </div>
                </li>
              )}
            </ul>
          )}

          {/* Out-of-range inline error for the searched address. */}
          {searchOutOfRange && (
            <div>
              <p className="mt-2 flex items-start gap-1.5 text-sm font-medium leading-relaxed text-rose-600">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" />
                This location is out of range from the pickup zone — choose a location inside the zone.
              </p>
              <p className="mt-1.5 text-xs font-medium leading-relaxed text-amber-700">
                Kindly choose a pickup area later and ensure you update the pickup location before the tour date.
              </p>
              <label className="mt-2 flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  onChange={() => handlePickupLater()}
                  className="mt-0.5 size-4 shrink-0 rounded border-slate-300 bg-white text-[#179237] accent-[#179237] [color-scheme:light] focus:ring-[#179237]/20"
                />
                <span className="text-sm font-medium text-slate-700">Choose a pickup location later</span>
              </label>
            </div>
          )}
        </div>
        )}

        {/* Body — on mobile the map owns the whole height and the list
            overlays it as a collapsible top sheet (never obstructing the
            map); on desktop the list is a static left column and the body may
            scroll when content exceeds the modal. */}
        <div className="scrollbar-hide relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row md:overflow-y-auto">
          {/* Mobile-only: reopen the pickup list — a button pinned under the
              modal header (hidden only while the top sheet is open or a
              dragged pin waits for confirmation — it stays visible after a
              pickup point is selected so the list can be reopened). */}
          {!listOpen && !dragPreview && (
            <button
              type="button"
              onClick={() => setListOpen(true)}
              className="flex shrink-0 items-center justify-between gap-1.5 border-b border-slate-100 bg-white px-4 py-2.5 text-xs font-semibold text-[#179237] md:hidden"
            >
              <span className="flex items-center gap-1.5">
                <List className="size-3.5" />
                Pickup locations ({selectable.length})
              </span>
              <ChevronDown className="size-3.5" />
            </button>
          )}
          {/* List panel — desktop: static left column; mobile: top sheet
              sliding down over the map (collapsed by default). */}
          <div
            className={`absolute inset-x-0 top-0 z-20 flex max-h-[60vh] flex-col overflow-hidden rounded-b-2xl border-b border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.18)] transition-transform duration-300 ease-out ${
              listOpen ? 'translate-y-0' : '-translate-y-full'
            } md:static md:z-auto md:max-h-none md:w-80 md:shrink-0 md:translate-y-0 md:rounded-none md:border-b-0 md:border-r md:border-slate-100 md:bg-transparent md:shadow-none`}
          >
            {/* Mobile-only sheet handle — collapses the sheet back over the map. */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 md:hidden">
              <button
                type="button"
                onClick={() => setListOpen(false)}
                aria-label="Hide pickup locations"
                className="flex w-full items-center justify-between py-1"
              >
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <List className="size-3.5" /> Pickup locations ({selectable.length})
                </span>
                <ChevronDown className="size-4 rotate-180 text-slate-400" />
              </button>
            </div>
            {/* Scrollable list — scrollbar hidden so the panel stays clean. */}
            <div className="scrollbar-hide min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pt-2 md:p-5 md:pt-2">
            {selectable.length === 0 && meetingPoint && (
              <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                This is a meeting-point tour — travellers go to{' '}
                <strong className="font-semibold text-slate-700">
                  {meetingPoint.name || meetingPoint.address || 'the meeting point'}
                </strong>{' '}
                themselves.
              </p>
            )}
            {/* Searched/pinned location — mirrors the blue pin on the map. */}
            {searchCommitted && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  <MapPin className="size-3" /> Your location
                </p>
                <ul className="space-y-1">
                  <li>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-pressed={true}
                      onClick={() => selectSearchResult({ formatted: addressPreview || searchQuery, latitude: searchMarker?.lat ?? null, longitude: searchMarker?.lng ?? null, city: '', country: '', region: '' })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          selectSearchResult({ formatted: addressPreview || searchQuery, latitude: searchMarker?.lat ?? null, longitude: searchMarker?.lng ?? null, city: '', country: '', region: '' })
                        }
                      }}
                      className="flex w-full items-start gap-2.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2.5 text-left ring-1 ring-blue-400/40"
                    >
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-blue-500 bg-blue-500 text-white">
                        <Check className="size-2.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-blue-800">
                          {searchQuery || addressPreview}
                        </span>
                        {searchMarker && (
                          <span className="block truncate font-mono text-[10px] text-blue-500/80">
                            {searchMarker.lat.toFixed(5)}, {searchMarker.lng.toFixed(5)}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleClearSearch()
                        }}
                        aria-label="Remove your location"
                        className="shrink-0 rounded p-1 text-blue-400 transition-colors hover:bg-blue-100 hover:text-blue-600"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </li>
                </ul>
                {searchInZone && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-emerald-200/60 bg-emerald-50/60 px-3 py-2 text-sm font-medium leading-relaxed text-emerald-800">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#179237]" />
                    Great, your location is within the pickup zone.
                  </p>
                )}
              </div>
            )}
            {group(zones.length > 0 ? 'Pickup zones' : 'Pickup points', 'car', zones)}
            {group('Pickup points', 'pin', spots)}
            {meetingPoint && (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <Compass className="size-3" /> Meeting point
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{pointDisplayName(meetingPoint)}</p>
                {meetingPoint.address && meetingPoint.address !== meetingPoint.name && (
                  <p className="truncate text-xs text-slate-500">{meetingPoint.address}</p>
                )}
              </div>
            )}
            {tour.pickupDescription && (
              <p className="px-1 text-xs leading-relaxed text-slate-400">{tour.pickupDescription}</p>
            )}
            </div>
          </div>

          {/* Map panel — min-w-0 so the row layout never overflows sideways.
              On mobile it fills the whole body height (the list sheet drops
              over it from the top); on desktop it keeps the fixed tall
              height. */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50/60">
            <div className="relative min-h-0 flex-1 md:min-h-[560px] md:p-4">
              {loading ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400">
                  <Loader2 className="size-4 animate-spin" />
                  Loading pickup locations…
                </div>
              ) : mapTour ? (
                <MapErrorBoundary>
                <LocationMap
                  tour={mapTour as PickupZoneMapTour}
                  mapHeight="h-full md:h-[560px]"
                  userMarker={
                    dragPreview
                      ? { lat: dragPreview.lat, lng: dragPreview.lng }
                      : searchMarker
                        ? { lat: searchMarker.lat, lng: searchMarker.lng }
                        : pointSelected
                          ? null
                          : selected && selected.lat != null && selected.lng != null
                            ? { lat: selected.lat, lng: selected.lng }
                            : multiplePickups
                              ? null
                              : { lat: contact.pickupLat, lng: contact.pickupLng }
                  }
                  userOutOfRange={mapUserOutOfRange}
                  userChosen={!!(searchMarker || (selected && !pointSelected && selected.lat != null && selected.lng != null) || (contact.pickupLat != null && !pointSelected))}
                  selectedPin={selectedPin}
                  selectedPinLabel={selectedPinLabel}
                  suppressDraggablePin={multiplePickups}
                  focusPoint={focusPoint}
                  onUserPointChange={(lat, lng) => handleDragEnd(lat, lng)}
                  onPinClick={handlePinClick}
                />
                </MapErrorBoundary>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  No pickup locations configured.
                </div>
              )}

              {/* Dragged blue pin → confirm before committing the location.
                  Drops outside the supplier's pickup zone show an inline
                  error and cannot be confirmed. */}
              {dragPreview && (
                <div className="pointer-events-none absolute inset-x-0 bottom-2 z-40 flex justify-center px-3">
                  <div
                    className={`pointer-events-auto w-full max-w-sm rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur-sm ${
                      dragOutOfRange ? 'border-slate-200 shadow-slate-900/5' : 'border-blue-200 shadow-blue-900/10'
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-800">Use this as your pickup location?</p>
                    {dragOutOfRange ? (
                      <div>
                        <p className="mt-1.5 flex items-start gap-1.5 text-sm font-medium leading-relaxed text-rose-600">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" />
                          This location is out of range from the pickup zone — choose a location inside the zone.
                        </p>
                        <p className="mt-1.5 text-xs font-medium leading-relaxed text-amber-700">
                          Kindly choose a pickup area later and ensure you update the pickup location before the tour date.
                        </p>
                        <label className="mt-2 flex cursor-pointer items-start gap-2">
                          <input
                            type="checkbox"
                            onChange={() => handlePickupLater()}
                            className="mt-0.5 size-4 shrink-0 rounded border-slate-300 bg-white text-[#179237] accent-[#179237] [color-scheme:light] focus:ring-[#179237]/20"
                          />
                          <span className="text-sm font-medium text-slate-700">Choose a pickup location later</span>
                        </label>
                      </div>
                    ) : (
                      <div>
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium break-words text-blue-700">
                          {dragAddress ? (
                            <>
                              <MapPin className="size-3.5 shrink-0" />
                              {dragAddress}
                            </>
                          ) : (
                            <>
                              <Loader2 className="size-3.5 shrink-0 animate-spin" />
                              Looking up address…
                            </>
                          )}
                        </p>
                        {geofenced && (
                          <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-emerald-200/60 bg-emerald-50/60 px-2.5 py-1.5 text-xs font-medium leading-relaxed text-emerald-800">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-[#179237]" />
                            Great, your location is within the pickup zone.
                          </p>
                        )}
                      </div>
                    )}
                    <div className="mt-2.5 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelDrag}
                        aria-label="Cancel dragged location"
                        className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={confirmDrag}
                        disabled={dragOutOfRange}
                        aria-label="Confirm dragged location"
                        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors ${
                          dragOutOfRange
                            ? 'cursor-not-allowed bg-slate-300'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        <Check className="size-3.5" />
                        Confirm
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Selection preview */}
            {searchMarker && !selected && !searchOutOfRange && (
              <div className="flex items-start gap-2 border-t border-slate-100 bg-emerald-50/50 px-4 py-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-[#179237]" />
                <div className="min-w-0 flex-1 text-xs text-emerald-900">
                  <p className="font-semibold">{searchQuery || addressPreview}</p>
                  {addressPreview && (
                    <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-emerald-700/70">
                      <MapPin className="size-3" />
                      {searchMarker.lat.toFixed(5)}, {searchMarker.lng.toFixed(5)}
                    </p>
                  )}
                </div>
              </div>
            )}
            {selected && selected.lat != null && selected.lng != null && (
              <div className="flex items-start gap-2 border-t border-slate-100 bg-emerald-50/50 px-4 py-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-[#179237]" />
                <div className="min-w-0 flex-1 text-xs text-emerald-900">
                  <p className="font-semibold">{pointDisplayName(selected)}</p>
                  {addressPreview && addressPreview !== pointDisplayName(selected) ? (
                    <p className="truncate text-emerald-700">{addressPreview}</p>
                  ) : (
                    <p className="mt-0.5 font-mono text-[10px] text-emerald-700/70">
                      {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Directions to the chosen pickup point (multi-pickup tours) —
                Google/Apple Maps deep-links to the selection. */}
            {directionsDestination && <DirectionsPanel destination={directionsDestination} />}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5">
          <button
            type="button"
            onClick={handlePickupLater}
            className="text-sm font-medium text-slate-500 underline underline-offset-2 transition-colors hover:text-slate-700"
          >
            Choose pickup location later
          </button>
          <motion.button
            type="button"
            onClick={handleSelect}
            disabled={!canConfirm}
            whileTap={{ scale: canConfirm ? 0.97 : 1 }}
            className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold shadow-sm transition ${
              canConfirm
                ? 'bg-emerald-600 text-white hover:brightness-110 cursor-pointer'
                : 'cursor-not-allowed bg-slate-200 text-white'
            }`}
          >
            <Check className="size-4" />
            Select
          </motion.button>
        </div>

        {/* Pickup-point confirmation popup (multi-pickup tours) — the choice
            only lands on the booking form after the traveller says yes. */}
        {pendingPoint && (
          <motion.div
            className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPendingPoint(null)}
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-[#179237]">
                  <MapPin className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">Do you want this to be your pickup point?</p>
                  {/* Full tooltip label (name || address), never truncated. */}
                  <p className="mt-1 text-sm font-medium break-words text-emerald-700">{pointDisplayName(pendingPoint)}</p>
                  {pendingPoint.address && pendingPoint.address !== pendingPoint.name && (
                    <p className="mt-0.5 text-xs leading-relaxed break-words text-slate-500">{pendingPoint.address}</p>
                  )}
                  {pendingPoint.time && (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      <Clock className="size-3" />
                      Pickup {compactTime(pendingPoint.time)}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingPoint(null)}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={confirmPendingPoint}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  <Check className="size-4" />
                  Yes, this is it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}
