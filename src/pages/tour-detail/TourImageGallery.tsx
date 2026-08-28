import { useState, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ArrowLeft, Images } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PhotoViewerModal from './PhotoViewerModal'
import GalleryDialog from './GalleryDialog'
import './TourImageGallery.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

interface TourImageGalleryProps {
  images: string[]
  title: string
  fallbackImage?: string
  showStickyHeader?: boolean
}

export default function TourImageGallery({
  images,
  title,
  fallbackImage,
  showStickyHeader,
}: TourImageGalleryProps) {
  const navigate = useNavigate()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const touchStartXRef = useRef<number | null>(null)
  const thumbnailImages = images.slice(0, 4)

  const showNext = () => {
    if (images.length === 0) return
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const showPrev = () => {
    if (images.length === 0) return
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

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

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.dataset.exhausted) return
    if (fallbackImage && e.currentTarget.src !== fallbackImage) {
      e.currentTarget.src = fallbackImage
      e.currentTarget.dataset.exhausted = 'true'
    }
  }, [fallbackImage])

  return (
    <>
      <div className="tour-image-gallery-new">
        {/* Main image */}
        <div
          className="tour-gallery-main-image"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="tour-gallery-main-track"
            style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
          >
            {images.map((img, idx) => (
              <OptimizedImage
                key={idx}
                src={img || fallbackImage}
                alt={`${title} ${idx + 1}`}
                onError={handleImageError}
                className="tour-gallery-main-slide"
                width={1200}
              />
            ))}
          </div>

          {/* Overlay back button */}
          <div className={`tour-gallery-overlay-top-left ${showStickyHeader ? 'hidden' : ''}`}>
            <button
              type="button"
              onClick={() => { if (window.history.length > 1) { navigate(-1) } else { navigate('/') } }}
              className="tour-gallery-overlay-btn"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>
          </div>

          {/* Nav arrows */}
          <button
            type="button"
            onClick={showPrev}
            className="tour-gallery-nav-arrow left"
            aria-label="Previous image"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={showNext}
            className="tour-gallery-nav-arrow right"
            aria-label="Next image"
          >
            <ChevronRight size={24} />
          </button>

          {/* Mobile dot pagination */}
          <div className="tour-gallery-dots">
            {images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentImageIndex(idx)}
                className={`tour-gallery-dot ${idx === currentImageIndex ? 'active' : ''}`}
                aria-label={`Go to image ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Thumbnail filmstrip */}
        <div className="tour-gallery-thumbnails">
          {thumbnailImages.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentImageIndex(idx)}
              className={`tour-gallery-thumb ${idx === currentImageIndex ? 'active' : ''}`}
              aria-label={`Show image ${idx + 1}`}
            >
              <OptimizedImage
                src={img || fallbackImage}
                alt=""
                onError={handleImageError}
                width={200}
              />
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setCurrentImageIndex(Math.min(4, images.length - 1))
              setIsGalleryOpen(true)
            }}
            className="tour-gallery-thumb tour-gallery-count-tile"
            aria-label={`View all ${images.length} photos`}
          >
            <OptimizedImage
              src={images[4] || images[0] || fallbackImage}
              alt=""
              onError={handleImageError}
              width={200}
            />
            <span className="tour-gallery-count-overlay">
              <Images size={28} strokeWidth={2} />
              <span>{images.length}+</span>
            </span>
          </button>
        </div>
      </div>

      <GalleryDialog
        open={isGalleryOpen}
        onOpenChange={setIsGalleryOpen}
        images={images}
        initialIndex={currentImageIndex}
        fallbackImage={fallbackImage}
        onImageError={handleImageError}
      />

      <PhotoViewerModal
        images={images}
        initialIndex={currentImageIndex}
        isOpen={false}
        onClose={() => {}}
        tourTitle={title}
      />
    </>
  )
}
