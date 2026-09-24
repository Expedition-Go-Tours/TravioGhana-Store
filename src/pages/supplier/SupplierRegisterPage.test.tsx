import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SupplierRegisterPage from './SupplierRegisterPage'

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string; name?: string },
}))

vi.mock('@/hooks/useAuthUser', () => ({
  useAuthUser: () => mocks.user,
}))

vi.mock('@/hooks/useSupplierStatus', () => ({
  useSupplierStatus: () => ({ profile: null, isLoading: false }),
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

vi.mock('@/components/supplier/SupplierApplicationForm', () => ({
  SupplierApplicationForm: () => <div>SUPPLIER_APPLICATION_FORM</div>,
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
  vi.clearAllMocks()
})

describe('SupplierRegisterPage', () => {
  it('marketing mode renders the story, no banner and no application form', () => {
    renderMarketing()

    expect(screen.getByText(/Manage your tours/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /become a supplier/i }).length).toBeGreaterThan(0)
    // Removed top-line banner (exact string — the hero copy mentions the same
    // phrase in a sentence and must stay).
    expect(screen.queryByText("Built for Ghana's experience operators.")).toBeNull()
    expect(screen.queryByText(/No listing fee/i)).toBeNull()
    // The application wizard lives on /supplier/register only.
    expect(screen.queryByText(/Join as a Supplier/i)).toBeNull()
    expect(screen.queryByText('SUPPLIER_APPLICATION_FORM')).toBeNull()
  })

  it('marketing CTA routes to the supplier registration page', async () => {
    renderMarketing()

    fireEvent.click(screen.getAllByRole('button', { name: /become a supplier/i })[0])

    expect(await screen.findByText('REGISTER_ROUTE')).toBeInTheDocument()
  })

  it('register mode is the focused application page — form first, no marketing', () => {
    renderRegister()

    expect(screen.getByRole('heading', { name: /Join as a Supplier/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Learn about listing on Travio Ghana/i })).toHaveAttribute(
      'href',
      '/supplier/list-experience',
    )
    // No banner, no marketing hero, no marketing sections.
    expect(screen.queryByText("Built for Ghana's experience operators.")).toBeNull()
    expect(screen.queryByText(/Manage your tours/i)).toBeNull()
    expect(screen.queryByText(/From sign-up to your first booking/i)).toBeNull()
  })

  it('shows the sign-up prompt when signed out, and the form when signed in', () => {
    const { unmount } = renderRegister()
    expect(screen.getByText(/Sign up to apply/i)).toBeInTheDocument()
    expect(screen.queryByText('SUPPLIER_APPLICATION_FORM')).toBeNull()
    unmount()

    mocks.user = { id: 'u1', name: 'Ada' }
    renderRegister()
    expect(screen.getByText('SUPPLIER_APPLICATION_FORM')).toBeInTheDocument()
  })
})
