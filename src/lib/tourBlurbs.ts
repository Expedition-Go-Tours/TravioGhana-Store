import { normalizeTitle } from './reviewTourLink'

/**
 * Card blurbs for the homepage recommendations rail.
 *
 * The tour detail description is written for the detail page — it opens with
 * numbered itinerary steps ("1. Start Your Journey from Accra…") and reads
 * badly as a two-line card excerpt. The curated blurbs below are the approved
 * marketing copy for the ten tours that fill this rail; anything without a
 * blurb falls back to a cleaned excerpt of the real description.
 */

const BLURBS: Record<string, string> = {
  'cape coast castle elmina castle and kakum national park tour':
    'Explore two of Ghana’s historic coastal castles and discover the stories behind them. Then head to Kakum National Park to experience the famous rainforest canopy walkway.',
  'accra guided city tour cultural and historical experience':
    'See Accra’s most famous landmarks while discovering the city’s rich history, lively culture and local neighbourhoods. An engaging introduction to Ghana’s capital.',
  'from accra waterfalls aburi gardens and cocoa farm tour':
    'Travel from Accra into the lush Eastern Region to discover beautiful waterfalls, stroll through Aburi Botanical Gardens and learn about Ghana’s cocoa-growing traditions.',
  'accra shai hills safari and akosombo boat cruise day tour':
    'Discover the scenic Shai Hills Reserve, look out for local wildlife and explore the landscape before enjoying a relaxing boat cruise on the Volta River at Akosombo.',
  'private accra international airport pickup and dropoff':
    'Make arrival or departure easier with a comfortable, private airport pickup or drop-off in Accra. Enjoy convenient transport and a smoother start or finish to your trip.',
  'the kumasi cultural and heritage day tour':
    'Discover Kumasi’s fascinating Ashanti heritage, royal history and vibrant arts scene. Explore local craftsmanship and gain a deeper appreciation of the region’s traditions.',
  'the shia hills safari quad bike tour':
    'Add excitement to your Ghana adventure with a quad-bike experience around the Shai Hills area. Enjoy an active outdoor outing surrounded by striking natural scenery.',
  'accra food tasting tour':
    'Discover the flavours of Ghana on a food-tasting experience in Accra. Sample local favourites and learn more about the ingredients, dishes and traditions behind them.',
  'transport from accra to cape coast':
    'Travel from Accra to Cape Coast in private, air-conditioned comfort. A convenient transfer option for visitors planning a coastal getaway or heritage trip.',
  'transport form accra to cape coast':
    'Travel from Accra to Cape Coast in private, air-conditioned comfort. A convenient transfer option for visitors planning a coastal getaway or heritage trip.',
  'accra golf lesson with optional dinner and transfers':
    'Enjoy a golf lesson in Accra, whether you are trying the sport for the first time or refining your swing. Optional dinner and transfers make the outing even easier.',
}

const MAX_EXCERPT = 168

/** Strip itinerary numbering/bullets and cut on a sentence or word boundary. */
export function toTourExcerpt(description: string): string {
  const cleaned = description
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:\d+\s*[.)]\s*|day\s*\d+\s*[:.\-–]\s*)/i, '')
    .replace(/^[•\-–—]\s*/, '')
    .trim()

  if (!cleaned) return ''

  // Prefer the first complete sentence when it is long enough to stand alone.
  const sentence = cleaned.match(/^.*?[.!?](?=\s|$)/)
  if (sentence && sentence[0].length >= 60) return sentence[0].trim()

  if (cleaned.length <= MAX_EXCERPT) return cleaned
  return `${cleaned.slice(0, MAX_EXCERPT).replace(/\s+\S*$/, '')}…`
}

/** Curated blurb when we have one, otherwise a card-safe excerpt. */
export function getTourBlurb(title: string, description: string): string {
  const curated = BLURBS[normalizeTitle(title)]
  if (curated) return curated
  return toTourExcerpt(description)
}
