import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Info } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useWishlist, type WishlistItem } from '../context/WishlistContext'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import TourCard from '../components/TourCard'
import ContinuePlanningCard, { type ContinuePlanningCardItem } from '../components/ContinuePlanningCard'
import { useSellOutContext } from '../context/SellOutContext'
import { useHomepageOffers } from '../hooks/useHomepageSections'
import type { SpecialOfferData } from '../hooks/useExpeditionTours'
import './Wishlist.css'

const DotLottieReact = lazy(() =>
  import('@lottiefiles/dotlottie-react').then((m) => ({ default: m.DotLottieReact }))
)

/**
 * The dashboard column is max 1200px wide, so the saved grid is 3-up on
 * desktop and 2-up on tablets. Without this descriptor the card's default
 * 50vw assumption makes the browser fetch the 1200w image for a ~370px card.
 * Mobile renders the horizontal Continue Planning card instead of TourCard,
 * so only the tablet/desktop widths appear here.
 */
const CARD_SIZES = '(max-width: 1199px) 50vw, 33vw'

/**
 * A saved tour renders as the very same card the home page uses — features,
 * badges, photos and promo state included — so a tour looks identical before
 * and after saving it. Booking happens on the tour page the card opens; the
 * card itself carries no Book now button.
 *
 * `category`, `features` and the badge fields are absent on items saved
 * before they were captured; empty values make TourCard omit that part of the
 * card rather than invent one.
 *
 * `refreshedOffers` is the tour's current live offer list (from the homepage
 * offers endpoint), preferred over the offer snapshot saved with the item so
 * promos that started or ended after saving are reflected.
 */
function toCardProps(item: WishlistItem, refreshedOffers?: SpecialOfferData[]) {
  return {
    // Canonical /tour/{id}/{slug} — the id first so a retitled tour's saved
    // item keeps working; items stored before slugs were captured fall back to
    // the id-only form the route still resolves.
    id: item.tourId || item.id,
    title: item.title,
    category: item.category ?? '',
    duration: item.duration,
    features: item.features ?? '',
    photos: item.photos,
    price: String(item.price),
    priceValue: item.price,
    rating: String(item.rating),
    reviews: item.reviewCount,
    location: item.location,
    image: item.imageUrl,
    slug: item.slug,
    source: item.source,
    externalUrl: item.externalUrl,
    supplierName: item.supplierName,
    languages: item.languages,
    difficulty: item.difficulty,
    cancellationPolicy: item.cancellationPolicy,
    pickupIncluded: item.pickupIncluded,
    accommodationIncluded: item.accommodationIncluded,
    meetingMode: item.meetingMode,
    discount: item.discount,
    specialOffers: refreshedOffers ?? item.specialOffers,
  }
}

/**
 * On mobile a saved tour renders as the horizontal Continue Planning card
 * instead of the vertical TourCard, so the wishlist matches the card the home
 * page shows on desktop. Offers are handed over as stored and filtered by the
 * card itself, so a snapshot whose date window has passed can never discount
 * the price or raise the "Special Offer" badge.
 */
function toPlanningCardItem(item: WishlistItem, refreshedOffers?: SpecialOfferData[]): ContinuePlanningCardItem {
  return {
    id: item.id,
    tourId: item.tourId,
    title: item.title,
    location: item.location,
    price: item.price,
    duration: item.duration,
    features: item.features,
    imageUrl: item.imageUrl,
    photos: item.photos,
    rating: item.rating,
    reviewCount: item.reviewCount,
    category: item.category,
    supplierName: item.supplierName,
    languages: item.languages,
    difficulty: item.difficulty,
    cancellationPolicy: item.cancellationPolicy,
    pickupIncluded: item.pickupIncluded,
    meetingMode: item.meetingMode,
    source: item.source,
    externalUrl: item.externalUrl,
    slug: item.slug,
    discount: item.discount,
    specialOffers: refreshedOffers ?? item.specialOffers,
  }
}

export default function Wishlist() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { wishlist: wishlistItems } = useWishlist()
  const { isLikelyToSellOut } = useSellOutContext()

  // Same breakpoint the Continue Planning section uses to decide between its
  // horizontal card and the vertical TourCard.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(max-width: 768px)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Live offers for the saved tours. One cached request shares the homepage's
  // offers data; the snapshot captured at save time stays as the fallback for
  // tours the live list doesn't cover (and for first paint / offline).
  const { data: offerTours } = useHomepageOffers(100, wishlistItems.length > 0)
  const offersById = useMemo(() => {
    const map = new Map<string, SpecialOfferData[]>()
    for (const tour of offerTours ?? []) {
      if (tour.id && tour.specialOffers?.length) map.set(tour.id, tour.specialOffers)
    }
    return map
  }, [offerTours])

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
            <Button onClick={() => navigate('/')} className="empty-cta">
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
            {/* Removal is the heart on each card — say so, because the heart
                fills in when saved and nothing else on the page removes a
                tour any more. */}
            <p className="wishlist-hint">
              <Info size={14} aria-hidden="true" />
              {t('wishlist.removeHint')}
            </p>
          </div>

          <div className="wishlist-grid">
            <AnimatePresence>
              {wishlistItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.3 }}
                >
                  {isMobile ? (
                    <ContinuePlanningCard
                      item={toPlanningCardItem(item, item.tourId ? offersById.get(item.tourId) : undefined)}
                      likelyToSellOut={isLikelyToSellOut({ id: item.tourId || item.id, title: item.title })}
                    />
                  ) : (
                    <TourCard
                      {...toCardProps(item, item.tourId ? offersById.get(item.tourId) : undefined)}
                      imageClean
                      sizes={CARD_SIZES}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  )
}
