/**
 * `apiUploadWithProgress` is the only place the app uses XMLHttpRequest (the
 * only browser API that reports request-body progress), so these tests pin the
 * behaviour the supplier form relies on: progress events, error mapping, and
 * one silent token refresh on 401.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  getAuthToken: vi.fn<() => Promise<string | null>>(async () => 'token-1'),
  refreshAuthToken: vi.fn<() => Promise<string | null>>(async () => 'token-2'),
  getApiBaseUrl: vi.fn(() => 'https://api.test'),
}))

vi.mock('./auth', () => auth)

import { ApiError, apiUploadWithProgress } from './api'

type ProgressEventLike = {
  lengthComputable: boolean
  loaded: number
  total: number
}

class FakeXhr {
  static instances: FakeXhr[] = []

  upload: {
    onprogress?: (event: ProgressEventLike) => void
    onload?: () => void
  } = {}

  status = 200
  response: unknown = { data: { ok: true } }
  headers: Record<string, string> = {}
  sentBody: FormData | null = null

  onload?: () => void
  onerror?: () => void
  ontimeout?: () => void
  onabort?: () => void

  open = vi.fn()
  setRequestHeader = vi.fn((name: string, value: string) => {
    this.headers[name] = value
  })
  send = vi.fn((body: FormData) => {
    this.sentBody = body
  })

  constructor() {
    FakeXhr.instances.push(this)
  }
}

function firstXhr(): FakeXhr {
  const xhr = FakeXhr.instances[0]
  if (!xhr) throw new Error('no XMLHttpRequest was sent')
  return xhr
}

describe('apiUploadWithProgress', () => {
  beforeEach(() => {
    FakeXhr.instances = []
    auth.getAuthToken.mockReset()
    auth.getAuthToken.mockResolvedValue('token-1')
    auth.refreshAuthToken.mockReset()
    auth.refreshAuthToken.mockResolvedValue('token-2')
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
  })

  it('sends multipart with the bearer token and reports upload percentages', async () => {
    const body = new FormData()
    body.append('documents', new File(['x'], 'id.png'))
    const onProgress = vi.fn()

    const result = apiUploadWithProgress<{ ok: boolean }>('/suppliers/apply', body, onProgress)
    await vi.waitFor(() => expect(FakeXhr.instances).toHaveLength(1))

    const xhr = firstXhr()
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer token-1')
    expect(xhr.sentBody).toBe(body)

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 })
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 })
    // Non-computable totals (some proxies) must not produce NaN%.
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 10, total: 0 })

    xhr.status = 200
    xhr.response = { data: { ok: true } }
    xhr.onload?.()

    await expect(result).resolves.toEqual({ ok: true })
    expect(onProgress.mock.calls.map(([percent]) => percent)).toEqual([25, 100])
  })

  it('surfaces the backend message as an ApiError with its status', async () => {
    const result = apiUploadWithProgress('/suppliers/apply', new FormData())
    await vi.waitFor(() => expect(FakeXhr.instances).toHaveLength(1))

    const xhr = firstXhr()
    xhr.status = 400
    xhr.response = { message: 'Too many files uploaded' }
    xhr.onload?.()

    await expect(result).rejects.toBeInstanceOf(ApiError)
    await expect(result).rejects.toMatchObject({
      message: 'Too many files uploaded',
      status: 400,
    })
  })

  it('refreshes the token once and retries when the upload gets a 401', async () => {
    const result = apiUploadWithProgress('/suppliers/apply', new FormData())
    await vi.waitFor(() => expect(FakeXhr.instances).toHaveLength(1))

    firstXhr().status = 401
    firstXhr().response = { message: 'Invalid or expired token' }
    firstXhr().onload?.()

    await vi.waitFor(() => expect(FakeXhr.instances).toHaveLength(2))
    const retry = FakeXhr.instances[1]
    expect(retry.headers.Authorization).toBe('Bearer token-2')

    retry.status = 200
    retry.response = { ok: true }
    retry.onload?.()

    await expect(result).resolves.toEqual({ ok: true })
    expect(auth.refreshAuthToken).toHaveBeenCalledTimes(1)
  })

  it('reports a readable error when the network drops mid-upload', async () => {
    const result = apiUploadWithProgress('/suppliers/apply', new FormData())
    await vi.waitFor(() => expect(FakeXhr.instances).toHaveLength(1))

    firstXhr().onerror?.()

    await expect(result).rejects.toThrow(/could not reach TravioGhana/i)
  })
})
