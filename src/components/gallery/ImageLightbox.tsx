import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import './ImageLightbox.css'

export interface GalleryImage {
  src: string
  alt: string
  width: number
  height: number
}

interface ImageLightboxProps {
  images: GalleryImage[]
  index: number
  onClose: () => void
  /** Step through the gallery (wraps around). */
  onNavigate: (delta: number) => void
}

/**
 * Light frosted-glass image lightbox. Unlike a plain overlay it behaves like a
 * dialog: focus moves in and is restored on close, Tab is trapped, the
 * background cannot scroll, and Escape / arrow keys / swipe navigate.
 */
export default function ImageLightbox({
  images,
  index,
  onClose,
  onNavigate,
}: ImageLightboxProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const touchStartX = useRef<number | null>(null)
  const image = images[index]

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onNavigate(-1)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        onNavigate(1)
        return
      }
      if (e.key !== 'Tab') return

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusables.length === 0) return
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

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus()
    }
  }, [onClose, onNavigate])

  if (!image) return null

  return (
    <motion.div
      ref={dialogRef}
      className="img-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={t('about.imageGallery')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current
        touchStartX.current = null
        if (start == null) return
        const end = e.changedTouches[0]?.clientX ?? start
        const dx = end - start
        if (Math.abs(dx) > 50) onNavigate(dx > 0 ? -1 : 1)
      }}
    >
      <button
        ref={closeRef}
        type="button"
        className="img-lightbox-close"
        onClick={onClose}
        aria-label={t('about.closeImage')}
      >
        <X size={20} />
      </button>

      <motion.figure
        className="img-lightbox-figure"
        initial={{ scale: 0.94, y: 22, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 22, opacity: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          decoding="async"
        />
        <figcaption className="img-lightbox-caption">
          <span className="img-lightbox-caption-text">{image.alt}</span>
          <span className="img-lightbox-counter">
            {t('about.imageCounter', { current: index + 1, total: images.length })}
          </span>
        </figcaption>
      </motion.figure>

      {images.length > 1 && (
        <>
          <button
            type="button"
            className="img-lightbox-arrow img-lightbox-arrow--prev"
            onClick={(e) => {
              e.stopPropagation()
              onNavigate(-1)
            }}
            aria-label={t('about.previousImage')}
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            className="img-lightbox-arrow img-lightbox-arrow--next"
            onClick={(e) => {
              e.stopPropagation()
              onNavigate(1)
            }}
            aria-label={t('about.nextImage')}
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}
    </motion.div>
  )
}
