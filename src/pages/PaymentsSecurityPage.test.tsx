import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import PaymentsSecurityPage from './PaymentsSecurityPage'

vi.mock('@/components/Footer', () => ({ default: () => <div>FOOTER</div> }))

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/payments-and-security']}>
        <Routes>
          <Route path="/payments-and-security" element={<PaymentsSecurityPage />} />
          <Route path="/tours" element={<div>TOURS_ROUTE</div>} />
          <Route path="/contact-us" element={<div>CONTACT_ROUTE</div>} />
          <Route path="/refund-policy" element={<div>REFUND_ROUTE</div>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

const JUMP_IDS = [
  'responsibility',
  'security',
  'ways-to-pay',
  'pay-later',
  'refunds',
  'stay-safe',
  'questions',
]

/**
 * jsdom performs no layout, so every rect is zero and the scroll-spy would
 * always fall through to the last section. Hand it the geometry it reads: a
 * 64px navbar and a 54px jump nav, putting the activation line at 118px.
 *
 * `above` lists the sections the reader has scrolled past; they are placed
 * above that line and the rest below it, exactly as the real page does.
 */
function stubScrollLayout(above: string[]) {
  const rect = (o: Partial<DOMRect>) =>
    ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...o }) as DOMRect

  const navbar = document.createElement('div')
  navbar.className = 'navbar'
  document.body.appendChild(navbar)
  vi.spyOn(navbar, 'getBoundingClientRect').mockReturnValue(rect({ bottom: 64, height: 64 }))
  vi.spyOn(navbar.querySelector('.navbar') ?? navbar, 'getBoundingClientRect')

  const nav = document.querySelector('.jump') as HTMLElement
  vi.spyOn(nav, 'getBoundingClientRect').mockReturnValue(rect({ top: 64, bottom: 118, height: 54 }))

  for (const id of JUMP_IDS) {
    const el = document.getElementById(id) as HTMLElement
    const i = JUMP_IDS.indexOf(id)
    // Above the line if it, and everything before it, has been scrolled past.
    const isAbove = above.includes(id) && JUMP_IDS.slice(0, i).every((p) => above.includes(p))
    const top = isAbove ? -40 * (i + 1) : 600 + i * 40
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect({ top, bottom: top + 500, height: 500, y: top }))
  }

  // Keep the page off its own bottom, where the final section is pinned instead.
  const scrollHeight = vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(9000)
  const innerHeight = vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900)

  return () => {
    scrollHeight.mockRestore()
    innerHeight.mockRestore()
    navbar.remove()
  }
}

describe('jump nav scroll-spy', () => {
  it('marks nothing while the hero is in view, and hides the pill', async () => {
    const { container } = renderPage()
    const restore = stubScrollLayout([])
    try {
      fireEvent.scroll(window)
      // The pill follows in the commit after aria-current, so wait on both.
      await waitFor(() => {
        expect(container.querySelectorAll('.jump a[aria-current="true"]')).toHaveLength(0)
        expect((container.querySelector('.jump-pill') as HTMLElement).dataset.visible).toBe('false')
      })
    } finally {
      restore()
    }
  })

  it('marks the last section scrolled past, and shows the pill', async () => {
    const { container } = renderPage()
    const restore = stubScrollLayout(['responsibility', 'security'])
    try {
      fireEvent.scroll(window)
      await waitFor(() => {
        const current = container.querySelectorAll('.jump a[aria-current="true"]')
        expect(current).toHaveLength(1)
        expect((current[0] as HTMLElement).getAttribute('href')).toBe('#security')
      })
      expect((container.querySelector('.jump-pill') as HTMLElement).dataset.visible).toBe('true')
    } finally {
      restore()
    }
  })

  it('advances the highlight as later sections are reached', async () => {
    const { container } = renderPage()
    const restore = stubScrollLayout(['responsibility', 'security', 'ways-to-pay', 'pay-later', 'refunds'])
    try {
      fireEvent.scroll(window)
      await waitFor(() => {
        const current = container.querySelectorAll('.jump a[aria-current="true"]')
        expect(current).toHaveLength(1)
        expect((current[0] as HTMLElement).getAttribute('href')).toBe('#refunds')
      })
    } finally {
      restore()
    }
  })
})

