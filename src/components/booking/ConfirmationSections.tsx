import { useConfirmationSections } from '../../hooks/useConfirmationSections'
import TourCarouselSection from './TourCarouselSection'
import CountdownTimer from './CountdownTimer'
import './ConfirmationSections.css'

interface ConfirmationSectionsProps {
  tourSlug?: string
  supplierId?: string
  supplierName?: string
  excludeTourId?: string
  cancellationDeadline?: Date | null
}

export default function ConfirmationSections({
  tourSlug,
  supplierId,
  supplierName,
  excludeTourId,
  cancellationDeadline,
}: ConfirmationSectionsProps) {
  const { supplierTours, similarTours, offers, isLoading } = useConfirmationSections(
    tourSlug,
    supplierId,
    excludeTourId,
  )

  const hasAnyData = supplierTours.length > 0 || similarTours.length > 0 || offers.length > 0
  if (!hasAnyData && !isLoading) return null

  return (
    <div className="confirmation-sections-inner">
      {supplierTours.length > 0 && (
        <TourCarouselSection
          title={`More from ${supplierName || 'this supplier'}`}
          viewAllLink={supplierName ? `/supplier/${encodeURIComponent(supplierName)}` : undefined}
          tours={supplierTours}
        />
      )}

      {similarTours.length > 0 && (
        <TourCarouselSection
          title="Similar experiences"
          tours={similarTours}
        />
      )}

      {offers.length > 0 && (
        <TourCarouselSection
          title="Deals for you"
          titleRight={
            cancellationDeadline
              ? <CountdownTimer deadline={cancellationDeadline} />
              : null
          }
          tours={offers}
        />
      )}
    </div>
  )
}
