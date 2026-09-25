import { describe, expect, it, vi, beforeEach } from 'vitest'
import { classifySupplierSegment, normaliseSupplierName, resolveSupplierProfileTour } from './supplierResolution'

const SUPPLIER_ID = 'cmpcxwl3k0000caylg0jcp879'
const TOUR_ID = 'cmt8ij61a00oc646p0sq1d8xq'

const detailTour = {
  id: TOUR_ID,
  supplier: {
    id: SUPPLIER_ID,
    name: 'Expedition-Go Tours LTD',
    supplierProfile: { businessInfo: { description: 'Real about text', phone: '+233501234567' } },
  },
}

const listTour = {
  id: TOUR_ID,
  supplier: { id: SUPPLIER_ID, name: 'Expedition-Go Tours LTD', supplierProfile: { averageRating: '4.86' } },
}

/** The reduced list block never carries businessInfo — the whole reason for this module. */
const listSupplierWithoutBusinessInfo = {
  id: SUPPLIER_ID,
  name: 'Expedition-Go Tours LTD',
  supplierProfile: { averageRating: '4.86', totalBookings: 7, status: 'ACTIVE', supplierType: 'TOUR_COMPANY' },
}

vi.mock('./api', () => ({
  apiFetch: vi.fn(),
  fetchWithAuth: vi.fn(),
}))

const { apiFetch, fetchWithAuth } = await import('./api')
const apiFetchMock = vi.mocked(apiFetch)
const fetchMock = vi.mocked(/** @type {any} */ (fetchWithAuth))

const jsonResponse = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response

beforeEach(() => {
  apiFetchMock.mockReset()
  fetchMock.mockReset()
})

describe('classifySupplierSegment', () => {
  it('recognises a supplier id in the URL', () => {
    expect(classifySupplierSegment(SUPPLIER_ID)).toEqual({ supplierId: SUPPLIER_ID, name: null })
  })

  it('treats anything else as a name, decoded', () => {
    expect(classifySupplierSegment('Kadelo%20Travels')).toEqual({ supplierId: null, name: 'Kadelo Travels' })
    expect(classifySupplierSegment('Expedition-Go%20Tours%20LTD')).toEqual({
      supplierId: null,
      name: 'Expedition-Go Tours LTD',
    })
  })

  it('handles an empty segment', () => {
    expect(classifySupplierSegment('')).toEqual({ supplierId: null, name: null })
  })
})

describe('normaliseSupplierName', () => {
  it('ignores case and punctuation', () => {
    expect(normaliseSupplierName('Expedition-Go Tours LTD')).toBe('expedition go tours ltd')
    expect(normaliseSupplierName('  expedition   go  tours  ltd ')).toBe('expedition go tours ltd')
  })
})

describe('resolveSupplierProfileTour', () => {
  it('uses the tour id from router state and never scans the catalogue', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { tour: detailTour } }))

    const tour = await resolveSupplierProfileTour({ tourId: TOUR_ID })

    expect(tour).toBe(detailTour)
    expect(fetchMock).toHaveBeenCalledWith(`/tours/${TOUR_ID}`)
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('resolves a supplier id through one of their tours', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ tours: [{ id: TOUR_ID }] })
      .mockResolvedValueOnce({ tours: [] })
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { tour: detailTour } }))

    const tour = await resolveSupplierProfileTour({ supplierId: SUPPLIER_ID, name: null })

    expect(tour).toBe(detailTour)
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, `/tours?supplierId=${SUPPLIER_ID}&limit=1`)
    expect(fetchMock).toHaveBeenCalledWith(`/tours/${TOUR_ID}`)
  })

  it('scans the catalogue for a name, then fetches the detail payload for its businessInfo', async () => {
    apiFetchMock
      // name scan: the list block has no businessInfo …
      .mockResolvedValueOnce({
        tours: [listTour],
        pagination: { hasNextPage: false },
      })
      // … so one of the supplier's tours is fetched by id
      .mockResolvedValueOnce({ tours: [{ id: TOUR_ID }] })
      .mockResolvedValueOnce({ tours: [] })
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { tour: detailTour } }))

    const tour = await resolveSupplierProfileTour({ name: 'Expedition-Go Tours LTD' })

    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/tours?limit=500&page=1')
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, `/tours?supplierId=${SUPPLIER_ID}&limit=1`)
    expect(fetchMock).toHaveBeenCalledWith(`/tours/${TOUR_ID}`)
    expect(tour?.supplier?.supplierProfile?.businessInfo).toEqual({ description: 'Real about text', phone: '+233501234567' })
  })

  it('matches names regardless of case and punctuation', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ tours: [{ id: TOUR_ID, supplier: listSupplierWithoutBusinessInfo }] })
      .mockResolvedValueOnce({ tours: [{ id: TOUR_ID }] })
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { tour: detailTour } }))

    const tour = await resolveSupplierProfileTour({ name: 'expedition go tours ltd' })

    expect(tour?.supplier?.id).toBe(SUPPLIER_ID)
  })

  it('returns the reduced list block rather than nothing when the detail fetch fails', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ tours: [{ id: TOUR_ID, supplier: listSupplierWithoutBusinessInfo }] })
      .mockResolvedValueOnce({ tours: [] })
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) } as unknown as Response)

    const tour = await resolveSupplierProfileTour({ name: 'Expedition-Go Tours LTD' })

    expect(tour).toMatchObject({ supplier: { id: SUPPLIER_ID, name: 'Expedition-Go Tours LTD' } })
  })

  it('returns null when the supplier cannot be found at all', async () => {
    apiFetchMock.mockResolvedValue({ tours: [], pagination: { hasNextPage: false } })

    await expect(resolveSupplierProfileTour({ name: 'Nobody Travels' })).resolves.toBeNull()
  })

  it('stops scanning when the API reports no further pages', async () => {
    apiFetchMock.mockResolvedValue({ tours: [], pagination: { hasNextPage: false } })

    await resolveSupplierProfileTour({ name: 'Nobody Travels' })

    expect(apiFetchMock).toHaveBeenCalledTimes(1)
  })

  it('propagates a failing name scan so the page can offer a retry, not "not found"', async () => {
    apiFetchMock.mockRejectedValue(new Error('network'))

    await expect(resolveSupplierProfileTour({ name: 'Kadelo Travels' })).rejects.toThrow('network')
  })
})
