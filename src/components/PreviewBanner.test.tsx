import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PreviewBanner from './PreviewBanner'
import { PREVIEW_BANNER_TEXT } from '../lib/previewEnvironment'

afterEach(() => {
  vi.unstubAllEnvs()
  document.documentElement.style.removeProperty('--preview-banner-height')
})

describe('PreviewBanner', () => {
  it('renders nothing on production', () => {
    vi.stubEnv('VITE_APP_ENV', 'production')
    const { container } = render(<PreviewBanner />)
    expect(container).toBeEmptyDOMElement()
    expect(document.documentElement.style.getPropertyValue('--preview-banner-height')).toBe('')
  })

  it('shows a non-dismissible warning on staging and publishes its height', () => {
    vi.stubEnv('VITE_APP_ENV', 'staging')
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => 44,
    })

    try {
      render(<PreviewBanner />)
      const banner = screen.getByRole('region', { name: 'Preview environment' })
      expect(banner).toHaveAttribute('data-preview-reason', 'app-env')
      expect(banner).toHaveTextContent(PREVIEW_BANNER_TEXT)
      expect(banner.querySelector('button')).toBeNull()
      expect(document.documentElement.style.getPropertyValue('--preview-banner-height')).toBe('44px')
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original)
      else Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight')
    }
  })

  it('clears the offset when the banner unmounts', () => {
    vi.stubEnv('VITE_APP_ENV', 'staging')
    const { unmount } = render(<PreviewBanner />)
    expect(document.documentElement.style.getPropertyValue('--preview-banner-height')).not.toBe('')
    unmount()
    expect(document.documentElement.style.getPropertyValue('--preview-banner-height')).toBe('')
  })
})
