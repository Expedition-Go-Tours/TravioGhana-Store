#!/usr/bin/env node
/**
 * Generate and validate the app's locale bundles with Azure Translator.
 *
 * Usage:
 *   npm run translate:locales                # fill missing keys in every locale
 *   npm run translate:locales -- --force     # retranslate everything (costly)
 *   npm run translate:locales -- --locales=ja,de
 *   npm run translate:locales -- --validate-only
 *   npm run translate:locales -- --dry-run
 *
 * Azure credentials are read from the environment or `.env`:
 *   AZURE_TRANSLATOR_KEY
 *   AZURE_TRANSLATOR_REGION
 *   AZURE_TRANSLATOR_ENDPOINT  (optional)
 *
 * The script never prints the key. It protects placeholders and rich-text
 * tags, generates the plural categories required by each locale, and refuses
 * to write a locale if placeholder/tag validation fails.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  compareTranslation,
  extractTags,
  flatten,
  placeholdersMatch,
  pluralCategories,
  pluralGroups,
  protectText,
  readEnvFile,
  representativeFor,
  restoreText,
  setPath,
  sleep,
} from './lib.mjs'

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales')
const EN_PATH = path.join(LOCALES_DIR, 'en.json')
const LANGUAGES_PATH = path.join(ROOT, 'src', 'i18n', 'languages.json')
const OVERRIDES_DIR = path.join(ROOT, 'scripts', 'i18n', 'overrides')
const REPORT_DIR = path.join(ROOT, 'scripts', 'i18n', 'reports')
const CACHE_DIR = path.join(ROOT, 'scripts', 'i18n', '.cache')

const argv = process.argv.slice(2)
const flags = new Set(argv.filter((arg) => arg.startsWith('--')))
const force = flags.has('--force')
const dryRun = flags.has('--dry-run')
const validateOnly = flags.has('--validate-only')
const localeArg = argv.find((arg) => arg.startsWith('--locales='))
const selectedLocales = localeArg
  ? localeArg.slice('--locales='.length).split(',').map((code) => code.trim()).filter(Boolean)
  : null

const env = readEnvFile(path.join(ROOT, '.env'))
const PROVIDER = (process.env.TRANSLATE_PROVIDER || env.TRANSLATE_PROVIDER || 'azure').toLowerCase()
const AZURE_KEY = process.env.AZURE_TRANSLATOR_KEY || env.AZURE_TRANSLATOR_KEY
const AZURE_REGION = process.env.AZURE_TRANSLATOR_REGION || env.AZURE_TRANSLATOR_REGION
const AZURE_ENDPOINT = (
  process.env.AZURE_TRANSLATOR_ENDPOINT ||
  env.AZURE_TRANSLATOR_ENDPOINT ||
  'https://api.cognitive.microsofttranslator.com'
).replace(/\/+$/, '')

const MAX_CHARS = Number(process.env.AZURE_MAX_CHARS || 1_900_000)
const REQUEST_INTERVAL_MS = Number(process.env.AZURE_REQUEST_INTERVAL_MS || 2500)
const GOOGLE_SINGLE = process.env.GOOGLE_SINGLE === '1'
const BATCH_SIZE = 40
const BATCH_CHARS = 3_500

const SKIP_BRAND_PROTECTION = process.env.SKIP_BRAND_PROTECTION === '1'

const BRAND_TERMS = [
  'Travio Ghana Foundation',
  'Travio Ghana',
  'TravioGhana',
  'Expedition-Go Tours',
  'Expedition Go Tours',
  'Google Play',
  'App Store',
  'American Express',
  'Mastercard',
  'PayPal',
  'Google Pay',
  'Apple Pay',
  'Tripadvisor',
  'Instagram',
  'Facebook',
  'TikTok',
  'YouTube',
  'Ghana',
  'Accra',
  'Kumasi',
]

const PROTECTED_TERMS = SKIP_BRAND_PROTECTION ? [] : BRAND_TERMS

/** Strings that should stay as-is in every language. */
const SKIP_EXACT = new Set([
  ...BRAND_TERMS,
  'FAQ',
  'PDF',
  'GPS',
  'Wi-Fi',
  'USD',
  'GHS',
  'EUR',
  'GBP',
  'Instagram',
  'Facebook',
  'TikTok',
  'YouTube',
  'Tripadvisor',
  'Mastercard',
  'Visa',
  'American Express',
  'PayPal',
  'Google Pay',
  'Apple Pay',
])

