/**
 * The PayPal return route.
 *
 * PayPal hands the customer back to this exact URL with ?token=<orderId>, so
 * the page has to be right the first time: it may arrive signed-out, twice,
 * before the webhook, or after the webhook already made the booking. It must
 * never declare success on its own — only a Booking id may navigate.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  setAuthReturnTo: vi.fn(),
  search: '?token=ORDER-1',
  user: { email: 'buyer@example.com' } as { email: string } | null,
  capture: {
    mutate: vi.fn(),
    data: undefined as unknown,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null as unknown,
  },
  poll: {
    data: undefined as unknown,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  },
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => h.navigate,
  useSearchParams: () => [new URLSearchParams(h.search)],
  useLocation: () => ({ pathname: '/booking/paypal/return', search: h.search }),
}))

vi.mock('../hooks/useAuthUser', () => ({ useAuthUser: () => h.user }))
vi.mock('../lib/auth', () => ({ setAuthReturnTo: h.setAuthReturnTo }))
vi.mock('../hooks/useExpeditionBookings', () => ({
  useCapturePaypalPayment: () => h.capture,
  useBookingByPaypalOrder: () => h.poll,
}))

import PaypalReturnPage from './PaypalReturnPage'

beforeEach(() => {
  h.navigate.mockReset()
  h.setAuthReturnTo.mockReset()
  h.search = '?token=ORDER-1'
  h.user = { email: 'buyer@example.com' }
  h.capture.mutate.mockReset()
  h.capture.data = undefined
  h.capture.isPending = false
  h.capture.isSuccess = false
  h.capture.isError = false
  h.capture.error = null
  h.poll.data = undefined
  h.poll.isError = false
  h.poll.isLoading = false
})

describe('PaypalReturnPage', () => {
  it('refuses to act without a payment reference', () => {
    h.search = ''
    render(<PaypalReturnPage />)

    expect(screen.getByText(/couldn't find that payment/i)).toBeTruthy()
    expect(h.capture.mutate).not.toHaveBeenCalled()
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it('routes a signed-out customer through login, preserving where they came from', () => {
    h.user = null
    render(<PaypalReturnPage />)

    expect(h.setAuthReturnTo).toHaveBeenCalledWith('/booking/paypal/return?token=ORDER-1')
    expect(h.navigate).toHaveBeenCalledWith('/login', { replace: true })
    // Nothing may be captured without the booking owner's session.
    expect(h.capture.mutate).not.toHaveBeenCalled()
  })

  it('captures the order exactly once, on mount', () => {
    render(<PaypalReturnPage />)

    expect(h.capture.mutate).toHaveBeenCalledTimes(1)
    expect(h.capture.mutate).toHaveBeenCalledWith('ORDER-1')
    // Still in flight — never a premature success.
    expect(h.navigate).not.toHaveBeenCalled()
    expect(screen.getByText(/confirming your payment/i)).toBeTruthy()
  })

  it('navigates to the confirmation once the capture returns a booking', () => {
    h.capture.data = { status: 'PAID', booking: { id: 'booking_1' } }
    h.capture.isSuccess = true
    render(<PaypalReturnPage />)

    expect(h.navigate).toHaveBeenCalledWith('/booking/confirmation/booking_1', { replace: true })
  })

  it('keeps waiting when PayPal reports the capture is still processing', () => {
    h.capture.data = { status: 'PROCESSING' }
    h.capture.isPending = false
    h.capture.isSuccess = true
    h.poll.data = { status: 'HOLDING' }
    render(<PaypalReturnPage />)

    expect(screen.getByText(/still confirming/i)).toBeTruthy()
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it('shows the server\'s own refusal instead of an endless spinner', () => {
    h.capture.isError = true
    h.capture.error = new Error('This booking hold ended before payment completed. You have been refunded in full.')
    render(<PaypalReturnPage />)

    expect(screen.getByText(/refunded in full/i)).toBeTruthy()
    expect(screen.getByText(/couldn't be completed/i)).toBeTruthy()
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it('reports a refunded hold found by polling (webhook won the race)', () => {
    h.poll.data = { status: 'REFUNDED' }
    render(<PaypalReturnPage />)

    expect(screen.getByRole('heading', { name: /you have been refunded/i })).toBeTruthy()
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it('reports an expired hold without claiming a payment happened', () => {
    h.poll.data = { status: 'EXPIRED' }
    render(<PaypalReturnPage />)

    expect(screen.getByText(/hold expired/i)).toBeTruthy()
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it('follows the webhook when it materialised the booking first', () => {
    h.poll.data = { status: 'PAID', booking: { id: 'booking_webhook' } }
    render(<PaypalReturnPage />)

    expect(h.navigate).toHaveBeenCalledWith('/booking/confirmation/booking_webhook', { replace: true })
  })
})
