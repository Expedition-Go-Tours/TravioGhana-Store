import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { SupplierApplicationForm } from './SupplierApplicationForm'
import {
  createEmptySupplierApplicationForm,
  saveSupplierApplicationDraft,
} from '@/lib/supplierApplicationDraft'

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string; name?: string; email?: string; hasPassword?: boolean },
  registerWithEmail: vi.fn(),
  setAccountPassword: vi.fn(),
  applyAsSupplier: vi.fn<
    (payload: FormData, onProgress?: (percent: number) => void) => Promise<unknown>
  >(async () => ({})),
  getSupplierApplicationStatus: vi.fn<() => Promise<unknown>>(async () => null),
}))

// jsdom has no 2D canvas, so the celebration must never touch the real library.
const confettiMock = vi.hoisted(() => Object.assign(vi.fn(), { reset: vi.fn() }))

vi.mock('canvas-confetti', () => ({ default: confettiMock }))

vi.mock('@/hooks/useAuthUser', () => ({
  useAuthUser: () => mocks.user,
}))

vi.mock('@/lib/auth', () => ({
  getAuthUserId: (user: { id?: string; email?: string } | null | undefined) => user?.id ?? null,
  registerWithEmail: mocks.registerWithEmail,
  setAccountPassword: mocks.setAccountPassword,
  refreshStoredUserFromBackend: vi.fn(async () => null),
}))

vi.mock('@/lib/supplier', () => ({
  applyAsSupplier: mocks.applyAsSupplier,
  getSupplierApplicationStatus: mocks.getSupplierApplicationStatus,
  MAX_SUPPLIER_APPLICATION_FILES: 30,
  MAX_SUPPLIER_DOCUMENT_BYTES: 10 * 1024 * 1024,
}))

function fillAccountStep() {
  fireEvent.change(screen.getByPlaceholderText('e.g. Peter'), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByPlaceholderText('e.g. Mensah'), { target: { value: 'Mensah' } })
  fireEvent.change(screen.getByPlaceholderText('name@company.com'), { target: { value: 'ada@example.com' } })
  fireEvent.change(screen.getByPlaceholderText('e.g. 024 123 4567'), { target: { value: '0244000000' } })
  fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'supersecret' } })
  fireEvent.change(screen.getByPlaceholderText('Repeat password'), { target: { value: 'supersecret' } })
}

/** Every step stays mounted, so assert the *active* one (visibility is CSS). */
function activeStepText(): string {
  return document.querySelector('.form-step.active')?.textContent ?? ''
}

function activeStepCard(): HTMLElement {
  const card = document.querySelector<HTMLElement>('.form-step.active .quick-upload-card')
  if (!card) throw new Error('upload card not found')
  return card
}

/** The success section stays mounted too — only its `.active` class flips. */
function successScreenIsActive(): boolean {
  return (
    document.querySelector('#successScreen')?.closest('.form-step')?.classList.contains('active') ?? false
  )
}

function activeFileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('.form-step.active input[type="file"]')
  if (!input) throw new Error('file input not found')
  return input
}

/** Minimal account details so the wizard renders a realistic step-5 draft. */
function seededForm() {
  const form = createEmptySupplierApplicationForm()
  form.supplierChoice = 'individual_guide'
  form.account = {
    firstName: 'Ada',
    lastName: 'Mensah',
    email: 'ada@example.com',
    phone: '0244000000',
    phoneCountryCode: '+233',
  }
  return form
}

function seedVerificationStep() {
  saveSupplierApplicationDraft(null, { step: 4, form: seededForm() })
}

function seedReviewStep() {
  const form = seededForm()
  form.compliance = { acceptedTerms: true, agreedToPayoutTerms: true }
  saveSupplierApplicationDraft(null, { step: 6, form })
}

