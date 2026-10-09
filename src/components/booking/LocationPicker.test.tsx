import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LocationPicker from './LocationPicker'
import { useLocationAutocomplete } from '../../hooks/useLocationAutocomplete'
import type { LocationResult } from '../../hooks/useLocationAutocomplete'
import { reverseGeocode } from '../../lib/locations'
import { searchGhanaLocations } from '../../lib/serpApiMapsSearch'

vi.mock('../../hooks/useLocationAutocomplete', () => ({
  useLocationAutocomplete: vi.fn(() => ({
    search: vi.fn(),
    retry: vi.fn(),
    clear: vi.fn(),
    results: [],
    loading: false,
    error: null,
  })),
}))

vi.mock('../../lib/locations', () => ({
  reverseGeocode: vi.fn(),
}))

vi.mock('../../lib/serpApiMapsSearch', () => ({
  searchGhanaLocations: vi.fn(),
}))

const mockAutocomplete = vi.mocked(useLocationAutocomplete)
const mockReverseGeocode = vi.mocked(reverseGeocode)
const mockSearchGhana = vi.mocked(searchGhanaLocations)

const sample: LocationResult = {
  formatted: 'Accra, Ghana',
  latitude: 5.6037,
  longitude: -0.187,
  city: 'Accra',
  country: 'Ghana',
  region: 'Greater Accra',
  countryCode: 'gh',
  postcode: null,
  street: 'Independence Ave',
  housenumber: null,
  category: null,
  source: 'geoapify',
  confidence: 1,
}

function renderPicker(overrides: Partial<Parameters<typeof LocationPicker>[0]> = {}) {
  const onChange = vi.fn()
  const onBlur = vi.fn()
  render(
    <LocationPicker
      value=""
      onChange={onChange}
      onBlur={onBlur}
      placeholder="e.g. Accra, Ghana"
      {...overrides}
    />,
  )
  return { onChange, onBlur }
}

beforeEach(() => {
  mockAutocomplete.mockReturnValue({
    search: vi.fn(),
    retry: vi.fn(),
    clear: vi.fn(),
    results: [sample],
    loading: false,
    error: null,
  })
  mockReverseGeocode.mockResolvedValue(null)
  mockSearchGhana.mockResolvedValue({ status: 'empty', results: [] })
})

