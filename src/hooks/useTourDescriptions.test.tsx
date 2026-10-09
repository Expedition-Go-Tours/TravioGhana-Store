import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTourDescriptionsByIds } from './useTourDescriptions'

const fetchMock = vi.fn()

vi.mock('../lib/api', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchMock(...args),
}))

const ok = (payload: unknown) => ({ ok: true, status: 200, json: async () => payload })
const fail = (status: number, message = 'boom') => ({
  ok: false,
  status,
  json: async () => ({ message }),
})

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  fetchMock.mockReset()
})

describe('useTourDescriptionsByIds', () => {
  it('fetches each tour from the detail endpoint and maps cleaned descriptions', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/tours/t1') {
        return ok({ data: { tour: { description: 'Para one\n\n  Para two   extra  ' } } })
      }
      if (url === '/tours/t3') {
        return ok({ data: { tour: { description: 'Third description' } } })
      }
      return fail(500)
    })

    const { result } = renderHook(() => useTourDescriptionsByIds(['t1', 't2', 't3']), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.size).toBe(2))
    expect(fetchMock).toHaveBeenCalledWith('/tours/t1')
    // Paragraph breaks preserved, lines cleaned — the detail page's source.
    expect(result.current.get('t1')).toBe('Para one\nPara two extra')
    // A failed tour never blocks the others — it is simply absent.
    expect(result.current.has('t2')).toBe(false)
    expect(result.current.get('t3')).toBe('Third description')
  })

  it('does not fetch when disabled', () => {
    renderHook(() => useTourDescriptionsByIds(['t1'], false), { wrapper: createWrapper() })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
