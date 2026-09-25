import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import confetti from 'canvas-confetti'
import SupplierRegistrationWizard from './SupplierRegistrationWizard'

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string; name?: string; email?: string },
  registerWithEmail: vi.fn(),
  applyAsSupplier: vi.fn(),
  getSupplierApplicationStatus: vi.fn(),
  getSupplierPortalUrl: vi.fn(async () => null as string | null),
}))

vi.mock('@/hooks/useAuthUser', () => ({ useAuthUser: () => mocks.user }))

vi.mock('@/lib/auth', () => ({
  getAuthUserId: (u: { id?: string } | null) => u?.id ?? null,
  registerWithEmail: mocks.registerWithEmail,
}))

vi.mock('@/lib/supplier', () => ({
  applyAsSupplier: mocks.applyAsSupplier,
  getSupplierApplicationStatus: mocks.getSupplierApplicationStatus,
  getSupplierPortalUrl: mocks.getSupplierPortalUrl,
}))

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

// jsdom has no matchMedia; the wizard uses it for reduced-motion-aware scrolling.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList) as typeof window.matchMedia
}

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

function renderWizard(props: { onOpenAuth?: () => void; onSubmitted?: () => void } = {}) {
  return render(
    <MemoryRouter>
      <SupplierRegistrationWizard {...props} />
    </MemoryRouter>,
  )
}

function byId(container: HTMLElement, id: string) {
  const el = container.querySelector(`#${id}`)
  if (!el) throw new Error(`missing #${id}`)
  return el as HTMLInputElement
}

function progress(container: HTMLElement) {
  return container.querySelector('#progressText')?.textContent
}

function toast(container: HTMLElement) {
  return container.querySelector('#toast')?.textContent
}

function fillAccount(container: HTMLElement) {
  fireEvent.change(byId(container, 'sr-first-name'), { target: { value: 'Peter' } })
  fireEvent.change(byId(container, 'sr-last-name'), { target: { value: 'Mensah' } })
  fireEvent.change(byId(container, 'sr-email'), { target: { value: 'peter@example.com' } })
  fireEvent.change(byId(container, 'sr-phone'), { target: { value: '+233 24 000 0000' } })
  fireEvent.change(byId(container, 'sr-password'), { target: { value: 'Sup3rSecret!' } })
  fireEvent.change(byId(container, 'sr-confirm-password'), { target: { value: 'Sup3rSecret!' } })
}

function fillBusinessProfile(container: HTMLElement) {
  fireEvent.change(byId(container, 'sr-biz-brand'), { target: { value: 'Expedition-Go Tours' } })
  fireEvent.change(byId(container, 'sr-biz-year'), { target: { value: '2023' } })
  fireEvent.change(byId(container, 'sr-biz-legal'), { target: { value: 'Expedition-Go Tours Ltd' } })
  fireEvent.change(byId(container, 'sr-biz-reg'), { target: { value: 'CS-123456' } })
  fireEvent.change(byId(container, 'sr-biz-address'), { target: { value: 'GA-123-4567' } })
  fireEvent.change(byId(container, 'sr-biz-region'), { target: { value: 'Greater Accra' } })
  fireEvent.change(byId(container, 'sr-biz-city'), { target: { value: 'Accra' } })
}

function nextButton(container: HTMLElement) {
  return byId(container, 'nextBtn') as unknown as HTMLButtonElement
}

