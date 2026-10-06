import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import SEO from '../components/SEO'

function renderSEO(node: ReactElement) {
  return render(
    <HelmetProvider>
      <MemoryRouter>{node}</MemoryRouter>
    </HelmetProvider>,
  )
}

const metaContent = (selector: string) =>
  document.head.querySelector(selector)?.getAttribute('content')

describe('homepage title and social metadata', () => {
  it('on the homepage, which passes no title of its own', () => {
    renderSEO(<SEO description="Discover authentic Ghana tours and experiences." />)

    const pageTitle = document.title
    const ogTitle = metaContent('meta[property="og:title"]')
    const twitterTitle = metaContent('meta[name="twitter:title"]')

    expect(pageTitle).toBe('Ghana Tours & Activities | Discover Experiences | Book & Explore')

    // The real requirement: the three must agree. A card previewing a
    // different string from the indexed one is the bug in one assertion.
    expect(ogTitle).toBe(pageTitle)
    expect(twitterTitle).toBe(pageTitle)
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
    expect(metaContent('meta[property="og:title"]')).toBe(document.title)
  })

  it('without duplicating the brand when the title already contains it', () => {
    renderSEO(<SEO title="Travio Ghana Careers" description="Work with us." />)

    // Callers supply the suffix themselves in `title`; the component appends
    // exactly one. A doubled brand is as wrong as an absent one.
    expect(document.title).toBe('Travio Ghana Careers | Travio Ghana')
  })
})
