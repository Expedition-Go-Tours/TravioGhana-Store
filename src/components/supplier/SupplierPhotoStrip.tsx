import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import GalleryDialog from '@/pages/tour-detail/GalleryDialog'
import OptimizedImage from '@/components/shared/OptimizedImage'
import useMediaQuery from '@/hooks/useMediaQuery'

/** Photos a desktop rail shows at once (the arrows step three at a time). */
const VISIBLE_TILES = 4
/** Fallback rail gap in px when the computed style is unavailable (jsdom). */
const FALLBACK_GAP = 8

interface SupplierPhotoStripProps {
  /** Deduped photos uploaded with this supplier's own tours. */
  photos: string[]
  supplierName: string
}

function railGap(rail: HTMLElement): number {
  return parseFloat(getComputedStyle(rail).columnGap) || FALLBACK_GAP
}

function railStep(rail: HTMLElement): number {
  const first = rail.firstElementChild as HTMLElement | null
  return first ? first.offsetWidth + railGap(rail) : 0
}

/**
 * The supplier's photo strip — built exclusively from the images on the
 * supplier's own tours (never another operator's photos and never the logo).
 *
 * A horizontal snap rail at every size, with the same arrow mechanics as the
 * tour and review rails (three tiles per click). Desktop shows four tiles
 * across; mobile shows one wide tile per view and drops the chevrons, with
 * "View all photos" moved below the rail so it never covers the photo being
 * swiped to. The counter tracks the first visible tile everywhere, and clicking
 * any tile opens the full-image lightbox at that photo.
 */
export default function SupplierPhotoStrip({ photos, supplierName }: SupplierPhotoStripProps) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [scrollIndex, setScrollIndex] = useState(0)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const railRef = useRef<HTMLDivElement>(null)

  const photoCount = photos.length
  const showArrows = !isMobile && photoCount > VISIBLE_TILES

  /** Track the first visible tile and the arrow disabled states while scrolling. */
  const updateRail = useCallback(() => {
    const rail = railRef.current
    if (!rail) return
    const step = railStep(rail)
    if (step > 0) {
      const index = Math.min(photoCount - 1, Math.max(0, Math.round(rail.scrollLeft / step)))
      setScrollIndex((current) => (current === index ? current : index))
    }
    const max = rail.scrollWidth - rail.clientWidth
    setCanScrollLeft(rail.scrollLeft > 2)
    setCanScrollRight(max > 1 && rail.scrollLeft < max - 2)
  }, [photoCount])

  useEffect(() => {
    updateRail()
    window.addEventListener('resize', updateRail)
    return () => window.removeEventListener('resize', updateRail)
  }, [updateRail, photos])

  if (photoCount === 0) return null

  const scrollRail = (direction: 1 | -1) => {
    const rail = railRef.current
    if (!rail || typeof rail.scrollBy !== 'function') return
    const step = railStep(rail)
    if (step <= 0) return
    rail.scrollBy({ left: direction * step * 3, behavior: 'smooth' })
  }

  return (
    <>
      <div className="supplier-photo-strip-wrap">
        <div className="supplier-photo-strip" ref={railRef} onScroll={updateRail}>
          {photos.map((photo, index) => (
            <div key={photo} className="supplier-photo-tile">
              <button
                type="button"
                className="supplier-photo-open"
                onClick={() => setViewerIndex(index)}
                aria-label={t('supplier.openPhoto', { index: index + 1, total: photoCount })}
              >
                <OptimizedImage src={photo} alt={`${supplierName} tour photo ${index + 1}`} width={640} />
              </button>
            </div>
          ))}
        </div>

        <span className="supplier-photo-count">
          {scrollIndex + 1} / {photoCount}
        </span>
        <button
          type="button"
          className="supplier-view-photos"
          onClick={() => setViewerIndex(0)}
        >
          {t('supplier.viewAllPhotos')}
        </button>

        {showArrows && (
          <>
            <button
              type="button"
              className="supplier-photo-nav supplier-photo-nav-left"
              onClick={() => scrollRail(-1)}
              disabled={!canScrollLeft}
              aria-label={t('supplier.previousPhotos')}
            >
              <ChevronLeft size={18} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className="supplier-photo-nav supplier-photo-nav-right"
              onClick={() => scrollRail(1)}
              disabled={!canScrollRight}
              aria-label={t('supplier.nextPhotos')}
            >
              <ChevronRight size={18} strokeWidth={2.2} />
            </button>
          </>
        )}
      </div>

      <GalleryDialog
        key={viewerIndex != null ? `photos-open-${viewerIndex}` : 'photos-closed'}
        open={viewerIndex != null}
        onOpenChange={(open) => {
          if (!open) setViewerIndex(null)
        }}
        images={photos}
        initialIndex={viewerIndex ?? 0}
        fallbackImage={photos[0]}
      />
    </>
  )
}
