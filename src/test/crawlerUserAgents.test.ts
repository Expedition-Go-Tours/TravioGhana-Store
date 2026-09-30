import { describe, it, expect } from 'vitest'
import { isBot } from '../../middleware'

/**
 * Which user agents are served the build-time prerender rather than the SPA
 * shell.
 *
 * middleware.ts decides this with `BOT_AGENTS.some((b) => ua.toLowerCase().includes(b))`
 * — a substring test. Every Google fetcher except `Googlebot` fails it, because
 * none of them contain the literal string "googlebot":
 *
 *   "…Google-InspectionTool/1.0…"  includes "googlebot"?  no
 *
 * The one that bit is Google-InspectionTool, which is what Search Console's
 * "Test live URL" sends. It was being handed the 5 KB shell — no canonical, no
 * meta robots, no <h1>, and a <title> that was not the one Google had indexed —
 * while Googlebot was served 571 KB of the real page. A live test against an
 * empty document is not a test of the site.
 *
 * The assertions below pin the exact user-agent strings Google publishes, so
 * deleting any of these tokens from BOT_AGENTS fails here rather than silently
 * un-fixing the inspection tool.
 */

// Verbatim from Google's own crawler documentation.
const GOOGLEBOT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const INSPECTION_TOOL =
  'Mozilla/5.0 (compatible; Google-InspectionTool/1.0; +http://www.google.com/bot.html)'
const ADSBOT =
  'Mozilla/5.0 (compatible; AdsBot-Google/2.1; +http://www.google.com/bot.html)'
const MEDIAPARTNERS = 'Mozilla/5.0 (compatible; Mediapartners-Google)'
const STOREBOT =
  'Mozilla/5.0 (compatible; Storebot-Google/1.0; +http://www.google.com/bot.html)'
const APIS_GOOGLE = 'Mozilla/5.0 (compatible; APIs-Google; +http://www.google.com/bot.html)'
const GOOGLE_OTHER = 'Mozilla/5.0 (compatible; GoogleOther)'

// A real browser, kept as the negative control: if this ever matches, the
// bot list has grown a substring that also occurs in ordinary UA strings and
// every visitor would be served prerendered HTML.
const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

describe('crawler user agents get the prerender, not the SPA shell', () => {
  it("recognises Search Console's Test live URL fetcher", () => {
    expect(isBot(INSPECTION_TOOL)).toBe(true)
  })

  it('recognises Googlebot', () => {
    expect(isBot(GOOGLEBOT)).toBe(true)
  })

  it('recognises the Google fetchers whose names lack the substring "googlebot"', () => {
    for (const ua of [ADSBOT, MEDIAPARTNERS, STOREBOT, APIS_GOOGLE, GOOGLE_OTHER]) {
      expect(isBot(ua), `expected ${ua} to be treated as a crawler`).toBe(true)
    }
  })

  it('does not mistake a browser for a crawler', () => {
    expect(isBot(CHROME)).toBe(false)
  })

  it('handles an absent or empty user agent', () => {
    expect(isBot('')).toBe(false)
    expect(isBot(undefined)).toBe(false)
    expect(isBot(null)).toBe(false)
  })

  it('would not have matched the inspection tool under the old single-token check', () => {
    // Documents the bug rather than the fix: the reason it was missed is that
    // "google-inspectiontool" does not contain "googlebot". If someone
    // "simplifies" BOT_AGENTS back to a bare 'googlebot', this still passes —
    // the assertion above is what catches that. This one just explains why.
    expect(INSPECTION_TOOL.toLowerCase()).not.toContain('googlebot')
    expect(isBot(INSPECTION_TOOL)).toBe(true)
  })
})
