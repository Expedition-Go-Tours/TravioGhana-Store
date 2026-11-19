/**
 * Shared helpers for the locale translation pipeline.
 *
 * The important rule in this file is that translation engines never see a
 * `{{placeholder}}` or an HTML tag. Both are replaced with opaque sentinels
 * before a string is sent to the provider and restored afterwards. Without
 * this, providers translate `{{year}}` into `{{année}}` and `<brand>` into
 * `<marque>`, which breaks i18next interpolation and `<Trans>` rendering.
 */

import { readFileSync } from 'node:fs'

export const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other']

const TOKEN_PREFIX = 'I18NTOKEN'
const PLACEHOLDER_RE = /\{\{[\s\S]*?\}\}/g
const TAG_RE = /<\/?[a-zA-Z][^>]*>/g
const URL_RE = /https?:\/\/[^\s<>"']+/g

export function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out)
    } else {
      out[path] = value
    }
  }
  return out
}

export function setPath(obj, path, value) {
  const parts = path.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i]
    if (!current[part] || typeof current[part] !== 'object') current[part] = {}
    current = current[part]
  }
  current[parts[parts.length - 1]] = value
}

export function extractPlaceholders(text) {
  return [...String(text).matchAll(PLACEHOLDER_RE)].map((match) => match[0])
}

export function extractTags(text) {
  return [...String(text).matchAll(TAG_RE)].map((match) => match[0])
}

/**
 * Placeholders are named, so their sentence order may legitimately change in
 * translation. Compare them as a multiset rather than an ordered list. Tags
 * remain order-sensitive because `<Trans>` maps them by position.
 */
export function placeholdersMatch(source, target) {
  const sourceValues = extractPlaceholders(source)
  const targetValues = extractPlaceholders(target)
  if (sourceValues.length !== targetValues.length) return false
  const counts = new Map()
  for (const value of sourceValues) counts.set(value, (counts.get(value) ?? 0) + 1)
  for (const value of targetValues) {
    const remaining = counts.get(value)
    if (!remaining) return false
    counts.set(value, remaining - 1)
  }
  for (const remaining of counts.values()) if (remaining !== 0) return false
  return true
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Protect tags, URLs, placeholders and brand terms with sentinels.
 * Tags are protected first so a placeholder/URL inside an attribute is kept
 * inside the opaque tag token rather than creating nested tokens.
 */
export function protectText(text, protectedTerms = [], tokenPrefix = TOKEN_PREFIX) {
  const tokens = []
  let output = String(text)

  const add = (value) => {
    const token = `⟦${tokenPrefix}${tokens.length}⟧`
    tokens.push({ token, value })
    return token
  }

  output = output.replace(TAG_RE, (match) => add(match))
  output = output.replace(URL_RE, (match) => add(match))
  output = output.replace(PLACEHOLDER_RE, (match) => add(match))

  for (const term of [...protectedTerms].filter(Boolean).sort((a, b) => b.length - a.length)) {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(term)})(?=$|[^\\p{L}\\p{N}])`, 'gu')
    output = output.replace(pattern, (match, before, found) => `${before}${add(found)}`)
  }

  return { text: output, tokens }
}

export function restoreText(text, tokens) {
  let output = String(text)
  for (const { token, value } of tokens) {
    if (!output.includes(token)) {
      throw new Error(`translation lost sentinel ${token}`)
    }
    output = output.split(token).join(value)
  }
  return output
}

/** Validate placeholders, tags and sentinel leakage against a source string. */
export function compareTranslation(source, target) {
  const errors = []
  if (!placeholdersMatch(source, target)) {
    errors.push(
      `placeholders expected ${extractPlaceholders(source).join(' ') || '(none)'} got ${extractPlaceholders(target).join(' ') || '(none)'}`,
    )
  }

  const sourceTags = extractTags(source)
  const targetTags = extractTags(target)
  if (JSON.stringify(sourceTags) !== JSON.stringify(targetTags)) {
    errors.push(`tags expected ${sourceTags.join(' ') || '(none)'} got ${targetTags.join(' ') || '(none)'}`)
  }

  if (String(target).includes(`⟦${TOKEN_PREFIX}`)) errors.push('unreplaced sentinel token')
  if (/[⟦⟧]/.test(String(target))) errors.push('leftover sentinel bracket')
  if (!String(target).trim()) errors.push('empty translation')

  // Catch a provider that returns only the placeholder/number and drops the
  // actual phrase, e.g. "{{count}} experience" -> "{{count}}".
  const sourceWords = String(source)
    .replace(PLACEHOLDER_RE, '')
    .replace(TAG_RE, '')
    .trim()
  const targetWords = String(target)
    .replace(PLACEHOLDER_RE, '')
    .replace(TAG_RE, '')
    .replace(/[0-9\s.,%+:/–—-]/g, '')
    .trim()
  // A time range legitimately becomes numeric in 24-hour locales
  // ("8:00 AM - 10:00 PM" -> "8:00–22:00"), so do not require a word there.
  const looksLikeTimeRange = /\b(?:AM|PM)\b/i.test(source) && /\d{1,2}:\d{2}/.test(source)
  if (!looksLikeTimeRange && /\p{L}/u.test(sourceWords) && !/[\p{L}★]/u.test(targetWords)) {
    errors.push('translation has no words')
  }

  return errors
}

/** Plural categories for a locale, in stable output order. */
export function pluralCategories(locale) {
  try {
    const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories
    return PLURAL_SUFFIXES.filter((category) => categories.includes(category))
  } catch {
    return ['one', 'other']
  }
}

const REPRESENTATIVE_CANDIDATES = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 20, 21, 22, 25, 100, 101, 1000,
]

/**
 * A small integer that makes Intl.PluralRules select `category`.
 * Small values keep the translated output stable (no thousands separators),
 * so the number can be replaced with `{{count}}` afterwards.
 */
export function representativeFor(locale, category) {
  const rules = new Intl.PluralRules(locale)
  if (category === 'one' && rules.select(1) === 'one') return 1
  for (const value of REPRESENTATIVE_CANDIDATES) {
    if (rules.select(value) === category) return value
  }
  return null
}

export function pluralGroups(flat) {
  const groups = new Map()
  for (const key of Object.keys(flat)) {
    const match = key.match(/^(.*)_(one|other)$/)
    if (!match) continue
    const [, base, suffix] = match
    if (!groups.has(base)) groups.set(base, { base })
    groups.get(base)[suffix] = key
  }
  return groups
}

export function readEnvFile(filePath) {
  const out = {}
  let raw = ''
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch {
    return out
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