describe('LocationPicker', () => {
  it('shows suggestions and emits the formatted label on select', () => {
    const { onChange } = renderPicker()
    const input = screen.getByPlaceholderText('e.g. Accra, Ghana')

    fireEvent.change(input, { target: { value: 'Acc' } })
    expect(screen.getByText('Accra, Ghana')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Accra, Ghana'))
    expect(onChange).toHaveBeenCalledWith('Accra, Ghana')
  })

  it('selects a suggestion on the first click — mousedown must not blur the input (no mid-click dropdown shift)', () => {
    const { onChange } = renderPicker()
    const input = screen.getByPlaceholderText('e.g. Accra, Ghana')

    fireEvent.change(input, { target: { value: 'Acc' } })

    const option = screen.getByText('Accra, Ghana')
    const capturedEvents: MouseEvent[] = []
    const capture = (e: MouseEvent) => {
      capturedEvents.push(e)
    }
    window.addEventListener('mousedown', capture)
    fireEvent.mouseDown(option)
    window.removeEventListener('mousedown', capture)

    // The browser would normally move focus off the input on this mousedown
    // (firing blur → onBlur → error row insertion that shifts the dropdown and
    // swallows the following click). The option prevents that default so a
    // single click commits the selection.
    expect(capturedEvents.at(-1)?.defaultPrevented).toBe(true)

    expect(onChange).toHaveBeenCalledTimes(1) // only the typed keystroke so far
    fireEvent.click(option)
    // Exactly one more call — the suggestion commit (not a lost first click).
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith('Accra, Ghana')
  })

  it('forwards every keystroke to onChange', () => {
    const { onChange } = renderPicker()
    const input = screen.getByPlaceholderText('e.g. Accra, Ghana')

    fireEvent.change(input, { target: { value: 'Acc' } })
    expect(onChange).toHaveBeenCalledWith('Acc')
  })

  it('shows error styling when invalid', () => {
    renderPicker({ error: 'Please enter your pickup location' })
    const input = screen.getByPlaceholderText('e.g. Accra, Ghana')
    expect(input.className).toContain('border-rose-300')
    expect(screen.getByText('Please enter your pickup location')).toBeInTheDocument()
  })

  it('lets the user use a manually typed location when there are no suggestions', () => {
    mockAutocomplete.mockReturnValue({
      search: vi.fn(),
      retry: vi.fn(),
      clear: vi.fn(),
      results: [],
      loading: false,
      error: null,
    })
    const { onChange } = renderPicker()
    const input = screen.getByPlaceholderText('e.g. Accra, Ghana')

    fireEvent.change(input, { target: { value: 'Kaneshie Market, Accra' } })
    fireEvent.click(screen.getByText(/Use .* as your pickup location/))

    expect(onChange).toHaveBeenCalledWith('Kaneshie Market, Accra')
  })

  it('commits a manually typed location on Enter when there are no suggestions', () => {
    mockAutocomplete.mockReturnValue({
      search: vi.fn(),
      retry: vi.fn(),
      clear: vi.fn(),
      results: [],
      loading: false,
      error: null,
    })
    const { onChange } = renderPicker()
    const input = screen.getByPlaceholderText('e.g. Accra, Ghana')

    fireEvent.change(input, { target: { value: 'Osu, Accra' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('Osu, Accra')
  })

  it('renders the "Use my current location" button (geolocation entry point)', () => {
    renderPicker()
    expect(screen.getByRole('button', { name: 'Use my current location' })).toBeInTheDocument()
  })

  it('places a pin from a pasted Google Maps link and emits its coordinates', async () => {
    mockAutocomplete.mockReturnValue({
      search: vi.fn(),
      retry: vi.fn(),
      clear: vi.fn(),
      results: [],
      loading: false,
      error: null,
    })
    mockReverseGeocode.mockResolvedValueOnce(null)
    const onChange = vi.fn()
    const onCoordsChange = vi.fn()
    renderPicker({ onChange, onCoordsChange })

    const input = screen.getByPlaceholderText('e.g. Accra, Ghana')
    fireEvent.change(input, { target: { value: 'Kaneshie Market' } })
    fireEvent.click(screen.getByText(/Paste a Google Maps link/))

    const textarea = screen.getByLabelText('Google Maps link')
    fireEvent.change(textarea, {
      target: { value: 'https://www.google.com/maps/place/Kaneshie+Market/@5.5735,-0.2456,17z' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Place Pin/ }))

    await waitFor(() => expect(onCoordsChange).toHaveBeenCalledWith(5.5735, -0.2456))
    expect(onChange).toHaveBeenLastCalledWith('Kaneshie Market')
    // The panel closes once the pin is placed.
    expect(screen.queryByLabelText('Google Maps link')).not.toBeInTheDocument()
  })

  it('uses the reverse-geocoded address as the label when available', async () => {
    mockAutocomplete.mockReturnValue({
      search: vi.fn(),
      retry: vi.fn(),
      clear: vi.fn(),
      results: [],
      loading: false,
      error: null,
    })
    mockReverseGeocode.mockResolvedValueOnce({
      formatted: 'Kaneshie Market Road, Accra, Ghana',
      latitude: 5.5735,
      longitude: -0.2456,
      city: 'Accra',
      country: 'Ghana',
      region: 'Greater Accra Region',
    })
    const onChange = vi.fn()
    const onCoordsChange = vi.fn()
    renderPicker({ onChange, onCoordsChange })

    const input = screen.getByPlaceholderText('e.g. Accra, Ghana')
    fireEvent.change(input, { target: { value: 'Kaneshie Market' } })
    fireEvent.click(screen.getByText(/Paste a Google Maps link/))
    fireEvent.change(screen.getByLabelText('Google Maps link'), {
      target: { value: '5.5735, -0.2456' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Place Pin/ }))

    await waitFor(() => expect(onCoordsChange).toHaveBeenCalledWith(5.5735, -0.2456))
    expect(onChange).toHaveBeenLastCalledWith('Kaneshie Market Road, Accra, Ghana')
  })

  it('explains that shortened Google links cannot be read directly', () => {
    mockAutocomplete.mockReturnValue({
      search: vi.fn(),
      retry: vi.fn(),
      clear: vi.fn(),
      results: [],
      loading: false,
      error: null,
    })
    renderPicker()

    const input = screen.getByPlaceholderText('e.g. Accra, Ghana')
    fireEvent.change(input, { target: { value: 'My hotel' } })
    fireEvent.click(screen.getByText(/Paste a Google Maps link/))
    fireEvent.change(screen.getByLabelText('Google Maps link'), {
      target: { value: 'https://maps.app.goo.gl/AbC123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Place Pin/ }))

    expect(screen.getByText(/shortened Google link/i)).toBeInTheDocument()
  })

  it('shows a helpful error when the pasted text has no coordinates', () => {
    mockAutocomplete.mockReturnValue({
      search: vi.fn(),
      retry: vi.fn(),
      clear: vi.fn(),
      results: [],
      loading: false,
      error: null,
    })
    renderPicker()

    const input = screen.getByPlaceholderText('e.g. Accra, Ghana')
    fireEvent.change(input, { target: { value: 'My hotel' } })
    fireEvent.click(screen.getByText(/Paste a Google Maps link/))
    fireEvent.change(screen.getByLabelText('Google Maps link'), { target: { value: 'my hotel near the beach' } })
    fireEvent.click(screen.getByRole('button', { name: /Place Pin/ }))

    expect(screen.getByText(/Couldn’t find coordinates/)).toBeInTheDocument()
  })

  it('offers a Google Maps search when autocomplete finds nothing and commits the chosen place', async () => {
    mockAutocomplete.mockReturnValue({
      search: vi.fn(),
      retry: vi.fn(),
      clear: vi.fn(),
      results: [],
      loading: false,
      error: null,
    })
    mockSearchGhana.mockResolvedValueOnce({
      status: 'ok',
      results: [
        {
          title: 'Kaneshie Market',
          address: 'Kaneshie, Accra, Ghana',
          lat: 5.5735,
          lng: -0.2456,
          placeId: 'ChIJkaneshie',
        },
      ],
    })
    const onChange = vi.fn()
    const onCoordsChange = vi.fn()
    renderPicker({ onChange, onCoordsChange, searchOrigin: { lat: 5.57, lng: -0.24 } })

    const input = screen.getByPlaceholderText('e.g. Accra, Ghana')
    fireEvent.change(input, { target: { value: 'Kaneshie Market' } })

    fireEvent.click(screen.getByText(/Search Google Maps/))
    expect(screen.getByText('Searching Google Maps…')).toBeInTheDocument()

    // The result row shows the Google place; choosing it commits its exact
    // coordinates through the regular suggestion path.
    fireEvent.click(await screen.findByText('Kaneshie Market'))
    expect(onChange).toHaveBeenLastCalledWith('Kaneshie Market')
    expect(onCoordsChange).toHaveBeenCalledWith(5.5735, -0.2456)
    expect(mockSearchGhana).toHaveBeenCalledWith('Kaneshie Market', { lat: 5.57, lng: -0.24 })
  })

  it('does not offer the Google Maps search when a suggestion matches what was typed', () => {
    renderPicker()
    const input = screen.getByPlaceholderText('e.g. Accra, Ghana')
    fireEvent.change(input, { target: { value: 'Acc' } })

    expect(screen.getByText('Accra, Ghana')).toBeInTheDocument()
    expect(screen.queryByText(/Search Google Maps/)).not.toBeInTheDocument()
  })

  it('offers the Google Maps search when suggestions do not match what was typed', async () => {
    mockSearchGhana.mockResolvedValueOnce({
      status: 'ok',
      results: [
        {
          title: 'Kaneshie Market Complex',
          address: 'Mantse Akramah St, Accra',
          lat: 5.5667389,
          lng: -0.236487,
          placeId: 'ChIJ1',
        },
      ],
    })
    const onCoordsChange = vi.fn()
    renderPicker({ onCoordsChange })

    const input = screen.getByPlaceholderText('e.g. Accra, Ghana')
    fireEvent.change(input, { target: { value: 'Kaneshie Market' } })

    // The irrelevant suggestion is still shown — with the Google row under it.
    expect(screen.getByText('Accra, Ghana')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Search Google Maps/))

    fireEvent.click(await screen.findByText('Kaneshie Market Complex'))
    expect(onCoordsChange).toHaveBeenCalledWith(5.5667389, -0.236487)
  })

  it('filters out foreign suggestions so Google Maps can resolve a brand (Four Points case)', async () => {
    mockAutocomplete.mockReturnValue({
      search: vi.fn(),
      retry: vi.fn(),
      clear: vi.fn(),
      results: [
        {
          ...sample,
          formatted:
            'Four Points by Sheraton Lagos, 9/10 Prince Alabe Abiodun Oniru Road, Lagos, Nigeria',
          latitude: 6.4281,
          longitude: 3.4219,
          city: 'Lagos',
          region: 'Lagos',
          country: 'Nigeria',
          countryCode: 'ng',
        },
      ],
      loading: false,
      error: null,
    })
    mockSearchGhana.mockResolvedValueOnce({
      status: 'ok',
      results: [
        {
          title: 'Four Points by Sheraton Accra Airport Hotel',
          address: 'Plot 75A, First Senchi St, Accra',
          lat: 5.6131635,
          lng: -0.1766859,
          placeId: 'ChIJ2',
        },
      ],
    })
    const onChange = vi.fn()
    const onCoordsChange = vi.fn()
    renderPicker({ onChange, onCoordsChange })

    const input = screen.getByPlaceholderText('e.g. Accra, Ghana')
    fireEvent.change(input, { target: { value: 'Four Points by Sheraton' } })

    // The foreign-only suggestion is filtered out entirely…
    expect(screen.queryByText(/Four Points by Sheraton Lagos/)).not.toBeInTheDocument()
    // …so the Google Maps fallback is offered and resolves the Accra hotel.
    fireEvent.click(screen.getByText(/Search Google Maps/))
    fireEvent.click(await screen.findByText('Four Points by Sheraton Accra Airport Hotel'))

    expect(onChange).toHaveBeenLastCalledWith('Four Points by Sheraton Accra Airport Hotel')
    expect(onCoordsChange).toHaveBeenCalledWith(5.6131635, -0.1766859)
  })

  it('hides the Google Maps option when the server key is not configured', async () => {
    mockAutocomplete.mockReturnValue({
      search: vi.fn(),
      retry: vi.fn(),
      clear: vi.fn(),
      results: [],
      loading: false,
      error: null,
    })
    mockSearchGhana.mockResolvedValueOnce({ status: 'not_configured', results: [] })
    renderPicker()

    const input = screen.getByPlaceholderText('e.g. Accra, Ghana')
    fireEvent.change(input, { target: { value: 'Kaneshie Market' } })
    fireEvent.click(screen.getByText(/Search Google Maps/))

    await waitFor(() => expect(screen.queryByText(/Search Google Maps/)).not.toBeInTheDocument())
  })

  it('shows a fallback note when Google Maps has no results', async () => {
    mockAutocomplete.mockReturnValue({
      search: vi.fn(),
      retry: vi.fn(),
      clear: vi.fn(),
      results: [],
      loading: false,
      error: null,
    })
    mockSearchGhana.mockResolvedValueOnce({ status: 'empty', results: [] })
    renderPicker()

    const input = screen.getByPlaceholderText('e.g. Accra, Ghana')
    fireEvent.change(input, { target: { value: 'Nowhere at all' } })
    fireEvent.click(screen.getByText(/Search Google Maps/))

    expect(await screen.findByText('No matching places found on Google Maps.')).toBeInTheDocument()
  })
})
