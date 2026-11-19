import catalog from './languages.json'

export interface LanguageOption {
  /** BCP-47 code used by the app and the locale file name. */
  code: string
  /** Native language name shown in the picker. */
  label: string
  /** Decorative flag shown beside the native name. */
  flag: string
  /** Azure Translator target code. */
  azure: string
  /** Set when Azure has no distinct target for this variant. */
  derivedFrom?: string
  /** Optional post-processing applied to a derived variant. */
  postProcess?: string
}

/**
 * Every language option in the picker. The order matches the reference list:
 * variants are grouped, then the rest of the languages follow alphabetically.
 */
export const LANGUAGES = catalog as LanguageOption[]

export const SUPPORTED_LANGUAGE_CODES: string[] = LANGUAGES.map((language) => language.code)

const BY_CODE = new Map(LANGUAGES.map((language) => [language.code.toLowerCase(), language]))

function normalizeTag(input: string): string {
  return input.trim().replace(/_/g, '-').toLowerCase()
}

/**
 * Resolve any browser/BCP-47 tag to one of our options.
 *
 * Exact matches win, so `de-AT` is not collapsed into `de`. Region and script
 * variants that are not explicit options fall back to their base language
 * (`fr-CA` -> `fr`, `de-DE` -> `de`). A few legacy/alias tags are mapped
 * explicitly because their base is not one of our codes (`nb` -> `no`,
 * `iw` -> `he`, `zh-Hant` -> Traditional Chinese).
 */
export function resolveLanguage(input?: string | null): LanguageOption | undefined {
  if (!input) return undefined
  const tag = normalizeTag(input)
  if (!tag) return undefined

  const exact = BY_CODE.get(tag)
  if (exact) return exact

  // Script/alias handling must come before the generic base lookup.
  if (tag === 'es-419') return BY_CODE.get('es-mx')
  if (tag === 'zh-hant-hk') return BY_CODE.get('zh-hk')
  if (tag.startsWith('zh-hant')) return BY_CODE.get('zh-tw')
  if (tag === 'zh' || tag.startsWith('zh-hans')) return BY_CODE.get('zh-cn')
  if (tag === 'nb' || tag.startsWith('nb-') || tag === 'nn' || tag.startsWith('nn-')) {
    return BY_CODE.get('no')
  }
  if (tag === 'iw' || tag.startsWith('iw-')) return BY_CODE.get('he')
  if (tag === 'in' || tag.startsWith('in-')) return BY_CODE.get('id')
  if (tag === 'pt' || tag.startsWith('pt-')) return BY_CODE.get('pt-pt')

  return BY_CODE.get(tag.split('-')[0])
}

/** Normalize a detected browser language to a supported option code. */
export function canonicalizeDetectedLanguage(input: string): string {
  // Some detectors hand over an Accept-Language-like list rather than a single
  // tag. The first entry is the visitor's preferred language.
  const preferred = String(input).split(',')[0]?.split(';')[0]?.trim()
  return resolveLanguage(preferred)?.code ?? 'en'
}

/** True when the tag resolves to one of the 41 picker options. */
export function isSupportedLanguage(input: string): boolean {
  return Boolean(resolveLanguage(input))
}
