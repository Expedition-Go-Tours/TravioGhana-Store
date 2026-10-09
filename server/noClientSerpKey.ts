import type { Plugin } from 'vite'

/**
 * Build guard for the SerpApi key.
 *
 * The key is stored as `VITE_SERP_API_KEY` to match the deployment tooling's
 * naming, but it is a SERVER-ONLY secret: normally the `VITE_` prefix tells
 * Vite to expose a variable to the browser bundle, and SerpApi explicitly
 * forbids client-side keys (anyone could drain the account's searches).
 *
 * This plugin makes that leak structurally impossible:
 *  - referencing `import.meta.env.VITE_SERP_API_KEY` in client code fails the
 *    build;
 *  - using the bare `import.meta.env` object — which serializes every `VITE_`
 *    variable, including this one, into the public bundle — fails the build
 *    as well.
 *
 * Server code reads the variable via `process.env` (Vercel middleware) and
 * `loadEnv` (the Vite dev route) — never through `import.meta.env`.
 */
export function noClientSerpKeyPlugin(): Plugin {
  /**
   * Only client-bundled sources are checked. Test files, `node_modules` and
   * server/root files (middleware, vite config, server/) are ignored — they
   * never ship to the browser and may legitimately reference the name.
   */
  const isClientSource = (id: string): boolean =>
    id.includes('/src/') && !id.includes('/node_modules/') && !/\.(test|spec)\.[jt]sx?$/.test(id)

  return {
    name: 'no-client-serp-key',
    transform(code, id) {
      if (!isClientSource(id)) return null
      if (code.includes('VITE_SERP_API_KEY')) {
        throw new Error(
          '[no-client-serp-key] VITE_SERP_API_KEY is a server-only SerpApi secret and must not be referenced in client code. Use the same-origin /api/maps-search route (src/lib/serpApiMapsSearch.ts) instead.',
        )
      }
      if (/\bimport\.meta\.env(?!\.)/.test(code)) {
        throw new Error(
          '[no-client-serp-key] Using the bare import.meta.env object would serialize every VITE_ variable — including VITE_SERP_API_KEY — into the public bundle. Reference individual import.meta.env.VITE_* keys instead.',
        )
      }
      return null
    },
  }
}
