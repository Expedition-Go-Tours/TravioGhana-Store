import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import MeetingDirections from './MeetingDirections'
import { useLocationSharing } from '../../hooks/useLocationSharing'
import { reverseGeocode } from '../../lib/locations'

vi.mock('../../hooks/useLocationSharing', () => ({ useLocationSharing: vi.fn() }))
vi.mock('../../lib/locations', () => ({ reverseGeocode: vi.fn() }))

const mockUseLocationSharing = vi.mocked(useLocationSharing)
const mockReverseGeocode = vi.mocked(reverseGeocode)

const DESTINATION = { lat: 5.5473, lng: -0.1866, label: 'Independence Arch' }

function state(overrides: Partial<ReturnType<typeof useLocationSharing>> = {}): ReturnType<typeof useLocationSharing> {
  return {
    enabled: false,
    permission: 'prompt',
    status: 'idle',
    coords: null,
    enable: vi.fn(),
    disable: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockReverseGeocode.mockResolvedValue({
    formatted: 'Accra, Ghana',
    latitude: null,
    longitude: null,
    city: '',
    country: '',
    region: '',
  })
})

describe('MeetingDirections', () => {
  it('renders nothing without a destination', () => {
    mockUseLocationSharing.mockReturnValue(state())
    const { container } = render(<MeetingDirections destination={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('gates the maps links until the traveller turns location on', () => {
    const enable = vi.fn()
    mockUseLocationSharing.mockReturnValue(state({ enable }))

    render(<MeetingDirections destination={DESTINATION} />)

    expect(screen.queryByRole('link', { name: /Open in Google Maps/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Apple Maps/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Turn on location to get directions from where you are/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Turn on location/ }))
    expect(enable).toHaveBeenCalledTimes(1)
  })

  it('renders origin-bearing links and reports the location once sharing is ready', async () => {
    const onLocationResolved = vi.fn()
    mockUseLocationSharing.mockReturnValue(state({
      enabled: true,
      permission: 'granted',
      status: 'ready',
      coords: { lat: 5.6037, lng: -0.187 },
    }))

    render(<MeetingDirections destination={DESTINATION} onLocationResolved={onLocationResolved} />)

    const googleLink = screen.getByRole('link', { name: /Open in Google Maps/ })
    const appleLink = screen.getByRole('link', { name: /Apple Maps/ })

    expect(googleLink).toHaveAttribute(
      'href',
      expect.stringContaining('https://www.google.com/maps/dir/?api=1&destination=5.5473,-0.1866'),
    )
    expect(googleLink).toHaveAttribute('href', expect.stringContaining('origin=5.6037,-0.187'))
    expect(appleLink).toHaveAttribute('href', expect.stringContaining('saddr=5.6037,-0.187'))
    expect(screen.getByText('from your current location')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText(/Your location: Accra, Ghana/)).toBeInTheDocument())
    expect(onLocationResolved).toHaveBeenCalledWith({ lat: 5.6037, lng: -0.187, address: 'Accra, Ghana' })
  })

  it('turning off hides the links and turns sharing off', async () => {
    const disable = vi.fn()
    mockUseLocationSharing.mockReturnValue(state({
      enabled: true,
      permission: 'granted',
      status: 'ready',
      coords: { lat: 5.6037, lng: -0.187 },
      disable,
    }))

    render(<MeetingDirections destination={DESTINATION} />)

    // Let the reverse-geocode effect settle before interacting.
    await waitFor(() => expect(screen.getByText(/Your location: Accra, Ghana/)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('switch', { name: /Turn off location sharing/ }))
    expect(disable).toHaveBeenCalledTimes(1)
  })

  it('shows blocked guidance (and no links) when the browser denied access', () => {
    const retry = vi.fn()
    mockUseLocationSharing.mockReturnValue(state({ permission: 'denied', status: 'denied', retry }))

    render(<MeetingDirections destination={DESTINATION} />)

    expect(screen.getByText(/Location access is blocked/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open in Google Maps/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('explains when the device has no geolocation support', () => {
    mockUseLocationSharing.mockReturnValue(state({ permission: 'unsupported', status: 'unsupported' }))

    render(<MeetingDirections destination={DESTINATION} />)

    expect(screen.getByText(/Location isn’t available on this device/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Turn on location/ })).toBeDisabled()
    expect(screen.queryByRole('link', { name: /Open in Google Maps/ })).not.toBeInTheDocument()
  })
})
