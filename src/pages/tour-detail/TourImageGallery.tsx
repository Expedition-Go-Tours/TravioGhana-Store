import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Images, ArrowLeft, Heart, Share } from 'lucide-react'
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
  /** Mobile only: the tour is in the wishlist. */
  isSaved?: boolean
  /** Mobile only: toggle the wishlist entry. */
  onToggleSave?: () => void
  /** Mobile only: share the page (navigator.share with a clipboard fallback). */
  onShare?: () => void
}

type Size = { w: number; h: number }

/**
 * The mosaic height follows the booking card, which settles in small steps
 * while the pricing state changes. Snapping the measured tile height to 40px
 * buckets keeps the Cloudinary transform URL stable across those steps
 * (e.g. 469–496px all crop at 480), so a few pixels of movement never
 * re-downloads every photo; `object-fit: cover` absorbs the difference.
 */
const TILE_HEIGHT_BUCKET = 40
function snapTileHeight(height: number): number {
  return Math.max(TILE_HEIGHT_BUCKET, Math.round(height / TILE_HEIGHT_BUCKET) * TILE_HEIGHT_BUCKET)
}

function sameSizeMap(a: Record<number, Size>, b: Record<number, Size>): boolean {
  const aKeys = Object.keys(a)
  return (
    aKeys.length === Object.keys(b).length &&
    Object.entries(b).every(([key, box]) => {
      const before = a[Number(key)]
      return before?.w === box.w && before?.h === box.h
    })
  )
}

interface Column {
  key: string
  grow: number
  shrink: number
  basis: string
  indexes: number[]
}

/**
 * Desktop mosaic geometry (mockup): the cover photo takes the large hero tile
 * on the left (~2/3 of the width) and a right column takes the remainder with
 * the next photos stacked as equal tiles. 4px gaps, 12px outer radius.
 */
const HERO_COLUMN = { grow: 0, shrink: 0, basis: '68%' }
const STACK_COLUMN = { grow: 1, shrink: 1, basis: '0%' }

/**
 * Same proportions at every count, degraded gracefully for short galleries:
 *   4+ → hero (cover) + right column with three stacked tiles (any extra
 *        photos stay in the lightbox, reachable via "View all N photos")
 *   3  → hero (cover) + right column with two stacked tiles
 *   2  → two half-width tiles
 *   1  → one full-width tile
 * The cover photo (index 0) always takes the hero tile.
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
      { key: 'hero', ...HERO_COLUMN, indexes: [0] },
      { key: 'stack', ...STACK_COLUMN, indexes: [1, 2] },
    ]
  }
  return [
    { key: 'hero', ...HERO_COLUMN, indexes: [0] },
    { key: 'stack', ...STACK_COLUMN, indexes: [1, 2, 3] },
  ]
}

/**
 * Mobile pagination is over *pages*, not photos — matching the GetYourGuide
 * screen this mirrors. Each page is one fixed composition and the swipe moves
 * a whole composition, so the dots count pages. Photos past page 4 stay in the
 * lightbox, which the last page opens.
 */
export type GalleryPage =
  | { kind: 'hero'; indexes: number[] }
  | { kind: 'single'; indexes: number[] }
  | { kind: 'twoUp'; indexes: number[] }
  | { kind: 'stacked'; indexes: number[] }
  | { kind: 'viewAll'; indexes: number[] }

/**
 * hero (3) → single (1) → stacked (3) → single (1) → view all.
 *
 * The reference reaches its fifth page with eight or more photos: 3 + 1 + 3 +
 * 1 fills the four photo pages and "View all" closes the strip. Shorter tours
 * stop early rather than repeating a photo to pad the count.
 */
