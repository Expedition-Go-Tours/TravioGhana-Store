import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PickupLocationSection, { type PickupLocationSectionTour } from './PickupLocationSection'
import type { ResolvedTourPoint } from '@/lib/resolvePoints'

vi.mock('./LocationMap', () => ({ default: () => <div data-testid="location-map" /> }))
vi.mock('./LocationPicker', () => ({ default: () => <input placeholder="Search for hotel, address, etc." /> }))
vi.mock('./TravelTimeChip', () => ({ default: () => null }))
vi.mock('./OutOfRangeDistance', () => ({
  default: ({ message, tone }: { message: string; tone?: string }) => (
    <div data-testid="out-of-range" data-tone={tone}>
      {message}
    </div>
  ),
}))

const DRAWN_ZONE: [number, number][] = [
  [5.55, -0.2],
  [5.57, -0.2],
  [5.57, -0.17],
  [5.55, -0.17],
]

const baseContact = { location: '', pickupLater: false, pickupLat: null, pickupLng: null, pickupArea: '' }

const baseProps = {
  contact: baseContact,
  onContactChange: vi.fn(),
  locationValid: true,
  touched: {},
  onSetTouched: vi.fn(),
  resolvingPoints: false,
  onOpenMap: vi.fn(),
}

function point(id: string, name: string, lat: number, lng: number): ResolvedTourPoint {
  return { id, kind: 'point', name, address: `${name}, Accra, Ghana`, lat, lng, query: '' }
}

describe('PickupLocationSection', () => {
  it('renders a single pickup point read-only — no search, no radio — and auto-fills it', () => {
    const onContactChange = vi.fn()
    const tour: PickupLocationSectionTour = {
      meetingMode: 'pickup',
      pickupType: 'address',
      pickupLocations: [{ name: 'Kotoka Airport', address: 'Kotoka Airport, Accra', lat: 5.605, lng: -0.166 }],
    }
    render(
      <PickupLocationSection
        {...baseProps}
        tour={tour}
        onContactChange={onContactChange}
        resolvedPoints={[point('p0', 'Kotoka Airport', 5.605, -0.166)]}
        mapTour={tour}
      />,
    )

    expect(screen.getByText('Your pickup point')).toBeInTheDocument()
    expect(screen.getByText(/single designated pickup point/i)).toBeInTheDocument()
    // No selection affordances.
    expect(screen.queryByPlaceholderText('Search for hotel, address, etc.')).not.toBeInTheDocument()
    expect(screen.queryByText(/Yes, I can add it now/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/I don't know yet/i)).not.toBeInTheDocument()
    // The fixed point is written into the booking automatically.
    expect(onContactChange).toHaveBeenCalledWith('pickupLat', 5.605)
    expect(onContactChange).toHaveBeenCalledWith('pickupLng', -0.166)
    expect(onContactChange).toHaveBeenCalledWith('location', 'Kotoka Airport')
  })

  it('shows the zone how-to message for a single-zone tour', () => {
    const tour: PickupLocationSectionTour = {
      meetingMode: 'pickup',
      pickupType: 'area',
      pickupAreas: [{ name: 'Osu', polygon: DRAWN_ZONE }],
    }
    render(
      <PickupLocationSection
        {...baseProps}
        tour={tour}
        resolvedPoints={[{ id: 'z0', kind: 'zone', name: 'Osu', address: 'Osu, Accra', lat: 5.56, lng: -0.185, polygon: DRAWN_ZONE, query: '' }]}
        mapTour={tour}
      />,
    )

    expect(screen.getByText(/picks up within a specific zone/i)).toBeInTheDocument()
    expect(screen.getByText(/Yes, I can add it now/i)).toBeInTheDocument()
  })

  it('shows the pickup-points how-to message for a multipoint tour', () => {
    const tour: PickupLocationSectionTour = {
      meetingMode: 'pickup',
      pickupType: 'address',
      pickupLocations: [
        { name: 'Kotoka Airport', address: 'Kotoka Airport, Accra', lat: 5.605, lng: -0.166 },
        { name: 'Accra Mall', address: 'Accra Mall, Accra', lat: 5.62, lng: -0.173 },
      ],
    }
    render(
      <PickupLocationSection
        {...baseProps}
        tour={tour}
        resolvedPoints={[point('p0', 'Kotoka Airport', 5.605, -0.166), point('p1', 'Accra Mall', 5.62, -0.173)]}
        mapTour={tour}
      />,
    )

    expect(screen.getByText(/has 2 pickup points/i)).toBeInTheDocument()
    expect(screen.getByText(/only available at these points/i)).toBeInTheDocument()
  })

  it('shows an amber caution (not a block) when the address is outside the zone', () => {
    const tour: PickupLocationSectionTour = {
      meetingMode: 'pickup',
      pickupType: 'area',
      pickupAreas: [{ name: 'Osu', polygon: DRAWN_ZONE }],
    }
    render(
      <PickupLocationSection
        {...baseProps}
        tour={tour}
        contact={{ ...baseContact, location: 'Ejisu', pickupLat: 6.7, pickupLng: -1.6 }}
        resolvedPoints={[{ id: 'z0', kind: 'zone', name: 'Osu', address: 'Osu, Accra', lat: 5.56, lng: -0.185, polygon: DRAWN_ZONE, query: '' }]}
        mapTour={tour}
      />,
    )

    fireEvent.click(screen.getByText(/Yes, I can add it now/i))
    const card = screen.getByTestId('out-of-range')
    expect(card).toHaveAttribute('data-tone', 'warning')
    expect(card).toHaveTextContent(/remember to choose a pickup location within the pickup zone/i)
  })
})
