import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, MapPin, Loader2, AlertTriangle, RefreshCw, Check, X, Pencil, LocateFixed } from 'lucide-react'
import { toast } from 'sonner'
import { useLocationAutocomplete, type LocationSuggestion } from '../../hooks/useLocationAutocomplete'
import { reverseGeocode } from '../../lib/locations'

interface LocationPickerProps {
  value: string
  onChange: (value: string) => void
  /** Emits the selected suggestion's coordinates, or (null, null) when cleared / typed manually. */
  onCoordsChange?: (lat: number | null, lng: number | null) => void
  onBlur?: () => void
  valid?: boolean
  error?: string
  placeholder?: string
  disabled?: boolean
  /** Minimal mode: hides the selected location card, "Use my current location" button, and attribution. */
  minimal?: boolean
  /** True when the current value is a confirmed selection (e.g. a green pickup
      point tapped on the map) — the input shows the tick instead of the
      clear × until the traveller edits the text. */
  confirmed?: boolean
}

/**
 * Location picker for the booking form. Suggestions come from Geoapify
 * straight from the browser (client-side VITE_GEOAPIFY_API_KEY, OSM data),
 * with the backend location service (GET /api/locations/autocomplete) as a
 * fallback — plus a "use my current location" button (geolocation → reverse
 * geocode).
 *
 * Emits the human-readable formatted label only — coordinates stay client-side
 * (numeric coords must never enter the travelers payload).
 */
