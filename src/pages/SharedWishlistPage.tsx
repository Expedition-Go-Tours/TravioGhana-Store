import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Heart, Share2, Compass } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fetchSharedWishlist } from '../lib/storefrontExtras'
import { mapRawTourToListing } from '../hooks/useExpeditionTours'
import TourCard from '../components/TourCard'
import SEO from '../components/SEO'
import Footer from '../components/Footer'
import './SharedWishlistPage.css'

/**
 * A wishlist someone shared with you.
 *
 * Read-only and public: the opaque token is the only credential, so the page
 * renders for anyone holding the link — which is the point, since the link is
 * meant to travel through a WhatsApp group. No account, no personal details
 * about the owner, just the tours and a way to book them.
 *
 * `noindex` because a share URL is a per-user document; it must never enter
 * the search index as someone's private list.
 */
export default function SharedWishlistPage() {
  const { t } = useTranslation()
  const { token = '' } = useParams<{ token: string }>()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['shared-wishlist', token],
    queryFn: () => fetchSharedWishlist(token),
    enabled: !!token,
    retry: false,
    staleTime: 60 * 1000,
  })

  const tours = useMemo(() => (data ?? []).map(mapRawTourToListing), [data])

  if (isError) {
    return (
      <div className="shared-wishlist-page">
        <SEO
          title="Wishlist unavailable"
          description="This wishlist link is no longer available."
          robots="noindex, nofollow"
        />
        <div className="shared-wishlist-state">
          <Heart size={40} aria-hidden="true" />
          <h1>{t('sharedWishlist.goneTitle', 'This link is no longer available')}</h1>
          <p>{t('sharedWishlist.goneBody', 'The list may have been unshared or has expired. Start your own instead.')}</p>
          <Link className="shared-wishlist-cta" to="/tours">
            <Compass size={16} aria-hidden="true" />
            {t('sharedWishlist.browse', 'Browse experiences')}
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="shared-wishlist-page">
      <SEO
        title={t('sharedWishlist.seoTitle', 'Experiences saved on Travio Ghana')}
        description={t('sharedWishlist.seoDescription', 'A curated list of Ghana tours and experiences, saved and shared on Travio Ghana.')}
        robots="noindex, nofollow"
      />

      <header className="shared-wishlist-hero">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <span className="shared-wishlist-eyebrow">
            <Share2 size={14} aria-hidden="true" />
            {t('sharedWishlist.eyebrow', 'Shared with you')}
          </span>
          <h1>{t('sharedWishlist.title', 'A wishlist worth stealing')}</h1>
          <p>
            {t('sharedWishlist.subtitle', 'Someone saved these Ghana experiences. Tap any card to see the details and book it.')}
          </p>
        </motion.div>
      </header>

      <div className="shared-wishlist-body">
        {isLoading ? (
          <div className="shared-wishlist-grid" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="shared-wishlist-skeleton" />
            ))}
          </div>
        ) : tours.length === 0 ? (
          <div className="shared-wishlist-state">
            <Heart size={36} aria-hidden="true" />
            <h2>{t('sharedWishlist.emptyTitle', 'Nothing saved yet')}</h2>
            <p>{t('sharedWishlist.emptyBody', 'This list is empty right now. Check back later, or start your own.')}</p>
            <Link className="shared-wishlist-cta" to="/tours">
              <Compass size={16} aria-hidden="true" />
              {t('sharedWishlist.browse', 'Browse experiences')}
            </Link>
          </div>
        ) : (
          <div className="shared-wishlist-grid">
            {tours.map((tour) => (
              <TourCard
                key={tour.id}
                {...tour}
                imageClean
                priority={false}
                sizes="(max-width: 767px) 92vw, (max-width: 1199px) 45vw, 30vw"
              />
            ))}
          </div>
        )}

        <div className="shared-wishlist-footer-cta">
          <p>{t('sharedWishlist.makeOwn', 'Made your own shortlist?')}</p>
          <Link className="shared-wishlist-cta" to="/wishlist">
            <Heart size={16} aria-hidden="true" />
            {t('sharedWishlist.openWishlist', 'Open my wishlist')}
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  )
}
