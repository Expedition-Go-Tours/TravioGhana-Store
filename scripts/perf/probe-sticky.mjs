#!/usr/bin/env node
/** Probes the homepage sticky-search behavior across a scroll position. */

import puppeteer from 'puppeteer'

const url = process.argv[2] ?? 'http://localhost:4173/'
const scrollTo = Number(process.argv[3] ?? 900)

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] })
const page = await browser.newPage()
await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true })

const errors = []
page.on('pageerror', (err) => errors.push(String(err)))
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })

await page.goto(url, { waitUntil: 'load', timeout: 60000 })
await new Promise((r) => setTimeout(r, 2500))

const state = async () => page.evaluate(() => {
  const hero = document.getElementById('hero-search-bar')
  const compact = document.querySelector('.navbar-compact-search')
  const wrap = document.querySelector('.hero-search-wrap')
  return {
    scrollY: Math.round(window.scrollY),
    bodyStickyClass: document.body.classList.contains('hero--search-sticky'),
    heroFound: !!hero,
    heroTop: hero ? Math.round(hero.getBoundingClientRect().top) : null,
    heroHeight: hero ? Math.round(hero.getBoundingClientRect().height) : null,
    compactDisplay: compact ? getComputedStyle(compact).display : null,
    compactOpacity: compact ? getComputedStyle(compact).opacity : null,
    wrapOpacity: wrap ? getComputedStyle(wrap).opacity : null,
  }
})

const before = await state()

const useTouch = process.argv.includes('--touch')
if (useTouch) {
  const client = await page.createCDPSession()
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 206, y: 700 }] })
  for (let y = 680; y >= 120; y -= 40) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 206, y }] })
    await new Promise((r) => setTimeout(r, 16))
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
} else {
  await page.evaluate((y) => window.scrollTo(0, y), scrollTo)
}
await new Promise((r) => setTimeout(r, 500))
const afterScroll = await state()

console.log(JSON.stringify({ before, afterScroll, mode: useTouch ? 'touch' : 'programmatic', errors: errors.slice(0, 5) }, null, 2))
await browser.close()
