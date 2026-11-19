import { describe, expect, it } from 'vitest'
import {
  LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  canonicalizeDetectedLanguage,
  resolveLanguage,
} from './languages'

const REFERENCE_LABELS = [
  'Català',
  'Čeština',
  'Dansk',
  'Deutsch (Österreich)',
  'Deutsch (Schweiz)',
  'Deutsch (Deutschland)',
  'Ελληνικά',
  'English (Australia)',
  'English (United States)',
  'Español (España)',
  'Español (México)',
  'Eesti',
  'Suomi',
  'Français',
  'עברית',
  'Hrvatski',
  'Magyar',
  'Bahasa Indonesia',
  'Italiano',
  '日本語',
  '한국어',
  'Lietuvių',
  'Latviešu',
  'Bahasa Melayu',
  'Nederlands',
  'Norsk',
  'Polski',
  'Português (Brasil)',
  'Português (Portugal)',
  'Română',
  'Русский',
  'Slovenčina',
  'Slovenščina',
  'Српски',
  'Svenska',
  'ไทย',
  'Türkçe',
  'Українська',
  '简体中文',
  '繁體中文（香港）',
  '繁體中文（台灣）',
]

describe('language catalogue', () => {
  it('contains every language from the reference list, in order', () => {
    expect(LANGUAGES.map((language) => language.label)).toEqual(REFERENCE_LABELS)
  })

  it('has unique codes and exposes them to i18next', () => {
    const codes = LANGUAGES.map((language) => language.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(SUPPORTED_LANGUAGE_CODES).toEqual(codes)
  })

  it('resolves exact regional variants before falling back to a base language', () => {
    expect(resolveLanguage('de-AT')?.code).toBe('de-AT')
    expect(resolveLanguage('de-CH')?.code).toBe('de-CH')
    expect(resolveLanguage('de-DE')?.code).toBe('de')
    expect(resolveLanguage('en-AU')?.code).toBe('en-AU')
    expect(resolveLanguage('es-MX')?.code).toBe('es-MX')
    expect(resolveLanguage('pt-BR')?.code).toBe('pt-BR')
    expect(resolveLanguage('pt-PT')?.code).toBe('pt-PT')
    expect(resolveLanguage('zh-HK')?.code).toBe('zh-HK')
    expect(resolveLanguage('zh-TW')?.code).toBe('zh-TW')
    expect(resolveLanguage('zh-CN')?.code).toBe('zh-CN')
  })

  it('normalizes legacy and script tags used by browsers', () => {
    expect(resolveLanguage('nb-NO')?.code).toBe('no')
    expect(resolveLanguage('nn')?.code).toBe('no')
    expect(resolveLanguage('iw')?.code).toBe('he')
    expect(resolveLanguage('in')?.code).toBe('id')
    expect(resolveLanguage('zh-Hant')?.code).toBe('zh-TW')
    expect(resolveLanguage('zh-Hant-HK')?.code).toBe('zh-HK')
    expect(resolveLanguage('zh-Hans-CN')?.code).toBe('zh-CN')
    expect(resolveLanguage('es-419')?.code).toBe('es-MX')
    expect(resolveLanguage('fr-CA')?.code).toBe('fr')
  })

  it('maps Azure targets and derived variants explicitly', () => {
    const byCode = new Map(LANGUAGES.map((language) => [language.code, language]))
    expect(byCode.get('pt-BR')?.azure).toBe('pt')
    expect(byCode.get('pt-PT')?.azure).toBe('pt-pt')
    expect(byCode.get('no')?.azure).toBe('nb')
    expect(byCode.get('sr')?.azure).toBe('sr-Cyrl')
    expect(byCode.get('zh-CN')?.azure).toBe('zh-Hans')
    expect(byCode.get('zh-TW')?.azure).toBe('zh-Hant')
    expect(byCode.get('de-AT')?.derivedFrom).toBe('de')
    expect(byCode.get('de-CH')?.derivedFrom).toBe('de')
    expect(byCode.get('en-AU')?.derivedFrom).toBe('en')
    expect(byCode.get('es-MX')?.derivedFrom).toBe('es')
    expect(byCode.get('zh-HK')?.derivedFrom).toBe('zh-TW')
  })

  it('reads the first entry from an Accept-Language-style value', () => {
    expect(canonicalizeDetectedLanguage('de-DE,de;q=0.9,en;q=0.8')).toBe('de')
    expect(canonicalizeDetectedLanguage('pt-BR,pt;q=0.9')).toBe('pt-BR')
  })

  it('falls back to English for unknown browser languages', () => {
    expect(canonicalizeDetectedLanguage('sw')).toBe('en')
    expect(canonicalizeDetectedLanguage('tlh')).toBe('en')
    expect(canonicalizeDetectedLanguage('')).toBe('en')
  })
})
