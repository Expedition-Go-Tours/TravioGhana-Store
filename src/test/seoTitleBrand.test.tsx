import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import SEO from '../components/SEO'

/**
 * Every title tag carries the brand, not just `<title>`.
 *
 * `fullTitle` is built as `${title} | ${SITE_NAME}` and written to `<title>`,
 * but og:title and twitter:title were written from `title || DEFAULT_TITLE` —
 * the brand appended to nothing. On the homepage, which passes no title at all,
 * that produced:
 *
 *   <title>       … Book Authentic African Adventures | Travio Ghana
 *   og:title      … Book Authentic African Adventures          <- brand gone
 *   twitter:title … Book Authentic African Adventures          <- brand gone
 *
 * Open Graph hid it behind og:site_name; the Twitter card has no equivalent,
 * so X saw a title with no brand in it. Shared unfurl previews (LinkedIn,
 * Slack, iMessage, Discord) read og:title directly and rendered the same way.
 *
 * These render the component and read document.head — the tags a crawler
 * actually receives. Asserting on the `fullTitle` variable alone would have
 * passed with the og:title line left broken.
 */

function renderSEO(node: ReactElement) {
  return render(
    <HelmetProvider>
      <MemoryRouter>{node}</MemoryRouter>
    </HelmetProvider>,
  )
}

const metaContent = (selector: string) =>
  document.head.querySelector(selector)?.getAttribute('content')

describe('every title tag carries the brand', () => {
  it('on the homepage, which passes no title of its own', () => {
    renderSEO(<SEO description="Discover authentic Ghana tours and experiences." />)

    const pageTitle = document.title
    const ogTitle = metaContent('meta[property="og:title"]')
    const twitterTitle = metaContent('meta[name="twitter:title"]')

    expect(pageTitle, '<title> must name the brand').toContain('Travio Ghana')
    expect(ogTitle, 'og:title must name the brand').toContain('Travio Ghana')
    expect(twitterTitle, 'twitter:title must name the brand').toContain('Travio Ghana')

    // The real requirement: the three must agree. A card previewing a
    // different string from the indexed one is the bug in one assertion.
    expect(ogTitle).toBe(pageTitle)
    expect(twitterTitle).toBe(pageTitle)
  })

  it('on the homepage, the brand leads instead of trailing', () => {
    // The homepage used to build `${DEFAULT_TITLE} | ${SITE_NAME}`, which put
    // the brand last in a three-segment string — past the ~60 characters
    // Google renders. The result for "travio ghana" therefore carried no brand
    // in it at all, and the query went to a YouTube channel and some GitHub
    // repos. Leading with the brand is what makes the page a candidate for it.
    renderSEO(<SEO description="Discover authentic Ghana tours and experiences." />)

    expect(document.title.startsWith('Travio Ghana | ')).toBe(true)
    expect(metaContent('meta[property="og:title"]')?.startsWith('Travio Ghana | ')).toBe(true)
    expect(metaContent('meta[name="twitter:title"]')?.startsWith('Travio Ghana | ')).toBe(true)
  })

  it('on a page that passes its own title', () => {
    renderSEO(<SEO title="Privacy Policy" description="How we handle data." />)

    expect(document.title).toBe('Privacy Policy | Travio Ghana')
    expect(metaContent('meta[property="og:title"]')).toBe('Privacy Policy | Travio Ghana')
    expect(metaContent('meta[name="twitter:title"]')).toBe('Privacy Policy | Travio Ghana')
  })

  it('alongside og:site_name, which does not replace it', () => {
    // og:site_name used to be the only place the brand appeared in the card,
    // which is why the omission read as harmless. It is a separate field: most
    // unfurl renderers show title and site name in different places, so a
    // missing brand in the title is still a missing brand in the title.
    renderSEO(<SEO description="Discover authentic Ghana tours." />)

    expect(metaContent('meta[property="og:site_name"]')).toBe('Travio Ghana')
    expect(metaContent('meta[property="og:title"]')).toContain('Travio Ghana')
  })

  it('without duplicating the brand when the title already contains it', () => {
    renderSEO(<SEO title="Travio Ghana Careers" description="Work with us." />)

    // Callers supply the suffix themselves in `title`; the component appends
    // exactly one. A doubled brand is as wrong as an absent one.
    expect(document.title).toBe('Travio Ghana Careers | Travio Ghana')
  })
})
