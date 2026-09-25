/** Single source of truth for the public support section
 *  (Help Centre, Contact Us, FAQ). */
export const SUPPORT_EMAIL = 'info@expeditiongotours.com'

export const SUPPORT_PHONE = '+233591409761'

/** E.164-ish digits only, for tel: and wa.me links. */
export const SUPPORT_PHONE_DIGITS = SUPPORT_PHONE.replace(/[^0-9]/g, '')

export const WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE_DIGITS}`

/** Google Maps embed + directions for the Accra office. The embed uses the
 *  share-embed `pb` form with the business's place token
 *  (0xfddffe31ada119b:0xa1c648c383bd4b86) pinned at 5.6604422,-0.1316677
 *  (≈17z). A bare coordinate query has no place entity behind the pin, so
 *  clicking it failed with "Place info couldn't load"; the token keeps the
 *  exact storefront and loads the place card. */
export const OFFICE_MAP_EMBED =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3970.363468674851!2d-0.1316677!3d5.6604422!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xfddffe31ada119b%3A0xa1c648c383bd4b86!2sExpedition-Go%20Tours%20LTD!5e0!3m2!1sen!2sgh'
export const OFFICE_DIRECTIONS_URL =
  'https://www.google.com/maps/dir/?api=1&destination=5.6604422,-0.1316677&travelmode=driving'

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
