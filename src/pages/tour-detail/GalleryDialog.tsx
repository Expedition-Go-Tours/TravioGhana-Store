import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Grid3X3 } from 'lucide-react'
import './GalleryDialog.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

interface GalleryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: string[]
  initialIndex?: number
  fallbackImage?: string
  onImageError?: (e: React.SyntheticEvent<HTMLImageElement>) => void
}

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
  const [view, setView] = useState<'grid' | 'viewer'>('grid')
  const [slideDirection, setSlideDirection] = useState(0)
  const touchStartXRef = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      window.setTimeout(() => setCurrentIndex(initialIndex), 0)
      window.setTimeout(() => setView('grid'), 0)
    }
  }, [open, initialIndex])

  const showPrev = useCallback(() => {
    if (images.length === 0) return
    setSlideDirection(-1)
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }, [images.length])

  const showNext = useCallback(() => {
    if (images.length === 0) return
    setSlideDirection(1)
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }, [images.length])

  useEffect(() => {
    if (!open || view !== 'viewer') return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') showPrev()
      if (e.key === 'ArrowRight') showNext()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, view, showPrev, showNext])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartXRef.current
    if (startX === null) return
    const endX = e.changedTouches[0]?.clientX ?? startX
    const deltaX = endX - startX
    if (Math.abs(deltaX) > 45) {
      if (deltaX < -45) showNext()
      if (deltaX > 45) showPrev()
    }
    touchStartXRef.current = null
  }

  if (!open) return null

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 70 : -70, opacity: 0, scale: 0.985 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -70 : 70, opacity: 0, scale: 0.985 }),
  }

  return (
    <div className="gallery-dialog-overlay" onClick={() => onOpenChange(false)}>
      <div className="gallery-dialog" onClick={(e) => e.stopPropagation()}
        onTouchStart={view === 'viewer' ? handleTouchStart : undefined}
        onTouchEnd={view === 'viewer' ? handleTouchEnd : undefined}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="gallery-dialog-close"
          aria-label="Close gallery"
        >
          <X size={16} />
        </button>

        <AnimatePresence mode="wait">
          {view === 'grid' ? (
            <motion.div
              key="gallery-grid"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="gallery-grid"
            >
              <div className="gallery-grid-inner">
                {images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setCurrentIndex(i); setView('viewer') }}
                    className="gallery-grid-item"
                  >
                    <OptimizedImage
                      src={img || fallbackImage}
                      alt={t('gallery.tourImage', { number: i + 1 })}
                      onError={onImageError}
                      width={1200}
                    />
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="gallery-viewer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="gallery-viewer"
            >
              <p className="gallery-viewer-counter">
                {images.length > 0 ? `${currentIndex + 1} / ${images.length}` : ''}
              </p>
              <button
                type="button"
                onClick={() => setView('grid')}
                className="gallery-viewer-grid-btn"
                aria-label="Back to gallery grid"
              >
                <Grid3X3 size={16} />
              </button>

              <div className="gallery-viewer-main">
                <button
                  type="button"
                  onClick={showPrev}
                  className="gallery-viewer-nav left"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={20} />
                </button>

                <AnimatePresence custom={slideDirection} initial={false} mode="wait">
                  <motion.div
                    key={currentIndex}
                    custom={slideDirection}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="gallery-viewer-image-container"
                  >
                    <OptimizedImage
                      src={images[currentIndex] || fallbackImage}
                       alt={t('gallery.tourImage', { number: currentIndex + 1 })}
                      onError={onImageError}
                      className="gallery-viewer-image"
                      width={1200}
                    />
                  </motion.div>
                </AnimatePresence>

                <button
                  type="button"
                  onClick={showNext}
                  className="gallery-viewer-nav right"
                  aria-label="Next image"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
