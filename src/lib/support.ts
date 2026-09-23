/** Single source of truth for the public support section
 *  (Help Centre, Contact Us, FAQ). */
export const SUPPORT_EMAIL = 'info@expeditiongotours.com'

export const SUPPORT_PHONE = '+233591409761'

/** E.164-ish digits only, for tel: and wa.me links. */
export const SUPPORT_PHONE_DIGITS = SUPPORT_PHONE.replace(/[^0-9]/g, '')

export const WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE_DIGITS}`

/** Google Maps embed + directions for the Accra office. */
export const OFFICE_MAP_EMBED =
  'https://www.google.com/maps?q=Travio Ghana+Tours+Ltd,+Accra,+Ghana&output=embed'
export const OFFICE_DIRECTIONS_URL =
  'https://www.google.com/maps/dir/?api=1&destination=Travio Ghana+Tours+Ltd,+Accra,+Ghana&travelmode=driving'

export interface SupportHoursEntry {
  labelKey: string
  valueKey: string
  closed?: boolean
}

/** Shared opening hours — label/value keys exist in every locale. */
export const SUPPORT_HOURS: SupportHoursEntry[] = [
  { labelKey: 'help.hours1Label', valueKey: 'help.hours1Value' },
  { labelKey: 'help.hours2Label', valueKey: 'help.hours2Value' },
]
