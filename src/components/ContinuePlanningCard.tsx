import { useMemo } from 'react'
import { tourPath } from '../lib/tourPath'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Star, Heart, Car, Compass, Languages as LanguagesIcon, ShieldCheck, Ban, TrendingUp } from 'lucide-react'
import FormattedPrice from './FormattedPrice'
import { useWishlist, toWishlistItem } from '../context/WishlistContext'
import { getCategoryMeta } from './categoryMeta'
import i18n from '../i18n/config'
import './ContinuePlanningCard.css'
import OptimizedImage from '@/components/shared/OptimizedImage'
import { bestOfferDiscountAmount, filterActiveOffers, type SpecialOfferData } from '../hooks/useExpeditionTours'
import { useCombinedTourStats } from '../hooks/useExternalReviews'

/**
 * Tour fields the horizontal card renders. Both `ContinuePlanningItem` (the
 * homepage rail) and `WishlistItem` (saved tours) satisfy this shape, so the
 * card is shared by the two surfaces without importing either context type.
 */
export interface ContinuePlanningCardItem {
  id: string
  /**
   * Real backend tour ID. Legacy items captured before this field existed have
   * none — the card then falls back to the slug-only `/tour/{slug}` URL the API
   * resolves, instead of building a URL around a synthetic hash.
   */
  tourId?: string
  title: string
  location: string
  price: number
  duration: string
  /** Highlight line snapshot carried on the item; used when the heart adds
      the tour back to the wishlist. Never rendered on the card itself. */
  features?: string
  imageUrl: string
  photos?: string[]
  rating: number
  reviewCount: number
  category?: string
  supplierName?: string | null
  languages?: string[]
  difficulty?: string
  cancellationPolicy?: string
  pickupIncluded?: boolean
  meetingMode?: 'meeting_point' | 'pickup' | 'none'
  source?: 'expedition-go' | 'travio-africa'
  externalUrl?: string
  slug?: string
  discount?: string
  specialOffers?: SpecialOfferData[]
}

function shortCancellation(policy?: string): string {
  if (!policy) return ''
  const lower = policy.toLowerCase()
  if (/non[ -]?refundable/.test(lower)) return 'Non-refundable'
  if (lower.includes('free')) return 'Free cancellation'
  return policy.split(' up to')[0].trim()
}

/**
 * GetYourGuide-style horizontal card: image left, details middle, price right.
 *
 * Used by the Continue Planning carousel on the homepage (desktop/tablet) and
 * by the wishlist's mobile stack. Both map their stored item onto
 * `ContinuePlanningCardItem`; the card itself owns the wishlist heart, the
 * offer price math and the navigation so the two surfaces can never drift.
 */
