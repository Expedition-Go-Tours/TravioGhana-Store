import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

// Stripe throws exactly this once an Element has been destroyed — which is
// what it does itself when the element fails to load.
const h = vi.hoisted(() => {
  const destroyed =
    'IntegrationError: This Element has already been destroyed. Please create a new one.'
  const handlers: Record<string, (event: unknown) => void> = {}
  const paymentElement = {
    mount: vi.fn(),
    on: vi.fn((event: string, cb: (event: unknown) => void) => {
      handlers[event] = cb
    }),
    unmount: vi.fn(() => {
      throw new Error(destroyed)
    }),
    destroy: vi.fn(() => {
      throw new Error(destroyed)
    }),
  }
  const stripe = {
    elements: () => ({ create: () => paymentElement }),
  }
  return { handlers, paymentElement, stripe, destroyed }
})

vi.mock('../../lib/stripe', () => ({
  getStripePromise: () => Promise.resolve(h.stripe),
}))

vi.mock('./api', () => ({
  createSetupIntent: () => Promise.resolve('seti_test_secret'),
}))

import AddCardModal from './AddCardModal'

async function mountModal() {
  const view = render(<AddCardModal onClose={() => {}} onAdded={() => {}} />)
  await waitFor(() => expect(h.paymentElement.on).toHaveBeenCalled())
  return view
}

describe('AddCardModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(h.handlers)) delete h.handlers[key]
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('surfaces a Stripe load failure instead of spinning on a dead element', async () => {
    await mountModal()

    act(() => {
      h.handlers.loaderror({
        elementType: 'payment',
        error: { message: 'The SetupIntent is in a state that cannot be used.' },
      })
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The SetupIntent is in a state that cannot be used.',
    )
    expect(screen.getByRole('button', { name: /save card/i })).toBeDisabled()
  })

  it('falls back to the generic message when Stripe gives no error text', async () => {
    await mountModal()

    act(() => {
      h.handlers.loaderror({ elementType: 'payment', error: undefined })
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Secure card collection is unavailable',
    )
  })

  it('unmounts cleanly after Stripe has already destroyed the element', async () => {
    const { unmount } = await mountModal()

    act(() => {
      h.handlers.loaderror({ elementType: 'payment', error: { message: 'boom' } })
    })

    expect(() => unmount()).not.toThrow()
  })

  it('unmounts cleanly without any load error', async () => {
    const { unmount } = await mountModal()
    expect(() => unmount()).not.toThrow()
  })
})
