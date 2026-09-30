import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PartnerResourcesPage from './PartnerResourcesPage'

/**
 * The toolkit page's job is to hand partners working snippets. These tests
 * check the two ways that silently breaks:
 *
 *   1. a snippet points at a non-canonical host or a file that isn't shipped;
 *   2. the copy button copies nothing (or the wrong thing).
 *
 * The on-disk half of (1) — that every /badges/* URL resolves to a real file —
 * lives in src/test/partnerAssets.test.ts.
 */

vi.mock('@/components/Footer', () => ({ default: () => <div>FOOTER</div> }))
vi.mock('@/components/SEO', () => ({ default: () => null, buildBreadcrumbSchema: () => ({}) }))

/** Every value handed to the clipboard, in order. */
const copied: string[] = []
const writeText = vi.fn(async (text: string) => {
  copied.push(text)
})

beforeEach(() => {
  copied.length = 0
  writeText.mockClear()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <PartnerResourcesPage />
    </MemoryRouter>,
  )

describe('partner resources page', () => {
  it('renders exactly one h1, as the prerender gate requires', () => {
    renderPage()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('shows an embed snippet for every badge, all on the canonical host', () => {
    renderPage()

    const snippets = [...document.querySelectorAll('.pr-code code')].map((el) => el.textContent ?? '')
    const badgeSnippets = snippets.filter((s) => s.includes('/badges/'))

    expect(badgeSnippets.length).toBeGreaterThanOrEqual(4)
    for (const snippet of badgeSnippets) {
      expect(snippet, `non-canonical host in: ${snippet}`).toContain('https://www.travioghana.com/badges/')
      expect(snippet).toContain('<img')
      expect(snippet).toContain('alt="Book on Travio Ghana"')
    }
  })

  it('copies the badge embed snippet to the clipboard', async () => {
    renderPage()

    const [firstCopy] = screen.getAllByRole('button', { name: 'Copy embed code' })
    fireEvent.click(firstCopy)

    await waitFor(() => expect(copied).toHaveLength(1))
    expect(copied[0]).toContain('https://www.travioghana.com/badges/')
    expect(copied[0]).toContain('utm_source=PARTNER')
    expect(copied[0]).toContain('rel="noopener"')
  })

  it('acknowledges the copy in the button label', async () => {
    renderPage()

    const [firstCopy] = screen.getAllByRole('button', { name: 'Copy embed code' })
    fireEvent.click(firstCopy)

    expect(await screen.findByText('Copied')).toBeInTheDocument()
  })

  it('links to the press kit for outlets writing about the brand', () => {
    renderPage()
    const pressLinks = screen.getAllByRole('link', { name: /press kit/i })
    expect(pressLinks.some((link) => link.getAttribute('href') === '/press')).toBe(true)
  })

  it('keeps the PARTNER token replaceable, never a hardcoded slug', () => {
    renderPage()
    const snippets = [...document.querySelectorAll('.pr-code code')].map((el) => el.textContent ?? '')
    const utmSnippets = snippets.filter((s) => s.includes('utm_source='))
    expect(utmSnippets.length).toBeGreaterThan(0)
    for (const snippet of utmSnippets) {
      expect(snippet, `a snippet hardcodes a partner slug: ${snippet}`).not.toMatch(/utm_source=(?!PARTNER|your-partner-slug)[a-z-]+/)
    }
  })
})