export function buildMobilePages(count: number): GalleryPage[] {
  if (count <= 0) return []
  if (count === 1) return [{ kind: 'single', indexes: [0] }]
  if (count === 2) return [{ kind: 'twoUp', indexes: [0, 1] }]

  const pages: GalleryPage[] = [{ kind: 'hero', indexes: [0, 1, 2] }]
  let index = 3

  if (index < count) {
    pages.push({ kind: 'single', indexes: [index] })
    index += 1
  }

  const rest = count - index
  if (rest >= 3) {
    pages.push({ kind: 'stacked', indexes: [index, index + 1, index + 2] })
    index += 3
  } else if (rest === 2) {
    pages.push({ kind: 'twoUp', indexes: [index, index + 1] })
    index += 2
  } else if (rest === 1) {
    pages.push({ kind: 'single', indexes: [index] })
    index += 1
  }

  if (index < count) {
    pages.push({ kind: 'single', indexes: [index] })
  }

  // A "View all" page is only useful once the photo pages cannot show
  // everything — otherwise it opens a lightbox the strip already exhausted.
  if (count >= 4) pages.push({ kind: 'viewAll', indexes: [] })

  return pages
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function TourImageGallery({
  images,
  title,
  fallbackImage,
  onBack,
  hideBack,
  isSaved = false,
  onToggleSave,
  onShare,
}: TourImageGalleryProps) {
  const { t } = useTranslation()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [activePage, setActivePage] = useState(0)
  // The gallery can stay mounted while the route swaps to another tour. Reset
  // the carousel during render (React's documented "adjust state when a prop
  // changes" pattern) rather than in an effect, which would render the old
  // index once with the new photos first.
  const [photoCount, setPhotoCount] = useState(images.length)
  if (photoCount !== images.length) {
    setPhotoCount(images.length)
    setActivePage(0)
  }
  // Measured tile boxes: GetYourGuide crops every tile at the CDN to the exact
  // box it renders in, so the browser never has to crop (or upscale) anything.
  const [tileSizes, setTileSizes] = useState<Record<number, Size>>({})
  const [mobileTileSizes, setMobileTileSizes] = useState<Record<number, Size>>({})

  const rootRef = useRef<HTMLDivElement>(null)
  const tileRefs = useRef<Record<number, HTMLElement | null>>({})
  const mobileTileRefs = useRef<Record<number, HTMLElement | null>>({})
  const scrollerRef = useRef<HTMLDivElement>(null)

  const columns = useMemo(() => buildColumns(images.length), [images.length])
  const desktopIndexes = useMemo(() => columns.flatMap((c) => c.indexes), [columns])
  const pages = useMemo(() => buildMobilePages(images.length), [images.length])

  const measure = useCallback(() => {
    const next: Record<number, Size> = {}
    for (const index of desktopIndexes) {
      const el = tileRefs.current[index]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      const w = Math.round(rect.width)
      const h = Math.round(rect.height)
      if (w > 0 && h > 0) next[index] = { w, h: snapTileHeight(h) }
    }
    setTileSizes((prev) => (sameSizeMap(prev, next) ? prev : next))

    // Mobile tiles differ in size per page (a hero, a half tile, a tall tile),
    // so each one is measured rather than reusing a single slide box.
    const nextMobile: Record<number, Size> = {}
    for (const [key, el] of Object.entries(mobileTileRefs.current)) {
      if (!el) continue
      const rect = el.getBoundingClientRect()
      const w = Math.round(rect.width)
      const h = Math.round(rect.height)
      if (w > 0 && h > 0) nextMobile[Number(key)] = { w, h }
    }
    setMobileTileSizes((prev) => (sameSizeMap(prev, nextMobile) ? prev : nextMobile))
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

  // Snap the strip back only when the photo set changes. The page index is
  // reset above, during render.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    // jsdom has no layout engine and no scrollTo; fall back to the property.
    if (typeof scroller.scrollTo === 'function') scroller.scrollTo({ left: 0 })
    else scroller.scrollLeft = 0
  }, [images.length])

  const goToPage = useCallback((index: number) => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const page = scroller.children[index] as HTMLElement | undefined
    if (!page) return
    if (typeof page.scrollIntoView !== 'function') {
      // Non-browser host (tests): scroll the strip directly.
      scroller.scrollLeft = page.offsetLeft
      return
    }
    page.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'start',
    })
  }, [])

  const handleScroll = () => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const children = scroller.children
    if (children.length === 0) return
    const first = children[0] as HTMLElement
    const second = children[1] as HTMLElement | undefined
    const step = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth
    if (step <= 0) return
    const next = Math.round(scroller.scrollLeft / step)
    setActivePage((prev) =>
      prev === next ? prev : Math.min(Math.max(next, 0), children.length - 1),
    )
  }

  const openLightbox = useCallback((index: number) => {
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

  const renderMobileTile = (imageIndex: number, className = '') => {
    const box = mobileTileSizes[imageIndex]
    return (
      <button
        key={imageIndex}
        type="button"
        ref={(el) => { mobileTileRefs.current[imageIndex] = el }}
        className={`tour-gallery-mobile-tile ${className}`.trim()}
        onClick={() => openLightbox(imageIndex)}
        aria-label={t('gallery.viewPhoto', { number: imageIndex + 1 })}
        data-testid={`tour-gallery-mobile-tile-${imageIndex}`}
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
            sizes="100vw"
            className="tour-gallery-mobile-image"
            priority={imageIndex === 0}
          />
        )}
      </button>
    )
  }

  const renderPage = (page: GalleryPage) => {
    switch (page.kind) {
      case 'hero':
        return (
          <div className="tour-gallery-hero">
            {renderMobileTile(page.indexes[0], 'tour-gallery-hero-main')}
            <div className="tour-gallery-hero-row">
              {page.indexes.slice(1).map((imageIndex) => renderMobileTile(imageIndex))}
            </div>
          </div>
        )
      case 'twoUp':
        return (
          <div className="tour-gallery-two-up">
            {page.indexes.map((imageIndex) => renderMobileTile(imageIndex))}
          </div>
        )
      case 'stacked':
        return (
          <div className="tour-gallery-stacked">
            {page.indexes.map((imageIndex) => renderMobileTile(imageIndex))}
          </div>
        )
      case 'viewAll':
        return (
          <button
            type="button"
            className="tour-gallery-view-all"
            onClick={() => openLightbox(0)}
          >
            <OptimizedImage
              src={images[0] || fallbackImage}
              alt=""
              width={mobileTileSizes[0]?.w}
              height={mobileTileSizes[0]?.h}
              fit="fill"
              gravity="auto"
              sizes="100vw"
              className="tour-gallery-mobile-image"
              onError={handleImageError}
            />
            <span className="tour-gallery-view-all-content">
              <Images size={24} strokeWidth={2} aria-hidden="true" />
              {t('gallery.viewAll', { defaultValue: 'View all' })}
            </span>
          </button>
        )
      case 'single':
      default:
        return renderMobileTile(page.indexes[0])
    }
  }

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

        {/* Mobile (<768px) — a page-per-swipe strip with a peeking neighbour */}
        <div className="tour-gallery-mobile" data-testid="tour-gallery-mobile">
          <div
            ref={scrollerRef}
            className="tour-gallery-mobile-scroller"
            onScroll={handleScroll}
            role="group"
            aria-roledescription="carousel"
            aria-label={t('gallery.carouselLabel', { defaultValue: 'Tour photos' })}
          >
            {pages.map((page, pageIndex) => (
              <div
                key={pageIndex}
                className="tour-gallery-page"
                data-page={page.kind}
                data-testid={`tour-gallery-page-${pageIndex}`}
                aria-label={`${pageIndex + 1} / ${pages.length}`}
              >
                {renderPage(page)}
              </div>
            ))}
          </div>

          {pages.length > 1 && (
            <div className="tour-gallery-pagination">
              {pages.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => goToPage(index)}
                  className={`tour-gallery-dot ${index === activePage ? 'active' : ''}`}
                  aria-label={t('gallery.goToImage', { number: index + 1 })}
                  aria-current={index === activePage ? 'true' : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Mobile-only save + share, pinned over the strip like the reference.
            Desktop keeps its own wishlist/share affordances elsewhere. */}
        {(onToggleSave || onShare) && (
          <div className="tour-gallery-mobile-actions">
            {onToggleSave && (
              <button
                type="button"
                className={`tour-gallery-round${isSaved ? ' is-saved' : ''}`}
                onClick={onToggleSave}
                aria-label={
                  isSaved
                    ? t('common.removeFromWishlist', 'Remove from wishlist')
                    : t('common.addToWishlist', 'Add to wishlist')
                }
                aria-pressed={isSaved}
              >
                <Heart size={20} strokeWidth={2} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
            )}
            {onShare && (
              <button
                type="button"
                className="tour-gallery-round"
                onClick={onShare}
                aria-label={t('common.share', 'Share')}
              >
                <Share size={19} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

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

        {/* "View all photos" — desktop only. On phones the last page owns it. */}
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