describe('PaymentsSecurityPage', () => {
  it('renders the hero promise and the site footer', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: /Secure payments/i })).toBeInTheDocument()
    expect(screen.getByText(/Payments processed through Stripe/i)).toBeInTheDocument()
    expect(screen.getByText('FOOTER')).toBeInTheDocument()
  })

  it('keeps every jump-nav target on the page', () => {
    const { container } = renderPage()

    for (const id of ['responsibility', 'security', 'ways-to-pay', 'pay-later', 'refunds', 'stay-safe', 'questions']) {
      expect(container.querySelector(`#${id}`), `missing #${id}`).not.toBeNull()
    }

    const jump = container.querySelectorAll('.jump a')
    expect(jump).toHaveLength(7)
    jump.forEach((link) => {
      const hash = link.getAttribute('href')
      expect(hash).toMatch(/^#/)
      expect(container.querySelector(hash as string), `dead jump link ${hash}`).not.toBeNull()
    })
  })

  it('keeps the closing CTA clear of the site footer', () => {
    // The card used to meet the footer with 0px between them, because its
    // wrapper only had space above it. Asserted on the wrapper's own padding
    // since nothing in the stylesheet controls the gap.
    const { container } = renderPage()
    const wrap = (container.querySelector('.cta') as HTMLElement).parentElement as HTMLElement

    expect(wrap.style.paddingBottom).toBe('70px')
  })

  it('keeps the jump nav class-free and marks the current section with aria-current', () => {
    // The prototype ships no `.jump a.active` rule and no scroll-spy, so no
    // class-based active state is inherited from it. The highlight added later
    // is expressed with aria-current plus a positioned pill instead, which
    // assistive tech can announce and which leaves the anchors' markup intact.
    const { container } = renderPage()
    const jump = container.querySelector('.jump') as HTMLElement

    expect(jump.querySelector('a.active')).toBeNull()
    container.querySelectorAll('.jump a').forEach((a) => {
      expect(a.className).toBe('')
    })
    const current = Array.from(jump.querySelectorAll('a')).filter(
      (a) => a.getAttribute('aria-current') === 'true',
    )
    expect(current).toHaveLength(1)
  })

  it('renders a single decorative pill for the highlight to slide along', () => {
    const { container } = renderPage()
    const jump = container.querySelector('.jump') as HTMLElement

    expect(jump.querySelectorAll('.jump-pill')).toHaveLength(1)
    // It duplicates the aria-current signal, so it must not be announced.
    expect((jump.querySelector('.jump-pill') as HTMLElement).getAttribute('aria-hidden')).toBe('true')
  })

  it('shows only the selected payment-method panel', () => {
    const { container } = renderPage()

    expect(screen.getByRole('tab', { name: /^Cards$/ })).toHaveAttribute('aria-selected', 'true')
    expect(container.querySelector('#panel-cards')).not.toHaveAttribute('hidden')
    expect(container.querySelector('#panel-wallets')).toHaveAttribute('hidden')

    fireEvent.click(screen.getByRole('tab', { name: /Digital wallets/i }))

    expect(screen.getByRole('tab', { name: /Digital wallets/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /^Cards$/ })).toHaveAttribute('aria-selected', 'false')
    expect(container.querySelector('#panel-wallets')).not.toHaveAttribute('hidden')
    expect(container.querySelector('#panel-cards')).toHaveAttribute('hidden')
  })

  it('keeps a single tab stop so the tablist is one arrow-key journey', () => {
    renderPage()

    const focusable = screen
      .getAllByRole('tab')
      .filter((tab) => tab.getAttribute('tabindex') !== '-1')
    expect(focusable).toHaveLength(1)
    expect(focusable[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('moves between the tabs with the arrow keys', () => {
    renderPage()

    const cards = screen.getByRole('tab', { name: /^Cards$/ })
    fireEvent.keyDown(cards, { key: 'ArrowRight' })

    const wallets = screen.getByRole('tab', { name: /Digital wallets/i })
    expect(wallets).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(wallets)
  })

  it('wraps the arrow keys and honours Home and End', () => {
    renderPage()

    const cards = screen.getByRole('tab', { name: /^Cards$/ })
    fireEvent.keyDown(cards, { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: /Pay-later providers/i })).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(screen.getByRole('tab', { name: /Pay-later providers/i }), { key: 'End' })
    expect(screen.getByRole('tab', { name: /Pay-later providers/i })).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(screen.getByRole('tab', { name: /Pay-later providers/i }), { key: 'Home' })
    expect(screen.getByRole('tab', { name: /^Cards$/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('numbers the payments FAQ and opens only the first answer', () => {
    const { container } = renderPage()

    const numbers = Array.from(container.querySelectorAll('.accordion summary span')).map((el) => el.textContent)
    expect(numbers).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09'])

    const items = container.querySelectorAll('.accordion details')
    expect(items).toHaveLength(9)
    expect(items[0]).toHaveAttribute('open')
    expect(items[1]).not.toHaveAttribute('open')

    // The markup and the FAQPage JSON-LD must stay in step.
    expect(screen.getByText(/Should I send my card details through WhatsApp or email\?/i)).toBeInTheDocument()
  })

  it('keeps the FAQ and the nine questions inside this app', () => {
    const { container } = renderPage()

    // Every question rendered must have an answer underneath it.
    container.querySelectorAll('.accordion details').forEach((item, index) => {
      const answer = item.querySelector('p')?.textContent ?? ''
      expect(answer.length, `FAQ ${index + 1} has no answer`).toBeGreaterThan(40)
    })
  })

  it('resolves the prototype’s own pages in-app instead of off-site', () => {
    renderPage()

    // The prototype pointed at absolute www.travioghana.com URLs. Those resolve
    // here, but an absolute link is a full page load that drops the SPA state;
    // the router should handle these in-app.
    const internal = screen.getAllByRole('link').filter((a) => (a.getAttribute('href') ?? '').startsWith('/'))
    const hrefs = internal.map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/contact-us')
    expect(hrefs).toContain('/refund-policy')
    expect(hrefs).toContain('/tours')
    internal.forEach((a) => {
      expect(a.getAttribute('href')).not.toMatch(/travioghana\.com/)
    })
  })

  it('sends the closing CTA to the tours index in-app', async () => {
    const { container } = renderPage()

    const cta = container.querySelector('.cta') as HTMLElement
    fireEvent.click(within(cta).getByRole('link', { name: /Explore experiences/i }))
    expect(await screen.findByText('TOURS_ROUTE')).toBeInTheDocument()
  })

  it('opens Stripe documentation externally and safely', () => {
    renderPage()

    const external = screen
      .getAllByRole('link')
      .filter((a) => (a.getAttribute('href') ?? '').startsWith('http'))
    expect(external.length).toBeGreaterThan(10)

    external.forEach((a) => {
      expect(a).toHaveAttribute('target', '_blank')
      const rel = a.getAttribute('rel') ?? ''
      expect(rel, `missing noopener on ${a.getAttribute('href')}`).toContain('noopener')
    })
    expect(external.some((a) => (a.getAttribute('href') ?? '').includes('docs.stripe.com'))).toBe(true)
  })

  it('publishes the title, description and FAQ structured data', () => {
    renderPage()

    expect(document.title).toBe('Payment and Security | Travio Ghana')
    const ld = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent ?? '')
    expect(ld.some((s) => s.includes('"FAQPage"'))).toBe(true)
    expect(ld.some((s) => s.includes('"BreadcrumbList"'))).toBe(true)
    expect(ld.some((s) => s.includes('Should I send my card details'))).toBe(true)
  })

  it('keeps the site column contract used by the navbar and footer', () => {
    const { container } = renderPage()

    // Navbar.css / Footer.css align to `body:has(.ps-page)` — drop this class
    // and the navbar and footer stop lining up with the page's content column.
    expect(container.querySelector('.ps-page')).not.toBeNull()
    expect(container.querySelector('.wrap')).not.toBeNull()
    expect(container.querySelectorAll('.wrap').length).toBeGreaterThan(5)
  })
})