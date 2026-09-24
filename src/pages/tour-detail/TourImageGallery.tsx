import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Images, ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import GalleryDialog from './GalleryDialog'
import './TourImageGallery.css'
import OptimizedImage from '@/components/shared/OptimizedImage'
import { prefetchLightboxImages } from '@/lib/prefetchImages'

interface TourImageGalleryProps {
  images: string[]
  title: string
  fallbackImage?: string
  /** History-aware back handler. Rendered as an overlay on the hero. */
  onBack?: () => void
  /** Hide the overlay back button (e.g. once the sticky bar has taken over). */
  hideBack?: boolean
}

type Size = { w: number; h: number }

interface Column {
  key: string
  grow: number
  shrink: number
  basis: string
  indexes: number[]
}

/**
 * GetYourGuide's desktop mosaic geometry (`@media (min-width:768px)`):
 * left 20% / centre 54% / right column takes the remainder.
 */
const LEFT_COLUMN = { grow: 0, shrink: 0, basis: '20%' }
const CENTER_COLUMN = { grow: 0, shrink: 0, basis: '54%' }
const RIGHT_COLUMN = { grow: 1, shrink: 1, basis: '0%' }

/**
 * Same proportions as GetYourGuide, degraded gracefully for short galleries:
 *   4+ → left 20% / centre 54% / right column (two stacked tiles)
 *   3  → left 20% / centre 54% / right (one full-height tile)
 *   2  → two half-width tiles
 *   1  → one full-width tile
 * The cover photo (index 0) always takes the large centre tile.
 */
function buildColumns(count: number): Column[] {
  if (count <= 0) return []
  if (count === 1) return [{ key: 'single', grow: 1, shrink: 1, basis: '100%', indexes: [0] }]
  if (count === 2) {
    return [
      { key: 'half-0', grow: 0, shrink: 0, basis: '50%', indexes: [0] },
      { key: 'half-1', grow: 0, shrink: 0, basis: '50%', indexes: [1] },
    ]
  }
  if (count === 3) {
    return [
      { key: 'left', ...LEFT_COLUMN, indexes: [1] },
      { key: 'center', ...CENTER_COLUMN, indexes: [0] },
      { key: 'right', ...RIGHT_COLUMN, indexes: [2] },
    ]
  }
  return [
    { key: 'left', ...LEFT_COLUMN, indexes: [1] },
    { key: 'center', ...CENTER_COLUMN, indexes: [0] },
    { key: 'right', ...RIGHT_COLUMN, indexes: [2, 3] },
  ]
}

