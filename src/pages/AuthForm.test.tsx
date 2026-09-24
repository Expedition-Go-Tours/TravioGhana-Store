import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { GoogleOAuthProvider, useGoogleOneTapLogin } from '@react-oauth/google'
import AuthForm from './AuthForm'
import { registerWithEmail, signInWithEmail, signInWithGoogle } from '../lib/auth'

vi.mock('../lib/auth', () => ({
  signInWithEmail: vi.fn(),
  registerWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  setAuthReturnTo: vi.fn(),
  clearAuthReturnTo: vi.fn(),
  getAuthReturnTo: vi.fn(() => null),
}))

// The auth page must never run One Tap — the homepage GoogleOneTapPrompt is
// the single owner. If AuthForm ever imports this module again, the spies in
// the regression test below will catch it.
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: vi.fn(({ children }: { children?: unknown }) => children),
  useGoogleOneTapLogin: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

function renderAuth(props: Partial<Parameters<typeof AuthForm>[0]> = {}) {
  return render(
    <MemoryRouter>
      <AuthForm {...props} />
    </MemoryRouter>,
  )
}

function fillEmailPassword(email = 'ada@example.com', password = 'password123') {
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
}

function fillSignUp(confirm = 'password123') {
  fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Ada Lovelace' } })
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'ada@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: confirm } })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(signInWithEmail).mockResolvedValue({ id: 'u1', email: 'ada@example.com' })
  vi.mocked(registerWithEmail).mockResolvedValue({ id: 'u1', email: 'ada@example.com' })
  vi.mocked(signInWithGoogle).mockResolvedValue({ id: 'u1' })
})

describe('AuthForm', () => {
  it('renders the sign-in view by default', () => {
    renderAuth()

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
    expect(screen.getByText(/new to travio ghana\?/i)).toBeInTheDocument()
  })

  it('switches between sign-in and sign-up', () => {
    renderAuth()

    fireEvent.click(screen.getByRole('button', { name: /create an account/i }))
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('starts on sign-up when initialMode is signup', () => {
    renderAuth({ initialMode: 'signup' })
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
  })

  it('blocks sign-up when the passwords do not match', () => {
    renderAuth({ initialMode: 'signup' })
    fillSignUp('password456')

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    expect(registerWithEmail).not.toHaveBeenCalled()
  })

  it('registers with the entered values', async () => {
    renderAuth({ initialMode: 'signup' })
    fillSignUp()

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(registerWithEmail).toHaveBeenCalledWith('Ada Lovelace', 'ada@example.com', 'password123')
    })
  })

  it('passes the remember-me choice to sign-in', async () => {
    renderAuth()
    fillEmailPassword()

    fireEvent.click(screen.getByLabelText('Remember me'))
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(signInWithEmail).toHaveBeenCalledWith('ada@example.com', 'password123', { remember: false })
    })
  })

  it('shows the API error inline when sign-in fails', async () => {
    vi.mocked(signInWithEmail).mockRejectedValue(new Error('Invalid email or password'))
    renderAuth()
    fillEmailPassword()

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  })

  it('toggles password visibility', () => {
    renderAuth()
    const input = screen.getByLabelText('Password') as HTMLInputElement

    expect(input.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: /show password/i }))
    expect(input.type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: /hide password/i }))
    expect(input.type).toBe('password')
  })

  it('wires the back button to onBack', () => {
    const onBack = vi.fn()
    renderAuth({ onBack })

    const backButtons = screen.getAllByRole('button', { name: /^back$/i })
    expect(backButtons.length).toBeGreaterThan(0)
    fireEvent.click(backButtons[0])
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('never runs Google One Tap — the homepage prompt is the single owner', () => {
    renderAuth()

    expect(vi.mocked(useGoogleOneTapLogin)).not.toHaveBeenCalled()
    expect(vi.mocked(GoogleOAuthProvider)).not.toHaveBeenCalled()
    // Google sign-in on this page is only the explicit button.
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('starts Google sign-in from the button', async () => {
    renderAuth()

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() => {
      expect(signInWithGoogle).toHaveBeenCalledWith({ remember: true })
    })
  })
})
