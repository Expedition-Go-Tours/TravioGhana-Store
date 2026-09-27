import { lazy, type ComponentType } from 'react'

/**
 * `React.lazy` with a guaranteed component.
 *
 * React trusts whatever the dynamic import resolves to. When it resolves to
 * something unexpected — a chunk mismatch after a deploy, a duplicated React
 * copy, or an export that was renamed or tree-shaken away — the lazy payload's
 * `_result` is left `undefined` and React dies inside its own `lazyInitializer`
 * with:
 *
 *   TypeError: Cannot read properties of undefined (reading 'default')
 *
 * That error is thrown during render, so it takes the entire route down with
 * it. Every lazy boundary in this app is either a route or a decoration (an
 * animation that already has a static fallback), so a bad resolution should
 * degrade to the fallback instead of crashing.
 *
 * This normalises the resolved module (named export, then `default`), verifies
 * it is actually a component, and falls back — including when the import
 * itself rejects.
 *
 * @param loader    the dynamic `import()` (may resolve to anything)
 * @param exportName optional named export to prefer over `default`
 * @param Fallback  rendered when nothing usable resolved (defaults to nothing)
 */
export function safeLazy<P = Record<string, unknown>>(
  loader: () => Promise<unknown>,
  exportName?: string,
  Fallback: ComponentType<P> = (() => null) as ComponentType<P>,
) {
  return lazy(async () => {
    try {
      const mod = (await loader()) as Record<string, unknown> | null | undefined
      const candidate = (exportName ? mod?.[exportName] : undefined) ?? mod?.default
      // A component is a function (or a class); anything else — undefined, a
      // string, a module namespace — means the resolution went wrong.
      if (typeof candidate === 'function') {
        return { default: candidate as ComponentType<P> }
      }
      if (import.meta.env.DEV) {
        console.error(
          `[safeLazy] expected a component${exportName ? ` from export "${exportName}"` : ''} but resolved ${Object.prototype.toString.call(candidate)}`,
        )
      }
      return { default: Fallback }
    } catch (err) {
      if (import.meta.env.DEV) console.error('[safeLazy] dynamic import failed:', err)
      return { default: Fallback }
    }
  })
}