export default function TourImageGallery({ images, title, fallbackImage, onBack, hideBack }: TourImageGalleryProps) {
  const { t } = useTranslation()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [mobileIndex, setMobileIndex] = useState(0)
  // Measured tile boxes: GetYourGuide crops every tile at the CDN to the exact
  // box it renders in, so the browser never has to crop (or upscale) anything.
  const [tileSizes, setTileSizes] = useState<Record<number, Size>>({})
  const [mobileSize, setMobileSize] = useState<Size | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const tileRefs = useRef<Record<number, HTMLElement | null>>({})
  const mobileSlideRef = useRef<HTMLButtonElement>(null)
  const touchStartXRef = useRef<number | null>(null)
  const swipedRef = useRef(false)

  const columns = useMemo(() => buildColumns(images.length), [images.length])
  const desktopIndexes = useMemo(() => columns.flatMap((c) => c.indexes), [columns])

  const measure = useCallback(() => {
    const next: Record<number, Size> = {}
    for (const index of desktopIndexes) {
      const el = tileRefs.current[index]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      const w = Math.round(rect.width)
      const h = Math.round(rect.height)
      if (w > 0 && h > 0) next[index] = { w, h }
    }
    setTileSizes((prev) => {
      const same =
        Object.keys(prev).length === Object.keys(next).length &&
        Object.entries(next).every(([key, box]) => {
          const before = prev[Number(key)]
          return before?.w === box.w && before?.h === box.h
        })
      return same ? prev : next
    })

    // The mobile carousel is square, so one measurement covers every slide.
    const slide = mobileSlideRef.current
    if (slide) {
      const w = Math.round(slide.getBoundingClientRect().width)
      if (w > 0) setMobileSize((prev) => (prev && prev.w === w ? prev : { w, h: w }))
    }
  }, [desktopIndexes])

  useEffect(() => {
    const target = rootRef.current
    if (!target) return
    if (typeof ResizeObserver === 'undefined') {
      // Very old browsers have no ResizeObserver: measure once after paint.
      const timer = window.setTimeout(() => measure(), 0)
      return () => window.clearTimeout(timer)
    }
    // ResizeObserver delivers an initial observation as soon as observation
    // starts, so the first measurement arrives through the callback instead of
    // as a synchronous setState inside the effect body.
    const observer = new ResizeObserver(() => measure())
    observer.observe(target)
    return () => observer.disconnect()
  }, [measure])

  // Warm the viewer's photos while the page is idle: the first "next" click in
  // "View all photos" then paints from cache instead of waiting on Cloudinary.
  useEffect(
    () => prefetchLightboxImages(images.map((image) => image || fallbackImage)),
    [images, fallbackImage],
  )

  const showMobile = useCallback((index: number) => {
    setMobileIndex((prev) => {
      const count = images.length
      if (count === 0) return prev
      return ((index % count) + count) % count
    })
  }, [images.length])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null
    swipedRef.current = false
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartXRef.current
    touchStartXRef.current = null
    if (startX === null) return
    const endX = e.changedTouches[0]?.clientX ?? startX
    const deltaX = endX - startX
    if (Math.abs(deltaX) > 45) {
      swipedRef.current = true
      showMobile(mobileIndex + (deltaX < 0 ? 1 : -1))
    }
  }

  // A swipe on touch devices also fires a click; don't let it open the lightbox.
  const openLightbox = useCallback((index: number) => {
    if (swipedRef.current) {
      swipedRef.current = false
      return
    }
    if (images.length === 0) return
    setLightboxIndex(Math.max(0, Math.min(index, images.length - 1)))
  }, [images.length])

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.dataset.exhausted) return
    if (fallbackImage && e.currentTarget.src !== fallbackImage) {
      e.currentTarget.src = fallbackImage
      e.currentTarget.dataset.exhausted = 'true'
    }
  }, [fallbackImage])

  return (
    <>
      <div className="tour-image-gallery" ref={rootRef}>
        {/* Desktop / tablet mosaic — GetYourGuide ≥768px */}
        {columns.length > 0 && (
          <div className="tour-gallery-mosaic" data-testid="tour-gallery-mosaic">
            {columns.map((column) => (
              <div
                key={column.key}
                className="tour-gallery-mosaic-column"
                style={{
                  flexGrow: column.grow,
                  flexShrink: column.shrink,
                  flexBasis: column.basis,
                }}
              >
                {column.indexes.map((imageIndex) => {
                  const box = tileSizes[imageIndex]
                  return (
                    <button
                      key={imageIndex}
                      type="button"
                      ref={(el) => { tileRefs.current[imageIndex] = el }}
                      className="tour-gallery-tile"
                      onClick={() => openLightbox(imageIndex)}
                      aria-label={t('gallery.showImage', { number: imageIndex + 1 })}
                      data-testid={`tour-gallery-tile-${imageIndex}`}
                    >
                      {box && (
                        <OptimizedImage
                          src={images[imageIndex] || fallbackImage}
                          alt={`${title} ${imageIndex + 1}`}
                          onError={handleImageError}
                          width={box.w}
                          height={box.h}
                          fit="fill"
                          gravity="auto"
                          sizes={`${box.w}px`}
                          className="tour-gallery-tile-image"
                          priority={imageIndex === 0}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Mobile (<768px) — GetYourGuide square swipe carousel */}
        <div
          className="tour-gallery-mobile"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="tour-gallery-mobile-track"
            style={{ transform: `translateX(-${mobileIndex * 100}%)` }}
          >
            {images.map((image, index) => (
              <button
                type="button"
                key={index}
                ref={index === 0 ? mobileSlideRef : undefined}
                className="tour-gallery-mobile-slide"
                onClick={() => openLightbox(index)}
                aria-label={t('gallery.viewPhoto', { number: index + 1 })}
              >
                {mobileSize && (
                  <OptimizedImage
                    src={image || fallbackImage}
                    alt={`${title} ${index + 1}`}
                    onError={handleImageError}
                    width={mobileSize.w}
                    height={mobileSize.h}
                    fit="fill"
                    gravity="auto"
                    sizes="100vw"
                    className="tour-gallery-mobile-image"
                    priority={index === 0}
                  />
                )}
              </button>
            ))}
          </div>

          {images.length > 1 && (
            <div className="tour-gallery-dots">
              {images.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => showMobile(index)}
                  className={`tour-gallery-dot ${index === mobileIndex ? 'active' : ''}`}
                  aria-label={t('gallery.goToImage', { number: index + 1 })}
                />
              ))}
            </div>
          )}
        </div>

        {/* The page's primary back affordance: a bare left arrow on a round
            white button, top-left of the gallery. Once the sticky title/tabs
            slide in, `hideBack` retires it so two backs never show at once. */}
        {onBack && !hideBack && (
          <button
            type="button"
            className="tour-gallery-back"
            onClick={onBack}
            aria-label={t('common.goBack', 'Go back')}
          >
            <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}

        {/* "View all photos" — bottom-right of the gallery (above the mobile
            pagination dots). */}
        {images.length > 0 && (
          <button
            type="button"
            className="tour-gallery-show-all"
            onClick={() => openLightbox(0)}
          >
            <Images size={18} strokeWidth={2} aria-hidden="true" />
            <span>{t('gallery.viewAllPhotos', { count: images.length })}</span>
          </button>
        )}
      </div>

      {lightboxIndex !== null && (
        <GalleryDialog
          // Remount per open so the dialog always starts on the clicked photo.
          key={`tour-gallery-lightbox-${lightboxIndex}`}
          open
          onOpenChange={(isOpen) => { if (!isOpen) setLightboxIndex(null) }}
          images={images}
          initialIndex={lightboxIndex}
          fallbackImage={fallbackImage}
          onImageError={handleImageError}
        />
      )}
    </>
  )
}
