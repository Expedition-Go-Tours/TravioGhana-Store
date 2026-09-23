import { describe, expect, it } from 'vitest'
import { MAX_SUPPLIER_APPLICATION_FILES } from '../supplier'

/**
 * The form pre-flights against this constant before uploading. If it ever drops
 * below what a real application needs, vehicle-based supplier types silently
 * become unsubmittable again (the backend answers with a generic 400).
 */
describe('MAX_SUPPLIER_APPLICATION_FILES', () => {
  it('matches the backend upload field maxCounts', () => {
    // legacy named fields (1+1+1+1+5) + documents (30) + vehiclePhotos (30)
    expect(MAX_SUPPLIER_APPLICATION_FILES).toBe(69)
  })

  it('is above the legacy-fields-only total that used to cap the upload', () => {
    // The backend multer limit was once a flat 9 (the legacy fields alone) while
    // the form still sent vehicle documents in `documents`.
    expect(MAX_SUPPLIER_APPLICATION_FILES).toBeGreaterThan(9)
  })

  it('can carry a Transportation Provider application (6 supplier docs + 4 per vehicle)', () => {
    expect(MAX_SUPPLIER_APPLICATION_FILES).toBeGreaterThanOrEqual(6 + 4)
  })
})
