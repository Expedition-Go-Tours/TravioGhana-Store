import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTourDescriptions } from './useTourDescriptions'

const fetchMock = vi.fn()

vi.mock('../lib/api', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchMock(...args),
}))

const ok = (payload: unknown) => ({ ok: true, status: 200, json: async () => payload })

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  fetchMock.mockReset()
})

describe('useTourDescriptions', () => {
  it('loads the catalogue and maps cleaned, card-ready rows', async () => {
    fetchMock.mockResolvedValueOnce(
      ok({
        data: {
          tours: [
            {
              id: 't1',
              title: 'Cape Coast Castle',
              slug: 'cape-coast',
              coverPhoto: '',
              photos: ['https://img/1.jpg'],
              description: 'Line one\n\n  Line two   extra  ',
            },
            {
              id: 't2',
              title: 'Accra Food Tour',
              slug: 'accra-food',
              coverPhoto: 'https://img/cover.jpg',
              photos: [],
              description: 42,
            },
            { id: '', title: 'missing id — dropped' },
          ],
        },
      }),
    )

    const { result } = renderHook(() => useTourDescriptions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith('/travioghana/tours?limit=50')
    expect(result.current.data).toEqual([
      {
        id: 't1',
        title: 'Cape Coast Castle',
        slug: 'cape-coast',
        image: 'https://img/1.jpg',
        description: 'Line one Line two extra',
      },
      {
        id: 't2',
        title: 'Accra Food Tour',
        slug: 'accra-food',
        image: 'https://img/cover.jpg',
        description: '',
      },
    ])
  })

  it('does not fetch when disabled', () => {
    renderHook(() => useTourDescriptions(false), { wrapper: createWrapper() })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
