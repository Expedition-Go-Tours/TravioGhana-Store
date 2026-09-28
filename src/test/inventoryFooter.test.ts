import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The two inventory pages regressed here: `/tours` and `/reviews` were the only
 * routes in the whole site with no footer, so they also had no internal links
 * out of them at all — on the two pages that matter most for crawling.
 *
 * This asserts on source rather than on rendered output. Rendering these pages
 * needs the router, i18n and a mocked API, which would test far more than the
 * one thing that broke. The cost of that choice is stated plainly: the test
 * proves the component renders a Footer, not that the Footer is visible.
 *
 * Comments are stripped before matching, so the explanatory comments beside
 * each <Footer /> cannot satisfy the assertion on their own.
 */
function pageSource(file: string): string {
  const raw = readFileSync(
    resolve(__dirname, '..', 'pages', file),
    'utf8',
  )
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/^\s*\/\/.*$/gm, '') // line comments
    .replace(/(^|[^:])\/\/.*$/gm, '$1') // trailing line comments
}

const INVENTORY_PAGES = ['AllToursPage.tsx', 'AllReviewsPage.tsx']

describe('inventory pages render a footer', () => {
  it.each(INVENTORY_PAGES)('%s imports Footer', (file) => {
    expect(pageSource(file)).toMatch(/import\s+Footer\s+from\s+['"][^'"]*Footer['"]/)
  })

  it.each(INVENTORY_PAGES)('%s renders <Footer />', (file) => {
    expect(pageSource(file)).toMatch(/<Footer\s*\/>/)
  })

  it.each(INVENTORY_PAGES)('%s renders it inside the page, not at module scope', (file) => {
    // A stray <Footer /> outside the component would not reach the DOM.
    const src = pageSource(file)
    const rendered = src.indexOf('<Footer />')
    expect(rendered).toBeGreaterThan(-1)
    const componentStart = src.indexOf('export default function')
    expect(componentStart).toBeGreaterThan(-1)
    expect(rendered).toBeGreaterThan(componentStart)
  })
})

describe('the footer check cannot be satisfied by prose', () => {
  it('a file that only mentions the footer in a comment does not pass', () => {
    const fake = `
      import { useState } from 'react'
      // this page should render <Footer /> but does not
      /* nor here: <Footer /> */
      export default function Page() { return <div /> }
    `
    const stripped = fake
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    expect(stripped).not.toMatch(/<Footer\s*\/>/)
  })
})
