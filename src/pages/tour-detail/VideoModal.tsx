import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import './VideoModal.css'

interface VideoModalProps {
  videoUrl: string | undefined
  isOpen: boolean
  onClose: () => void
  tourTitle: string
}

export default function VideoModal({ videoUrl, isOpen, onClose, tourTitle }: VideoModalProps) {
  // Extract YouTube video ID from URL
  const getYouTubeEmbedUrl = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
    const match = url.match(regExp)
    const videoId = match && match[2].length === 11 ? match[2] : null
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : null
  }

  const embedUrl = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null

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

  // Keyboard navigation (ESC to close)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !embedUrl) return null

  return (
    <AnimatePresence>
      <motion.div
        className="video-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="video-modal-header">
            <h2 className="video-modal-title">{tourTitle}</h2>
            <button
              className="video-modal-close"
              onClick={onClose}
              aria-label="Close video"
            >
              <X size={24} />
            </button>
          </div>

          {/* Video Container */}
          <div className="video-modal-player">
            <iframe
              src={embedUrl}
              title={`${tourTitle} - Video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
