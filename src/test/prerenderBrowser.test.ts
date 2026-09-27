import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guards the one prerender failure that must never be silent.
 *
 * The prerender runs during `npm run build`. It originally caught every error
 * — including "no browser" — warned, and exited 0, on the reasoning that the
 * backend prerenderer would cover the gap. That reasoning is sound for a single
 * thin or broken route, and wrong for the browser itself: with no browser,
 * *every* route is skipped, dist/__seo/ is empty, and the deploy silently
 * reinstates the thin-content bug the prerender exists to remove.
 *
 * It did in fact go green that way in production, and was caught only by
 * reading the live word count. A build that cannot prerender has to be red.
 *
 * These assertions read the source rather than launching a browser, so they
 * stay fast and deterministic; the behaviour itself was verified by running the
 * script against an empty browser cache and against an unlaunchable binary.
 */
const ROOT = resolve(__dirname, '..', '..')
const source = readFileSync(resolve(ROOT, 'scripts/prerender-static.mjs'), 'utf8')

describe('prerender browser failure handling', () => {
  it('exits non-zero when no browser strategy works', () => {
    // The top-level catch must special-case the browser failure and exit 1,
    // rather than falling through to the warn-and-continue branch.
    expect(source).toMatch(/instanceof BrowserUnavailableError/)
    expect(source).toMatch(/process\.exit\(1\)/)
  })

  it('still fails soft for everything else, since the backend is the fallback', () => {
    // A per-route problem (thin page, API blip) must not block a release.
    expect(source).toMatch(/continuing without static prerender/)
    expect(source).not.toMatch(/process\.exit\(1\)[^\n]*\n\s*\}\)\n\s*process\.exit/)
  })

  it('installs a browser when none is present, independent of npm install scripts', () => {
    // npm 11 blocks puppeteer's postinstall (the Chrome download) behind
    // allowScripts, so the build must be able to fetch a browser itself.
    expect(source).toMatch(/browsers', 'install'/)
  })

  it('installs the shared libraries a slim CI image lacks', () => {
    // A downloaded Chrome exits 127 on Vercel's image without libnss3/atk/gbm.
    expect(source).toMatch(/installSystemDeps/)
    expect(source).toMatch(/libnss3|libnss/)
    expect(source).toMatch(/libgbm1|mesa-libgbm/)
  })

  it('offers an explicit opt-out rather than failing by accident', () => {
    expect(source).toMatch(/PRERENDER_SKIP/)
  })
})
