import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectPreview, PREVIEW_BANNER_TEXT, STAGING_HOSTNAME } from './previewEnvironment'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('detectPreview', () => {
  it('uses the explicit app-env flag first', () => {
    vi.stubEnv('VITE_APP_ENV', 'staging')
    expect(detectPreview(STAGING_HOSTNAME)).toBe('app-env')
    expect(detectPreview('www.travioghana.com')).toBe('app-env')
  })

  it('recognises the fixed staging host without the env flag', () => {
    vi.stubEnv('VITE_APP_ENV', '')
    expect(detectPreview(STAGING_HOSTNAME)).toBe('staging-domain')
    expect(detectPreview(STAGING_HOSTNAME.toUpperCase())).toBe('staging-domain')
  })

  it('recognises any Vercel branch preview without the env flag', () => {
    vi.stubEnv('VITE_APP_ENV', '')
    expect(detectPreview('travio-ghana-store-git-staging-a1b2c3d4.vercel.app')).toBe('vercel-preview')
    expect(detectPreview('some-other-project.vercel.app')).toBe('vercel-preview')
    expect(detectPreview('vercel.app')).toBeNull()
  })

  it('stays quiet on production and localhost', () => {
    vi.stubEnv('VITE_APP_ENV', 'production')
    expect(detectPreview('www.travioghana.com')).toBeNull()
    expect(detectPreview('travioghana.com')).toBeNull()
    expect(detectPreview('localhost')).toBeNull()
    expect(detectPreview('127.0.0.1')).toBeNull()
    expect(detectPreview('store-staging.travioghana.com.evil.example')).toBeNull()
  })

  it('describes what the warning is about', () => {
    expect(PREVIEW_BANNER_TEXT).toContain('production data')
  })
})
