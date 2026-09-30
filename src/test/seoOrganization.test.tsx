import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import SEO from '../components/SEO'
import { BRAND_SOCIAL_URLS } from '../lib/brandSocial'

/**
 * Every page names the brand. Proved by rendering, not by reading the helper.
 *
 * The Organization used to be a per-page opt-in: three pages passed it in their
 * `jsonLd`, eighteen did not, and 18 of the 22 static pages in the sitemap named
 * the brand's logo and nothing else. It is now injected by the component, so the
 * guarantee lives in one place.
 *
 * These tests render `SEO` and read `document.head` — the actual output a
 * browser and a crawler see. A test that only called `withOrganization()` would
 * have passed unchanged with the injection removed, which is the exact failure
 * mode this file exists to rule out.
 */

function renderSEO(node: ReactElement) {
  return render(
    <HelmetProvider>
      <MemoryRouter>{node}</MemoryRouter>
    </HelmetProvider>,
  )
}

/**
 * The JSON-LD the browser actually received, parsed.
 *
 * From the whole document, not just `document.head`. Under React 19,
 * react-helmet-async renders the tags rather than side-effecting them into the
 * head; React hoists `title`/`meta`/`link` there on its own but leaves
 * `<script>` where it was written. So the structured data ships inline in the
 * body — which is valid, and what the prerendered output has always contained.
 * Reading only the head reports these pages as having no schema at all, which
 * is how a test can be confidently wrong about the site.
 */
function headSchemas(): Record<string, unknown>[] {
  return [...document.querySelectorAll('script[type="application/ld+json"]')].map((el) =>
    JSON.parse(el.textContent ?? '{}'),
  )
}

const organization = () => headSchemas().filter((s) => s['@type'] === 'Organization')

describe('the SEO component names the brand on every page', () => {
  it('on a page that passes no schemas of its own', () => {
    // The shape of every policy page: title, description, canonical, and that
    // is all. There is no jsonLd prop, so nothing to opt into.
    renderSEO(<SEO title="Privacy Policy" description="How we handle data." canonical="/privacy-policy" />)

    const orgs = organization()
    expect(orgs, 'a page with no jsonLd still gets the Organization').toHaveLength(1)
    expect(orgs[0].name).toBe('Travio Ghana')
  })

  it('on a page that passes a single schema', () => {
    renderSEO(
      <SEO
        title="FAQ"
        description="Questions."
        jsonLd={{ '@type': 'FAQPage', mainEntity: [] }}
      />,
    )

    expect(headSchemas().map((s) => s['@type'])).toEqual(['Organization', 'FAQPage'])
  })

  it('on a page that passes several', () => {
    renderSEO(
      <SEO
        title="About Us"
        description="Who we are."
        jsonLd={[
          { '@type': 'BreadcrumbList', itemListElement: [] },
          { '@type': 'ItemList', numberOfItems: 0, itemListElement: [] },
        ]}
      />,
    )

    expect(headSchemas().map((s) => s['@type'])).toEqual([
      'Organization',
      'BreadcrumbList',
      'ItemList',
    ])
  })

  it('gives the Organization the brand\u2019s profiles, so the entity resolves', () => {
    // The single property that turns a name into something linkable. Without
    // it the node is a logo and a title.
    renderSEO(<SEO title="Refund Policy" description="Refunds." />)

    const [org] = organization()
    expect(org.sameAs).toEqual(expect.arrayContaining([...BRAND_SOCIAL_URLS]))
  })

  it('states the registered company name, distinct from the trading brand', () => {
    // Google's advice for a brand query that does not surface: where other
    // brands or sellers share a similar name, it may lean on the full legal
    // company name to confirm which site is the real one, and stating it helps.
    // The footer has printed "Travio Ghana by Expedition-Go Tours Ltd" since
    // launch — so the claim existed for a reader and not for a knowledge panel.
    renderSEO(<SEO title="Terms & Conditions" description="The rules." />)

    const [org] = organization()
    expect(org.legalName).toBe('Expedition-Go Tours Ltd')

    // The distinction is the entire reason the field exists. A legalName that
    // merely repeats `name` passes a presence check while saying nothing the
    // brand field had not already said — so assert they differ.
    expect(org.name).toBe('Travio Ghana')
    expect(org.legalName).not.toBe(org.name)
  })

  it('names no other brand', () => {
    renderSEO(<SEO title="Contact Us" description="Reach us." />)

    expect(JSON.stringify(headSchemas())).not.toMatch(/expeditiongo/i)
  })

  it('emits exactly one Organization when a page still opts in itself', () => {
    // The three pages that used to pass it were left passing nothing, but if
    // one ever does again it must not produce a duplicate node.
    renderSEO(
      <SEO
        title="Foundation"
        description="Our foundation."
        jsonLd={[
          { '@type': 'Organization', name: 'Travio Ghana', sameAs: [...BRAND_SOCIAL_URLS] },
          { '@type': 'BreadcrumbList', itemListElement: [] },
        ]}
      />,
    )

    expect(organization()).toHaveLength(1)
    expect(headSchemas().map((s) => s['@type'])).toEqual(['Organization', 'BreadcrumbList'])
  })

  it('still writes the title and description the page asked for', () => {
    // The injection must not come at the cost of the rest of the component.
    renderSEO(<SEO title="Cookie Policy" description="How cookies are used." />)

    expect(document.title).toContain('Cookie Policy')
    expect(
      document.head.querySelector('meta[name="description"]')?.getAttribute('content'),
    ).toBe('How cookies are used.')
  })
})
