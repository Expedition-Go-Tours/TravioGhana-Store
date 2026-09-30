import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import HotelsProviderPage from './HotelsProviderPage'

/**
 * "List your property" must lead somewhere real for a signed-in visitor.
 *
 * The regression this file exists for: every apply CTA called
 * `onOpenAuth('signup')` unconditionally, so a signed-in visitor was shown the
 * sign-up overlay again instead of the supplier registration form. These tests
 * click the actual buttons and assert on the route a visitor ends up on.
 */

vi.mock('../components/Footer', () => ({ default: () => <div>FOOTER</div> }))
vi.mock('../components/SEO', () => ({ default: () => null, buildBreadcrumbSchema: () => ({}) }))
vi.mock('../lib/auth', () => ({ setAuthReturnTo: vi.fn() }))

const state = vi.hoisted(() => ({ user: null as { id: string } | null }))
vi.mock('../hooks/useAuthUser', () => ({ useAuthUser: () => state.user }))

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

const { setAuthReturnTo } = await import('../lib/auth')
const setAuthReturnToMock = vi.mocked(setAuthReturnTo)

const onOpenAuth = vi.fn()

beforeEach(() => {
  state.user = null
  onOpenAuth.mockClear()
  setAuthReturnToMock.mockClear()
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hotels']}>
      <Routes>
        <Route path="/hotels" element={<HotelsProviderPage onOpenAuth={onOpenAuth} />} />
        <Route path="/supplier/register" element={<div>SUPPLIER_REGISTER_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const reachedRegister = () => screen.findByText('SUPPLIER_REGISTER_STUB')

describe('signed-in visitors are routed to the supplier registration form', () => {
  beforeEach(() => {
    state.user = { id: 'user-1' }
  })

  it('from the CTA button', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /list your property/i }))
    expect(await reachedRegister()).toBeInTheDocument()
  })

  it('from the hero button', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('link', { name: /list your property/i }))
    expect(await reachedRegister()).toBeInTheDocument()
  })

  it('from the "Start your listing" button', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('link', { name: /start your listing/i }))
    expect(await reachedRegister()).toBeInTheDocument()
  })

  it('without opening the sign-up overlay', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /list your property/i }))
    await reachedRegister()
    expect(onOpenAuth).not.toHaveBeenCalled()
  })
})

describe('signed-out visitors still sign up first', () => {
  it('the CTA opens the sign-up overlay and sets the return path', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /list your property/i }))

    expect(onOpenAuth).toHaveBeenCalledWith('signup')
    expect(setAuthReturnToMock).toHaveBeenLastCalledWith('/supplier/register')
    expect(screen.queryByText('SUPPLIER_REGISTER_STUB')).not.toBeInTheDocument()
  })

  it('the hero button keeps its scroll-to-apply behaviour', () => {
    renderPage()
    fireEvent.click(screen.getByRole('link', { name: /list your property/i }))

    expect(onOpenAuth).not.toHaveBeenCalled()
    expect(screen.queryByText('SUPPLIER_REGISTER_STUB')).not.toBeInTheDocument()
  })
})
