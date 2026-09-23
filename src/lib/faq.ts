import type { TFunction } from 'i18next'

export interface FaqItemData {
  /** Stable, locale-independent id, e.g. "booking-1" (anchor is `faq-${id}`). */
  id: string
  q: string
  a: string
}

export interface FaqCategory {
  /** Stable category id, e.g. "booking" (anchor is `cat-${id}`). */
  id: string
  heading: string
  items: FaqItemData[]
}

export interface FaqSearchEntry extends FaqItemData {
  category: string
  categoryId: string
}

/** Question number → item id, per category. */
const CATEGORY_LAYOUT: { id: string; headingKey: string; questions: number[] }[] = [
  { id: 'booking', headingKey: 'faq.catBooking', questions: [1, 2, 3, 4] },
  { id: 'cancellation', headingKey: 'faq.catCancellation', questions: [5, 6, 7, 8] },
  { id: 'pickup', headingKey: 'faq.catPickup', questions: [9, 10, 11] },
  { id: 'offers', headingKey: 'faq.catOffers', questions: [12, 13] },
  { id: 'help', headingKey: 'faq.catHelp', questions: [14, 15] },
]

/** Build the localized FAQ structure (shared by the FAQ page, the Help Centre
 *  hub and the support search). */
export function getFaqCategories(t: TFunction): FaqCategory[] {
  return CATEGORY_LAYOUT.map(({ id, headingKey, questions }) => ({
    id,
    heading: t(headingKey),
    items: questions.map((n, index) => ({
      id: `${id}-${index + 1}`,
      q: t(`faq.q${n}`),
      a: t(`faq.a${n}`),
    })),
  }))
}

/** Flat, searchable FAQ list with category metadata. */
export function getAllFaqs(t: TFunction): FaqSearchEntry[] {
  return getFaqCategories(t).flatMap((category) =>
    category.items.map((item) => ({
      ...item,
      category: category.heading,
      categoryId: category.id,
    })),
  )
}

/** Curated "most travellers ask this" list for the Help Centre hub. */
export const POPULAR_FAQ_IDS = [
  'booking-1',
  'cancellation-1',
  'cancellation-3',
  'pickup-1',
  'help-1',
] as const

export function getPopularFaqs(t: TFunction): FaqItemData[] {
  const all = getAllFaqs(t)
  return POPULAR_FAQ_IDS.flatMap((id) => {
    const match = all.find((entry) => entry.id === id)
    return match ? [{ id: match.id, q: match.q, a: match.a }] : []
  })
}
