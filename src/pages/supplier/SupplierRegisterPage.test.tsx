import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SupplierRegisterPage from './SupplierRegisterPage'

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string; name?: string },
  profile: null as null | { id: string; userId: string; status: string; adminNotes?: string | null },
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

vi.mock('@/components/supplier/SupplierApplicationForm', () => ({
  SupplierApplicationForm: () => <div>SUPPLIER_APPLICATION_FORM</div>,
}))

function withProviders(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/supplier/register']}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

function renderRegister() {
  return withProviders(<SupplierRegisterPage />)
}

beforeEach(() => {
  mocks.user = null
  mocks.profile = null
  vi.clearAllMocks()
})

describe('SupplierRegisterPage', () => {
  it('is the focused application page — form first, no marketing', () => {
    renderRegister()

    expect(screen.getByRole('heading', { name: /Join as a Supplier/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Learn about listing on Travio Ghana/i })).toHaveAttribute(
      'href',
      '/supplier/list-experience',
    )
    // The marketing story lives on /supplier/list-experience only.
    expect(screen.queryByText(/List your tours/i)).toBeNull()
    expect(screen.queryByText(/From supplier to live listing/i)).toBeNull()
  })

  it('renders the application wizard whether signed out or signed in — the wizard creates the account', () => {
    const { unmount } = renderRegister()
    // Step 1 of the wizard collects the password, so signed-out visitors go
    // straight into the form instead of a separate "Sign up to apply" card.
    expect(screen.getByText('SUPPLIER_APPLICATION_FORM')).toBeInTheDocument()
    expect(screen.queryByText(/Sign up to apply/i)).toBeNull()
    unmount()

    mocks.user = { id: 'u1', name: 'Ada' }
    renderRegister()
    expect(screen.getByText('SUPPLIER_APPLICATION_FORM')).toBeInTheDocument()
  })

  it('shows review copy for a pending application and the reviewer note when rejected', () => {
    mocks.profile = { id: 's1', userId: 'u1', status: 'UNDER_REVIEW' }
    const { unmount } = renderRegister()

    expect(screen.getByText('Application under review')).toBeInTheDocument()
    expect(screen.getByText(/Status: UNDER_REVIEW/i)).toBeInTheDocument()
    expect(screen.queryByText(/Note from our review team/i)).toBeNull()
    unmount()

    mocks.profile = {
      id: 's1',
      userId: 'u1',
      status: 'REJECTED',
      adminNotes: 'The ID photo was not legible. Please upload a clearer copy.',
    }
    renderRegister()

    expect(screen.getByText('Application not approved')).toBeInTheDocument()
    expect(screen.getByText(/Status: REJECTED/i)).toBeInTheDocument()
    expect(screen.getByText(/Note from our review team/i)).toBeInTheDocument()
    expect(screen.getByText(/not legible/i)).toBeInTheDocument()
    // The form is replaced by the status card once an application exists.
    expect(screen.queryByText('SUPPLIER_APPLICATION_FORM')).toBeNull()
  })

  it('explains suspension and expiry instead of claiming a review is in progress', () => {
    mocks.profile = { id: 's1', userId: 'u1', status: 'SUSPENDED', adminNotes: 'Safety review pending.' }
    const { unmount } = renderRegister()

    expect(screen.getByText('Supplier account suspended')).toBeInTheDocument()
    expect(screen.getByText(/Safety review pending/i)).toBeInTheDocument()
    expect(screen.queryByText(/get back to you within 3-5 business days/i)).toBeNull()
    unmount()

    mocks.profile = { id: 's1', userId: 'u1', status: 'EXPIRED' }
    renderRegister()

    expect(screen.getByText('Supplier profile expired')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /@/ })).toHaveAttribute('href', expect.stringContaining('mailto:'))
  })
})
