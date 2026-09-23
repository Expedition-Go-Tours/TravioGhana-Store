import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LocationPicker from './LocationPicker'
import { useLocationAutocomplete } from '../../hooks/useLocationAutocomplete'
import type { LocationResult } from '../../hooks/useLocationAutocomplete'

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

const mockAutocomplete = vi.mocked(useLocationAutocomplete)

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
})
