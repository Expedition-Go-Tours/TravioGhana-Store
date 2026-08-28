import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DirectionsPanel from './DirectionsPanel'

const DESTINATION = { lat: 5.5473, lng: -0.1866, label: 'Independence Arch' }

describe('DirectionsPanel', () => {
  it('renders nothing without a destination', () => {
    const { container } = render(<DirectionsPanel destination={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders Google Maps and Apple Maps deep-links for the destination', () => {
    render(<DirectionsPanel destination={DESTINATION} />)

    const googleLink = screen.getByRole('link', { name: /Open in Google Maps/ })
    const appleLink = screen.getByRole('link', { name: /Apple Maps/ })

    expect(googleLink).toHaveAttribute(
      'href',
      expect.stringContaining('https://www.google.com/maps/dir/?api=1&destination=5.5473,-0.1866'),
    )
    expect(googleLink).not.toHaveAttribute('href', expect.stringContaining('origin='))
    expect(appleLink).toHaveAttribute('href', expect.stringContaining('http://maps.apple.com/'))
    expect(appleLink).toHaveAttribute('href', expect.stringContaining('daddr=5.5473,-0.1866'))
  })
})
