import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TopAttractionsNearbySection from './TopAttractionsNearbySection'

vi.mock('../hooks/useHomepageSections', () => ({
  useAttractions: () => ({ data: [], isLoading: false }),
}))

describe('TopAttractionsNearbySection', () => {
  it('never requests geolocation on its own', () => {
    const getCurrentPosition = vi.fn()
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } })

    render(
      <MemoryRouter>
        <TopAttractionsNearbySection />
      </MemoryRouter>,
    )

    expect(getCurrentPosition).not.toHaveBeenCalled()

    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined })
  })
})
