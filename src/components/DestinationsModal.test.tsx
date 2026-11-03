import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DestinationsModal from './DestinationsModal'

const lenis = vi.hoisted(() => ({
  stop: vi.fn(),
  start: vi.fn(),
}))

vi.mock('../hooks/useHomepageSections', () => ({
  usePopularDestinations: () => ({ data: [], isLoading: false }),
}))

vi.mock('../lib/LenisProvider', () => ({
  getLenis: () => lenis,
}))

function renderModal(isOpen: boolean) {
  return render(
    <MemoryRouter>
      <DestinationsModal isOpen={isOpen} onClose={() => {}} />
    </MemoryRouter>,
  )
}

describe('DestinationsModal', () => {
  beforeEach(() => {
    lenis.stop.mockReset()
    lenis.start.mockReset()
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  })

  it('portals the drawer to body and locks the page while open', () => {
    renderModal(true)

    const panel = document.querySelector('.destinations-panel')
    expect(panel).not.toBeNull()
    expect(panel?.parentElement).toBe(document.body)
    expect(document.querySelector('.destinations-overlay')?.parentElement).toBe(document.body)

    expect(lenis.stop).toHaveBeenCalledTimes(1)
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.querySelector('.destinations-content')?.hasAttribute('data-lenis-prevent')).toBe(true)
  })

  it('restores page scrolling when the drawer closes', async () => {
    const view = renderModal(true)
    view.rerender(
      <MemoryRouter>
        <DestinationsModal isOpen={false} onClose={() => {}} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(lenis.start).toHaveBeenCalledTimes(1)
      expect(document.documentElement.style.overflow).toBe('')
      expect(document.body.style.overflow).toBe('')
    })
  })
})
