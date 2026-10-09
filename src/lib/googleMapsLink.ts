/**
 * Parses a pasted Google Maps link (or copied decimal coordinates) into an
 * exact [lat, lng] pair — entirely client-side, no network request.
 *
 * The traveller-facing flow: autocomplete found nothing for their address, so
 * they copy the pin from the Google Maps app/site and paste that link here.
 * Google encodes coordinates in several well-known places; we read the most
 * precise one available, in this order:
 *
 *   1. `!3d<lat>!4d<lng>` in the `data=` blob — the exact place pin.
 *   2. The last `/dir/<lat>,<lng>/<lat>,<lng>` path pair — the destination.
 *   3. `@<lat>,<lng>` — the map viewport centre.
 *   4. Query params: destination, daddr, query, q, ll, center, sll.
 *   5. Embed payload `!2d<lng>!3d<lat>` (note the swapped order).
 *   6. `geo:<lat>,<lng>` URIs.
 *   7. Plain decimal coordinates anywhere in the pasted text.
 *
 * Short share links (maps.app.goo.gl / goo.gl/maps / g.co/kgs) cannot be
 * expanded in the browser — they are reported with their own reason so the
 * UI can tell the traveller to copy the full link instead.
 */

export type MapsLinkParseFailure = 'short-link' | 'no-coords' | 'not-a-link'

export type MapsLinkParseResult =
  | { ok: true; lat: number; lng: number; label?: string }
  | { ok: false; reason: MapsLinkParseFailure }

/** A signed coordinate number: up to 3 integer digits + optional decimals. */
const COORD = String.raw`-?\d{1,3}(?:\.\d+)?`
/** Plain copied coordinates must carry decimals (avoids matching stray text). */
const COORD_DECIMAL = String.raw`-?\d{1,3}\.\d+`

const SHORT_LINK_RE = /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i
const URL_RE = /https?:\/\/\S+/i
const PARAM_KEYS = ['destination', 'daddr', 'query', 'q', 'll', 'center', 'sll'] as const

function toResult(latRaw: string, lngRaw: string, label?: string): MapsLinkParseResult | null {
  const lat = Number(latRaw)
  const lng = Number(lngRaw)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return label ? { ok: true, lat, lng, label } : { ok: true, lat, lng }
}

/** The place name from a `/maps/place/<name>/` path segment, if present. */
function placeName(raw: string): string | undefined {
  const match = raw.match(/\/maps\/place\/([^/@?\s]+)/i)
  if (!match || !match[1]) return undefined
  let name = match[1].replace(/\+/g, ' ')
  try {
    name = decodeURIComponent(name)
  } catch {
    /* malformed escape — keep the raw text */
  }
  const cleaned = name.trim()
  return cleaned || undefined
}

export function parseGoogleMapsLocation(input: string): MapsLinkParseResult {
  const raw = (input ?? '').trim()
  if (!raw) return { ok: false, reason: 'not-a-link' }

  const label = placeName(raw)
  const isShortLink = SHORT_LINK_RE.test(raw)

  // 1. Exact place pin in the data blob (!3d = lat, !4d = lng).
  const pin = raw.match(new RegExp(String.raw`!3d(${COORD})!4d(${COORD})`))
  if (pin) {
    const result = toResult(pin[1], pin[2], label)
    if (result) return result
  }

  // 2. Directions path — the last pair is the destination.
  const dir = raw.match(/\/dir\/([^?#\s]*)/i)
  if (dir) {
    const pairs = [...dir[1].matchAll(new RegExp(String.raw`(${COORD}),(${COORD})`, 'g'))]
    const last = pairs[pairs.length - 1]
    if (last) {
      const result = toResult(last[1], last[2], label)
      if (result) return result
    }
  }

  // 3. Viewport centre (@lat,lng).
  const view = raw.match(new RegExp(String.raw`@(${COORD}),(${COORD})`))
  if (view) {
    const result = toResult(view[1], view[2], label)
    if (result) return result
  }

  // 4. Query parameters (in destination-first order).
  for (const key of PARAM_KEYS) {
    const match = raw.match(new RegExp(String.raw`[?&]${key}=([^&#\s]+)`, 'i'))
    if (!match) continue
    let value = match[1]
    try {
      value = decodeURIComponent(value)
    } catch {
      /* malformed escape — parse the raw value */
    }
    value = value.replace(/^loc:/i, '')
    const pair = value.match(new RegExp(String.raw`^(${COORD})\s*,\s*(${COORD})$`))
    if (!pair) continue
    const result = toResult(pair[1], pair[2], label)
    if (result) return result
  }

  // 5. Embed payload — note !2d is longitude, !3d is latitude.
  const embed = raw.match(new RegExp(String.raw`!2d(${COORD})!3d(${COORD})`))
  if (embed) {
    const result = toResult(embed[2], embed[1], label)
    if (result) return result
  }

  // 6. Android geo: URIs.
  const geo = raw.match(new RegExp(String.raw`geo:(${COORD}),(${COORD})`, 'i'))
  if (geo) {
    const result = toResult(geo[1], geo[2], label)
    if (result) return result
  }

  // 7. Plain copied decimal coordinates anywhere in the text.
  const plain = raw.match(new RegExp(String.raw`(${COORD_DECIMAL})\s*,\s*(${COORD_DECIMAL})`))
  if (plain) {
    const result = toResult(plain[1], plain[2], label)
    if (result) return result
  }

  if (isShortLink) return { ok: false, reason: 'short-link' }
  if (URL_RE.test(raw)) return { ok: false, reason: 'no-coords' }
  return { ok: false, reason: 'not-a-link' }
}
