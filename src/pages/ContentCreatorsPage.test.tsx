import { describe, expect, it, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ContentCreatorsPage from './ContentCreatorsPage'

/**
 * The creator programme is not accepting applications yet, so both CTAs are
 * dormant "Coming soon" controls and nothing may route to a removed
 * application form.
 */

vi.mock('../components/Footer', () => ({ default: () => <div>FOOTER</div> }))
vi.mock('../components/SEO', () => ({ default: () => null, buildBreadcrumbSchema: () => ({}) }))

/** RevealOnScroll constructs an IntersectionObserver unconditionally. */
class StubIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: StubIntersectionObserver as unknown as typeof IntersectionObserver,
  })
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/content-creators']}>
      <Routes>
        <Route path="/content-creators" element={<ContentCreatorsPage />} />
        <Route path="/partners/content-creators/apply" element={<div>CREATOR_APPLY_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const comingSoonCtas = () => screen.getAllByRole('button', { name: /coming soon/i })

describe('creator programme CTAs are coming soon', () => {
  it('marks the hero and closing CTAs as coming soon', () => {
    renderPage()

    const ctas = comingSoonCtas()
    expect(ctas).toHaveLength(2)
    for (const cta of ctas) {
      expect(cta).toHaveAttribute('aria-disabled', 'true')
      expect(cta).toHaveClass('is-coming-soon')
    }
  })

  it('does not navigate to the removed application form when clicked', () => {
    renderPage()

    for (const cta of comingSoonCtas()) {
      fireEvent.click(cta)
    }

    expect(screen.queryByText('CREATOR_APPLY_STUB')).not.toBeInTheDocument()
  })
})
