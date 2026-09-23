import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import './GalleryDialog.css'
import OptimizedImage from '@/components/shared/OptimizedImage'
import { LIGHTBOX_IMAGE } from '@/lib/image'

interface GalleryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: string[]
  initialIndex?: number
  fallbackImage?: string
  onImageError?: (e: React.SyntheticEvent<HTMLImageElement>) => void
}

/**
 * GetYourGuide-parity photo lightbox.
 *
 * Rendered through a portal on `document.body` so no ancestor stacking context
 * or `overflow`/`transform` can trap it under the fixed navbar (the previous
 * in-place version lost its close button and counter behind it).
 *
 * The photo is scaled to fill the available space at its natural aspect ratio —
 * never cropped, never left at its intrinsic size (GYG: `object-fit:none;
 * width:100%` in a centred flex box, with `media-lightbox__close-button` as a
 * dark translucent pill and the counter on the top bar).
 */
export default function GalleryDialog({
  open,
  onOpenChange,
  images,
  initialIndex = 0,
  fallbackImage,
  onImageError,
}: GalleryDialogProps) {
  const { t } = useTranslation()
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const touchStartXRef = useRef<number | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  // The photo index is initialised from the prop on mount; callers remount the
  // dialog per open (`key`), so this never needs to sync mid-flight — only move
  // focus into the dialog for keyboard users.
  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()
  }, [open])

  const showPrev = useCallback(() => {
    if (images.length === 0) return
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }, [images.length])

  const showNext = useCallback(() => {
    if (images.length === 0) return
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }, [images.length])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') showPrev()
      if (e.key === 'ArrowRight') showNext()
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, showPrev, showNext, close])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
    if (!focusables || focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartXRef.current
    touchStartXRef.current = null
    if (startX === null) return
    const endX = e.changedTouches[0]?.clientX ?? startX
    const deltaX = endX - startX
    if (Math.abs(deltaX) > 45) {
      if (deltaX < 0) showNext()
      if (deltaX > 0) showPrev()
    }
  }

  if (!open) return null
  if (typeof document === 'undefined') return null

  const variants = {
    enter: { opacity: 0, scale: 0.995 },
    center: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.995 },
  }

  const dialog = (
    <div className="gallery-dialog-overlay" onClick={close}>
      <div
        className="gallery-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('gallery.viewAllPhotos', { count: images.length })}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <p className="gallery-viewer-counter">
          {images.length > 0 ? `${currentIndex + 1} / ${images.length}` : ''}
        </p>

        <button
          type="button"
          ref={closeButtonRef}
          onClick={close}
          className="gallery-dialog-close"
          aria-label={t('gallery.closeGallery')}
        >
          <X className="gallery-dialog-close-icon" strokeWidth={2.25} />
        </button>

        <div className="gallery-viewer-main">
          <button
            type="button"
            onClick={showPrev}
            className="gallery-viewer-nav left"
            aria-label={t('gallery.previousImage')}
          >
            <ChevronLeft size={24} />
          </button>

          <AnimatePresence initial={false}>
            <motion.div
              key={currentIndex}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="gallery-viewer-image-container"
            >
              <OptimizedImage
                src={images[currentIndex] || fallbackImage}
                alt={t('gallery.tourImage', { number: currentIndex + 1 })}
                onError={onImageError}
                className="gallery-viewer-image"
                width={LIGHTBOX_IMAGE.width}
                crop={LIGHTBOX_IMAGE.crop}
                sizes={LIGHTBOX_IMAGE.sizes}
                priority
                style={{ objectFit: 'contain' }}
              />
            </motion.div>
          </AnimatePresence>

          <button
            type="button"
            onClick={showNext}
            className="gallery-viewer-nav right"
            aria-label={t('gallery.nextImage')}
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(dialog, document.body)
}
