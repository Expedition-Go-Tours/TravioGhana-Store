import { describe, expect, it } from 'vitest'
import { noClientSerpKeyPlugin } from '../../server/noClientSerpKey'

const transform = noClientSerpKeyPlugin().transform as unknown as (
  code: string,
  id: string,
) => unknown

describe('noClientSerpKeyPlugin', () => {
  it('fails the build when client code references the SerpApi key', () => {
    expect(() =>
      transform("const key = import.meta.env.VITE_SERP_API_KEY", '/app/src/foo.ts'),
    ).toThrow(/server-only SerpApi secret/)
  })

  it('fails the build when client code uses the bare import.meta.env object', () => {
    expect(() => transform('console.log(import.meta.env)', '/app/src/foo.ts')).toThrow(
      /bare import\.meta\.env/,
    )
  })

  it('allows individual safe import.meta.env keys', () => {
    expect(transform("const mode = import.meta.env.MODE", '/app/src/foo.ts')).toBeNull()
    expect(
      transform("const url = import.meta.env.VITE_API_URL", '/app/src/foo.ts'),
    ).toBeNull()
  })

  it('ignores dependencies, server files and test files', () => {
    expect(
      transform('const k = import.meta.env.VITE_SERP_API_KEY', '/app/node_modules/x/index.js'),
    ).toBeNull()
    expect(
      transform('const k = import.meta.env.VITE_SERP_API_KEY', '/app/middleware.ts'),
    ).toBeNull()
    expect(
      transform('const k = import.meta.env.VITE_SERP_API_KEY', '/app/server/x.ts'),
    ).toBeNull()
    expect(
      transform('const k = import.meta.env.VITE_SERP_API_KEY', '/app/src/foo.test.ts'),
    ).toBeNull()
  })
})
