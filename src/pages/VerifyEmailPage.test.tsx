import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import VerifyEmailPage from './VerifyEmailPage'
import { fetchWithAuth } from '../lib/api'
import {
  clearAuthReturnTo,
  getAuthReturnTo,
  getStoredAuthUser,
  refreshStoredUserFromBackend,
} from '../lib/auth'

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})
vi.mock('../lib/api', () => ({ fetchWithAuth: vi.fn() }))
vi.mock('../lib/auth', () => ({
  refreshStoredUserFromBackend: vi.fn(),
  getStoredAuthUser: vi.fn(() => null),
  getAuthReturnTo: vi.fn(() => null),
  clearAuthReturnTo: vi.fn(),
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getStoredAuthUser).mockReturnValue(null)
  vi.mocked(getAuthReturnTo).mockReturnValue(null)
  vi.mocked(refreshStoredUserFromBackend).mockResolvedValue(null)
})

describe('VerifyEmailPage', () => {
  it('posts the token and confirms the address without requiring sign-in', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(
      jsonResponse(200, { status: 'success', data: { user: { id: 'u1', email: 'ada@example.com' } } }) as never,
    )

    renderAt('/verify-email?token=signed-token')

    expect(await screen.findByRole('heading', { name: /email verified/i })).toBeInTheDocument()
    expect(fetchWithAuth).toHaveBeenCalledWith('/auth/verify-email/confirm', {
      method: 'POST',
      body: JSON.stringify({ token: 'signed-token' }),
    })
    expect(refreshStoredUserFromBackend).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /sign in to see your bookings/i })).toBeInTheDocument()
  })

  it('continues to the return path for a signed-in visitor', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(
      jsonResponse(200, { status: 'success', data: { user: { id: 'u1' } } }) as never,
    )
    vi.mocked(refreshStoredUserFromBackend).mockResolvedValue({ id: 'u1' })
    vi.mocked(getStoredAuthUser).mockReturnValue({ id: 'u1', email: 'ada@example.com' })
    vi.mocked(getAuthReturnTo).mockReturnValue('/booking/confirmation/b1')

    renderAt('/verify-email?token=signed-token')

    const button = await screen.findByRole('button', { name: /continue to my bookings/i })
    fireEvent.click(button)

    expect(clearAuthReturnTo).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/booking/confirmation/b1')
  })

  it('shows the server message for an expired link', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(
      jsonResponse(400, { message: 'This verification link is invalid or has expired.' }) as never,
    )

    renderAt('/verify-email?token=bad-token')

    expect(await screen.findByRole('heading', { name: /couldn't verify this link/i })).toBeInTheDocument()
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument()
  })

  it('explains a link with no token without calling the API', () => {
    renderAt('/verify-email')

    expect(screen.getByText(/missing its token/i)).toBeInTheDocument()
    expect(fetchWithAuth).not.toHaveBeenCalled()
  })
})
