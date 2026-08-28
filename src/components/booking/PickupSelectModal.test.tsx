import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import PickupSelectModal from './PickupSelectModal'
import { useLocationAutocomplete } from '@/hooks/useLocationAutocomplete'
import type { LocationResult } from '@/hooks/useLocationAutocomplete'

vi.mock('@/hooks/useLocationAutocomplete', () => ({
  useLocationAutocomplete: vi.fn(() => ({
    search: vi.fn(),
    retry: vi.fn(),
    clear: vi.fn(),
    results: [],
    loading: false,
    error: null,
  })),
}))

// Capture the props handed to LocationMap so tests can fire the map's
// onUserPointChange (the drag handler) exactly like the real map would.
const { mapProps } = vi.hoisted(() => ({
  mapProps: { current: {} as Record<string, unknown> },
}))
vi.mock('./LocationMap', () => ({
  default: (props: Record<string, unknown>) => {
    mapProps.current = props
    return <div data-testid="location-map" />
  },
}))

const mockAutocomplete = vi.mocked(useLocationAutocomplete)

const searchResult: LocationResult = {
  formatted: 'Accra Mall, Spintex Road, Accra, Ghana',
  latitude: 5.6199791,
  longitude: -0.1731861,
  city: 'Accra',
  country: 'Ghana',
  region: 'Greater Accra Region',
  countryCode: 'gh',
  postcode: null,
  street: 'Spintex Road',
  housenumber: null,
  category: null,
  source: 'geoapify',
  confidence: 0.9,
}

const baseProps = {
  open: true,
  onClose: vi.fn(),
  tour: { meetingMode: 'pickup' as const },
  points: [],
  mapTour: {},
  contact: { location: '', pickupLater: false, pickupLat: null, pickupLng: null, pickupArea: '' },
  onContactChange: vi.fn(),
  loading: false,
}

// A drawn zone square around (5.55–5.57, -0.2–-0.17) — geofenced tour.
const DRAWN_ZONE: [number, number][] = [
  [5.55, -0.2],
  [5.57, -0.2],
  [5.57, -0.17],
  [5.55, -0.17],
]
const zonePoint = {
  id: 'zone-0',
  kind: 'zone' as const,
  name: 'Osu',
  address: 'Osu, Accra, Ghana',
  lat: 5.56,
  lng: -0.185,
  polygon: DRAWN_ZONE,
  query: '',
}

const outsideSearchResult: LocationResult = {
  ...searchResult,
  formatted: 'Somewhere Far, Ghana',
  latitude: 5.9,
  longitude: -0.5,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAutocomplete.mockReturnValue({
    search: vi.fn(),
    retry: vi.fn(),
    clear: vi.fn(),
    results: [searchResult],
    loading: false,
    error: null,
  })
})

