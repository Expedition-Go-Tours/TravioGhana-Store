/**
 * Types for generate-sitemap.cjs, so src/test/generateSitemap.test.ts can
 * import the script's exports without `@ts-expect-error` — the same arrangement
 * scripts/verify-build-links.d.mts sets up for its gate. The script sits
 * outside every tsconfig include, so only this declaration is picked up.
 */

export interface StaticPage {
  path: string;
  priority: number;
  changefreq: string;
}

export declare const STATIC_PAGES: StaticPage[];
export declare const SHARED_PAGE_SOURCES: string[];

/** Marketing pages whose body is the catalogue, so they inherit its date as a floor. */
export declare const CATALOGUE_BACKED_PAGES: Set<string>;

export declare function isoDate(value: unknown): string | undefined;

/** Newest of a set of YYYY-MM-DD strings; undefined when none survive. */
export declare function latestDate(
  ...sets: Array<readonly (string | null | undefined)[] | string | null | undefined>
): string | undefined;

/**
 * Date a page's source last changed, from `git log -1 --format=%as`.
 * Undefined when git cannot answer (no .git, shallow checkout, timeout).
 */
export declare function gitLastModified(files: readonly string[]): string | undefined;

/** Marketing route -> the tracked source files whose change changes that page. */
export declare function staticPageSources(): Map<string, string[]>;

/**
 * lastmod for an app-rendered route: its own git date, raised to the
 * catalogue date for catalogue-backed pages, and falling back to the catalogue
 * date when git is unavailable.
 */
export declare function marketingLastmod(
  route: string,
  sources: Map<string, readonly string[]>,
  catalogueDate?: string
): string | undefined;
