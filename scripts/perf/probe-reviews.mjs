#!/usr/bin/env node
/** One-off probe: verifies the homepage reviews section appears after scroll
 * and that the full review rows dataset is only fetched once it approaches. */

import puppeteer from 'puppeteer'

const url = process.argv[2] ?? 'http://localhost:4173/'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] })
const page = await browser.newPage()
await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true })

const requests = []
page.on('request', (req) => requests.push(req.url()))

await page.goto(url, { waitUntil: 'load', timeout: 60000 })
await new Promise((r) => setTimeout(r, 2500))

const before = await page.evaluate(() => ({
  sections: document.querySelectorAll('.ext-reviews-section').length,
  cards: document.querySelectorAll('.ext-reviews-card-wrap').length,
}))

await page.evaluate(async () => {
  const total = document.documentElement.scrollHeight - window.innerHeight
  for (let i = 1; i <= 40; i += 1) {
    window.scrollTo(0, Math.round((total * i) / 40))
    await new Promise((r) => setTimeout(r, 120))
  }
})
await new Promise((r) => setTimeout(r, 2500))

const after = await page.evaluate(() => ({
  sections: document.querySelectorAll('.ext-reviews-section').length,
  cards: document.querySelectorAll('.ext-reviews-card-wrap').length,
  heading: document.querySelector('.ext-reviews-section .section-heading')?.textContent?.trim() ?? null,
}))

const rowsRequested = requests.some((u) => u.includes('externalReviews.json'))
const statsRequested = requests.some((u) => u.includes('externalReviewStats.json'))

console.log(JSON.stringify({ before, after, rowsRequested, statsRequested }, null, 2))
await browser.close()
