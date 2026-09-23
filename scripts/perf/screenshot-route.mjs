#!/usr/bin/env node
/** Screenshots a route into .perf-shots/ for visual review. */

import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

const base = (process.argv[2] ?? 'http://localhost:4173').replace(/\/$/, '')
const route = process.argv[3] ?? '/careers'
const outDir = path.resolve('.perf-shots')
fs.mkdirSync(outDir, { recursive: true })
const name = route.replace(/[^a-z0-9]+/gi, '_') || 'home'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] })

for (const [label, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
]) {
  const page = await browser.newPage()
  await page.setViewport(viewport)
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise((r) => setTimeout(r, 1200))
  const file = path.join(outDir, `${name}-${label}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log(file)
  await page.close()
}

await browser.close()
