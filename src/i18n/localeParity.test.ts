import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { LANGUAGES } from './languages'

type Dict = Record<string, string>

function flatten(obj: Record<string, unknown>, prefix = '', out: Dict = {}): Dict {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value as Record<string, unknown>, path, out)
    } else {
      out[path] = String(value)
    }
  }
  return out
}

function readLocale(code: string): Dict {
  const file = resolve(__dirname, 'locales', `${code}.json`)
  return flatten(JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>)
}

function placeholders(value: string): string[] {
  // Placeholders are named, so a translation may legitimately move them
  // around a sentence. Compare them as a multiset; tag order stays exact.
  return [...value.matchAll(/\{\{[\s\S]*?\}\}/g)].map((match) => match[0]).sort()
}

function tags(value: string): string[] {
  return [...value.matchAll(/<\/?[a-zA-Z][^>]*>/g)].map((match) => match[0])
}

function pluralCategories(locale: string): string[] {
  const order: Intl.LDMLPluralRule[] = ['zero', 'one', 'two', 'few', 'many', 'other']
  const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories
  return order.filter((category) => categories.includes(category))
}

const en = readLocale('en')
const pluralGroups = new Map<string, { one?: string; other?: string }>()
for (const key of Object.keys(en)) {
  const match = key.match(/^(.*)_(one|other)$/)
  if (!match) continue
  const [, base, suffix] = match
  const group = pluralGroups.get(base) ?? {}
  group[suffix as 'one' | 'other'] = key
  pluralGroups.set(base, group)
}

describe('locale bundle parity', () => {
  for (const language of LANGUAGES) {
    it(`${language.code} has every source key with intact placeholders and tags`, () => {
      const target = readLocale(language.code)
      const nonPluralKeys = Object.keys(en).filter((key) => !/_(one|other)$/.test(key))

      for (const key of nonPluralKeys) {
        expect(target[key], `${language.code} is missing ${key}`).toBeTypeOf('string')
        expect(target[key].trim(), `${language.code} has an empty ${key}`).not.toBe('')
        expect(placeholders(target[key]), `${language.code} placeholder mismatch in ${key}`).toEqual(
          placeholders(en[key]),
        )
        expect(tags(target[key]), `${language.code} tag mismatch in ${key}`).toEqual(tags(en[key]))
        expect(target[key]).not.toMatch(/[⟦⟧]/)
      }

      for (const [base, group] of pluralGroups) {
        for (const category of pluralCategories(language.code)) {
          const key = `${base}_${category}`
          const sourceKey = category === 'one' && group.one ? group.one : group.other
          if (!sourceKey) continue
          const value = target[key]
          expect(value, `${language.code} is missing plural ${key}`).toBeTypeOf('string')
          expect(value.trim(), `${language.code} has an empty ${key}`).not.toBe('')
          expect(placeholders(value), `${language.code} placeholder mismatch in ${key}`).toEqual(
            placeholders(en[sourceKey]),
          )
          expect(tags(value), `${language.code} tag mismatch in ${key}`).toEqual(tags(en[sourceKey]))
          expect(value).not.toMatch(/[⟦⟧]/)
        }
      }
    })
  }
})
