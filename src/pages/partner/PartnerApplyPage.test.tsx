import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PartnerApplyPage from './PartnerApplyPage'

/**
 * /partners/content-creators/apply belonged to the creator application form,
 * which has been removed. The URL must land on the programme page instead of
 * the "Invalid Partner Type" card, while the remaining types keep working.
 */

vi.mock('@/components/partner/PartnerApplicationForm', () => ({
  default: () => <div>PARTNER_APPLICATION_FORM</div>,
}))
vi.mock('@/components/Navbar', () => ({ default: () => <div>NAVBAR</div> }))
vi.mock('@/components/Footer', () => ({ default: () => <div>FOOTER</div> }))
vi.mock('@/hooks/useAuthUser', () => ({ useAuthUser: () => ({ id: 'partner-1' }) }))
vi.mock('@/lib/auth', () => ({ setAuthReturnTo: vi.fn() }))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/partners/:type/apply" element={<PartnerApplyPage />} />
        <Route path="/content-creators" element={<div>CONTENT_CREATORS_PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('content creator apply URL', () => {
  it('redirects to the content creators programme page', async () => {
    renderAt('/partners/content-creators/apply')

    expect(await screen.findByText('CONTENT_CREATORS_PAGE')).toBeInTheDocument()
    expect(screen.queryByText(/invalid partner type/i)).not.toBeInTheDocument()
    expect(screen.queryByText('PARTNER_APPLICATION_FORM')).not.toBeInTheDocument()
  })

  it('still serves the remaining partner types', () => {
    renderAt('/partners/hotels/apply')

    expect(screen.getByText('PARTNER_APPLICATION_FORM')).toBeInTheDocument()
  })
})
