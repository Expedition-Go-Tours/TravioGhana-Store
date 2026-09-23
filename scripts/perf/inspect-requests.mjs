#!/usr/bin/env node
/**
 * Lists network requests above a size threshold for a given URL, with the
 * resource type and status. Useful for finding stray warm-ups/prefetches.
 *
 * Usage: node scripts/perf/inspect-requests.mjs [url] [minKB]
 */

import puppeteer from 'puppeteer'

const url = process.argv[2] ?? 'http://localhost:4173/'
const minKb = Number(process.argv[3] ?? 20)

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})
const page = await browser.newPage()
await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true })

const client = await page.createCDPSession()
await client.send('Network.enable')
const requests = new Map()
client.on('Network.responseReceived', (event) => {
  requests.set(event.requestId, {
    url: event.response.url,
    type: event.type,
    status: event.response.status,
    mimeType: event.response.mimeType,
  })
})
client.on('Network.loadingFinished', (event) => {
  const entry = requests.get(event.requestId)
  if (entry) entry.bytes = event.encodedDataLength ?? 0
})

await page.goto(url, { waitUntil: 'load', timeout: 60000 })
await new Promise((resolve) => setTimeout(resolve, 4000))
await browser.close()

const rows = [...requests.values()]
  .filter((entry) => (entry.bytes ?? 0) >= minKb * 1024)
  .sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0))

if (rows.length === 0) {
  console.log(`No requests >= ${minKb} KB`)
} else {
  for (const row of rows) {
    console.log(`${String(Math.round((row.bytes ?? 0) / 1024)).padStart(5)} KB  ${row.status}  ${row.type.padEnd(10)}  ${row.url}`)
  }
}
