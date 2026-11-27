import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  dashboardError,
  useDeleteVenuePhoto,
  useReorderVenuePhotos,
  useSetVenueCoverPhoto,
  useUpdateVenuePhoto,
  useUploadVenuePhotos,
  useVenuePhotos,
  type DashboardSession,
} from '../../../hooks/useRestaurantDashboard'
import { useOutletContext } from 'react-router-dom'
import {
  DashboardPageHeader,
  EmptyState,
  ErrorBlock,
  InfoNote,
  LoadingBlock,
  PhotoGrid,
  PhotoUploader,
} from './components'

export default function DashboardPhotos() {
  const { slug = '' } = useParams<{ slug: string }>()
  const session = useOutletContext<DashboardSession>()
  const photos = useVenuePhotos(slug)
  const upload = useUploadVenuePhotos(slug)
  const update = useUpdateVenuePhoto(slug)
  const reorder = useReorderVenuePhotos(slug)
  const setCover = useSetVenueCoverPhoto(slug)
  const remove = useDeleteVenuePhoto(slug)

  const canManage = session.permissions.includes('photos.manage')

  return (
    <>
      <DashboardPageHeader
        eyebrow="Photos"
        title="Photo library"
        description="Upload, caption and order the images diners see on your listing."
      />

      <InfoNote>
        New uploads wait for the Travio team before they appear publicly. Rejected photos stay in your
        library with their reason so you can fix and re-upload them.
      </InfoNote>

      {canManage && (
        <section className="rd-section" aria-label="Add photos">
          <PhotoUploader
            pending={upload.isPending}
            onUpload={(files) =>
              upload.mutate(files, {
                onSuccess: () => toast.success(`${files.length} photo${files.length === 1 ? '' : 's'} sent for review.`),
                onError: (error) => toast.error(dashboardError(error)),
              })
            }
          />
        </section>
      )}

      {photos.isPending ? (
        <LoadingBlock label="Loading photos…" />
      ) : photos.isError ? (
        <ErrorBlock message={dashboardError(photos.error)} onRetry={() => void photos.refetch()} />
      ) : photos.data.photos.length === 0 ? (
        <EmptyState
          title="No photos yet"
          description="Add at least three good images: the room, the food and the welcome."
        />
      ) : (
        <section className="rd-section" aria-labelledby="rd-library-title">
          <div className="rd-section__head">
            <h2 id="rd-library-title">Your photos</h2>
            <span>
              {photos.data.counts.published} live · {photos.data.counts.pending} in review ·{' '}
              {photos.data.counts.rejected} rejected · {photos.data.counts.total}/{photos.data.limit}
            </span>
          </div>
          <PhotoGrid
            photos={photos.data.photos}
            coverPhoto={photos.data.coverPhoto}
            canManage={canManage}
            reorderPending={reorder.isPending}
            onReorder={(ids) =>
              reorder.mutate(ids, {
                onSuccess: () => toast.success('Gallery order saved.'),
                onError: (error) => toast.error(dashboardError(error)),
              })
            }
            onCover={(photoId) =>
              setCover.mutate(photoId, {
                onSuccess: () => toast.success('Cover photo updated.'),
                onError: (error) => toast.error(dashboardError(error)),
              })
            }
            onCaption={(photo) =>
              update.mutate(
                { photoId: photo.id, caption: photo.caption },
                {
                  onSuccess: () => toast.success('Caption saved.'),
                  onError: (error) => toast.error(dashboardError(error)),
                },
              )
            }
            onDelete={(photoId) =>
              remove.mutate(photoId, {
                onSuccess: () => toast.success('Photo deleted.'),
                onError: (error) => toast.error(dashboardError(error)),
              })
            }
          />
        </section>
      )}
    </>
  )
}
