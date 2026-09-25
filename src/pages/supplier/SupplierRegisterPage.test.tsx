import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SupplierRegisterPage from './SupplierRegisterPage'

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string; name?: string },
  profile: null as null | { id: string; status: string },
}))

vi.mock('@/hooks/useAuthUser', () => ({
  useAuthUser: () => mocks.user,
}))

vi.mock('@/hooks/useSupplierStatus', () => ({
  useSupplierStatus: () => ({ profile: mocks.profile, isLoading: false }),
  supplierStatusKey: () => ['supplier-status', 'test'],
}))

vi.mock('@/lib/supplier', () => ({
  getSupplierPortalUrl: vi.fn(async () => null),
  isApprovedSupplier: () => false,
}))

vi.mock('@/lib/auth', () => ({
  getAuthUserId: () => null,
  setAuthReturnTo: vi.fn(),
}))

vi.mock('@/components/supplier/SupplierRegistrationWizard', () => ({
  default: () => <div>SUPPLIER_REGISTRATION_WIZARD</div>,
}))

vi.mock('@/components/Footer', () => ({ default: () => <div>FOOTER</div> }))

vi.mock('@/components/shared/RevealOnScroll', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function withProviders(ui: React.ReactNode, initialPath: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Marketing page at /supplier/list-experience, with /supplier/register as a probe. */
function renderMarketing() {
  return withProviders(
    <Routes>
      <Route path="/supplier/list-experience" element={<SupplierRegisterPage showApplicationForm={false} />} />
      <Route path="/supplier/register" element={<div>REGISTER_ROUTE</div>} />
    </Routes>,
    '/supplier/list-experience',
  )
}

/** The real focused registration page at /supplier/register. */
function renderRegister() {
  return withProviders(<SupplierRegisterPage />, '/supplier/register')
}

beforeEach(() => {
  mocks.user = null
  mocks.profile = null
  vi.clearAllMocks()
})

describe('SupplierRegisterPage', () => {
  it('marketing mode renders the story, no banner and no registration wizard', () => {
    renderMarketing()

    expect(screen.getByText(/Manage your tours/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /become a supplier/i }).length).toBeGreaterThan(0)
    // Removed top-line banner (exact string — the hero copy mentions the same
    // phrase in a sentence and must stay).
    expect(screen.queryByText("Built for Ghana's experience operators.")).toBeNull()
    expect(screen.queryByText(/No listing fee/i)).toBeNull()
    // The registration wizard lives on /supplier/register only.
    expect(screen.queryByText(/Join as a Supplier/i)).toBeNull()
    expect(screen.queryByText('SUPPLIER_REGISTRATION_WIZARD')).toBeNull()
  })

  it('marketing CTA routes to the supplier registration page', async () => {
    renderMarketing()

    fireEvent.click(screen.getAllByRole('button', { name: /become a supplier/i })[0])

    expect(await screen.findByText('REGISTER_ROUTE')).toBeInTheDocument()
  })

  it('register mode renders the registration wizard — no marketing, no footer', () => {
    renderRegister()

    expect(screen.getByText('SUPPLIER_REGISTRATION_WIZARD')).toBeInTheDocument()
    expect(screen.queryByText('FOOTER')).toBeNull()
    expect(screen.queryByText("Built for Ghana's experience operators.")).toBeNull()
    expect(screen.queryByText(/Manage your tours/i)).toBeNull()
    expect(screen.queryByText(/From sign-up to your first booking/i)).toBeNull()
  })

  it('shows the under-review status instead of the wizard when an application exists', () => {
    mocks.profile = { id: 'app-1', status: 'UNDER_REVIEW' }
    renderRegister()

    expect(screen.getByText(/Your application is under review/i)).toBeInTheDocument()
    expect(screen.getByText('UNDER_REVIEW')).toBeInTheDocument()
    expect(screen.queryByText('SUPPLIER_REGISTRATION_WIZARD')).toBeNull()
  })

  it('shows the needs-attention status for a rejected application', () => {
    mocks.profile = { id: 'app-2', status: 'REJECTED' }
    renderRegister()

    expect(screen.getByText(/needs more information/i)).toBeInTheDocument()
    expect(screen.getByText('REJECTED')).toBeInTheDocument()
    expect(screen.queryByText('SUPPLIER_REGISTRATION_WIZARD')).toBeNull()
  })
})
