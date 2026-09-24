import { describe, it, expect } from 'vitest'
import { SCRAPED_REVIEW_SUPPLIER, isScrapedReviewSupplier } from './supplierIdentity'

/**
 * Scraped TripAdvisor / GetYourGuide reviews belong to one operator's listings.
 * These tests pin the scope so a competitor's identically-titled tour can never
 * inherit that social proof again (the Kadelo Travels "Cape Coast" regression).
 */
describe('isScrapedReviewSupplier', () => {
  it('accepts the operator as the API spells it', () => {
    expect(isScrapedReviewSupplier('Expedition-Go Tours LTD')).toBe(true)
    expect(isScrapedReviewSupplier(SCRAPED_REVIEW_SUPPLIER)).toBe(true)
  })

  it('accepts case, hyphen and "Limited" variants of the same company', () => {
    expect(isScrapedReviewSupplier('Expedition-Go Tours Ltd')).toBe(true)
    expect(isScrapedReviewSupplier('expedition-go tours ltd')).toBe(true)
    expect(isScrapedReviewSupplier('Expedition Go Tours Ltd')).toBe(true)
    expect(isScrapedReviewSupplier('Expedition-Go Tours Limited')).toBe(true)
    expect(isScrapedReviewSupplier('  Expedition-Go   Tours LTD  ')).toBe(true)
  })

  it('rejects any other operator', () => {
    expect(isScrapedReviewSupplier('Kadelo Travels')).toBe(false)
    expect(isScrapedReviewSupplier('Kadelo Travels Ltd')).toBe(false)
    expect(isScrapedReviewSupplier('Expedition-Go Tours Ltd Ghana')).toBe(false)
  })

  it('fails closed when the supplier is unknown', () => {
    expect(isScrapedReviewSupplier(undefined)).toBe(false)
    expect(isScrapedReviewSupplier(null)).toBe(false)
    expect(isScrapedReviewSupplier('')).toBe(false)
    expect(isScrapedReviewSupplier('   ')).toBe(false)
  })
})
