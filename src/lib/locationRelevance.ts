/**
 * Token-based relevance check for the pickup picker's autocomplete results.
 *
 * The "Can't find your location? Search Google Maps" row was originally shown
 * only when autocomplete returned ZERO suggestions. That misses the common
 * case where autocomplete returns weak/unrelated matches for a local place it
 * doesn't really know — the traveller sees irrelevant suggestions and never
 * gets offered the Google Maps search.
 *
 * A suggestion now counts as "found" only when EVERY meaningful token of the
 * typed query appears in it as the start of a word (so `Kanes` matches
 * `Kaneshie`, but `osu` does not match `Tosu`). Stopwords and single-character
 * tokens are ignored. When no suggestion matches, the Google row is offered
 * alongside them — and it still only spends a SerpApi credit when clicked.
 */

interface RelevanceSuggestion {
  formatted?: string | null
  city?: string | null
  region?: string | null
  country?: string | null
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'is', 'near', 'of', 'on', 'or', 'the', 'to', 'with',
])

/** Lowercase + strip diacritics so `Ósu` and `Osu` compare equal. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** The meaningful tokens of a typed query (stopwords/short tokens dropped). */
export function locationQueryTokens(query: string): string[] {
  return normalize(query)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
}

/** True when `text` contains every token as the start of a word. */
export function locationTextMatchesTokens(text: string, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return true
  const haystack = normalize(text)
  return tokens.every((token) =>
    new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(token)}`).test(haystack),
  )
}

/**
 * True only when a suggestion is CLEARLY outside Ghana: a country code is
 * present and is not `gh`, or a country name is present and is not Ghana.
 * Suggestions with no country data are kept — never over-filter.
 *
 * This is a Ghana storefront and the SerpApi Google Maps search is already
 * hard-filtered to Ghana; a foreign brand-name match (e.g. "Four Points by
 * Sheraton Lagos") must not be treated as the traveller's location, and must
 * never hide the Google Maps fallback.
 */
export function isClearlyOutsideGhana(suggestion: {
  country?: string | null
  countryCode?: string | null
}): boolean {
  const code = (suggestion.countryCode || '').trim().toLowerCase()
  if (code) return code !== 'gh'
  const country = normalize(suggestion.country || '').trim()
  return country.length > 0 && country !== 'ghana'
}

/**
 * True when at least one suggestion actually contains what was typed — all
 * meaningful query tokens present (word-prefix match) in the text the
 * dropdown shows for that suggestion. A stopword-only query counts as found.
 */
export function hasRelevantLocationSuggestion(
  query: string,
  suggestions: readonly RelevanceSuggestion[],
): boolean {
  const tokens = locationQueryTokens(query)
  if (tokens.length === 0) return true
  return suggestions.some((suggestion) => {
    const haystack = [suggestion.formatted, suggestion.city, suggestion.region, suggestion.country]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .join(' ')
    return locationTextMatchesTokens(haystack, tokens)
  })
}
