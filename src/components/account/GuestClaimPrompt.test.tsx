import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import GuestClaimPrompt from './GuestClaimPrompt'
import { useGuestClaim } from '../../hooks/useGuestClaim'
import { toast } from 'sonner'

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})
vi.mock('../../hooks/useGuestClaim', () => ({ useGuestClaim: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

const preview = {
  canClaim: true,
  needsVerification: false,
  forUserId: 'u1',
  count: 2,
  bookings: [
    {
      id: 'b1',
      bookingNumber: 'TRG-1',
      tourTitle: 'Accra: Shai Hills Safari',
      travelDate: '2026-11-20T00:00:00.000Z',
      status: 'CONFIRMED',
      amount: 90,
      currency: 'USD',
      leadTravelerName: 'Ada Mensah',
    },
    {
      id: 'b2',
      bookingNumber: 'TRG-2',
      tourTitle: 'Cape Coast Castle Day Trip',
      travelDate: '2026-12-02T00:00:00.000Z',
      status: 'CONFIRMED',
      amount: 120,
      currency: 'USD',
      leadTravelerName: 'Kofi Mensah',
    },
  ],
}

function mockHook(overrides = {}) {
  const claim = vi.fn().mockResolvedValue({ claimed: 2 })
  const dismiss = vi.fn()
  vi.mocked(useGuestClaim).mockReturnValue({
    user: { id: 'u1', name: 'Ada Mensah', email: 'ada@example.com' },
    preview,
    busy: false,
    error: '',
    claim,
    dismiss,
    ...overrides,
  })
  return { claim, dismiss }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GuestClaimPrompt', () => {
  it('lists the verified-email bookings and labels a family booking', () => {
    mockHook()
    render(<GuestClaimPrompt />)

    expect(screen.getByRole('dialog', { name: /we found 2 bookings/i })).toBeInTheDocument()
    expect(screen.getByText(/ada@example\.com/i)).toBeInTheDocument()
    expect(screen.getByText('Accra: Shai Hills Safari')).toBeInTheDocument()
    // The second booking's lead traveller differs from the account name.
    expect(screen.getByText(/booked for kofi mensah/i)).toBeInTheDocument()
  })

  it('claims, confirms and opens the booking history', async () => {
    const { claim } = mockHook()
    render(<GuestClaimPrompt />)

    fireEvent.click(screen.getByRole('button', { name: /add to my account/i }))

    await waitFor(() => expect(claim).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('2 bookings added to your account'))
    expect(navigate).toHaveBeenCalledWith('/dashboard/bookings')
  })

  it('dismisses without claiming', () => {
    const { dismiss } = mockHook()
    render(<GuestClaimPrompt />)

    fireEvent.click(screen.getByRole('button', { name: /not now/i }))

    expect(dismiss).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when there is no preview', () => {
    mockHook({ preview: null, user: null })
    const { container } = render(<GuestClaimPrompt />)

    expect(container).toBeEmptyDOMElement()
  })
})