beforeEach(() => {
  // canvas-confetti's frame loop would otherwise keep firing after the test
  // that triggered it; stub rAF so each celebration calls confetti once.
  window.requestAnimationFrame = vi.fn(() => 0) as unknown as typeof window.requestAnimationFrame
  mocks.user = null
  mocks.registerWithEmail.mockReset().mockResolvedValue({ id: 'test-user', email: 'peter@example.com' })
  mocks.applyAsSupplier.mockReset().mockResolvedValue({ supplierProfile: { id: 'app-1', userId: 'test-user', status: 'PENDING' } })
  mocks.getSupplierApplicationStatus.mockReset().mockResolvedValue({ id: 'app-1', userId: 'test-user', status: 'PENDING' })
  mocks.getSupplierPortalUrl.mockReset().mockResolvedValue(null)
  vi.mocked(confetti).mockClear()
  cleanup()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('SupplierRegistrationWizard', () => {
  it('blocks the account step when required fields are missing', () => {
    const { container } = renderWizard()
    expect(progress(container)).toBe('Step 1 of 7')

    fireEvent.click(nextButton(container))

    expect(progress(container)).toBe('Step 1 of 7')
    expect(toast(container)).toBe('First name is required')
    expect(mocks.registerWithEmail).not.toHaveBeenCalled()
  })

  it('creates the account for signed-out visitors and advances', async () => {
    const { container } = renderWizard()
    fillAccount(container)
    fireEvent.click(nextButton(container))

    await waitFor(() => expect(mocks.registerWithEmail).toHaveBeenCalledWith('Peter Mensah', 'peter@example.com', 'Sup3rSecret!'))
    await waitFor(() => expect(progress(container)).toBe('Step 2 of 7'))
  })

  it('prefills a signed-in visitor and hides the password fields', async () => {
    mocks.user = { id: 'u1', name: 'Ada Mensah', email: 'ada@example.com' }
    const { container } = renderWizard()

    await waitFor(() => expect(byId(container, 'sr-first-name').value).toBe('Ada'))
    expect(byId(container, 'sr-last-name').value).toBe('Mensah')
    expect(byId(container, 'sr-email').value).toBe('ada@example.com')
    expect(container.querySelector('#sr-password')).toBeNull()
  })

  it('gates the business profile on the tax acknowledgement', async () => {
    const { container } = renderWizard()
    fillAccount(container)
    fireEvent.click(nextButton(container))
    await waitFor(() => expect(progress(container)).toBe('Step 2 of 7'))

    fireEvent.click(container.querySelectorAll('.cards[data-name="supplierType"] .choice-card')[0])
    fireEvent.click(nextButton(container))
    expect(progress(container)).toBe('Step 3 of 7')

    fillBusinessProfile(container)
    fireEvent.click(container.querySelectorAll('#operatingRegions .pill')[0])
    fireEvent.click(nextButton(container))

    expect(progress(container)).toBe('Step 3 of 7')
    expect(toast(container)).toBe('Please confirm the tax responsibility acknowledgement')

    fireEvent.click(byId(container, 'businessTaxAck'))
    fireEvent.click(nextButton(container))
    expect(progress(container)).toBe('Step 4 of 7')
  })

  it('reveals and hides the password with the eye toggle', () => {
    const { container } = renderWizard()
    const passwordInput = byId(container, 'sr-password') as HTMLInputElement
    const confirmInput = byId(container, 'sr-confirm-password') as HTMLInputElement
    const toggle = container.querySelectorAll('.password-toggle')[0] as HTMLButtonElement

    expect(passwordInput.type).toBe('password')
    expect(toggle.getAttribute('aria-label')).toBe('Show password')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(toggle)

    expect(passwordInput.type).toBe('text')
    expect(toggle.getAttribute('aria-label')).toBe('Hide password')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    // The confirm field keeps its own state.
    expect(confirmInput.type).toBe('password')

    fireEvent.click(toggle)

    expect(passwordInput.type).toBe('password')
    expect(toggle.getAttribute('aria-label')).toBe('Show password')
  })

  it('toggles the confirm field independently without submitting the form', () => {
    const { container } = renderWizard()
    fillAccount(container)

    const confirmInput = byId(container, 'sr-confirm-password') as HTMLInputElement
    const confirmToggle = container.querySelectorAll('.password-toggle')[1] as HTMLButtonElement

    fireEvent.click(confirmToggle)

    expect(confirmInput.type).toBe('text')
    expect(progress(container)).toBe('Step 1 of 7')
    expect(mocks.registerWithEmail).not.toHaveBeenCalled()
  })

  it('submits a complete application, celebrates with confetti and shows the success screen', async () => {
    const onSubmitted = vi.fn()
    const { container } = renderWizard({ onSubmitted })

    // 1. Account
    fillAccount(container)
    fireEvent.click(nextButton(container))
    await waitFor(() => expect(progress(container)).toBe('Step 2 of 7'))

    // 2. Supplier type
    fireEvent.click(container.querySelectorAll('.cards[data-name="supplierType"] .choice-card')[0])
    fireEvent.click(nextButton(container))
    expect(progress(container)).toBe('Step 3 of 7')

    // 3. Profile
    fillBusinessProfile(container)
    fireEvent.click(byId(container, 'businessTaxAck'))
    fireEvent.click(container.querySelectorAll('#operatingRegions .pill')[0])
    fireEvent.click(nextButton(container))
    expect(progress(container)).toBe('Step 4 of 7')

    // 4. Services
    const serviceCards = container.querySelectorAll('#serviceCards .choice-card')
    fireEvent.click(serviceCards[0])
    fireEvent.click(serviceCards[1])
    fireEvent.click(nextButton(container))
    expect(progress(container)).toBe('Step 5 of 7')

    // 5. Verification
    const file = new File(['id'], 'ghana-card.png', { type: 'image/png' })
    const fileInput = container.querySelector('#primaryDocumentUpload input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })
    fireEvent.click(nextButton(container))
    expect(progress(container)).toBe('Step 6 of 7')

    // 6. Payout (defaults are valid)
    fireEvent.click(nextButton(container))
    expect(progress(container)).toBe('Step 7 of 7')

    // 7. Review + submit
    expect(mocks.applyAsSupplier).not.toHaveBeenCalled()
    fireEvent.click(nextButton(container))
    expect(progress(container)).toBe('Step 7 of 7')
    expect(toast(container)).toBe('Please review and accept the supplier standards')

    fireEvent.click(byId(container, 'acceptAllStandards'))
    fireEvent.click(nextButton(container))

    await waitFor(() => expect(mocks.applyAsSupplier).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(progress(container)).toBe('Complete'))
    await waitFor(() => expect(confetti).toHaveBeenCalled())
    expect(container.textContent).toContain('Your supplier profile is ready')
    expect(onSubmitted).toHaveBeenCalledTimes(1)

    const payload = mocks.applyAsSupplier.mock.calls[0][0] as FormData
    expect(payload.get('supplierType')).toBe('TOUR_COMPANY')
  })

  it('does not fire confetti when the submission fails', async () => {
    mocks.applyAsSupplier.mockRejectedValue(new Error('Network down'))
    const { container } = renderWizard()

    fillAccount(container)
    fireEvent.click(nextButton(container))
    await waitFor(() => expect(progress(container)).toBe('Step 2 of 7'))
    fireEvent.click(container.querySelectorAll('.cards[data-name="supplierType"] .choice-card')[0])
    fireEvent.click(nextButton(container))
    fillBusinessProfile(container)
    fireEvent.click(byId(container, 'businessTaxAck'))
    fireEvent.click(container.querySelectorAll('#operatingRegions .pill')[0])
    fireEvent.click(nextButton(container))
    fireEvent.click(nextButton(container))
    const file = new File(['id'], 'id.png', { type: 'image/png' })
    fireEvent.change(container.querySelector('#primaryDocumentUpload input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    })
    fireEvent.click(nextButton(container))
    fireEvent.click(nextButton(container)) // payout
    fireEvent.click(byId(container, 'acceptAllStandards'))
    fireEvent.click(nextButton(container))

    await waitFor(() => expect(mocks.applyAsSupplier).toHaveBeenCalledTimes(1))
    expect(confetti).not.toHaveBeenCalled()
    expect(toast(container)).toBe('Network down')
    expect(progress(container)).toBe('Step 7 of 7')
  })
})
