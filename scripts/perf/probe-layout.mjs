#!/usr/bin/env node
/**
 * Prints geometry + key computed styles for a selector on a route.
 * Usage: node scripts/perf/probe-layout.mjs <baseUrl> <route> <selector>
 */

import puppeteer from 'puppeteer'

const base = (process.argv[2] ?? 'http://localhost:4173').replace(/\/$/, '')
const route = process.argv[3] ?? '/careers'
const selector = process.argv[4] ?? '.careers-hero-lottie'
const selectors = selector.split(',').map((s) => s.trim()).filter(Boolean)

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] })

for (const [label, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
]) {
  const page = await browser.newPage()
  await page.setViewport(viewport)
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise((r) => setTimeout(r, 2500))

  const report = await page.evaluate((sels) => {
    return sels.map((sel) => {
      const el = document.querySelector(sel)
      if (!el) return { selector: sel, found: false }
      const rect = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      const padLeft = parseFloat(cs.paddingLeft) || 0
      const padRight = parseFloat(cs.paddingRight) || 0
      const inner = el.querySelector('canvas, .dotlottie-player, svg')
      const innerRect = inner ? inner.getBoundingClientRect() : null
      return {
        selector: sel,
        found: true,
        rect: {
          x: Math.round(rect.x),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          centerX: Math.round(rect.x + rect.width / 2),
        },
        contentWidth: Math.round(rect.width - padLeft - padRight),
        viewportWidth: window.innerWidth,
        centered: Math.abs((rect.x + rect.width / 2) - window.innerWidth / 2) < 4,
        maxWidth: cs.maxWidth,
        padding: cs.padding,
        inner: innerRect
          ? { tag: inner.tagName, width: Math.round(innerRect.width), height: Math.round(innerRect.height) }
          : null,
      }
    })
  }, selectors)

  console.log(label, JSON.stringify(report, null, 1))
  await page.close()
}

await browser.close()
