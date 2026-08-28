import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import './PhotoViewerModal.css'
import OptimizedImage from '@/components/shared/OptimizedImage'
import { transformImage } from '@/lib/image'

interface PhotoViewerModalProps {
  images: string[]
  initialIndex: number
  isOpen: boolean
  onClose: () => void
  tourTitle: string
}

export default function PhotoViewerModal({
  images,
  initialIndex,
  isOpen,
  onClose,
  tourTitle,
}: PhotoViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  // Update current index when initialIndex changes
  useEffect(() => {
    window.setTimeout(() => setCurrentIndex(initialIndex), 0)
  }, [initialIndex])

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }, [images.length])

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }, [images.length])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrevious()
      if (e.key === 'ArrowRight') goToNext()
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, goToPrevious, goToNext, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="photo-viewer-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Header */}
        <div className="photo-viewer-header">
          <h2 className="photo-viewer-title">{tourTitle}</h2>
          <button
            className="photo-viewer-close"
            onClick={onClose}
            aria-label="Close photo viewer"
          >
            <X size={24} />
          </button>
        </div>

        {/* Image Counter */}
        <div className="photo-viewer-counter">
          {currentIndex + 1} / {images.length}
        </div>

        {/* Main Image */}
        <div className="photo-viewer-content" onClick={(e) => e.stopPropagation()}>
          <motion.img
            key={currentIndex}
            src={transformImage(images[currentIndex], { width: 1600, quality: 'auto:good', format: 'auto' }) ?? images[currentIndex]}
            alt={`${tourTitle} - Photo ${currentIndex + 1}`}
            className="photo-viewer-image"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          />

          {/* Navigation Arrows */}
          <button
            className="photo-viewer-nav photo-viewer-nav-prev"
            onClick={(e) => {
              e.stopPropagation()
              goToPrevious()
            }}
            aria-label="Previous photo"
          >
            <ChevronLeft size={32} />
          </button>

          <button
            className="photo-viewer-nav photo-viewer-nav-next"
            onClick={(e) => {
              e.stopPropagation()
              goToNext()
            }}
            aria-label="Next photo"
          >
            <ChevronRight size={32} />
          </button>
        </div>

        {/* Thumbnail Strip */}
        <div className="photo-viewer-thumbnails">
          {images.map((image, index) => (
            <button
              key={index}
              className={`photo-viewer-thumbnail ${index === currentIndex ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setCurrentIndex(index)
              }}
              aria-label={`View photo ${index + 1}`}
            >
              <OptimizedImage src={image} alt={`Thumbnail ${index + 1}`} width={200} />
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