export default function LocationPicker({
  value,
  onChange,
  onCoordsChange,
  onBlur,
  valid,
  error,
  placeholder = 'e.g. Accra, Ghana',
  disabled,
  minimal,
  confirmed,
}: LocationPickerProps) {
  const { search, retry, clear, results, loading, error: searchError } = useLocationAutocomplete()

  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [selected, setSelected] = useState<LocationSuggestion | null>(null)
  const [locating, setLocating] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const onChangeRef = useRef(onChange)
  const onCoordsChangeRef = useRef(onCoordsChange)
  useEffect(() => {
    onChangeRef.current = onChange
    onCoordsChangeRef.current = onCoordsChange
  })

  // Keep the local input value in sync when the parent restores it (e.g.
  // draft reload). React-recommended "adjust state during render" pattern,
  // guarded so it only runs on the value transition.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setQuery(value)
  }

  // Close dropdown on outside click.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const commit = useCallback((suggestion: LocationSuggestion) => {
    setSelected(suggestion)
    setQuery(suggestion.formatted)
    setOpen(false)
    setHighlightedIndex(-1)
    onChangeRef.current(suggestion.formatted)
    onCoordsChangeRef.current?.(suggestion.latitude ?? null, suggestion.longitude ?? null)
  }, [])

  // "Use my current location": geolocation → coords; the address is
  // reverse-geocoded through the backend location service (Geoapify-first).
  const handleUseMyLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocation is not supported on this device.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        const r = await reverseGeocode(latitude, longitude)
        const address = r?.formatted ?? ''
        const label = address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        setSelected({ formatted: label, latitude, longitude, city: '', country: '', region: '' })
        setQuery(label)
        setOpen(false)
        setHighlightedIndex(-1)
        onChangeRef.current(label)
        onCoordsChangeRef.current?.(latitude, longitude)
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — enable location access to use your current position.'
            : 'Could not get your current location. Please try again.',
        )
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  }, [])

  // Manual fallback: when the location isn't in the suggestion list, the user
  // can commit exactly what they typed as their pickup location.
  const commitManual = useCallback((value: string) => {
    const v = value.trim()
    setSelected(null)
    setQuery(v)
    setOpen(false)
    setHighlightedIndex(-1)
    onChangeRef.current(v)
    // A manually typed location has no coordinates to pin on the map.
    onCoordsChangeRef.current?.(null, null)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    onChangeRef.current(v)
    setHighlightedIndex(-1)
    if (v.trim().length >= 3) {
      search(v)
      setOpen(true)
    } else {
      clear()
      setOpen(false)
    }
  }

  const handleSelect = (result: { formatted: string; latitude: number | null; longitude: number | null; city: string; country: string; region: string }) => {
    commit({
      formatted: result.formatted,
      latitude: result.latitude ?? null,
      longitude: result.longitude ?? null,
      city: result.city || '',
      country: result.country || '',
      region: result.region || '',
    })
  }

  const handleClear = () => {
    setSelected(null)
    setQuery('')
    onChangeRef.current('')
    onCoordsChangeRef.current?.(null, null)
    clear()
    setOpen(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    switch (e.key) {
      case 'ArrowDown':
        if (results.length === 0) break
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        if (results.length === 0) break
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        // No suggestions available → commit the manually typed location.
        if (results.length === 0) {
          if (query.trim().length >= 2) commitManual(query)
          break
        }
        if (highlightedIndex >= 0) {
          handleSelect(results[highlightedIndex])
        } else if (
          results[0] &&
          results[0].formatted.toLowerCase().includes(query.trim().toLowerCase())
        ) {
          // Dropdown open with nothing highlighted: pressing Enter after
          // typing an address must resolve coordinates (and get a real zone
          // verdict) instead of silently doing nothing. Commit the top
          // suggestion only when it actually contains what the traveller
          // typed, so a bad first hit never pins a different place.
          handleSelect(results[0])
        }
        break
      case 'Escape':
        setOpen(false)
        setHighlightedIndex(-1)
        break
      default:
        break
    }
  }

  // Keep the highlighted option visible.
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex]
      if (item) item.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex])

  const inputClass = `w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 ${
    error
      ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
      : valid
        ? 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100'
        : 'border-slate-200 focus:border-[#179237] focus:ring-[#179237]/15'
  } ${disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400' : ''}`

  const sub = (s: LocationSuggestion) => [s.city, s.region, s.country].filter(Boolean).join(', ')

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
          }}
          disabled={disabled}
          placeholder={placeholder}
          className={`${inputClass} pl-10 pr-9`}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={open ? 'location-listbox' : undefined}
          aria-activedescendant={highlightedIndex >= 0 ? `location-option-${highlightedIndex}` : undefined}
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-[#179237]" />
        ) : confirmed ? (
          <Check className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-emerald-500" />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear location"
          >
            <X size={14} />
          </button>
        ) : valid ? (
          <Check className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-emerald-500" />
        ) : null}
      </div>

      {error && (
        <p className={`mt-1 text-sm font-medium ${error.includes('out of range from the pickup zone') ? 'text-rose-600' : 'text-slate-600'}`}>{error}</p>
      )}

      {/* Use my current location — geolocation → reverse geocode. */}
      {!minimal && (
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating || disabled}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-[#179237]/50 hover:text-[#179237] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {locating ? <Loader2 size={13} className="animate-spin text-[#179237]" /> : <LocateFixed size={13} className="text-[#179237]" />}
          {locating ? 'Locating…' : 'Use my current location'}
        </button>
      )}

      {/* Geoapify suggestions dropdown. */}
      {open && (
        <div className="relative z-20">
          <ul
            id="location-listbox"
            ref={listRef}
            role="listbox"
            className="absolute z-30 mt-1 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/60"
            style={{ maxHeight: 240 }}
          >
            {loading && (
              <li className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin text-[#179237]" />
                Searching locations…
              </li>
            )}
            {!loading && searchError && (
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
            {!loading &&
              results.map((r, index) => (
                <li
                  key={`${r.source}-${index}`}
                  id={`location-option-${index}`}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  onClick={() => handleSelect(r)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`cursor-pointer px-4 py-2.5 text-sm ${
                    index === highlightedIndex ? 'bg-emerald-50 text-emerald-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.formatted}</div>
                      {sub({ city: r.city, region: r.region, country: r.country, formatted: r.formatted, latitude: r.latitude, longitude: r.longitude }) && (
                        <div className="truncate text-xs text-slate-400">
                          {sub({ city: r.city, region: r.region, country: r.country, formatted: r.formatted, latitude: r.latitude, longitude: r.longitude })}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            {/* Manual fallback: whenever the user has typed a location, let them
                commit exactly what they typed — even when autocomplete returned
                nothing or the lookup failed. */}
            {!loading && query.trim().length >= 3 && (
              <li
                role="option"
                aria-selected={highlightedIndex === results.length}
                onClick={() => commitManual(query)}
                onMouseEnter={() => setHighlightedIndex(results.length)}
                className={`cursor-pointer border-t border-slate-100 px-4 py-3 text-sm ${
                  highlightedIndex === results.length ? 'bg-emerald-50 text-emerald-900' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <Pencil size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">Use “{query.trim()}” as your pickup location</div>
                    <div className="mt-0.5 text-xs text-slate-400">Not in the list? We’ll use exactly what you typed.</div>
                  </div>
                </div>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Selected location summary */}
      {!minimal && query && !open && !error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-3 py-2.5">
          <MapPin size={14} className="mt-0.5 shrink-0 text-[#179237]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-emerald-900">{query}</p>
            {selected?.latitude != null && selected?.longitude != null && (
              <p className="mt-0.5 font-mono text-[10px] text-emerald-700/70">
                {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded p-1 text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
            aria-label="Clear location"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {!minimal && (
        <p className="text-[10px] text-slate-400">
          Location data ©{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-slate-600"
          >
            OpenStreetMap
          </a>{' '}
          contributors
        </p>
      )}
    </div>
  )
}
