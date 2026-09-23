#!/usr/bin/env node
/**
 * Verifies footer navigation stays in a single tab and that hover warms the
 * destination route chunk. Desktop viewport so every footer section is
 * expanded (mobile accordions collapse their link lists).
 *
 * Usage: node scripts/perf/probe-navigation.mjs [baseUrl]
 */

import puppeteer from 'puppeteer'

const base = (process.argv[2] ?? 'http://localhost:4173').replace(/\/$/, '')

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

let popups = 0
page.on('popup', () => { popups += 1 })

const requested = []
page.on('request', (req) => requested.push(req.url()))

await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 })
await new Promise((r) => setTimeout(r, 1500))

// 1. Hover prefetch: the destination chunk must be requested before any click.
requested.length = 0
await page.hover('footer a[href="/help-centre"]')
await new Promise((r) => setTimeout(r, 600))
const prefetchHit = requested.some((url) => url.includes('HelpCentrePage'))

// 2. Social links keep target=_blank.
const socialTargets = await page.$$eval(
  'footer a.footer-social',
  (links) => links.map((link) => link.getAttribute('target')),
)

// 3. Click every internal footer link; each must stay in this tab. Only the
// homepage renders the footer, so reload home before every attempt.
const hrefs = await page.$$eval('footer a[href^="/"]', (links) => {
  const set = new Set()
  for (const link of links) {
    const href = link.getAttribute('href')
    if (href && !href.startsWith('//')) set.add(href)
  }
  return [...set]
})

const visited = []
const failures = []
for (const href of hrefs) {
  try {
    await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 })
    await page.waitForSelector(`footer a[href="${href}"]`, { timeout: 10000 })
    // DOM-level click: bypasses fixed overlays (cookie banner) and still
    // triggers the router's synthetic handler.
    await page.$eval(`footer a[href="${href}"]`, (el) => el.click())
    await page.waitForFunction((path) => window.location.pathname === path, { timeout: 8000 }, href)
    visited.push(href)
  } catch (error) {
    failures.push(`${href} (${error instanceof Error ? error.message : String(error)}) url=${page.url()}`)
  }
}

console.log(JSON.stringify({
  internalLinks: hrefs.length,
  visited: visited.length,
  prefetchHit,
  popups,
  socialTargets,
  failures,
}, null, 2))

await browser.close()
process.exit(failures.length > 0 || popups > 0 || !prefetchHit ? 1 : 0)