describe('PickupSelectModal search', () => {
  it('runs the Geoapify search on typing and shows suggestions', () => {
    render(<PickupSelectModal {...baseProps} />)
    const input = screen.getByPlaceholderText('Search for your address…')

    fireEvent.change(input, { target: { value: 'Accra Mall' } })

    expect(mockAutocomplete().search).toHaveBeenCalledWith('Accra Mall')
    expect(screen.getByText('Accra Mall, Spintex Road, Accra, Ghana')).toBeInTheDocument()
  })

  it('pins the selected suggestion and commits it on Select', () => {
    const onContactChange = vi.fn()
    const onClose = vi.fn()
    render(<PickupSelectModal {...baseProps} onContactChange={onContactChange} onClose={onClose} />)
    const input = screen.getByPlaceholderText('Search for your address…')

    fireEvent.change(input, { target: { value: 'Accra Mall' } })
    fireEvent.click(screen.getByText('Accra Mall, Spintex Road, Accra, Ghana'))

    // The search box empties once the location is selected — the selection
    // shows in the left-panel "Your location" row instead.
    expect(input).toHaveValue('')

    const select = screen.getByRole('button', { name: /Select/ })
    expect(select).not.toBeDisabled()
    fireEvent.click(select)

    expect(onContactChange).toHaveBeenCalledWith('pickupArea', '')
    expect(onContactChange).toHaveBeenCalledWith('location', 'Accra Mall, Spintex Road, Accra, Ghana')
    expect(onContactChange).toHaveBeenCalledWith('pickupLat', 5.6199791)
    expect(onContactChange).toHaveBeenCalledWith('pickupLng', -0.1731861)
    expect(onClose).toHaveBeenCalled()
  })

  it('asks for confirmation when the blue pin is dragged and commits on Confirm', () => {
    render(<PickupSelectModal {...baseProps} />)
    const onUserPointChange = mapProps.current.onUserPointChange as (lat: number, lng: number) => void

    fireEvent.change(screen.getByPlaceholderText('Search for your address…'), { target: { value: 'x' } })
    expect(screen.queryByText('Use this as your pickup location?')).not.toBeInTheDocument()

    act(() => {
      onUserPointChange(5.62, -0.19)
    })
    expect(screen.getByText('Use this as your pickup location?')).toBeInTheDocument()

    // Cancel reverts the pin without committing.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel dragged location' }))
    expect(screen.queryByText('Use this as your pickup location?')).not.toBeInTheDocument()

    act(() => {
      onUserPointChange(5.62, -0.19)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm dragged location' }))
    expect(screen.getByText('Your location')).toBeInTheDocument()

    const select = screen.getByRole('button', { name: /Select/ })
    expect(select).not.toBeDisabled()
  })

  it('shows the pinned location in the left panel alongside the map pin', () => {
    render(<PickupSelectModal {...baseProps} />)
    const input = screen.getByPlaceholderText('Search for your address…')

    fireEvent.change(input, { target: { value: 'Accra Mall' } })
    fireEvent.click(screen.getByText('Accra Mall, Spintex Road, Accra, Ghana'))

    expect(screen.getByText('Your location')).toBeInTheDocument()
    // The address shows in the left-panel row and the bottom selection preview.
    expect(screen.getAllByText('Accra Mall, Spintex Road, Accra, Ghana').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('5.61998, -0.17319').length).toBeGreaterThanOrEqual(2)

    fireEvent.click(screen.getByLabelText('Remove your location'))
    expect(screen.queryByText('Your location')).not.toBeInTheDocument()
  })

  it('lets the traveller commit a manually typed address without coordinates', () => {
    mockAutocomplete.mockReturnValue({
      search: vi.fn(),
      retry: vi.fn(),
      clear: vi.fn(),
      results: [],
      loading: false,
      error: null,
    })
    const onContactChange = vi.fn()
    render(<PickupSelectModal {...baseProps} onContactChange={onContactChange} />)
    const input = screen.getByPlaceholderText('Search for your address…')

    fireEvent.change(input, { target: { value: 'Kaneshie Market, Accra' } })
    fireEvent.click(screen.getByText(/Use .* as your pickup location/))

    expect(input).toHaveValue('')

    const select = screen.getByRole('button', { name: /Select/ })
    expect(select).not.toBeDisabled()
    fireEvent.click(select)

    expect(onContactChange).toHaveBeenCalledWith('location', 'Kaneshie Market, Accra')
    expect(onContactChange).toHaveBeenCalledWith('pickupLat', null)
    expect(onContactChange).toHaveBeenCalledWith('pickupLng', null)
  })

  it('shows the pin tooltip name as the final location on multi-pickup tours', () => {
    const onContactChange = vi.fn()
    const onClose = vi.fn()
    render(
      <PickupSelectModal
        {...baseProps}
        onContactChange={onContactChange}
        onClose={onClose}
        points={[
          { id: 'zone-0', kind: 'zone', name: 'Osu', address: 'Osu, Accra, Ghana', lat: 5.56, lng: -0.18, query: '' },
          { id: 'zone-1', kind: 'zone', name: 'Labone', address: 'Labone, Accra, Ghana', lat: 5.57, lng: -0.17, query: '' },
        ]}
      />,
    )

    // Clicking the row selects it and zooms the map — no popup yet.
    fireEvent.click(screen.getByText('Osu'))
    expect(screen.queryByText('Do you want this to be your pickup point?')).not.toBeInTheDocument()

    // The popup only appears once the footer "Select" is pressed.
    fireEvent.click(screen.getByRole('button', { name: /Select/ }))
    expect(screen.getByText('Do you want this to be your pickup point?')).toBeInTheDocument()

    // Confirming commits the tooltip name as the traveler's pickup location.
    fireEvent.click(screen.getByRole('button', { name: /Yes, this is it/ }))
    expect(onContactChange).toHaveBeenCalledWith('pickupArea', 'Osu')
    expect(onContactChange).toHaveBeenCalledWith('location', '')
    expect(onClose).toHaveBeenCalled()
  })

  it('lands the pin tooltip name on the form via the footer Select too', () => {
    const onContactChange = vi.fn()
    render(
      <PickupSelectModal
        {...baseProps}
        onContactChange={onContactChange}
        points={[
          { id: 'zone-0', kind: 'zone', name: 'Labone', address: 'Labone, Accra, Ghana', lat: 5.57, lng: -0.17, query: '' },
        ]}
      />,
    )
    fireEvent.click(screen.getByText('Labone'))
    fireEvent.click(screen.getByRole('button', { name: /Select/ }))
    expect(onContactChange).toHaveBeenCalledWith('pickupArea', 'Labone')
  })

  it('hides the search bar and shows the options-only note on multi-pickup tours', () => {
    render(
      <PickupSelectModal
        {...baseProps}
        points={[
          { id: 'zone-0', kind: 'zone', name: 'Osu', address: 'Osu, Accra, Ghana', lat: 5.56, lng: -0.18, query: '' },
          { id: 'zone-1', kind: 'zone', name: 'Labone', address: 'Labone, Accra, Ghana', lat: 5.57, lng: -0.17, query: '' },
        ]}
      />,
    )
    expect(screen.queryByPlaceholderText('Search for your address…')).not.toBeInTheDocument()
    expect(screen.getByText(/These are the available pickup locations — please choose from those options only/i)).toBeInTheDocument()
  })

  it('rejects a blue-pin drop outside the pickup zone with an inline error', () => {
    render(<PickupSelectModal {...baseProps} points={[zonePoint]} />)
    const onUserPointChange = mapProps.current.onUserPointChange as (lat: number, lng: number) => void

    // Drop far outside the drawn zone square.
    act(() => {
      onUserPointChange(5.9, -0.5)
    })
    expect(screen.getByText(/out of range from the pickup zone/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm dragged location' })).toBeDisabled()

    // Drop inside the zone → the normal confirm flow is restored.
    act(() => {
      onUserPointChange(5.56, -0.185)
    })
    expect(screen.queryByText(/out of range from the pickup zone/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm dragged location' })).not.toBeDisabled()
  })

  it('shows an inline error when a searched address is outside the pickup zone', () => {
    mockAutocomplete.mockReturnValue({
      search: vi.fn(),
      retry: vi.fn(),
      clear: vi.fn(),
      results: [outsideSearchResult],
      loading: false,
      error: null,
    })
    render(<PickupSelectModal {...baseProps} points={[zonePoint]} />)
    const input = screen.getByPlaceholderText('Search for your address…')

    fireEvent.change(input, { target: { value: 'Somewhere Far' } })
    fireEvent.click(screen.getByText('Somewhere Far, Ghana'))

    expect(screen.getByText(/out of range from the pickup zone/i)).toBeInTheDocument()
    // Nothing was pinned/committed.
    expect(screen.queryByText('Your location')).not.toBeInTheDocument()
  })

  it('marks a tapped pickup point with the green check pin instead of the blue pin', () => {
    render(
      <PickupSelectModal
        {...baseProps}
        points={[
          { id: 'point-0', kind: 'point', name: 'Osu', address: 'Osu, Accra, Ghana', lat: 5.56, lng: -0.18, query: '' },
          { id: 'point-1', kind: 'point', name: 'Labone', address: 'Labone, Accra, Ghana', lat: 5.57, lng: -0.17, query: '' },
        ]}
      />,
    )

    const onPinClick = mapProps.current.onPinClick as (label: string) => void
    expect(onPinClick).toBeTypeOf('function')

    act(() => {
      onPinClick('Osu')
    })

    // The map receives the selected pin (green check-mark style) and no
    // blue user pin — the selection is marked by the highlighted green pin.
    expect(mapProps.current.selectedPinLabel).toBe('Osu')
    expect(mapProps.current.selectedPin).toEqual({ lat: 5.56, lng: -0.18, label: 'Osu' })
    expect(mapProps.current.suppressDraggablePin).toBe(true)
    expect(mapProps.current.userMarker).toBeNull()
    expect(mapProps.current.userChosen).toBe(false)
    // The map is asked to fly to the tapped point (zoom in).
    expect(mapProps.current.focusPoint).toEqual({ lat: 5.56, lng: -0.18 })
  })

  it('passes no selected pin label before any selection', () => {
    render(
      <PickupSelectModal
        {...baseProps}
        points={[
          { id: 'point-0', kind: 'point', name: 'Osu', address: 'Osu, Accra, Ghana', lat: 5.56, lng: -0.18, query: '' },
        ]}
      />,
    )
    expect(mapProps.current.selectedPinLabel).toBeNull()
    expect(mapProps.current.selectedPin).toBeNull()
    expect(mapProps.current.focusPoint).toBeNull()
  })

  it('zooms the map when a side-list location is clicked', () => {
    render(
      <PickupSelectModal
        {...baseProps}
        points={[
          { id: 'point-0', kind: 'point', name: 'Osu', address: 'Osu, Accra, Ghana', lat: 5.56, lng: -0.18, query: '' },
          { id: 'point-1', kind: 'point', name: 'Labone', address: 'Labone, Accra, Ghana', lat: 5.57, lng: -0.17, query: '' },
        ]}
      />,
    )

    // Click a left-side list row (e.g. "Labone") — the map must fly to it.
    fireEvent.click(screen.getByText('Labone'))
    expect(mapProps.current.focusPoint).toEqual({ lat: 5.57, lng: -0.17 })
  })

  it('shows the traveller’s confirmed pickup point when the map is reopened', () => {
    render(
      <PickupSelectModal
        {...baseProps}
        points={[
          { id: 'point-0', kind: 'point', name: 'Osu', address: 'Osu, Accra, Ghana', lat: 5.56, lng: -0.18, query: '' },
          { id: 'point-1', kind: 'point', name: 'Labone', address: 'Labone, Accra, Ghana', lat: 5.57, lng: -0.17, query: '' },
        ]}
        contact={{
          location: 'Osu',
          pickupLater: false,
          pickupLat: 5.56,
          pickupLng: -0.18,
          pickupArea: '',
        }}
      />,
    )

    // The map zooms straight to the confirmed spot and shows its green pin…
    expect(mapProps.current.focusPoint).toEqual({ lat: 5.56, lng: -0.18 })
    expect(mapProps.current.selectedPinLabel).toBe('Osu')
    expect(mapProps.current.selectedPin).toEqual({ lat: 5.56, lng: -0.18, label: 'Osu' })
    // …and the left list highlights it instead of leaving every row unchecked.
    expect(screen.getByRole('button', { name: /Osu/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows Google/Apple Maps deep-links when a multi-pickup point is selected', () => {
    render(
      <PickupSelectModal
        {...baseProps}
        points={[
          { id: 'point-0', kind: 'point', name: 'Osu', address: 'Osu, Accra, Ghana', lat: 5.56, lng: -0.18, query: '' },
          { id: 'point-1', kind: 'point', name: 'Labone', address: 'Labone, Accra, Ghana', lat: 5.57, lng: -0.17, query: '' },
        ]}
      />,
    )

    // The directions deep-links appear once a location is selected.
    fireEvent.click(screen.getByText('Osu'))
    const googleLink = screen.getByRole('link', { name: /Open in Google Maps/ })
    const appleLink = screen.getByRole('link', { name: /Apple Maps/ })

    expect(googleLink).toHaveAttribute('href', expect.stringContaining('destination=5.56,-0.18'))
    expect(appleLink).toHaveAttribute('href', expect.stringContaining('daddr=5.56,-0.18'))
    // No route is fetched or drawn on the map.
    expect(screen.queryByRole('button', { name: /Get directions/i })).not.toBeInTheDocument()
    expect(mapProps.current.route).toBeUndefined()
  })

  it('shows no directions control on single-point tours', () => {
    render(
      <PickupSelectModal
        {...baseProps}
        points={[
          { id: 'point-0', kind: 'point', name: 'Osu', address: 'Osu, Accra, Ghana', lat: 5.56, lng: -0.18, query: '' },
        ]}
      />,
    )

    // Directions are for multi-pickup (and meeting-point) tours — selecting the
    // single pickup point must NOT reveal the directions deep-links.
    fireEvent.click(screen.getByText('Osu'))
    expect(screen.queryByRole('link', { name: /Open in Google Maps/ })).not.toBeInTheDocument()
    expect(mapProps.current.route).toBeUndefined()
  })
})
