import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { TourBadgeFields } from './useExpeditionTours'

const fetchMock = vi.fn()

vi.mock('../lib/api', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchMock(...args),
}))

/**
 * `/tours/badges` has always returned seven badge fields — difficulty,
 * pickup, cancellation, languages, meeting mode and accommodation — and the
 * pipeline consumed six, dropping difficulty without a word. That mattered
 * most on surfaces whose payload carries none of them (the supplier rail),
 * where difficulty was the one badge the card could never show.
 *
 * The second half of this file is the lock: the homepage ships a difficulty on
 * every row, so a fill that overwrote it would put a different word on cards
 * that were already correct. Both directions are asserted here, because
 * `enrichTourBadgeFields` sits behind every listing section in the app.
 */

const WITH_BADGES = 'cmuwithbadges000000000001'
const DIFFICULTY_ONLY = 'cmudifficultyonly0000001'
const ALREADY_HAS_ONE = 'cmualreadyhasone00000001'
const NO_MATCH = 'cmunomatch000000000000001'

const badgeTours = [
  {
    id: WITH_BADGES,
    difficulty: 'challenging',
    languages: ['English', 'Twi'],
    cancellationPolicy: 'Free cancellation',
    pickupIncluded: true,
    meetingMode: 'pickup',
    accommodationIncluded: true,
  },
  // Exercises the short-circuit: a tour whose *only* available fact is
  // difficulty must still reach the fill instead of falling out early.
  { id: DIFFICULTY_ONLY, difficulty: 'easy' },
  { id: ALREADY_HAS_ONE, difficulty: 'expert' },
]

const ok = (payload: unknown) => ({ ok: true, status: 200, json: async () => payload })

/** The narrowest row the pipeline accepts — every badge field optional. */
type Row = { id: string } & TourBadgeFields

async function loadEnrich() {
  vi.resetModules()
  return (await import('./useExpeditionTours')).enrichTourBadgeFields
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: unknown) => {
    const u = String(url)
    if (u.includes('/tours/badges')) return ok({ data: { tours: badgeTours } })
    if (u.includes('/tours?limit=500')) return ok({ data: { tours: [] } })
    return ok({ data: {} })
  })
})

describe('enrichTourBadgeFields — difficulty', () => {
  it('backfills a difficulty the row does not carry', async () => {
    const enrich = await loadEnrich()

    const out = await enrich<Row>([{ id: WITH_BADGES }])

    expect(out[0].difficulty).toBe('challenging')
    expect(out[0].languages).toEqual(['English', 'Twi'])
    expect(out[0].pickupIncluded).toBe(true)
  })

  it('reaches the fill when difficulty is the only available badge', async () => {
    const enrich = await loadEnrich()

    const out = await enrich<Row>([{ id: DIFFICULTY_ONLY }])

    // The early-return short-circuits on every field it knows about; omitting
    // difficulty from that list would send this row back untouched.
    expect(out[0].difficulty).toBe('easy')
    expect(out[0].languages).toBeUndefined()
    expect(out[0].pickupIncluded).toBeUndefined()
  })

  it('never overwrites a difficulty the row already carries', async () => {
    const enrich = await loadEnrich()

    // The homepage ships difficulty on every row. Anything that clobbered it
    // would change cards that were already right, across every section.
    const out = await enrich<Row>([{ id: ALREADY_HAS_ONE, difficulty: 'moderate' }])

    expect(out[0].difficulty).toBe('moderate')
  })

  it('fills the rest of the badge set without touching difficulty at all', async () => {
    const enrich = await loadEnrich()

    const out = await enrich<Row>([{ id: WITH_BADGES, difficulty: 'moderate' }])

    expect(out[0].difficulty).toBe('moderate')
    expect(out[0].cancellationPolicy).toBe('Free cancellation')
    expect(out[0].accommodationIncluded).toBe(true)
  })

  it('leaves a row with no match completely unchanged', async () => {
    const enrich = await loadEnrich()

    const source = { id: NO_MATCH }
    const out = await enrich<Row>([source])

    expect(out[0]).toEqual({ id: NO_MATCH })
    expect(out[0]).toBe(source)
  })

  it('passes an empty list through without fetching anything', async () => {
    const enrich = await loadEnrich()

    expect(await enrich<Row>([])).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
