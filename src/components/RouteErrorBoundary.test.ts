import { describe, it, expect } from 'vitest'
import { isChunkLoadError } from './RouteErrorBoundary'

describe('isChunkLoadError', () => {
  it('matches a stale-deploy dynamic-import failure (Vite)', () => {
    expect(
      isChunkLoadError(
        new Error(
          'Failed to fetch dynamically imported module: https://expeditiongotours.vercel.app/assets/AuthForm-8yim78WF.js',
        ),
      ),
    ).toBe(true)
  })

  it('matches Vite "Loading chunk … failed" messages', () => {
    expect(isChunkLoadError(new Error('Loading chunk 12 failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Loading CSS chunk 3 failed.'))).toBe(true)
  })

  it('matches "Importing a module script failed"', () => {
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
  })

  it('does not match ordinary render/runtime errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
    expect(isChunkLoadError('some string')).toBe(false)
  })
})
