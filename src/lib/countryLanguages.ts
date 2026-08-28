/**
 * Language options for supplier registration by business country.
 * English and French are always included; local languages vary by country.
 */

export const DEFAULT_LANGUAGES = ['English', 'French']

/** ISO country code → locally relevant languages (excluding English/French). */
export const COUNTRY_LOCAL_LANGUAGES: Record<string, string[]> = {
  GH: ['Akan', 'Twi', 'Ewe', 'Ga', 'Dagbani', 'Hausa'],
  NG: ['Yoruba', 'Hausa', 'Igbo', 'Pidgin English', 'Fulfulde'],
  ZA: ['Zulu', 'Xhosa', 'Afrikaans', 'Sotho', 'Tswana', 'Venda'],
  KE: ['Swahili', 'Kikuyu', 'Luo', 'Kalenjin', 'Kamba'],
  TZ: ['Swahili', 'Chaga', 'Sukuma', 'Haya'],
  UG: ['Swahili', 'Luganda', 'Runyankole', 'Acholi', 'Lusoga'],
  RW: ['Kinyarwanda', 'Swahili'],
  ET: ['Amharic', 'Oromo', 'Tigrinya', 'Somali'],
  EG: ['Arabic'],
  MA: ['Arabic', 'Berber (Tamazight)'],
  US: ['Spanish', 'Chinese (Mandarin)', 'Vietnamese', 'Tagalog'],
  GB: ['Welsh', 'Scottish Gaelic', 'Irish'],
  DE: ['German', 'Turkish', 'Polish'],
  FR: ['German', 'Arabic', 'Portuguese', 'Italian', 'Spanish'],
  NL: ['Dutch', 'Turkish', 'Arabic', 'Papiamento'],
  ES: ['Spanish', 'Catalan', 'Basque', 'Galician'],
  IT: ['Italian', 'German', 'Arabic', 'Romanian'],
  CA: ['Spanish', 'Chinese (Mandarin)', 'Punjabi', 'Tagalog', 'Arabic'],
  AU: ['Mandarin', 'Arabic', 'Vietnamese', 'Italian', 'Greek', 'Hindi'],
  OTHER: ['Spanish', 'Portuguese', 'Arabic', 'German', 'Swahili', 'Hausa', 'Yoruba'],
}

/** @param countryCode ISO 3166-1 alpha-2 */
export function getLanguagesForCountry(countryCode?: string): string[] {
  const code = String(countryCode || '')
    .trim()
    .toUpperCase()

  const local = code ? (COUNTRY_LOCAL_LANGUAGES[code] ?? COUNTRY_LOCAL_LANGUAGES.OTHER) : []

  return [...new Set([...DEFAULT_LANGUAGES, ...local])]
}

/** Keep only languages still valid for the selected country. */
export function filterLanguagesForCountry(selected: string[], countryCode?: string): string[] {
  const allowed = new Set(getLanguagesForCountry(countryCode))
  return (Array.isArray(selected) ? selected : []).filter((lang) => allowed.has(lang))
}
