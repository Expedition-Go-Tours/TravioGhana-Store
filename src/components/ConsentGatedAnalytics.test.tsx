/**
 * Vercel Analytics is a second analytics tag and obeys the same consent rule
 * as GA4 (lib/googleAnalytics.ts): denied until the visitor opts in, mounted
 * for a returning visitor who already consented, unmounted again on
 * withdrawal. It used to render unconditionally in main.tsx, reporting every
 * visitor regardless of the choice.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import ConsentGatedAnalytics from './ConsentGatedAnalytics'
import { clearConsent, writeConsent } from '../lib/cookieConsent'

vi.mock('@vercel/analytics/react', () => ({
  Analytics: () => <div data-testid="vercel-analytics" />,
}))

beforeEach(() => {
  clearConsent()
})

afterEach(() => {
  clearConsent()
  cleanup()
})

describe('ConsentGatedAnalytics', () => {
  it('renders nothing while analytics consent is denied', () => {
    render(<ConsentGatedAnalytics />)
    expect(screen.queryByTestId('vercel-analytics')).toBeNull()
  })

  it('mounts the tag once consent is granted mid-visit', () => {
    render(<ConsentGatedAnalytics />)
    act(() => {
      writeConsent({ analytics: true }, 'accept-all')
    })
    expect(screen.getByTestId('vercel-analytics')).toBeTruthy()
  })

  it('starts mounted for a returning visitor who already consented', () => {
    writeConsent({ analytics: true }, 'accept-all')
    render(<ConsentGatedAnalytics />)
    expect(screen.getByTestId('vercel-analytics')).toBeTruthy()
  })

  it('unmounts again when consent is withdrawn', () => {
    writeConsent({ analytics: true }, 'accept-all')
    render(<ConsentGatedAnalytics />)
    expect(screen.getByTestId('vercel-analytics')).toBeTruthy()

    act(() => {
      writeConsent({ analytics: false }, 'preferences')
    })
    expect(screen.queryByTestId('vercel-analytics')).toBeNull()
  })
})
