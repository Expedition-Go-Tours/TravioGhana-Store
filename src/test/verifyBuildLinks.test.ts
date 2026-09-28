import { describe, it, expect } from 'vitest'
// Typed by scripts/verify-build-links.d.mts — the script itself is plain .mjs
// and sits outside every tsconfig include.
import {
  extractTourSegments,
  classifySegment,
  summarise,
  isEntrypoint,
} from '../../scripts/verify-build-links.mjs'

/**
 * The homepage as it shipped with the last-minute-rail bug: ten cards linked by
 * the offer row's id, the rest by the tour's. This is the shape the gate exists
 * to reject, so it is the fixture the classification tests lean on.
 */
const OFFER_IDS = [
  'cmt8txcri0465646pa9y6d76n',
  'cmt8u0qk0047z646pds75l3rs',
  'cmt8u1d6v0486646pro203b5h',
]
const TOUR_IDS = ['cmt8hjkii00bo646phdiznmrr', 'cmt8lt5ma025x646psioguemz']

const KNOWN = {
  offerIds: new Set(OFFER_IDS),
  tourIds: new Set(TOUR_IDS),
}

describe('extractTourSegments', () => {
  it('reads the first segment of the canonical two-segment form', () => {
    const html = '<a href="/tour/cmt8hjkii00bo646phdiznmrr/cape-coast-castle">x</a>'
    expect(extractTourSegments(html)).toEqual(['cmt8hjkii00bo646phdiznmrr'])
  })

  it('reads the legacy single-segment form too', () => {
    const html = '<a href="/tour/cmt8hjkii00bo646phdiznmrr">x</a>'
    expect(extractTourSegments(html)).toEqual(['cmt8hjkii00bo646phdiznmrr'])
  })

  it('de-duplicates: the same tour in three rails is one thing to resolve', () => {
    const id = 'cmt8hjkii00bo646phdiznmrr'
    const html = [
      `<a href="/tour/${id}/a">`,
      `<a href="/tour/${id}/b">`,
      `<a href="/tour/${id}">`,
    ].join('')
    expect(extractTourSegments(html)).toEqual([id])
  })

  it('keeps the slug out of the result, so a retitle cannot change the verdict', () => {
    const html = '<a href="/tour/abc123/old-slug">x</a><a href="/tour/abc123/new-slug">y</a>'
    expect(extractTourSegments(html)).toEqual(['abc123'])
  })

  it('ignores hrefs that are not tour links', () => {
    const html = [
      '<a href="/tours?category=x">',
      '<a href="/tour-cancellation-policy">',
      '<a href="/about-us">',
      '<a href="https://expeditiongotours.com/tour/abc">',
    ].join('')
    expect(extractTourSegments(html)).toEqual([])
  })

  it('returns nothing for a page with no links at all', () => {
    expect(extractTourSegments('<html><body>Tour not found</body></html>')).toEqual([])
  })

  it('never reports a bare or double-slashed /tour/ link', () => {
    // The regex requires a segment, so these simply are not matches.
    expect(extractTourSegments('<a href="/tour/">x</a><a href="/tour//slug">y</a>')).toEqual([])
  })
})

describe('classifySegment', () => {
  it('names an offer id, which is the regression this gate was written for', () => {
    expect(classifySegment(OFFER_IDS[0], KNOWN)).toBe('offer')
  })

  it('names a live tour id', () => {
    expect(classifySegment(TOUR_IDS[0], KNOWN)).toBe('tour')
  })

  it('calls anything unrecognised unknown rather than guessing', () => {
    expect(classifySegment('cmtdoesnotexist0000000000', KNOWN)).toBe('unknown')
  })

  it('treats an id in both sets as an offer, the worse explanation', () => {
    const both = { offerIds: new Set(['x']), tourIds: new Set(['x']) }
    expect(classifySegment('x', both)).toBe('offer')
  })

  it('defaults to unknown when it knows nothing', () => {
    expect(classifySegment('anything')).toBe('unknown')
  })
})

describe('isEntrypoint', () => {
  // The real checkout path has a space in it, which is exactly what breaks a
  // naive `file://${argv[1]}` comparison.
  const SPACED = '/Users/someone/Documents/Default Project/TravioGhana-Store'
  const url = 'file:///Users/someone/Documents/Default%20Project/TravioGhana-Store/scripts/verify-build-links.mjs'
  const argv = `${SPACED}/scripts/verify-build-links.mjs`

  it('recognises itself when run directly, even from a path with a space', () => {
    expect(isEntrypoint(argv, url)).toBe(true)
  })

  it('is false when merely imported by the test suite', () => {
    expect(isEntrypoint('/some/other/entry.mjs', url)).toBe(false)
  })

  it('is false when argv[1] is absent', () => {
    expect(isEntrypoint(undefined, url)).toBe(false)
  })

  it('is false rather than throwing on a nonsense url', () => {
    expect(isEntrypoint(argv, 'not-a-url')).toBe(false)
  })
})

describe('summarise', () => {
  const row = (segment: string, ok: boolean, kind: 'offer' | 'tour' | 'unknown' = 'tour') => ({
    segment,
    ok,
    kind,
  })

  it('passes when every link resolves', () => {
    const s = summarise([row('a', true), row('b', true)])
    expect(s).toMatchObject({ total: 2, resolved: 2, broken: 0, passed: true })
  })

  it('fails on a single broken link, however many resolve', () => {
    const s = summarise([row('a', true), row('b', true), row('c', false, 'offer')])
    expect(s).toMatchObject({ total: 3, resolved: 2, broken: 1, passed: false })
  })

  it('does not pass an empty run — that would rubber-stamp a gutted build', () => {
    expect(summarise([]).passed).toBe(false)
  })

  it('breaks the tally down by why each link failed', () => {
    const s = summarise([
      row('a', false, 'offer'),
      row('b', false, 'offer'),
      row('c', false, 'tour'),
      row('d', false, 'unknown'),
      row('e', true),
    ])
    expect(s.broken).toBe(4)
    expect(s.byKind).toEqual({ offer: 2, tour: 1, unknown: 1 })
  })

  it('counts a broken link in its kind bucket and never in `resolved`', () => {
    const s = summarise([row('a', false, 'offer')])
    expect(s.resolved).toBe(0)
    expect(s.total).toBe(1)
  })

  it('reports a zero for every kind when nothing is broken', () => {
    // Pins the bucket list itself, not just the counts that get filled in.
    expect(summarise([row('a', true), row('b', true)]).byKind).toEqual({
      offer: 0,
      tour: 0,
      unknown: 0,
    })
  })
})
