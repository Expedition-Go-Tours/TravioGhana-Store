/**
 * Types for the prerender build script.
 *
 * The script itself is plain `.mjs` and is not part of a tsconfig `include`, so
 * TypeScript has no declaration to read when a test imports its exported
 * helpers. It reports the error against the *closing* line of a multi-line
 * import, which is why a `@ts-expect-error` above the `import` keyword silently
 * stopped applying and the build failed on a directive it had marked unused.
 *
 * Declaring the helpers here is better than suppressing: it gives the tests
 * real signatures to check against, so a renamed or dropped export is a
 * compile error rather than a test that quietly stops covering anything.
 */
import type { Page } from 'puppeteer'

export function dedupeTitle(html: string, title: string): string

/** Strips the prerender's own origin out of the serialised HTML. */
export function relativizeOrigin(html: string, origin: string | undefined): string

/** Routes required to carry product cards, not just text. */
export function isInventoryRoute(route: string): boolean

/** Bare origin from a base URL, or null if it is not a URL at all. */
export function toOrigin(value: unknown): string | null

/** Origins the prerender proxies through Node, from the values given in order. */
export function resolveApiOrigins(values: unknown[]): Set<string>

/** One key out of a .env file, without pulling in a parser. */
export function readDotEnvValue(text: string, key: string): string | undefined

/** True when a request URL is addressed to one of the proxied API origins. */
export function isApiRequest(url: string, origins: Set<string>): boolean

/** Everything that disqualifies a capture from being published. */
export function routeProblems(
  route: string,
  audit: {
    words: number
    h1: string[]
    canonical: string
    description: string
    robots: string
    cards: number
    tourLinks: number
  }
): string[]

/** Routes API requests to the page from Node, bypassing the CORS check. */
export function installApiProxy(page: Page, apiOrigins: Set<string>, pageOrigin: string): Promise<void>
