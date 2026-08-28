import { getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js'

const stripNonDigits = (value: string): string => value.replace(/\D/g, '')

/**
 * Build a canonical E.164 phone number from a country calling code
 * (e.g. "+233") and a national number (e.g. "024 123 4567").
 *
 * Tolerates input that already contains a full international number
 * (legacy localStorage drafts) and common formatting such as spaces,
 * hyphens, parentheses and a leading "0" national prefix.
 *
 * Returns the canonical E.164 string (e.g. "+233241234567"), or null
 * when the combined value is not a valid phone number. Uses the same
 * `libphonenumber-js` validation as the backend so both sides agree.
 */
export function buildE164Phone(countryCode: string, nationalNumber: string): string | null {
  const cc = (countryCode ?? '').trim()
  const raw = (nationalNumber ?? '').trim()
  if (!raw) return null

  const alreadyInternational = raw.startsWith('+')
  const candidate = alreadyInternational
    ? raw
    : `${cc.startsWith('+') ? '' : '+'}${cc}${stripNonDigits(raw)}`

  if (!candidate || candidate === '+') return null

  try {
    if (isValidPhoneNumber(candidate)) {
      const parsed = parsePhoneNumber(candidate)
      if (parsed?.number) return parsed.number
    }
  } catch {
    return null
  }
  return null
}

export function isValidPhoneInput(countryCode: string, nationalNumber: string): boolean {
  return buildE164Phone(countryCode, nationalNumber) !== null
}

/* ─── Country calling-code options (from libphonenumber-js metadata) ─── */

export const DEFAULT_COUNTRY_CODE = '+233'

/** ISO 3166-1 alpha-2 → English country name (covers every code libphonenumber-js exposes). */
const COUNTRY_NAMES: Record<string, string> = {
  AC: 'Ascension Island', AD: 'Andorra', AE: 'United Arab Emirates', AF: 'Afghanistan',
  AG: 'Antigua & Barbuda', AI: 'Anguilla', AL: 'Albania', AM: 'Armenia', AO: 'Angola',
  AR: 'Argentina', AS: 'American Samoa', AT: 'Austria', AU: 'Australia', AW: 'Aruba',
  AX: 'Åland Islands', AZ: 'Azerbaijan', BA: 'Bosnia & Herzegovina', BB: 'Barbados',
  BD: 'Bangladesh', BE: 'Belgium', BF: 'Burkina Faso', BG: 'Bulgaria', BH: 'Bahrain',
  BI: 'Burundi', BJ: 'Benin', BL: 'St. Barthélemy', BM: 'Bermuda', BN: 'Brunei',
  BO: 'Bolivia', BQ: 'Caribbean Netherlands', BR: 'Brazil', BS: 'Bahamas', BT: 'Bhutan',
  BW: 'Botswana', BY: 'Belarus', BZ: 'Belize', CA: 'Canada', CC: 'Cocos (Keeling) Islands',
  CD: 'DR Congo', CF: 'Central African Republic', CG: 'Congo', CH: 'Switzerland',
  CI: 'Côte d’Ivoire', CK: 'Cook Islands', CL: 'Chile', CM: 'Cameroon', CN: 'China',
  CO: 'Colombia', CR: 'Costa Rica', CU: 'Cuba', CV: 'Cape Verde', CW: 'Curaçao',
  CX: 'Christmas Island', CY: 'Cyprus', CZ: 'Czechia', DE: 'Germany', DJ: 'Djibouti',
  DK: 'Denmark', DM: 'Dominica', DO: 'Dominican Republic', DZ: 'Algeria', EC: 'Ecuador',
  EE: 'Estonia', EG: 'Egypt', EH: 'Western Sahara', ER: 'Eritrea', ES: 'Spain',
  ET: 'Ethiopia', FI: 'Finland', FJ: 'Fiji', FK: 'Falkland Islands', FM: 'Micronesia',
  FO: 'Faroe Islands', FR: 'France', GA: 'Gabon', GB: 'United Kingdom', GD: 'Grenada',
  GE: 'Georgia', GF: 'French Guiana', GG: 'Guernsey', GH: 'Ghana', GI: 'Gibraltar',
  GL: 'Greenland', GM: 'Gambia', GN: 'Guinea', GP: 'Guadeloupe', GQ: 'Equatorial Guinea',
  GR: 'Greece', GT: 'Guatemala', GU: 'Guam', GW: 'Guinea-Bissau', GY: 'Guyana',
  HK: 'Hong Kong', HN: 'Honduras', HR: 'Croatia', HT: 'Haiti', HU: 'Hungary',
  ID: 'Indonesia', IE: 'Ireland', IL: 'Israel', IM: 'Isle of Man', IN: 'India',
  IO: 'British Indian Ocean Territory', IQ: 'Iraq', IR: 'Iran', IS: 'Iceland',
  IT: 'Italy', JE: 'Jersey', JM: 'Jamaica', JO: 'Jordan', JP: 'Japan', KE: 'Kenya',
  KG: 'Kyrgyzstan', KH: 'Cambodia', KI: 'Kiribati', KM: 'Comoros', KN: 'St. Kitts & Nevis',
  KP: 'North Korea', KR: 'South Korea', KW: 'Kuwait', KY: 'Cayman Islands',
  KZ: 'Kazakhstan', LA: 'Laos', LB: 'Lebanon', LC: 'St. Lucia', LI: 'Liechtenstein',
  LK: 'Sri Lanka', LR: 'Liberia', LS: 'Lesotho', LT: 'Lithuania', LU: 'Luxembourg',
  LV: 'Latvia', LY: 'Libya', MA: 'Morocco', MC: 'Monaco', MD: 'Moldova', ME: 'Montenegro',
  MF: 'St. Martin', MG: 'Madagascar', MH: 'Marshall Islands', MK: 'North Macedonia',
  ML: 'Mali', MM: 'Myanmar (Burma)', MN: 'Mongolia', MO: 'Macau',
  MP: 'Northern Mariana Islands', MQ: 'Martinique', MR: 'Mauritania', MS: 'Montserrat',
  MT: 'Malta', MU: 'Mauritius', MV: 'Maldives', MW: 'Malawi', MX: 'Mexico',
  MY: 'Malaysia', MZ: 'Mozambique', NA: 'Namibia', NC: 'New Caledonia', NE: 'Niger',
  NF: 'Norfolk Island', NG: 'Nigeria', NI: 'Nicaragua', NL: 'Netherlands', NO: 'Norway',
  NP: 'Nepal', NR: 'Nauru', NU: 'Niue', NZ: 'New Zealand', OM: 'Oman', PA: 'Panama',
  PE: 'Peru', PF: 'French Polynesia', PG: 'Papua New Guinea', PH: 'Philippines',
  PK: 'Pakistan', PL: 'Poland', PM: 'St. Pierre & Miquelon', PR: 'Puerto Rico',
  PS: 'Palestine', PT: 'Portugal', PW: 'Palau', PY: 'Paraguay', QA: 'Qatar',
  RE: 'Réunion', RO: 'Romania', RS: 'Serbia', RU: 'Russia', RW: 'Rwanda',
  SA: 'Saudi Arabia', SB: 'Solomon Islands', SC: 'Seychelles', SD: 'Sudan', SE: 'Sweden',
  SG: 'Singapore', SH: 'St. Helena', SI: 'Slovenia', SJ: 'Svalbard & Jan Mayen',
  SK: 'Slovakia', SL: 'Sierra Leone', SM: 'San Marino', SN: 'Senegal', SO: 'Somalia',
  SR: 'Suriname', SS: 'South Sudan', ST: 'São Tomé & Príncipe', SV: 'El Salvador',
  SX: 'Sint Maarten', SY: 'Syria', SZ: 'Eswatini', TA: 'Tristan da Cunha',
  TC: 'Turks & Caicos Islands', TD: 'Chad', TG: 'Togo', TH: 'Thailand', TJ: 'Tajikistan',
  TK: 'Tokelau', TL: 'Timor-Leste', TM: 'Turkmenistan', TN: 'Tunisia', TO: 'Tonga',
  TR: 'Turkey', TT: 'Trinidad & Tobago', TV: 'Tuvalu', TW: 'Taiwan', TZ: 'Tanzania',
  UA: 'Ukraine', UG: 'Uganda', US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan',
  VA: 'Vatican City', VC: 'St. Vincent & Grenadines', VE: 'Venezuela',
  VG: 'British Virgin Islands', VI: 'US Virgin Islands', VN: 'Vietnam', VU: 'Vanuatu',
  WF: 'Wallis & Futuna', WS: 'Samoa', XK: 'Kosovo', YE: 'Yemen', YT: 'Mayotte',
  ZA: 'South Africa', ZM: 'Zambia', ZW: 'Zimbabwe',
}

/** Markets pinned to the top of the selector (Ghana stays the default). */
const POPULAR_COUNTRY_CODES = [
  'GH', 'US', 'GB', 'NG', 'ZA', 'CA', 'DE', 'FR', 'AU', 'AE', 'KE', 'EG', 'IN', 'ES', 'IT', 'NL',
]

export interface CountryOption {
  label: string
  value: string
}

/**
 * The full set of country calling codes from libphonenumber-js metadata, each
 * labelled "Country (+code)". Popular markets are pinned first, the remainder
 * follow alphabetically by name. Calling codes shared across countries (e.g.
 * +1 for the NANP) collapse to the first (popular) label.
 */
export const COUNTRY_CODES: CountryOption[] = (() => {
  const byCode = new Map<string, CountryOption>()
  for (const code of getCountries()) {
    let callingCode: string
    try {
      callingCode = `+${getCountryCallingCode(code)}`
    } catch {
      continue
    }
    const name = COUNTRY_NAMES[code] || code
    byCode.set(code, { label: `${name} (${callingCode})`, value: callingCode })
  }

  const seen = new Set<string>()
  const unique: CountryOption[] = []
  const pushUnique = (opt?: CountryOption) => {
    if (!opt || seen.has(opt.value)) return
    seen.add(opt.value)
    unique.push(opt)
  }

  // Popular markets first (shared codes collapse to the first label)…
  for (const code of POPULAR_COUNTRY_CODES) pushUnique(byCode.get(code))
  const popularCount = unique.length
  // …then every remaining country.
  for (const code of getCountries()) pushUnique(byCode.get(code))

  const popular = unique.slice(0, popularCount)
  const rest = unique.slice(popularCount).sort((a, b) => a.label.localeCompare(b.label))
  return [...popular, ...rest]
})()
