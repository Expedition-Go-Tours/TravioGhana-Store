import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import VerifyEmailBanner from './VerifyEmailBanner'
import { useAuthUser } from '../../hooks/useAuthUser'
import { fetchWithAuth } from '../../lib/api'

vi.mock('../../hooks/useAuthUser', () => ({ useAuthUser: vi.fn() }))
vi.mock('../../lib/api', () => ({ fetchWithAuth: vi.fn() }))

function mockUser(overrides = {}) {
  vi.mocked(useAuthUser).mockReturnValue({
    id: 'u1',
    name: 'Ada Mensah',
    email: 'ada@example.com',
    emailVerified: false,
    ...overrides,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('VerifyEmailBanner', () => {
  it('prompts an unverified account to confirm its address', () => {
    mockUser()
    render(<VerifyEmailBanner />)

    expect(screen.getByText(/verify your email address/i)).toBeInTheDocument()
    expect(screen.getByText(/ada@example\.com/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend email/i })).toBeInTheDocument()
  })

  it('resends the verification link and confirms it was sent', async () => {
    mockUser()
    vi.mocked(fetchWithAuth).mockResolvedValue({ ok: true } as never)

    render(<VerifyEmailBanner />)
    fireEvent.click(screen.getByRole('button', { name: /resend email/i }))

    await waitFor(() => expect(fetchWithAuth).toHaveBeenCalledWith('/auth/verify-email/send', { method: 'POST' }))
    expect(await screen.findByText(/verification email sent/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /resend email/i })).not.toBeInTheDocument()
  })

  it('keeps the retry available when sending fails', async () => {
    mockUser()
    vi.mocked(fetchWithAuth).mockResolvedValue({ ok: false } as never)

    render(<VerifyEmailBanner />)
    fireEvent.click(screen.getByRole('button', { name: /resend email/i }))

    expect(await screen.findByText(/could not send it just now/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend email/i })).toBeInTheDocument()
  })

  it('stays quiet for verified accounts', () => {
    mockUser({ emailVerified: true })
    const { container } = render(<VerifyEmailBanner />)

    expect(container).toBeEmptyDOMElement()
  })

  it('stays quiet when the flag is unknown (older cached session)', () => {
    mockUser({ emailVerified: undefined })
    const { container } = render(<VerifyEmailBanner />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when signed out', () => {
    vi.mocked(useAuthUser).mockReturnValue(null)
    const { container } = render(<VerifyEmailBanner />)

    expect(container).toBeEmptyDOMElement()
  })
})
