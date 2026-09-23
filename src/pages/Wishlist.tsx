import { useState, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { useWishlist, type WishlistItem } from '../context/WishlistContext'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useCurrency } from '../contexts/CurrencyContext'
import './Wishlist.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

const DotLottieReact = lazy(() =>
  import('@lottiefiles/dotlottie-react').then((m) => ({ default: m.DotLottieReact }))
)

export default function Wishlist() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { wishlist: wishlistItems, removeFromWishlist } = useWishlist()
  const { formatPrice } = useCurrency()
  const [removingId, setRemovingId] = useState<string | null>(null)

  const handleRemove = (id: string) => {
    setRemovingId(id)
    removeFromWishlist(id)
    toast.success(t('common.removedFromWishlist'))
  }

  const handleBookNow = (item: WishlistItem) => {
    const slug = item.tourId || item.id
    navigate(`/tour/${encodeURIComponent(slug)}`)
  }

  return (
    <div className="wishlist-container">
      {wishlistItems.length === 0 ? (
        <motion.div
          className="empty-state"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
          }}
        >
          {/* Wishlist Lottie animation */}
          <motion.div
            className="empty-icon-wrap"
            variants={{
              hidden: { opacity: 0, scale: 0.6 },
              visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 200, damping: 14 } },
            }}
          >
            <Suspense fallback={<div className="empty-lottie-placeholder" />}>
              <DotLottieReact
                src="/animations/wishlist-empty.lottie"
                loop
                autoplay
                className="wishlist-lottie"
              />
            </Suspense>
          </motion.div>

          <motion.h3
            className="empty-title"
            variants={{
              hidden: { opacity: 0, y: 12 },
              visible: { opacity: 1, y: 0 },
            }}
          >
            {t('wishlist.empty')}
          </motion.h3>
          <motion.p
            className="empty-text"
            variants={{
              hidden: { opacity: 0, y: 12 },
              visible: { opacity: 1, y: 0 },
            }}
          >
            {t('wishlist.emptyDesc')}
          </motion.p>
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              visible: { opacity: 1, y: 0 },
            }}
          >
            <Button onClick={() => window.location.href = '/'} className="empty-cta">
              {t('wishlist.exploreTours')}
            </Button>
          </motion.div>
        </motion.div>
      ) : (
        <>
          <div className="wishlist-header">
            <div className="wishlist-count">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span>{wishlistItems.length} {wishlistItems.length === 1 ? t('wishlist.tourSaved') : t('wishlist.toursSaved')}</span>
            </div>
          </div>

          <div className="wishlist-grid">
            <AnimatePresence>
              {wishlistItems.map((item) => (
                <motion.div
                  key={item.id}
                  className="wishlist-card"
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="wishlist-card-image">
                    <OptimizedImage
                      src={item.imageUrl}
                      alt={item.title}
                      className="wishlist-img"
                      width={400}
                      height={250}
                    />
                    <button
                      className="wishlist-remove-btn"
                      onClick={() => handleRemove(item.id)}
                      disabled={removingId === item.id}
                      aria-label={t('common.remove')}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  </div>
                  <div className="wishlist-card-content">
                    <h3 className="wishlist-card-title">{item.title}</h3>
                    <p className="wishlist-card-location">{item.location}</p>
                    <div className="wishlist-card-footer">
                      <span className="wishlist-card-price">
                        {formatPrice(item.price)}
                      </span>
                      <Button
                        onClick={() => handleBookNow(item)}
                        className="wishlist-book-btn"
                        size="sm"
                      >
                        {t('tourDetail.bookNow')}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  )
}