const PLURAL_KEY_RE = /^(.*)_(one|other)$/
const PLURAL_CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])

let charactersSent = 0
let transientErrors = 0
let lastRequestAt = 0

/**
 * Azure's F0 tier is request-rate limited as well as character limited. Space
 * requests out even when a batch succeeds; otherwise a long run starts getting
 * 429001 responses around the middle of a locale.
 */
async function throttle() {
  const wait = REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt)
  if (wait > 0) await sleep(wait)
  lastRequestAt = Date.now()
}

function log(...args) {
  process.stdout.write(`${args.join(' ')}\n`)
}

function warn(...args) {
  process.stderr.write(`${args.join(' ')}\n`)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function targetPath(code) {
  return path.join(LOCALES_DIR, `${code}.json`)
}

function cachePath(code) {
  return path.join(CACHE_DIR, `${code}.json`)
}

function readExistingFlat(code) {
  // A failed validation leaves its work in the cache so a rerun does not pay
  // for the same translations again. Only a validated file reaches the repo.
  const file = fs.existsSync(targetPath(code)) ? targetPath(code) : cachePath(code)
  if (!fs.existsSync(file)) return {}
  try {
    return flatten(readJson(file))
  } catch (error) {
    warn(`[${code}] could not read existing locale: ${error.message}`)
    return {}
  }
}

function writeCache(code, flat) {
  writeJson(cachePath(code), buildOutputObject(flat))
}

function clearCache(code) {
  try {
    fs.rmSync(cachePath(code), { force: true })
  } catch {
    /* ignore */
  }
}

function loadOverrides(code) {
  const file = path.join(OVERRIDES_DIR, `${code}.json`)
  if (!fs.existsSync(file)) return {}
  try {
    return flatten(readJson(file))
  } catch (error) {
    warn(`[${code}] could not read overrides: ${error.message}`)
    return {}
  }
}

function shouldSkip(source) {
  const text = String(source).trim()
  if (!text) return true
  if (SKIP_EXACT.has(text)) return true
  if (/^https?:\/\//i.test(text)) return true
  const stripped = text
    .replace(/\{\{[\s\S]*?\}\}/g, '')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .trim()
  return !/[A-Za-z]/.test(stripped)
}

function countPlaceholderMatch(text) {
  return String(text).match(/\{\{\s*count[\s\S]*?\}\}/)
}

function postProcess(code, value) {
  let result = value
  if (code === 'de-CH') {
    // Swiss standard German uses ss instead of ß.
    result = result.replace(/ß/g, 'ss')
  }
  if (code === 'en-AU') {
    // A small, conservative Australian English pass. The source is US English.
    const replacements = [
      [/\btravelers\b/g, 'travellers'],
      [/\btraveler\b/g, 'traveller'],
      [/\btraveling\b/g, 'travelling'],
      [/\bcanceled\b/g, 'cancelled'],
      [/\bcanceling\b/g, 'cancelling'],
      [/\borganization\b/g, 'organisation'],
      [/\borganizations\b/g, 'organisations'],
      [/\borganize\b/g, 'organise'],
      [/\bpersonalized\b/g, 'personalised'],
      [/\bcustomize\b/g, 'customise'],
      [/\bfavorite\b/g, 'favourite'],
      [/\bfavorites\b/g, 'favourites'],
      [/\bcolor\b/g, 'colour'],
      [/\bcolors\b/g, 'colours'],
      [/\bcenter\b/g, 'centre'],
    ]
    for (const [pattern, replacement] of replacements) result = result.replace(pattern, replacement)
  }
  return result
}

function catalogueLabels(catalog) {
  return Object.fromEntries(catalog.map((entry) => [entry.code, entry.label]))
}

function buildOutputObject(flat) {
  const output = {}
  for (const key of Object.keys(flat).sort()) setPath(output, key, flat[key])
  return output
}

async function azureTranslate(texts, target) {
  if (!AZURE_KEY) throw new Error('AZURE_TRANSLATOR_KEY is not set')
  if (!AZURE_REGION) throw new Error('AZURE_TRANSLATOR_REGION is not set')

  const characters = texts.reduce((total, text) => total + text.length, 0)
  if (charactersSent + characters > MAX_CHARS) {
    throw new Error(
      `character budget exhausted (${charactersSent + characters} > ${MAX_CHARS}); rerun next month or raise AZURE_MAX_CHARS`,
    )
  }

  const url = `${AZURE_ENDPOINT}/translate?api-version=3.0&from=en&to=${encodeURIComponent(target)}`
  let lastError = ''

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await throttle()
    let response
    try {
      response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(20_000),
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_KEY,
          'Ocp-Apim-Subscription-Region': AZURE_REGION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(texts.map((text) => ({ Text: text }))),
      })
    } catch (error) {
      lastError = error.message
      await sleep(1000 * (attempt + 1))
      continue
    }

    if (response.ok) {
      charactersSent += characters
      const body = await response.json()
      if (!Array.isArray(body) || body.length !== texts.length) {
        throw new Error(`Azure returned ${Array.isArray(body) ? body.length : 'no'} results for ${texts.length} strings`)
      }
      return body.map((item, index) => {
        const value = item?.translations?.[0]?.text
        if (typeof value !== 'string') throw new Error(`Azure returned no translation for string ${index}`)
        return value
      })
    }

    const body = await response.text().catch(() => '')
    lastError = `HTTP ${response.status}: ${body.slice(0, 300)}`

    if (response.status === 429 || response.status >= 500) {
      const retryAfter = Number(response.headers.get('retry-after'))
      // Request-limit windows are longer than a normal transient error; give
      // them room to reset instead of burning all five attempts in 15 seconds.
      const wait =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(60_000, 5_000 * 2 ** attempt)
      warn(`Azure ${response.status}; retrying in ${Math.round(wait / 1000)}s`)
      await sleep(wait)
      continue
    }

    // 400/401/403 are not fixed by retrying the same batch.
    throw new Error(lastError)
  }

  throw new Error(lastError || 'Azure translation failed')
}