export default function ContinuePlanningCard({
  item,
  likelyToSellOut,
}: {
  item: ContinuePlanningCardItem
  likelyToSellOut?: boolean
}) {
  const { t } = useTranslation()
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist()
  // The wishlist is keyed by the real tour id; legacy items fall back to their
  // stored id so their existing heart state keeps working.
  const wishlistKey = item.tourId || item.id
  const inWishlist = isInWishlist(wishlistKey)
  // Persisted offer snapshots (e.g. a saved wishlist item) can outlive the
  // offer's date window, so only live offers may discount the price or raise
  // the badge. Live API payloads arrive pre-filtered, so this changes nothing
  // there.
  const liveOffers = useMemo(() => filterActiveOffers(item.specialOffers), [item.specialOffers])
  const hasOfferList = Array.isArray(item.specialOffers) && item.specialOffers.length > 0
  const hasOffer = liveOffers.length > 0
  // Display stats include matched scraped reviews; the stored item keeps the
  // raw in-app stats so re-rendering through the card never double-counts.
  const combinedStats = useCombinedTourStats({
    title: item.title,
    location: item.location,
    supplierName: item.supplierName,
    rating: item.rating,
    reviewCount: item.reviewCount,
  })
  const displayRating = combinedStats.reviewCount > 0 ? combinedStats.rating.toFixed(1) : String(item.rating)
  const displayReviewCount = combinedStats.reviewCount > 0 ? combinedStats.reviewCount : item.reviewCount

  // Canonical /tour/{id}/{slug}. Legacy items have no real id: the
  // single-segment /tour/{slug} form is resolved by the API, while the
  // synthetic hash id is not.
  const slug = item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const url = tourPath(item.tourId ?? null, slug)

  // Opens in a new tab, matching TourCard (the mobile slide and every other
  // tour surface). The title below is the real crawlable <a>; clicks anywhere
  // else on the card route through here.
  const openTour = () => {
    window.open(url, '_blank', 'noopener')
  }

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (inWishlist) {
      removeFromWishlist(wishlistKey)
      // Symmetric with TourCard: the card leaves the page silently otherwise.
      toast.success(i18n.t('common.removedFromWishlist'))
      return
    }
    const wishItem = toWishlistItem({
      // `id` here is the real backend tour id — toWishlistItem treats it as
      // such and falls back to its own hash only when it is absent.
      id: item.tourId,
      title: item.title,
      location: item.location,
      category: item.category ?? '',
      price: item.price > 0 ? `$${item.price}` : '',
      priceValue: item.price > 0 ? item.price : null,
      duration: item.duration,
      features: item.features ?? '',
      image: item.imageUrl,
      photos: item.photos,
      rating: String(item.rating),
      reviews: item.reviewCount,
      source: item.source,
      externalUrl: item.externalUrl,
      slug: item.slug,
      supplierName: item.supplierName,
      languages: item.languages,
      difficulty: item.difficulty,
      cancellationPolicy: item.cancellationPolicy,
      pickupIncluded: item.pickupIncluded,
      meetingMode: item.meetingMode,
      discount: item.discount,
      specialOffers: item.specialOffers,
    })
    addToWishlist(wishItem)
    toast.success(i18n.t('common.addedToWishlist'))
  }

  // Only the first language is shown (mirrors the Step 1 "content language"
  // convention used on TourCard/AllToursPage) — "Guide" is attached so it's
  // unambiguous this is the language the tour guide conducts the experience
  // in, not a language of the page/materials.
  const languageLabel = item.languages?.length ? `${item.languages[0]} Guide` : ''
  const cancellationLabel = shortCancellation(item.cancellationPolicy)
  const isNonRefundable = /non[- ]?refundable/i.test(cancellationLabel)
  const categoryMeta = getCategoryMeta(item.category)

  // GYG-style feature list: small icon + plain text per fact, no pill/chip
  // backgrounds — just an icon-led row so features stay scannable without
  // turning the card into a wall of colored badges.
  const featureFacts: { Icon: typeof Car; label: string; negative?: boolean }[] = [
    ...(item.meetingMode === 'meeting_point'
      ? [{ Icon: Compass as typeof Car, label: t('tourDetail.meetingPoint') }]
      : item.pickupIncluded
        ? [{ Icon: Car, label: t('sections.pickupTitle') }]
        : []),
    ...(languageLabel ? [{ Icon: LanguagesIcon, label: languageLabel }] : []),
    ...(cancellationLabel
      ? [{ Icon: isNonRefundable ? Ban : ShieldCheck, label: cancellationLabel, negative: isNonRefundable }]
      : []),
  ]

  // Offer pricing, mirroring TourCard: the stored price is the FULL price;
  // when a supplier offer (specialOffers) or a percentage discount label
  // applies, strike the original and show the promo price plus a "-X%" chip.
  const originalPrice = item.price
  const promoPrice = useMemo(() => {
    if (!Number.isFinite(originalPrice) || originalPrice <= 0) return null
    if (liveOffers.length > 0) {
      const best = bestOfferDiscountAmount(liveOffers, originalPrice)
      const promo = originalPrice - best
      return best > 0 && promo > 0 && promo < originalPrice ? promo : null
    }
    // Offers exist but none is live: the offer expired and the "-30%" label
    // captured alongside it is equally stale — never resurrect a promo from
    // the label alone.
    if (hasOfferList) return null
    const pct = item.discount?.match(/-?\s*(\d+(?:\.\d+)?)\s*%/)
    if (pct) {
      const promo = originalPrice * (1 - parseFloat(pct[1]) / 100)
      return promo > 0 && promo < originalPrice ? promo : null
    }
    return null
  }, [originalPrice, item.discount, liveOffers, hasOfferList])

  const discountLabel = useMemo(() => {
    if (liveOffers.length > 0 && originalPrice > 0) {
      const best = bestOfferDiscountAmount(liveOffers, originalPrice)
      if (best > 0) {
        const pct = Math.round((best / originalPrice) * 100)
        if (pct > 0) return `-${pct}%`
      }
    }
    // A discount label backed by an offer list only shows while its offer is
    // live; labels on tours with no offer data are trusted as-is.
    if (item.discount && (!hasOfferList || liveOffers.length > 0)) return item.discount
    return ''
  }, [liveOffers, hasOfferList, item.discount, originalPrice])

  return (
    <div
      className="cp-card"
      onClick={openTour}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        // Key presses raised on the nested title link / wishlist button belong
        // to those controls — handling them here too would open the tour on top
        // of the control's own activation (and double-open the title link).
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openTour()
        }
      }}
    >
      {discountLabel && <span className="cp-card-discount-chip">{discountLabel}</span>}
      <div className="cp-card-media">
        {item.source === 'travio-africa' && (
          <div className="cp-card-source-badge">
            <img src="/travio_logo.png" alt="Travio Africa" />
          </div>
        )}
        <OptimizedImage src={item.imageUrl} alt={item.title} width={400} />
        {categoryMeta && (
          <span className={`cp-card-type-badge cp-card-type-badge-${categoryMeta.variant}`}>
            <categoryMeta.Icon size={11} strokeWidth={2.4} />
            {categoryMeta.label}
          </span>
        )}
        <button
          type="button"
          className={`cp-card-wishlist${inWishlist ? ' wishlist-active' : ''}`}
          onClick={handleWishlist}
          aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart size={14} fill={inWishlist ? 'currentColor' : 'none'} strokeWidth={2} />
        </button>
      </div>

      <div className="cp-card-content">
        <h3 className="cp-card-title">
          <a
            href={url}
            target="_blank"
            rel="noopener"
            // The card body's own handler opens a new tab too; stopping
            // propagation keeps the title's native navigation from opening two.
            onClick={(e) => e.stopPropagation()}
          >
            {item.title}
          </a>
        </h3>

        {item.duration && <p className="cp-card-duration">{item.duration}</p>}

        {hasOffer ? (
          <span className="cp-card-special-offer">{t('card.specialOffer')}</span>
        ) : likelyToSellOut ? (
          <span className="cp-card-sellout-tag">
            <TrendingUp size={11} strokeWidth={2.4} />
            {t('card.likelyToSellOut')}
          </span>
        ) : null}

        {featureFacts.length > 0 && (
          <ul className="cp-card-facts">
            {featureFacts.map(({ Icon, label, negative }, i) => (
              <li key={i} className={negative ? 'cp-card-fact-negative' : undefined}>
                <Icon size={12} strokeWidth={2.2} />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="cp-card-rating">
          <Star size={17} className="cp-card-star" fill="currentColor" stroke="currentColor" strokeWidth={1} />
          <span className="cp-card-rating-value">{displayRating}</span>
          {displayReviewCount > 0 && <span className="cp-card-rating-count">({displayReviewCount})</span>}
        </div>
      </div>

      <div className="cp-card-price-col">
        <span className="cp-card-from">{t('common.from')}</span>
        {promoPrice != null ? (
          <span className="cp-card-price">
            <span className="cp-card-price-strike"><FormattedPrice usdPrice={originalPrice} /></span>
            <span className="cp-card-price-promo"><FormattedPrice usdPrice={promoPrice} /></span>
          </span>
        ) : (
          <span className="cp-card-price">
            <FormattedPrice usdPrice={originalPrice} />
          </span>
        )}
      </div>
    </div>
  )
}
