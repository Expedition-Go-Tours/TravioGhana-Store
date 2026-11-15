/**
 * Types for generate-llms-txt.cjs, so src/test/generateLlmsTxt.test.ts can
 * import the script's exports without `@ts-expect-error` — the same
 * arrangement scripts/generate-sitemap.d.cts sets up for the sitemap script.
 * The script sits outside every tsconfig include, so only this declaration is
 * picked up by TypeScript.
 */

export interface LlmsTour {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  startingPrice?: number | null;
  currency?: string | null;
  city?: string | null;
}

export interface LlmsArticle {
  slug: string;
  title: string;
  excerpt?: string | null;
  publishedAt?: string | null;
}

export interface PageLink {
  path: string;
  section: 'book' | 'company' | 'optional';
  label: string;
  note?: string;
}

export interface PriceRange {
  min: number;
  max: number;
  /** Single currency across the catalogue, or null when mixed. */
  currency: string | null;
  currencies: string[];
}

export interface Destination {
  city: string;
  count: number;
}

/** Build the whole llms.txt body from already-fetched API data. */
export declare function buildLlmsTxt(input: {
  tours?: LlmsTour[];
  articles?: LlmsArticle[];
  siteUrl?: string;
}): string;

/** Lowest/highest "from" price; null when no tour carries a price. */
export declare function priceRange(tours: LlmsTour[]): PriceRange | null;

/** First complete sentence (plus a second when the first is very short). */
export declare function summarise(text: unknown, maxChars?: number): string;

/** Tours grouped by the city a `?place=` page resolves, aliases applied. */
export declare function destinations(tours: LlmsTour[]): Destination[];

export declare function formatMoney(value: number | null | undefined, currency?: string | null): string;

/** Markdown-safe link label. */
export declare function linkLabel(text: unknown): string;

/** Canonical `/tour/<id>/<slug>` URL for a tour. */
export declare function tourUrl(tour: LlmsTour): string;

export declare const CITY_ALIASES: Record<string, string>;
export declare const PAGE_LINKS: PageLink[];
export declare const BLOG_INDEX: { path: string; label: string };
export declare const OUTPUT: string;