describe('SupplierApplicationForm', () => {
  beforeEach(() => {
    mocks.user = null
    mocks.registerWithEmail.mockReset()
    mocks.setAccountPassword.mockReset()
    mocks.applyAsSupplier.mockReset()
    mocks.applyAsSupplier.mockResolvedValue({})
    mocks.getSupplierApplicationStatus.mockReset()
    mocks.getSupplierApplicationStatus.mockResolvedValue(null)
    confettiMock.mockClear()
    confettiMock.reset.mockClear()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('offers password fields on step 1 when signed out, and an identity notice when signed in', () => {
    const { unmount } = render(<SupplierApplicationForm />)
    expect(screen.getByText('Create your supplier account')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('At least 8 characters')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Repeat password')).toBeInTheDocument()
    unmount()

    mocks.user = { id: 'u1', name: 'Ada Mensah', email: 'ada@example.com', hasPassword: true }
    render(<SupplierApplicationForm />)
    // Email/password accounts cannot change their password here.
    expect(screen.queryByPlaceholderText('At least 8 characters')).toBeNull()
    expect(screen.getByText(/signed in as/i)).toBeInTheDocument()
  })

  it('offers an optional password to Google accounts, and saves it on Continue', async () => {
    mocks.user = { id: 'u1', name: 'Ada Mensah', email: 'ada@example.com', hasPassword: false }
    mocks.setAccountPassword.mockResolvedValue({ id: 'u1', hasPassword: true })

    render(<SupplierApplicationForm />)
    expect(screen.getByText(/signed in with google/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('At least 8 characters')).toBeInTheDocument()

    // The session email/name prefill lands just after mount.
    await screen.findByDisplayValue('ada@example.com')
    fireEvent.change(screen.getByPlaceholderText('e.g. 024 123 4567'), { target: { value: '0244000000' } })
    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'supersecret' } })
    fireEvent.change(screen.getByPlaceholderText('Repeat password'), { target: { value: 'supersecret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(mocks.setAccountPassword).toHaveBeenCalledWith('supersecret'))
    expect(activeStepText()).toContain('How are you joining TravioGhana?')
  })

  it('lets a Google account skip the optional password', async () => {
    mocks.user = { id: 'u1', name: 'Ada Mensah', email: 'ada@example.com', hasPassword: false }

    render(<SupplierApplicationForm />)
    await screen.findByDisplayValue('ada@example.com')
    fireEvent.change(screen.getByPlaceholderText('e.g. 024 123 4567'), { target: { value: '0244000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(activeStepText()).toContain('How are you joining TravioGhana?'))
    expect(mocks.setAccountPassword).not.toHaveBeenCalled()
  })

  it('rejects a half-filled optional password instead of silently skipping it', () => {
    mocks.user = { id: 'u1', name: 'Ada Mensah', email: 'ada@example.com', hasPassword: false }

    render(<SupplierApplicationForm />)
    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(mocks.setAccountPassword).not.toHaveBeenCalled()
  })

  it('blocks Continue until the account details (and password) are valid', () => {
    render(<SupplierApplicationForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByText('First name is required')).toBeInTheDocument()
    expect(screen.getByText('Last name is required')).toBeInTheDocument()
    expect(screen.getByText('Email address is required')).toBeInTheDocument()
    expect(screen.getByText('Phone / WhatsApp number is required')).toBeInTheDocument()
    expect(screen.getByText('Create a password for your supplier account')).toBeInTheDocument()
    expect(mocks.registerWithEmail).not.toHaveBeenCalled()
  })

  it('creates the account on Continue, then moves on to the supplier-type step', async () => {
    mocks.registerWithEmail.mockImplementation(async (name: string, email: string) => {
      mocks.user = { id: 'u1', name, email }
      return mocks.user
    })

    render(<SupplierApplicationForm />)
    fillAccountStep()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() =>
      expect(mocks.registerWithEmail).toHaveBeenCalledWith('Ada Mensah', 'ada@example.com', 'supersecret')
    )
    await waitFor(() => expect(activeStepText()).toContain('How are you joining TravioGhana?'))
    // Passwords are cleared and the fields are gone once the session exists.
    expect(screen.queryByPlaceholderText('At least 8 characters')).toBeNull()
  })

  it('points an existing account at sign-in instead of failing silently', async () => {
    const onOpenAuth = vi.fn()
    mocks.registerWithEmail.mockRejectedValue(new Error('An account with this email already exists'))

    render(<SupplierApplicationForm onOpenAuth={onOpenAuth} />)
    fillAccountStep()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText(/already exists — sign in to continue/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /sign in instead/i }))
    expect(onOpenAuth).toHaveBeenCalledWith('signin')
    // Stayed on step 1.
    expect(screen.getByText('Create your supplier account')).toBeInTheDocument()
  })

  it('uses the checkout phone input: country code plus a digits-only number', () => {
    render(<SupplierApplicationForm />)

    const countrySelect = screen.getByLabelText('Country calling code') as HTMLSelectElement
    expect(countrySelect.value).toBe('+233') // Ghana default
    expect(countrySelect.options.length).toBeGreaterThan(100) // full libphonenumber list

    const tel = screen.getByPlaceholderText('e.g. 024 123 4567') as HTMLInputElement
    fireEvent.change(tel, { target: { value: '024abc400 0000' } })
    expect(tel.value).toBe('0244000000') // letters, spaces and symbols stripped

    fireEvent.change(countrySelect, { target: { value: '+1' } })
    expect(countrySelect.value).toBe('+1')
    expect(tel.value).toBe('0244000000') // the number typed so far is kept
  })

  it('rejects a phone number that is invalid for the selected country', () => {
    render(<SupplierApplicationForm />)
    fillAccountStep()
    fireEvent.change(screen.getByLabelText('Country calling code'), { target: { value: '+1' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. 024 123 4567'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      screen.getByText('Enter a valid phone number for the selected country, e.g. 024 123 4567')
    ).toBeInTheDocument()
    expect(mocks.registerWithEmail).not.toHaveBeenCalled()
  })

  it('rejects an oversized document before anything is uploaded', async () => {
    seedVerificationStep()
    render(<SupplierApplicationForm />)

    await waitFor(() => expect(activeStepText()).toContain('Quick verification'))

    const tooBig = new File(['x'], 'passport.pdf', { type: 'application/pdf' })
    Object.defineProperty(tooBig, 'size', { value: 11 * 1024 * 1024 })
    fireEvent.change(activeFileInput(), { target: { files: [tooBig] } })

    expect(
      await screen.findByText(/the largest document we accept is 10.0 MB/i)
    ).toBeInTheDocument()
    expect(activeStepText()).toContain('No file selected')
    expect(mocks.applyAsSupplier).not.toHaveBeenCalled()
  })

  it('shows a spinner while a photo is read, then a preview with remove', async () => {
    seedVerificationStep()
    const bitmap = { close: vi.fn() }
    let releaseBitmap: (() => void) | null = null
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(
        () =>
          new Promise((resolve) => {
            releaseBitmap = () => resolve(bitmap)
          })
      )
    )
    const urlWithBlob = URL as unknown as {
      createObjectURL?: (file: Blob) => string
      revokeObjectURL?: (url: string) => void
    }
    urlWithBlob.createObjectURL = vi.fn(() => 'blob:preview-id')
    urlWithBlob.revokeObjectURL = vi.fn()

    try {
      render(<SupplierApplicationForm />)
      await waitFor(() => expect(activeStepText()).toContain('Quick verification'))

      const photo = new File(['photo'], 'ghana-card.png', { type: 'image/png' })
      fireEvent.change(activeFileInput(), { target: { files: [photo] } })

      // Real work behind the loader: the image is decoded before it is accepted.
      await waitFor(() => expect(activeStepCard().className).toContain('is-preparing'))
      expect(document.querySelector('.form-step.active .doc-spinner')).not.toBeNull()
      expect(activeStepText()).toContain('Preparing your document…')

      await act(async () => {
        releaseBitmap?.()
      })

      await waitFor(() => expect(activeStepCard().className).toContain('uploaded'))
      expect(activeStepText()).toContain('Uploads securely when you submit your application.')
      const thumb = document.querySelector<HTMLImageElement>('.form-step.active .doc-thumb')
      expect(thumb?.getAttribute('src')).toBe('blob:preview-id')
      expect(activeStepText()).toContain('ghana-card.png')

      // Remove clears the choice and revokes the preview URL.
      fireEvent.click(screen.getByRole('button', { name: /remove/i }))
      await waitFor(() => expect(activeStepText()).toContain('No file selected'))
      expect(urlWithBlob.revokeObjectURL).toHaveBeenCalledWith('blob:preview-id')
      expect(activeStepText()).not.toContain('ghana-card.png')
    } finally {
      delete urlWithBlob.createObjectURL
      delete urlWithBlob.revokeObjectURL
      vi.unstubAllGlobals()
    }
  })

  it('converts a photo the pipeline cannot accept (HEIC) to JPEG before upload', async () => {
    seedVerificationStep()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 4032, height: 3024, close: vi.fn() }))
    )
    const context = { drawImage: vi.fn() }
    const toBlob = vi.fn((callback: (blob: Blob | null) => void) =>
      callback(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }))
    )
    const createElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'canvas') {
        return { width: 0, height: 0, getContext: () => context, toBlob } as unknown as HTMLElement
      }
      return createElement(tagName)
    }) as typeof document.createElement)
    const urlWithBlob = URL as unknown as { createObjectURL?: (file: Blob) => string }
    urlWithBlob.createObjectURL = vi.fn(() => 'blob:converted')

    try {
      render(<SupplierApplicationForm />)
      await waitFor(() => expect(activeStepText()).toContain('Quick verification'))

      const heic = new File(['heic-bytes'], 'IMG_1234.HEIC', { type: 'image/heic' })
      fireEvent.change(activeFileInput(), { target: { files: [heic] } })

      // Re-encoded to a JPEG file, so the backend/Cloudinary accepts it.
      await waitFor(() => expect(activeStepText()).toContain('IMG_1234.jpg'))
      expect(context.drawImage).toHaveBeenCalled()
      // The toast lives outside the step, so assert it on the whole wizard.
      expect(screen.getByText('Photo prepared for upload')).toBeInTheDocument()
      expect(activeStepText()).not.toContain('IMG_1234.HEIC')
    } finally {
      delete urlWithBlob.createObjectURL
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
    }
  })

  it('reports real document upload progress on submit', async () => {
    seedReviewStep()
    let finishUpload: (() => void) | null = null
    mocks.applyAsSupplier.mockImplementation(
      (_payload, onProgress) =>
        new Promise((resolve) => {
          onProgress?.(42)
          finishUpload = () => {
            onProgress?.(100)
            resolve({ supplierProfile: { id: 's1' } })
          }
        })
    )
    mocks.getSupplierApplicationStatus.mockResolvedValue({ id: 's1', userId: 'u1', status: 'PENDING' })

    render(<SupplierApplicationForm />)
    await waitFor(() => expect(activeStepText()).toContain('Review your setup'))

    fireEvent.click(screen.getByRole('button', { name: 'Create supplier profile' }))

    // Percentage in the submit button, a working progressbar and a visible strip.
    expect(
      await screen.findByRole('button', { name: /Uploading documents… 42%/ })
    ).toBeInTheDocument()
    const strip = document.querySelector('.upload-progress-strip')
    expect(strip?.textContent).toContain('Uploading your document…')
    expect(strip?.textContent).toContain('42%')
    expect(
      document.querySelector('.upload-progress-strip [role="progressbar"]')?.getAttribute('aria-valuenow')
    ).toBe('42')

    await act(async () => {
      finishUpload?.()
    })

    await waitFor(() =>
      expect(screen.getByText('Your supplier account is ready')).toBeInTheDocument()
    )
  })

  it('hands an auto-accepted supplier to their dashboard after a short pause', async () => {
    seedReviewStep()
    mocks.applyAsSupplier.mockResolvedValue({ supplierProfile: { id: 's1' } })
    mocks.getSupplierApplicationStatus.mockResolvedValue({ id: 's1', userId: 'u1', status: 'ACTIVE' })
    const onSubmitted = vi.fn()

    render(<SupplierApplicationForm onSubmitted={onSubmitted} />)
    await waitFor(() => expect(activeStepText()).toContain('Review your setup'))

    fireEvent.click(screen.getByRole('button', { name: 'Create supplier profile' }))

    // The account is live on submission, so the success screen promises the
    // dashboard and the parent is asked to refresh the status (the refresh is
    // what performs the SSO redirect once the account reads back as ACTIVE).
    await waitFor(() => expect(successScreenIsActive()).toBe(true))
    expect(screen.getByText(/Taking you to your supplier dashboard/)).toBeInTheDocument()
    expect(onSubmitted).not.toHaveBeenCalled()
    // The celebration is the same canvas-confetti burst as the tour-submitted
    // screen on the supplier dashboard.
    expect(confettiMock).toHaveBeenCalled()

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 4100))
    })
    expect(onSubmitted).toHaveBeenCalledTimes(1)
  }, 10000)
})
