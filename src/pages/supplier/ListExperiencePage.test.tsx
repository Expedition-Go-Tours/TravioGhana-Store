import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import ListExperiencePage from './ListExperiencePage'

const mocks = vi.hoisted(() => ({
  profile: null as null | { id: string; userId: string; status: string },
}))

vi.mock('@/hooks/useSupplierStatus', () => ({
  useSupplierStatus: () => ({ profile: mocks.profile, isLoading: false }),
  supplierStatusKey: () => ['supplier-status', 'test'],
}))

vi.mock('@/lib/supplier', () => ({
  getSupplierPortalUrl: vi.fn(async () => null),
  isApprovedSupplier: () => false,
}))

vi.mock('@/components/Footer', () => ({ default: () => <div>FOOTER</div> }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/supplier/list-experience']}>
          <Routes>
            <Route path="/supplier/list-experience" element={<ListExperiencePage />} />
            <Route path="/supplier/register" element={<div>REGISTER_ROUTE</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  )
}

beforeEach(() => {
  mocks.profile = null
  vi.clearAllMocks()
})

describe('ListExperiencePage', () => {
  it('renders the supplier story with the trust layer and footer', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: /List your tours/i })).toBeInTheDocument()
    expect(screen.getByText(/Verify TravioGhana before you join/i)).toBeInTheDocument()
    expect(screen.getByText(/supplier support in Ghana/i)).toBeInTheDocument()
    expect(screen.getByText(/Independent travel-platform proof/i)).toBeInTheDocument()
    expect(screen.getByText('FOOTER')).toBeInTheDocument()
  })

  it('keeps the verification anchors inside the page', () => {
    const { container } = renderPage()

    expect(screen.getByRole('link', { name: /Verify us first/i })).toHaveAttribute('href', '#verify')
    expect(container.querySelector('#verify')).not.toBeNull()
    expect(container.querySelector('#supplier-faq')).not.toBeNull()
    expect(screen.getByRole('link', { name: /Talk to supplier support/i })).toHaveAttribute('href', '#verify')
  })

  it('routes the hero CTA to the registration page', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /Become a supplier/i }))
    expect(await screen.findByText('REGISTER_ROUTE')).toBeInTheDocument()
  })

  it('routes the closing CTA to the registration page', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /Create supplier account/i }))
    expect(await screen.findByText('REGISTER_ROUTE')).toBeInTheDocument()
  })

  it('numbers the supplier FAQ and lists all eleven questions', () => {
    renderPage()

    const numbers = Array.from(document.querySelectorAll('.eg-faq-btn b')).map((el) => el.textContent)
    expect(numbers).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'])
    expect(screen.getByText(/Who operates TravioGhana\?/i)).toBeInTheDocument()
    expect(screen.getAllByText(/official supplier portal/i).length).toBeGreaterThan(0)
  })

  it('links the travel-platform proof cards to the public profiles', () => {
    renderPage()

    const links = screen.getAllByRole('link', { name: /View profile/i })
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('tripadvisor.com'))
    expect(links[1]).toHaveAttribute('href', expect.stringContaining('getyourguide.com'))
  })
})