/**
 * Free fallback used only when the Azure F0 character budget is exhausted.
 * The production/default provider remains Azure; this endpoint is
 * unsupported and should be treated as a bootstrap/repair path.
 */
function googleTargetFor(entry) {
  if (entry.azure === 'sr-Cyrl') return 'sr'
  if (entry.azure === 'zh-Hans') return 'zh-CN'
  if (entry.azure === 'zh-Hant') return 'zh-TW'
  if (entry.azure === 'pt-pt') return 'pt-PT'
  if (entry.azure === 'nb') return 'no'
  return entry.azure
}

async function googleTranslateOnce(texts, target) {
  const separator = '<<<I18N_7F3A>>>'
  const joined = texts.join(`\n${separator}\n`)
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(joined)}`
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Google HTTP ${response.status}`)
  const body = await response.json()
  const output = Array.isArray(body?.[0])
    ? body[0].map((part) => part?.[0] ?? '').join('')
    : ''
  const parts = output.split(separator).map((part) => part.trim())
  if (parts.length !== texts.length) {
    throw new Error(`Google batch split ${parts.length} !== ${texts.length}`)
  }
  return parts
}

async function googleTranslateSingle(text, target) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`
  let lastError = ''
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
      if (!response.ok) throw new Error(`Google HTTP ${response.status}`)
      const body = await response.json()
      const output = Array.isArray(body?.[0])
        ? body[0].map((part) => part?.[0] ?? '').join('')
        : ''
      if (!output.trim()) throw new Error('Google returned an empty translation')
      await sleep(50)
      return output
    } catch (error) {
      lastError = error.message
      await sleep(Math.min(10_000, 500 * 2 ** attempt))
    }
  }
  throw new Error(lastError || 'Google translation failed')
}

async function googleTranslate(texts, target) {
  const characters = texts.reduce((total, text) => total + text.length, 0)

  // Some languages make the unofficial endpoint swallow the batch separator.
  // GOOGLE_SINGLE trades throughput for a reliable one-string-per-request path.
  if (GOOGLE_SINGLE || texts.length === 1) {
    const results = new Array(texts.length)
    let cursor = 0
    const workers = Array.from({ length: Math.min(8, texts.length) }, async () => {
      while (true) {
        const index = cursor
        cursor += 1
        if (index >= texts.length) return
        results[index] = await googleTranslateSingle(texts[index], target)
      }
    })
    await Promise.all(workers)
    charactersSent += characters
    return results
  }

  let lastError = ''
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await googleTranslateOnce(texts, target)
      charactersSent += characters
      await sleep(400)
      return result
    } catch (error) {
      lastError = error.message
      await sleep(Math.min(10_000, 1000 * 2 ** attempt))
    }
  }
  throw new Error(lastError || 'Google translation failed')
}

async function translateBatch(texts, entry) {
  if (PROVIDER === 'google' || PROVIDER === 'google-unofficial') {
    return googleTranslate(texts, googleTargetFor(entry))
  }
  return azureTranslate(texts, entry.azure)
}

async function translateTextsSafely(texts, entry) {
  try {
    return await translateBatch(texts, entry)
  } catch (error) {
    if (texts.length === 1) {
      transientErrors += 1
      throw error
    }
    const midpoint = Math.ceil(texts.length / 2)
    const left = await translateTextsSafely(texts.slice(0, midpoint), entry)
    const right = await translateTextsSafely(texts.slice(midpoint), entry)
    return [...left, ...right]
  }
}

function batches(items) {
  const result = []
  let current = []
  let currentChars = 0
  for (const item of items) {
    const chars = item.sourceForApi.length
    if (current.length >= BATCH_SIZE || (current.length > 0 && currentChars + chars > BATCH_CHARS)) {
      result.push(current)
      current = []
      currentChars = 0
    }
    current.push(item)
    currentChars += chars
  }
  if (current.length) result.push(current)
  return result
}

function makeJob({ outputKey, sourceOriginal, sourceForApi, countPlaceholder = null }) {
  const { text, tokens } = protectText(sourceForApi, PROTECTED_TERMS)
  return {
    outputKey,
    sourceOriginal,
    sourceRaw: sourceForApi,
    sourceForApi: text,
    tokens,
    countPlaceholder,
  }
}

function jobFromSource(outputKey, sourceOriginal, locale) {
  const countMatch = countPlaceholderMatch(sourceOriginal)
  if (!countMatch) {
    return makeJob({ outputKey, sourceOriginal, sourceForApi: sourceOriginal })
  }

  const category = outputKey.slice(outputKey.lastIndexOf('_') + 1)

  // Non-plural strings that happen to contain {{count}} ("Only {{count}}
  // spot(s) left...") do not need a visible number. Protecting the placeholder
  // avoids providers corrupting the two count markers.
  if (!PLURAL_CATEGORIES.has(category)) {
    return makeJob({ outputKey, sourceOriginal, sourceForApi: sourceOriginal })
  }

  // The singular form is safest as a standalone noun phrase with the count
  // placeholder protected. Providers sometimes drop the noun when a visible
  // "1" is placed inside an opaque marker (notably Hebrew).
  if (category === 'one') {
    return makeJob({ outputKey, sourceOriginal, sourceForApi: sourceOriginal })
  }

  // For every other category, keep a visible representative number so the
  // provider inflects the noun correctly.
  const representative =
    pluralCategories(locale).includes(category)
      ? representativeFor(locale, category)
      : null
  // Some categories (notably French/Italian/Spanish "many") only apply to
  // counts around one million. Use a small ordinary-plural count instead; the
  // result is the form used for normal plural quantities, which is what the UI
  // will show for every realistic count.
  const countNumber = representative ?? 2

  // Keep the number visible (so the provider inflects the noun correctly) but
  // wrap it in opaque markers. Some languages spell numbers out or move them
  // across the sentence; the markers let us restore `{{count}}` reliably.
  const withNumber = sourceOriginal.replace(
    countMatch[0],
    `⟦I18NCOUNT0⟧${countNumber}⟦I18NCOUNT1⟧`,
  )
  return makeJob({
    outputKey,
    sourceOriginal,
    sourceForApi: withNumber,
    countPlaceholder: countMatch[0],
  })
}

async function translateTagFallback(entry, job) {
  const parts = job.sourceRaw.split(/(<[^>]+>)/g).filter((part) => part !== '')
  const textParts = parts
    .map((part, index) => ({ part, index }))
    .filter(({ part }) => !/^<[^>]+>$/.test(part) && part.trim())
  if (!textParts.length) throw new Error('no text segments to translate')

  const segments = textParts.map(({ part }) => {
    const leading = part.match(/^\s*/)?.[0] ?? ''
    const trailing = part.match(/\s*$/)?.[0] ?? ''
    const core = part.slice(leading.length, part.length - trailing.length)
    return { ...protectText(core, PROTECTED_TERMS), leading, trailing }
  })

  const translations = await translateTextsSafely(segments.map((segment) => segment.text), entry)
  const translatedByIndex = new Map()
  textParts.forEach(({ index }, i) => {
    translatedByIndex.set(
      index,
      segments[i].leading + restoreText(translations[i], segments[i].tokens) + segments[i].trailing,
    )
  })

  const reassembled = parts
    .map((part, index) => (translatedByIndex.has(index) ? translatedByIndex.get(index) : part))
    .join('')
  return finalizeJob(entry, { ...job, tokens: [] }, reassembled)
}

function finalizeJob(entry, job, translated) {
  let value = restoreText(translated, job.tokens)
  if (job.countPlaceholder) {
    // Tolerate stray characters a provider inserts between the count markers
    // (e.g. a superscript counter), as long as both markers survive.
    const countPattern = /⟦I18NCOUNT0⟧[\s\S]*?⟦I18NCOUNT1⟧/
    if (!countPattern.test(value)) {
      throw new Error(`lost count marker (translated: ${JSON.stringify(value)})`)
    }
    value = value.replace(countPattern, job.countPlaceholder)
  }
  if (/[⟦⟧]/.test(value)) {
    throw new Error(`leftover sentinel (translated: ${JSON.stringify(value)})`)
  }

  // Star-rating labels are sometimes reduced to just the number. A star glyph
  // is language-neutral and reads correctly in every locale's rating filter.
  if (job.outputKey === 'reviews.starsCount' && !/\p{L}/u.test(value.replace(/\{\{[\s\S]*?\}\}/g, ''))) {
    value = `${job.countPlaceholder ?? '{{count}}'} ★`
  }

  // Catch a provider that keeps both tags but reverses them. That is
  // structurally invalid and should trigger the per-tag fallback rather than
  // being discovered only at final validation.
  const sourceTags = extractTags(job.sourceOriginal)
  const targetTags = extractTags(value)
  if (JSON.stringify(sourceTags) !== JSON.stringify(targetTags)) {
    throw new Error(
      `tag order/content mismatch (expected ${sourceTags.join(' ')} got ${targetTags.join(' ')})`,
    )
  }
  if (!placeholdersMatch(job.sourceOriginal, value)) {
    throw new Error('placeholder mismatch after restore')
  }

  return postProcess(entry.code, value)
}

async function translateJobs(entry, jobs) {
  const results = new Map()
  const work = jobs.filter((job) => !job.directValue)
  for (const job of jobs) {
    if (job.directValue !== undefined) results.set(job.outputKey, job.directValue)
  }

  const failures = []
  if (!work.length) return { results, failures }

  const retries = []
  const queue = batches(work)
  let processed = 0
  for (const batch of queue) {
    const translated = await translateTextsSafely(batch.map((job) => job.sourceForApi), entry)
    for (let i = 0; i < batch.length; i += 1) {
      const job = batch[i]
      try {
        results.set(job.outputKey, finalizeJob(entry, job, translated[i]))
      } catch (error) {
        retries.push({ job, error })
      }
    }
    processed += batch.length
    log(`[${entry.code}] translated ${processed}/${work.length} strings (${charactersSent} chars total)`)
  }

  // A provider occasionally drops a sentinel or moves a marked number. Retry
  // those strings individually with a few different token shapes before
  // giving up; batch corruption is uncommon, but individual retries fix it.
  for (const { job, error } of retries) {
    let lastError = error
    let recovered = false

    // Count-first strings are usually the ones a provider reduces to the bare
    // number. Translate the noun alone first; it avoids three token-shape
    // retries for every count/plural key.
    if (/^\s*\{\{\s*count[\s\S]*?\}\}/.test(job.sourceOriginal)) {
      const countMatch = countPlaceholderMatch(job.sourceOriginal)
      const nounSource = countMatch ? job.sourceOriginal.replace(countMatch[0], '').trim() : ''
      if (countMatch && nounSource) {
        try {
          const protectedNoun = protectText(nounSource, PROTECTED_TERMS)
          const [translated] = await translateTextsSafely([protectedNoun.text], entry)
          const noun = restoreText(translated, protectedNoun.tokens)
          const value = `${countMatch[0]} ${noun}`.trim()
          results.set(
            job.outputKey,
            finalizeJob(entry, { ...job, tokens: [], countPlaceholder: null }, value),
          )
          warn(`[${entry.code}] ${job.outputKey}: translated the noun alone after a wordless result`)
          recovered = true
        } catch (fallbackError) {
          lastError = fallbackError
        }
      }
    }

    for (const prefix of ['I18NTOKEN', 'T', 'I18NTAG']) {
      if (recovered) break
      const retryProtected = protectText(job.sourceRaw, PROTECTED_TERMS, prefix)
      try {
        const [translated] = await translateTextsSafely([retryProtected.text], entry)
        const value = finalizeJob(entry, { ...job, tokens: retryProtected.tokens }, translated)
        results.set(job.outputKey, value)
        warn(`[${entry.code}] ${job.outputKey}: retried individually (${error.message})`)
        recovered = true
        break
      } catch (retryError) {
        lastError = retryError
      }
    }

    // Last resort for strings with rich-text tags: translate the text around
    // the tags separately and put the original tags back. This avoids a
    // provider silently dropping a closing-tag sentinel in a long string.
    if (!recovered && /<[^>]+>/.test(job.sourceRaw)) {
      try {
        const value = await translateTagFallback(entry, job)
        results.set(job.outputKey, value)
        warn(`[${entry.code}] ${job.outputKey}: translated around tags after sentinel loss`)
        recovered = true
      } catch (fallbackError) {
        lastError = fallbackError
      }
    }

    // Brand-name tokens are the only protected items in plain sentences. If a
    // provider keeps dropping one, retry with the brand names left as ordinary
    // text; proper nouns usually survive translation unchanged.
    if (!recovered) {
      try {
        const plain = protectText(job.sourceRaw, [], 'I18NPLAIN')
        const [translated] = await translateTextsSafely([plain.text], entry)
        const value = finalizeJob(entry, { ...job, tokens: plain.tokens }, translated)
        results.set(job.outputKey, value)
        warn(`[${entry.code}] ${job.outputKey}: retried without brand-name protection`)
        recovered = true
      } catch (fallbackError) {
        lastError = fallbackError
      }
    }

    if (!recovered) {
      failures.push({
        outputKey: job.outputKey,
        error: new Error(
          `[${entry.code}] ${job.outputKey}: ${lastError.message}\n  source: ${JSON.stringify(job.sourceOriginal)}`,
        ),
      })
      warn(`[${entry.code}] ${job.outputKey}: could not translate after fallbacks`)
      continue
    }
    await sleep(120)
  }

  return { results, failures }
}

function validateLocale(entry, targetFlat, sourceFlat, groups) {
  const errors = []
  const warnings = []

  const requiredKeys = Object.keys(sourceFlat).filter((key) => {
    if (!PLURAL_KEY_RE.test(key)) return true
    return false
  })

  for (const key of requiredKeys) {
    if (!(key in targetFlat)) {
      errors.push(`${key}: missing`)
      continue
    }
    const source = sourceFlat[key]
    const target = targetFlat[key]
    for (const message of compareTranslation(source, target)) errors.push(`${key}: ${message}`)
    if (target === source && !shouldSkip(source) && String(source).split(/\s+/).length > 1) {
      warnings.push(`${key}: target equals source`)
    }
  }

  for (const group of groups.values()) {
    for (const category of pluralCategories(entry.code)) {
      const key = `${group.base}_${category}`
      if (!(key in targetFlat)) {
        errors.push(`${key}: missing plural category`)
        continue
      }
      const sourceKey = category === 'one' && group.one ? group.one : group.other
      const source = sourceFlat[sourceKey]
      if (source !== undefined) {
        for (const message of compareTranslation(source, targetFlat[key])) {
          errors.push(`${key}: ${message}`)
        }
      }
    }
  }

  return { errors, warnings }
}

async function translateLocale(entry, sourceFlat, groups, catalogByCode) {
  const existing = readExistingFlat(entry.code)
  const overrides = loadOverrides(entry.code)
  const jobs = []
  const direct = {}

  for (const [key, source] of Object.entries(sourceFlat)) {
    if (PLURAL_KEY_RE.test(key)) continue
    if (overrides[key] !== undefined) {
      direct[key] = String(overrides[key])
      continue
    }
    if (key.startsWith('languages.')) {
      const code = key.slice('languages.'.length)
      const label = catalogByCode[code]
      if (label) {
        direct[key] = label
        continue
      }
    }
    if (existing[key] !== undefined && !force && compareTranslation(source, existing[key]).length === 0) {
      direct[key] = existing[key]
      continue
    }
    if (shouldSkip(source)) {
      direct[key] = source
      continue
    }
    jobs.push(jobFromSource(key, source, entry.code))
  }

  for (const group of groups.values()) {
    for (const category of pluralCategories(entry.code)) {
      const outputKey = `${group.base}_${category}`
      const sourceKey = category === 'one' && group.one ? group.one : group.other
      const source = sourceFlat[sourceKey]
      if (source === undefined) continue
      if (overrides[outputKey] !== undefined) {
        direct[outputKey] = String(overrides[outputKey])
        continue
      }
      if (existing[outputKey] !== undefined && !force && compareTranslation(source, existing[outputKey]).length === 0) {
        direct[outputKey] = existing[outputKey]
        continue
      }
      if (shouldSkip(source)) {
        direct[outputKey] = source
        continue
      }
      jobs.push(jobFromSource(outputKey, source, entry.code))
    }
  }

  for (const [key, value] of Object.entries(direct)) {
    jobs.push({ outputKey: key, directValue: value })
  }

  if (dryRun) {
    const pending = jobs.filter((job) => job.directValue === undefined).length
    log(`[${entry.code}] dry run: ${pending} strings would be translated, ${Object.keys(direct).length} kept`)
    return { code: entry.code, ok: true, errors: [], warnings: [], dryRun: true }
  }

  const { results: translated, failures } = await translateJobs(entry, jobs)
  const targetFlat = {}
  for (const [key, value] of translated) targetFlat[key] = value

  // Human corrections always win.
  for (const [key, value] of Object.entries(overrides)) {
    targetFlat[key] = postProcess(entry.code, String(value))
  }

  const validation = validateLocale(entry, targetFlat, sourceFlat, groups)
  for (const failure of failures) validation.errors.push(failure.error.message)
  if (validation.errors.length) {
    warn(`[${entry.code}] ${validation.errors.length} validation error(s)`)
    for (const error of validation.errors.slice(0, 30)) warn(`  ${error}`)
    if (validation.errors.length > 30) warn(`  ... and ${validation.errors.length - 30} more`)
    if (!dryRun) {
      writeCache(entry.code, targetFlat)
      warn(`[${entry.code}] work saved to the translation cache; fix and rerun without paying again`)
    }
    return { code: entry.code, ok: false, errors: validation.errors, warnings: validation.warnings }
  }

  if (dryRun) {
    log(`[${entry.code}] dry run: ${validation.errors.length} errors, ${validation.warnings.length} warnings`)
    return { code: entry.code, ok: true, errors: [], warnings: validation.warnings, dryRun: true }
  }

  writeJson(targetPath(entry.code), buildOutputObject(targetFlat))
  clearCache(entry.code)
  log(`[${entry.code}] wrote ${Object.keys(targetFlat).length} strings (${validation.warnings.length} warnings)`)
  return { code: entry.code, ok: true, errors: [], warnings: validation.warnings }
}

function deriveLocale(entry, overrides, sourceFlat, groups) {
  const baseCode = entry.derivedFrom
  const baseFile = targetPath(baseCode)
  if (!fs.existsSync(baseFile)) {
    throw new Error(`[${entry.code}] base locale ${baseCode} is missing`)
  }
  const baseFlat = flatten(readJson(baseFile))
  const targetFlat = {}
  for (const [key, value] of Object.entries(baseFlat)) {
    targetFlat[key] = postProcess(entry.code, String(value))
  }
  for (const [key, value] of Object.entries(overrides)) {
    targetFlat[key] = postProcess(entry.code, String(value))
  }

  const validation = validateLocale(entry, targetFlat, sourceFlat, groups)
  if (validation.errors.length) {
    warn(`[${entry.code}] ${validation.errors.length} validation error(s)`)
    for (const error of validation.errors.slice(0, 15)) warn(`  ${error}`)
    return { code: entry.code, ok: false, errors: validation.errors, warnings: validation.warnings }
  }

  if (dryRun) {
    log(`[${entry.code}] dry run: derived from ${baseCode}`)
    return { code: entry.code, ok: true, errors: [], warnings: [], dryRun: true }
  }
  writeJson(targetPath(entry.code), buildOutputObject(targetFlat))
  clearCache(entry.code)
  log(`[${entry.code}] wrote ${Object.keys(targetFlat).length} strings (derived from ${baseCode})`)
  return { code: entry.code, ok: true, errors: [], warnings: [] }
}

function validateExisting(entry, sourceFlat, groups) {
  const targetFlat = readExistingFlat(entry.code)
  return validateLocale(entry, targetFlat, sourceFlat, groups)
}

function writeReports(reports, sourceFlat, catalog) {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const priorityPrefixes = [
    'terms.',
    'privacy.',
    'refund.',
    'cookies.',
    'supplierTerms.',
    'booking.',
    'payment.',
    'auth.',
    'footer.',
  ]
  for (const report of reports) {
    if (!report.targetFlat) continue
    const rows = ['key,priority,source,target,flags']
    for (const key of Object.keys(report.targetFlat).sort()) {
      const pluralMatch = key.match(/^(.*)_(zero|one|two|few|many|other)$/)
      const source =
        sourceFlat[key] ??
        (pluralMatch
          ? sourceFlat[`${pluralMatch[1]}_one`] ?? sourceFlat[`${pluralMatch[1]}_other`] ?? ''
          : '')
      const target = report.targetFlat[key] ?? ''
      const priority = priorityPrefixes.some((prefix) => key.startsWith(prefix)) ? 'high' : 'normal'
      const flags = []
      if (target === source) flags.push('untranslated')
      if (String(target).length > String(source).length * 2.2) flags.push('length')
      if (!target) flags.push('empty')
      const csv = [key, priority, source, target, flags.join('|')]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
      rows.push(csv)
    }
    writeFileSafe(path.join(REPORT_DIR, `${report.code}.csv`), `${rows.join('\n')}\n`)
  }
}

function writeFileSafe(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
}

async function main() {
  const en = readJson(EN_PATH)
  const sourceFlat = flatten(en)
  const groups = pluralGroups(sourceFlat)
  const catalog = readJson(LANGUAGES_PATH)
  const catalogByCode = Object.fromEntries(catalog.map((entry) => [entry.code, entry.label]))

  const requested = new Set(selectedLocales || catalog.map((entry) => entry.code))
  const distinct = catalog.filter(
    (entry) => entry.code !== 'en' && !entry.derivedFrom && requested.has(entry.code),
  )
  const derived = catalog.filter((entry) => entry.derivedFrom && requested.has(entry.code))

  log(`provider: ${PROVIDER}`)
  log(`source: ${Object.keys(sourceFlat).length} strings, ${groups.size} plural groups`)
  log(`locales: ${distinct.length} translated + ${derived.length} derived`)

  if (validateOnly) {
    const reports = []
    for (const entry of [...distinct, ...derived]) {
      const result = validateExisting(entry, sourceFlat, groups)
      reports.push({ code: entry.code, ...result, targetFlat: readExistingFlat(entry.code) })
      if (result.errors.length) {
        warn(`[${entry.code}] ${result.errors.length} validation error(s)`)
        for (const error of result.errors.slice(0, 15)) warn(`  ${error}`)
      } else {
        log(`[${entry.code}] OK (${result.warnings.length} warnings)`)
      }
    }
    writeReports(reports, sourceFlat, catalog)
    const failures = reports.filter((report) => report.errors.length)
    if (failures.length) process.exitCode = 1
    return
  }

  const results = []
  for (const entry of distinct) {
    log(`\n[${entry.code}] translating to Azure target ${entry.azure}`)
    try {
      results.push(await translateLocale(entry, sourceFlat, groups, catalogByCode))
    } catch (error) {
      warn(`[${entry.code}] FAILED: ${error.message}`)
      results.push({ code: entry.code, ok: false, errors: [error.message], warnings: [] })
    }
  }

  for (const entry of derived) {
    log(`\n[${entry.code}] deriving from ${entry.derivedFrom}`)
    try {
      results.push(deriveLocale(entry, loadOverrides(entry.code), sourceFlat, groups))
    } catch (error) {
      warn(`[${entry.code}] FAILED: ${error.message}`)
      results.push({ code: entry.code, ok: false, errors: [error.message], warnings: [] })
    }
  }

  if (!dryRun) {
    const reportLocales = catalog
      .filter((entry) => entry.code !== 'en' && requested.has(entry.code))
      .map((entry) => ({ code: entry.code, targetFlat: readExistingFlat(entry.code) }))
    writeReports(reportLocales, sourceFlat, catalog)
    log(`wrote review reports to ${path.relative(ROOT, REPORT_DIR)}`)
  }

  const failures = results.filter((result) => !result.ok)
  log(`\ncharacters sent: ${charactersSent}`)
  if (transientErrors) log(`transient errors retried: ${transientErrors}`)
  if (failures.length) {
    warn(`\n${failures.length} locale(s) failed`)
    process.exitCode = 1
  } else {
    log('\nall requested locales written successfully')
  }
}

main().catch((error) => {
  warn(error.stack || error.message)
  process.exitCode = 1
})
