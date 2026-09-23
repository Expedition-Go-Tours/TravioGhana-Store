#!/usr/bin/env node
/**
 * Mobile performance audit harness.
 *
 * Drives a production build (vite preview) through a mobile emulation profile
 * with CPU/network throttling and records the numbers this project budgets:
 *   - Core Web Vitals (FCP, LCP, CLS) + TBT approximation from long tasks
 *   - Bytes transferred by resource type, request count
 *   - Long tasks + layout/style recalc during a scripted scroll pass
 *
 * Usage:
 *   node scripts/perf/audit-mobile.mjs --label baseline
 *   node scripts/perf/audit-mobile.mjs --label phase1 --check
 *
 * Flags:
 *   --base   http://localhost:4173   preview origin
 *   --routes /,/tours,/search        comma separated paths
 *   --profile midrange-4g            midrange-4g | slow4g | none
 *   --label  baseline                output file name
 *   --check                          exit 1 when budgets are exceeded
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const PERF_DIR = path.join(ROOT, 'perf')

const argv = process.argv.slice(2)
function getArg(name, fallback) {
  const i = argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const value = argv[i + 1]
  if (!value || value.startsWith('--')) return true
  return value
}

const base = String(getArg('base', 'http://localhost:4173')).replace(/\/$/, '')
const routes = String(getArg('routes', '/,/tours,/search?q=accra')).split(',').map((r) => r.trim()).filter(Boolean)
const profileName = String(getArg('profile', 'midrange-4g'))
const label = String(getArg('label', 'baseline'))
const check = argv.includes('--check')

const PROFILES = {
  'midrange-4g': { cpu: 4, latency: 85, downKbps: 4000, upKbps: 1500 },
  slow4g: { cpu: 4, latency: 150, downKbps: 1600, upKbps: 750 },
  none: { cpu: 1, latency: 0, downKbps: -1, upKbps: -1 },
}
const profile = PROFILES[profileName]
if (!profile) {
  console.error(`Unknown profile "${profileName}". Use: ${Object.keys(PROFILES).join(', ')}`)
  process.exit(2)
}

const SETTLE_MS = 4000
const SCROLL_MS = 4500

function loadBudgets() {
  const file = path.join(PERF_DIR, 'budgets.json')
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

async function auditRoute(browser, route) {
  const page = await browser.newPage()
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true })
  await page.setUserAgent(
    'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  )

  const client = await page.createCDPSession()
  await client.send('Network.enable')
  await client.send('Performance.enable')
  if (profile.cpu > 1) await client.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu })
  if (profile.downKbps > 0) {
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: profile.latency,
      downloadThroughput: (profile.downKbps * 1024) / 8,
      uploadThroughput: (profile.upKbps * 1024) / 8,
    })
  }

  const transfers = new Map()
  const requestTypes = new Map()
  client.on('Network.responseReceived', (event) => {
    requestTypes.set(event.requestId, event.type)
  })
  client.on('Network.loadingFinished', (event) => {
    const type = requestTypes.get(event.requestId) ?? 'Other'
    const entry = transfers.get(type) ?? { bytes: 0, requests: 0 }
    entry.bytes += event.encodedDataLength ?? 0
    entry.requests += 1
    transfers.set(type, entry)
  })

  await page.evaluateOnNewDocument(() => {
    window.__perf = { fcp: 0, lcp: 0, cls: 0, phase: 'load', tasks: [], scrollTasks: [] }
    const cap = (arr, max) => {
      if (arr.length > max) arr.splice(0, arr.length - max)
    }
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') window.__perf.fcp = entry.startTime
      }
    }).observe({ type: 'paint', buffered: true })
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__perf.lcp = entry.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__perf.cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const task = { start: entry.startTime, duration: entry.duration }
        if (window.__perf.phase === 'scroll') window.__perf.scrollTasks.push(task)
        else window.__perf.tasks.push(task)
        cap(window.__perf.tasks, 400)
        cap(window.__perf.scrollTasks, 400)
      }
    }).observe({ type: 'longtask', buffered: true })
  })

  const url = `${base}${route}`
  const started = Date.now()
  let navigationError = null
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 })
  } catch (error) {
    navigationError = String(error && error.message ? error.message : error)
  }
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))

  const loadPerf = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] ?? {}
    return {
      perf: window.__perf,
      ttfb: nav.responseStart ?? 0,
      domContentLoaded: nav.domContentLoadedEventEnd ?? 0,
      load: nav.loadEventEnd ?? 0,
      domNodes: document.getElementsByTagName('*').length,
    }
  })

  await page.evaluate(() => {
    window.__perf.phase = 'scroll'
  })
  const scrollPass = await page.evaluate(async (duration) => {
    const total = document.documentElement.scrollHeight - window.innerHeight
    const steps = Math.max(1, Math.round(duration / 100))
    for (let i = 1; i <= steps; i += 1) {
      window.scrollTo(0, Math.round((total * i) / steps))
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return { height: total }
  }, SCROLL_MS)
  await new Promise((resolve) => setTimeout(resolve, 600))
  const scrollPerf = await page.evaluate(() => window.__perf.scrollTasks)

  const pageMetrics = await page.metrics()
  await page.close()

  const blockingTime = (tasks) =>
    tasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0)

  const byType = {}
  let totalBytes = 0
  let totalRequests = 0
  for (const [type, entry] of transfers) {
    byType[type] = { bytes: entry.bytes, requests: entry.requests }
    totalBytes += entry.bytes
    totalRequests += entry.requests
  }
  const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10

  return {
    route,
    url,
    wallClockMs: Date.now() - started,
    navigationError,
    metrics: {
      fcp: Math.round(loadPerf.perf.fcp),
      lcp: Math.round(loadPerf.perf.lcp),
      cls: Math.round(loadPerf.perf.cls * 10000) / 10000,
      ttfb: Math.round(loadPerf.ttfb),
      domContentLoaded: Math.round(loadPerf.domContentLoaded),
      load: Math.round(loadPerf.load),
      tbt: Math.round(blockingTime(loadPerf.perf.tasks ?? [])),
      longTasks: (loadPerf.perf.tasks ?? []).length,
      longTaskDetail: (loadPerf.perf.tasks ?? [])
        .map((task) => ({ start: Math.round(task.start), dur: Math.round(task.duration) }))
        .sort((a, b) => b.dur - a.dur)
        .slice(0, 12),
      domNodes: loadPerf.domNodes,
      layoutCount: pageMetrics.LayoutCount ?? 0,
      recalcStyleCount: pageMetrics.RecalcStyleCount ?? 0,
      scriptDurationMs: Math.round((pageMetrics.ScriptDuration ?? 0) * 1000),
      scrollLongTasks: scrollPerf.length,
      scrollMaxTask: Math.round(scrollPerf.reduce((max, t) => Math.max(max, t.duration), 0)),
      scrollTaskDetail: scrollPerf
        .map((task) => ({ start: Math.round(task.start), dur: Math.round(task.duration) }))
        .sort((a, b) => b.dur - a.dur)
        .slice(0, 8),
      scrollBlockingMs: Math.round(blockingTime(scrollPerf)),
      scrollHeight: scrollPass.height,
    },
    network: {
      totalKB: kb(totalBytes),
      totalRequests,
      byType: Object.fromEntries(
        Object.entries(byType).map(([type, entry]) => [type, { kb: kb(entry.bytes), requests: entry.requests }]),
      ),
    },
  }
}

function evaluateBudgets(results, budgets) {
  const failures = []
  for (const result of results) {
    const m = result.metrics
    const checks = [
      ['lcp', m.lcp, budgets.lcp],
      ['fcp', m.fcp, budgets.fcp],
      ['cls', m.cls, budgets.cls],
      ['tbt', m.tbt, budgets.tbt],
      ['scrollMaxTask', m.scrollMaxTask, budgets.scrollMaxTask],
      ['scriptKB', result.network.byType.Script?.kb ?? 0, budgets.scriptKB],
      ['imageKB', result.network.byType.Image?.kb ?? 0, budgets.imageKB],
      ['transferKB', result.network.totalKB, budgets.transferKB],
      ['requests', result.network.totalRequests, budgets.requests],
    ]
    for (const [name, value, limit] of checks) {
      if (typeof limit === 'number' && value > limit) {
        failures.push(`${result.route}  ${name}=${value}  budget=${limit}`)
      }
    }
  }
  return failures
}

async function main() {
  fs.mkdirSync(PERF_DIR, { recursive: true })
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'],
  })

  const results = []
  try {
    for (const route of routes) {
      process.stdout.write(`auditing ${route} ... `)
      const result = await auditRoute(browser, route)
      results.push(result)
      const m = result.metrics
      console.log(`LCP ${m.lcp}ms  TBT ${m.tbt}ms  CLS ${m.cls}  bytes ${result.network.totalKB}KB`)
    }
  } finally {
    await browser.close()
  }

  const output = {
    label,
    profile: profileName,
    generatedAt: new Date().toISOString(),
    base,
    results,
  }
  const outFile = path.join(PERF_DIR, `${label}.json`)
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2))
  console.log(`\nwrote ${path.relative(ROOT, outFile)}`)

  const budgets = loadBudgets()
  if (budgets) {
    const failures = evaluateBudgets(results, budgets)
    if (failures.length) {
      console.log('\nbudget failures:')
      for (const failure of failures) console.log(`  - ${failure}`)
      if (check) process.exitCode = 1
    } else {
      console.log('\nall budgets passed')
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
