import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import BookingAccessPage from './BookingAccessPage'
import { fetchWithAuth } from '../lib/api'
import { setGuestToken } from '../lib/guestSession'
import { setAuthReturnTo } from '../lib/auth'

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})
vi.mock('../lib/api', () => ({ fetchWithAuth: vi.fn() }))
vi.mock('../lib/guestSession', () => ({ setGuestToken: vi.fn() }))
vi.mock('../lib/auth', () => ({ setAuthReturnTo: vi.fn() }))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/booking/access" element={<BookingAccessPage />} />
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
})

describe('BookingAccessPage', () => {
  it('exchanges the email token for a guest session and opens the confirmation', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(
      jsonResponse(200, {
        status: 'success',
        data: { guestToken: 'guest-token', booking: { id: 'b1', bookingNumber: 'TRG-1' } },
      }) as never,
    )

    renderAt('/booking/access?token=signed-token')

    await waitFor(() => expect(setGuestToken).toHaveBeenCalledWith('guest-token'))
    expect(fetchWithAuth).toHaveBeenCalledWith('/travioghana/bookings/access/exchange', {
      method: 'POST',
      body: JSON.stringify({ token: 'signed-token' }),
    })
    expect(navigate).toHaveBeenCalledWith('/booking/confirmation/b1', { replace: true })
  })

  it('sends a guest to sign in when the booking has since been claimed', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(
      jsonResponse(200, {
        status: 'success',
        data: { requireLogin: true, booking: { id: 'b1', bookingNumber: 'TRG-1' } },
      }) as never,
    )

    renderAt('/booking/access?token=signed-token')

    await waitFor(() =>
      expect(setAuthReturnTo).toHaveBeenCalledWith('/booking/confirmation/b1'),
    )
    expect(setGuestToken).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('shows the server message for an expired or invalid link', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(
      jsonResponse(400, { message: 'This booking link is invalid or has expired.' }) as never,
    )

    renderAt('/booking/access?token=bad-token')

    expect(await screen.findByRole('heading', { name: /this link has expired/i })).toBeInTheDocument()
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument()
    expect(setGuestToken).not.toHaveBeenCalled()
  })

  it('explains a link with no token without calling the API', () => {
    renderAt('/booking/access')

    expect(screen.getByText(/missing its access token/i)).toBeInTheDocument()
    expect(fetchWithAuth).not.toHaveBeenCalled()
  })
})
