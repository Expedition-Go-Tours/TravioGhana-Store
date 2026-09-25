import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import SocialBrandIcon from './SocialBrandIcon'

/**
 * The supplier profile's social pills used to render generic lucide stand-ins
 * (Facebook was a share arrow, LinkedIn/Pinterest a chain link). These tests pin
 * a real brand path per supported network and the generic fallback for unknown
 * ones.
 *
 * The glyphs also carry their own brand colour rather than inheriting
 * `currentColor` from the pill — inheriting meant the mark turned green when
 * the pill was hovered, and Instagram collapsed to a single flat hue.
 */

const NETWORKS = ['instagram', 'facebook', 'tiktok', 'youtube', 'twitter', 'linkedin', 'pinterest', 'whatsapp']

const BRAND_COLORS: Record<string, string> = {
  facebook: '#1877F2',
  tiktok: '#010101',
  youtube: '#FF0000',
  twitter: '#000000',
  linkedin: '#0A66C2',
  pinterest: '#E60023',
  whatsapp: '#25D366',
}

/** jsdom normalises colours, so compare through the same normaliser. */
function normaliseColor(value: string): string {
  const probe = document.createElement('span')
  probe.style.color = value
  return probe.style.color
}

describe('SocialBrandIcon', () => {
  it('renders a distinct brand path for every supported network', () => {
    const paths = new Set<string>()

    for (const network of NETWORKS) {
      const { container, unmount } = render(<SocialBrandIcon network={network} size={14} />)
      const svg = container.querySelector('svg')
      const path = svg?.querySelector('path')

      expect(svg, network).toBeTruthy()
      expect(svg?.getAttribute('width'), network).toBe('14')
      expect(path?.getAttribute('d'), network).toBeTruthy()
      // Instagram's mark is a gradient; every other network paints flat.
      if (network === 'instagram') {
        expect(svg?.getAttribute('fill')).toMatch(/^url\(#/)
      } else {
        expect(svg?.getAttribute('fill'), network).toBe('currentColor')
      }

      paths.add(path!.getAttribute('d')!)
      unmount()
    }

    // No two networks share a glyph — a generic fallback everywhere would fail this.
    expect(paths.size).toBe(NETWORKS.length)
  })

  it('paints each glyph in its own brand colour', () => {
    for (const [network, hex] of Object.entries(BRAND_COLORS)) {
      const { container, unmount } = render(<SocialBrandIcon network={network} size={14} />)
      const svg = container.querySelector('svg') as SVGElement

      expect(getComputedStyle(svg).color, network).toBe(normaliseColor(hex))
      unmount()
    }
  })

  it('keeps its brand colour inside a green hover state', () => {
    // The pill used to hover green and drag the glyph with it.
    const { container } = render(
      <span style={{ color: '#179237' }}>
        <SocialBrandIcon network="facebook" size={14} />
      </span>,
    )
    const svg = container.querySelector('svg') as SVGElement

    expect(getComputedStyle(svg).color).toBe(normaliseColor('#1877F2'))
    expect(getComputedStyle(svg).color).not.toBe(normaliseColor('#179237'))
  })

  it('gives Instagram the multi-stop brand gradient', () => {
    const { container } = render(<SocialBrandIcon network="instagram" size={14} />)
    const gradient = container.querySelector('linearGradient')
    const stops = [...container.querySelectorAll('stop')].map((stop) => stop.getAttribute('stop-color'))

    expect(gradient).toBeTruthy()
    expect(stops).toEqual(['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5'])
    // unique id per instance, so two icons on a page cannot share one definition
    expect(gradient?.getAttribute('id')).toBeTruthy()
  })

  it('maps each network case-insensitively and falls back for unknown ones', () => {
    const { container: upper } = render(<SocialBrandIcon network="INSTAGRAM" />)
    const { container: known } = render(<SocialBrandIcon network="instagram" />)
    expect(upper.querySelector('path')?.getAttribute('d')).toBe(known.querySelector('path')?.getAttribute('d'))

    const { container: unknown } = render(<SocialBrandIcon network="mastodon" />)
    const svg = unknown.querySelector('svg')
    expect(svg).toBeTruthy()
    // lucide fallback carries its own class family, not a brand path we define.
    expect(svg?.getAttribute('class') || '').toContain('lucide')
  })
})
