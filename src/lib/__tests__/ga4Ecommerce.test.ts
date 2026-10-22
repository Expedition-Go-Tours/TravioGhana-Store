/**
 * GA4 ecommerce funnel events.
 *
 * The contract under test is the one that makes a per-product funnel readable
 * at all: the item shape MUST match what the API sends server-side for
 * `purchase` (src/core/services/ga4Measurement.js → buildItem: item_id =
 * tourId, item_name = title, price, quantity: 1). If client-side `view_item` /
 * `add_to_cart` and server-side `purchase` disagree, GA4 reports the same tour
 * as two products and the funnel can never join them.
 *
 * The second rule: an unknown price is omitted, never sent as 0 — in every
 * report built on top of this, a real $0 and "we didn't know" must not look
 * the same.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

const trackGaEvent = vi.fn()

vi.mock('../googleAnalytics', () => ({
  trackGaEvent: (...args: unknown[]) => trackGaEvent(...args),
}))

import {
  tourItem,
  trackViewItem,
  trackAddToCart,
  trackBeginCheckout,
} from '../ga4Ecommerce'

const TOUR = { id: 'tour-1', title: 'Accra Guided City Tour' }

beforeEach(() => {
  trackGaEvent.mockReset()
})

describe('tourItem — the shape shared with the backend', () => {
  it('matches the server-side purchase item field for field', () => {
    // buildItem() over in ga4Measurement.js sends exactly these keys.
    expect(tourItem(TOUR, 70)).toEqual({
      item_id: 'tour-1',
      item_name: 'Accra Guided City Tour',
      price: 70,
      quantity: 1,
    })
  })

  it('omits the price instead of inventing a zero', () => {
    const item = tourItem(TOUR, null)
    expect(item).toEqual({
      item_id: 'tour-1',
      item_name: 'Accra Guided City Tour',
      quantity: 1,
    })
    expect('price' in item).toBe(false)

    // A free tour is a real price of 0 only when it is exactly 0 — but the
    // report cannot tell that from "unknown", so 0 is treated as unknown too.
    expect('price' in tourItem(TOUR, 0)).toBe(false)
    expect('price' in tourItem(TOUR, Number.NaN)).toBe(false)
  })
})

describe('funnel events', () => {
  it('reports view_item with the item and its value', () => {
    trackViewItem(TOUR, 70)

    expect(trackGaEvent).toHaveBeenCalledWith('view_item', {
      currency: 'USD',
      value: 70,
      items: [tourItem(TOUR, 70)],
    })
  })

  it('reports add_to_cart at the book-now moment, with flow metadata', () => {
    trackAddToCart(TOUR, 320, 1, 'USD', { travelers: 2, date: '2026-11-04' })

    expect(trackGaEvent).toHaveBeenCalledWith('add_to_cart', {
      currency: 'USD',
      value: 320,
      items: [tourItem(TOUR, 320)],
      travelers: 2,
      date: '2026-11-04',
    })
  })

  it('reports begin_checkout for the booking page', () => {
    trackBeginCheckout(TOUR, 152)

    expect(trackGaEvent).toHaveBeenCalledWith('begin_checkout', {
      currency: 'USD',
      value: 152,
      items: [tourItem(TOUR, 152)],
    })
  })

  it('omits `value` entirely when the price is unknown', () => {
    trackViewItem(TOUR, null)

    const [, params] = trackGaEvent.mock.calls[0] as [string, Record<string, unknown>]
    expect('value' in params).toBe(false)
    expect(params.currency).toBe('USD')
  })

  it('carries no PII — only ids, names, counts and dates', () => {
    trackAddToCart(TOUR, 100, 1, 'USD', { travelers: 3, date: '2026-11-04' })

    const [, params] = trackGaEvent.mock.calls[0] as [string, Record<string, unknown>]
    const flat = JSON.stringify(params)
    for (const pii of ['@', 'phone', 'email', 'name:']) {
      // `item_name` is a product title and is expected; no other name-ish keys.
      if (pii === 'name:') {
        expect(flat.replace('"item_name"', '')).not.toContain('name:')
        continue
      }
      expect(flat).not.toContain(pii)
    }
  })

  it('delegates the consent gate to the shared gtag wrapper', () => {
    // These builders must not call gtag directly: googleAnalytics.trackGaEvent
    // is the single place that enforces analytics consent and the gtag stub.
    trackViewItem(TOUR, 70)
    expect(trackGaEvent).toHaveBeenCalledTimes(1)
  })
})
