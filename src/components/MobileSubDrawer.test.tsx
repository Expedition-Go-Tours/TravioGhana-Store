import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import MobileSubDrawer from './MobileSubDrawer'

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn() }))

vi.mock('../lib/api', () => ({ fetchWithAuth: mocks.fetchWithAuth }))

/**
 * The drawer used to carry language and currency tabs as well as updates. Those
 * moved to the shared LanguageCurrencyModal, so this pins what is left: the
 * updates preview and its "mark all as read" action.
 */
describe('MobileSubDrawer (updates)', () => {
  beforeEach(() => {
    cleanup()
    mocks.fetchWithAuth.mockReset()
  })

  it('renders the latest notifications', async () => {
    mocks.fetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          notifications: [
            { id: 'n1', title: 'Booking confirmed', message: 'Your Accra city tour is confirmed.', read: false, createdAt: new Date().toISOString() },
          ],
        },
      }),
    })

    render(<MobileSubDrawer tab="updates" onClose={() => {}} onNavigate={() => {}} />)

    expect(await screen.findByText('Booking confirmed')).toBeInTheDocument()
    expect(screen.getByText('Your Accra city tour is confirmed.')).toBeInTheDocument()
    expect(mocks.fetchWithAuth).toHaveBeenCalledWith('/notifications?page=1&limit=5')
  })

  it('marks everything read and clears the list', async () => {
    mocks.fetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          notifications: [
            { id: 'n1', title: 'Booking confirmed', message: 'Confirmed.', read: false, createdAt: new Date().toISOString() },
          ],
        },
      }),
    })

    render(<MobileSubDrawer tab="updates" onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('Booking confirmed')

    fireEvent.click(screen.getByText('Mark all as read'))

    await waitFor(() =>
      expect(mocks.fetchWithAuth).toHaveBeenCalledWith('/notifications/mark-all-read', { method: 'PATCH' }),
    )
    expect(screen.queryByText('Booking confirmed')).not.toBeInTheDocument()
    expect(screen.getByText('You are all caught up.')).toBeInTheDocument()
  })

  it('renders nothing when no tab is selected', () => {
    const { container } = render(<MobileSubDrawer tab={null} onClose={() => {}} onNavigate={() => {}} />)

    expect(container.querySelector('.nav-subdrawer')).toBeNull()
  })
})
