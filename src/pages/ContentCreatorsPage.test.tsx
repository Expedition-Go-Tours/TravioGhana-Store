import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ContentCreatorsPage from './ContentCreatorsPage'

/**
 * The creator-page half of the same regression: "Apply to the creator
 * programme" called `onOpenAuth('signup')` unconditionally, so a signed-in
 * creator was shown the sign-up overlay instead of the creator application
 * form. Both CTAs share `handleApply`; these tests click each one.
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
    <MemoryRouter initialEntries={['/content-creators']}>
      <Routes>
        <Route path="/content-creators" element={<ContentCreatorsPage onOpenAuth={onOpenAuth} />} />
        <Route path="/partners/content-creators/apply" element={<div>CREATOR_APPLY_STUB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const reachedApply = () => screen.findByText('CREATOR_APPLY_STUB')

describe('signed-in creators are routed to the creator application form', () => {
  beforeEach(() => {
    state.user = { id: 'creator-1' }
  })

  it('from the hero button', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /apply to the creator programme/i }))
    expect(await reachedApply()).toBeInTheDocument()
  })

  it('from the closing CTA button', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /apply now/i }))
    expect(await reachedApply()).toBeInTheDocument()
  })

  it('without opening the sign-up overlay', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /apply to the creator programme/i }))
    await reachedApply()
    expect(onOpenAuth).not.toHaveBeenCalled()
  })
})

describe('signed-out creators still sign up first', () => {
  it('the CTA opens the sign-up overlay and sets the return path', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /apply to the creator programme/i }))

    expect(onOpenAuth).toHaveBeenCalledWith('signup')
    expect(setAuthReturnToMock).toHaveBeenLastCalledWith('/partners/content-creators/apply')
    expect(screen.queryByText('CREATOR_APPLY_STUB')).not.toBeInTheDocument()
  })
})
