import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CancelBookingModal from './CancelBookingModal'

const base = {
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  isPending: false,
  error: null,
  refundPct: 0,
  isPaid: true,
  bookingNumber: 'TRG-1',
  tourTitle: 'Shai Hills Safari',
  currency: 'USD',
}

async function reachNoRefundStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /yes, continue/i }))
  await user.click(screen.getByText('My schedule changed'))
  await user.click(screen.getByRole('button', { name: /continue/i }))
}

describe('CancelBookingModal same-day request', () => {
  it('asks for supplier approval instead of promising an instant cancellation', async () => {
    const user = userEvent.setup()
    render(<CancelBookingModal {...base} requiresApproval />)

    await reachNoRefundStep(user)

    expect(screen.getByText(/cancellation needs the supplier's approval/i)).toBeInTheDocument()
    expect(screen.getByText(/if approved, the booking is cancelled and you will not receive a refund/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send cancellation request/i })).toBeInTheDocument()
  })

  it('keeps the normal late-cancellation copy when approval is not required', async () => {
    const user = userEvent.setup()
    render(<CancelBookingModal {...base} />)

    await reachNoRefundStep(user)

    expect(screen.getByText(/cancellation not eligible for refund/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /proceed to cancel/i })).toBeInTheDocument()
  })

  it('sends the selected reason through onConfirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<CancelBookingModal {...base} onConfirm={onConfirm} requiresApproval />)

    await reachNoRefundStep(user)
    await user.click(screen.getByRole('button', { name: /send cancellation request/i }))

    expect(onConfirm).toHaveBeenCalledWith('SCHEDULE_CHANGED', undefined)
  })
})
