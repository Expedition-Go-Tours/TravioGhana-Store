import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Calendar, Loader2, MapPin, Ticket, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useExpeditionBookingDetail, useUpdateBookingPickup } from '../hooks/useExpeditionBookings'
import { extractMeetingInfo } from '../hooks/useExpeditionTours'
import { useResolvedTourPoints } from '../hooks/useResolvedTourPoints'
import { useAuthUser } from '../hooks/useAuthUser'
import PickupLocationSection from '../components/booking/PickupLocationSection'
import PickupSelectModal from '../components/booking/PickupSelectModal'
import MapErrorBoundary from '../components/booking/MapErrorBoundary'
import {
  hasLocationOnlyAreas,
  isPickupLocationSatisfied,
  pickupZoneStatus,
  type PickupAreaShape,
} from '../lib/pickupZone'
import type { ResolveTourSource } from '../lib/resolvePoints'

interface ContactPickup {
  location: string
  pickupLater: boolean
  pickupLat: number | null
  pickupLng: number | null
  pickupArea: string
}

const DEFAULT_CONTACT: ContactPickup = {
  location: '',
  pickupLater: false,
  pickupLat: null,
  pickupLng: null,
  pickupArea: '',
}

const fmtDate = (value?: string): string => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function seedContactFromPickup(pickup: unknown): ContactPickup {
  const p = (pickup && typeof pickup === 'object' ? pickup : {}) as Record<string, unknown>
  const addr =
    p.address && typeof p.address === 'object'
      ? (p.address as Record<string, unknown>)
      : {}
  const addrName = String(addr.name || addr.address || '')
  const hasStoredPlace = !!(p.place || p.locationName || p.areaName || addrName)
  // Genuine "choose later" (no stored place) resets to deferred. An out-of-zone
  // choice is also flagged deferred but keeps its address — seed it so
  // re-opening the editor shows the traveller's chosen location.
  if ((p.pickupLater || p.skipValidation) && !hasStoredPlace) {
    return { ...DEFAULT_CONTACT, pickupLater: true }
  }
  const lat =
    typeof p.lat === 'number' && Number.isFinite(p.lat)
      ? Number(p.lat)
      : typeof addr.lat === 'number' && Number.isFinite(addr.lat)
        ? Number(addr.lat)
        : null
  const lng =
    typeof p.lng === 'number' && Number.isFinite(p.lng)
      ? Number(p.lng)
      : typeof addr.lng === 'number' && Number.isFinite(addr.lng)
        ? Number(addr.lng)
        : null
  return {
    ...DEFAULT_CONTACT,
    pickupArea: String(p.areaName || ''),
    location: String(p.place || p.locationName || addrName || ''),
    pickupLat: lat,
    pickupLng: lng,
  }
}

export default function BookingPickupPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const navigate = useNavigate()
  const user = useAuthUser()

  const { data: booking, isLoading, isError } = useExpeditionBookingDetail(bookingId)
  const updatePickup = useUpdateBookingPickup()

  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [showMapModal, setShowMapModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // The tour's pickup config (zones / locations / pickupType) — read from the
  // booking's own tour via the same helper Booking History uses, so the
  // supplier's pickup rules apply here exactly as at checkout.
  const meeting = useMemo(() => extractMeetingInfo(booking?.tour ?? {}), [booking])
  const pickupTour = meeting as unknown as PickupLocationSectionTourLoose

  const tour = booking?.tour ?? ({} as Record<string, unknown>)
  const showPickupLocation =
    meeting.meetingMode === 'pickup' || (tour as { pickupIncluded?: boolean }).pickupIncluded === true

  const pickupAreas = useMemo(
    () => (Array.isArray(pickupTour.pickupAreas) ? pickupTour.pickupAreas : []),
    [pickupTour.pickupAreas],
  )
  const pickupLocations = useMemo(
    () => (Array.isArray(pickupTour.pickupLocations) ? pickupTour.pickupLocations : []),
    [pickupTour.pickupLocations],
  )

  const [contact, setContact] = useState<ContactPickup>(() => seedContactFromPickup(booking?.pickup))

  const handleContactChange = (key: string, value: string | boolean | number | null) => {
    setContact((prev) => ({ ...prev, [key]: value }))
  }

  const zonesDrawn = useMemo(
    () => pickupAreas.some((a: PickupAreaShape) => !!a && Array.isArray(a.polygon) && a.polygon.length >= 3),
    [pickupAreas],
  )
  const hasPointAreas = useMemo(() => hasLocationOnlyAreas(pickupAreas), [pickupAreas])
  const pickupZoneStatusValue = useMemo(
    () =>
      showPickupLocation && !contact.pickupLater
        ? pickupZoneStatus({ name: contact.location, lat: contact.pickupLat, lng: contact.pickupLng }, pickupAreas)
        : 'none',
    [showPickupLocation, contact.pickupLater, contact.location, contact.pickupLat, contact.pickupLng, pickupAreas],
  )
  const noPickupConfig = showPickupLocation && pickupAreas.length === 0 && pickupLocations.length === 0
  // Single designated pickup point: nothing to choose (the section shows it
  // read-only and auto-fills it), so the form is always valid.
  const isSinglePoint = pickupLocations.length === 1 && pickupAreas.length === 0
  const pickupLocationValid = useMemo(
    () =>
      !showPickupLocation ||
      noPickupConfig ||
      isSinglePoint ||
      isPickupLocationSatisfied({
        pickupLater: contact.pickupLater,
        pickedArea: contact.pickupArea,
        typed: contact.location,
        status: pickupZoneStatusValue,
        zonesDrawn,
        hasLocationOnlyAreas: hasPointAreas,
      }),
    [showPickupLocation, noPickupConfig, isSinglePoint, contact.pickupLater, contact.pickupArea, contact.location, pickupZoneStatusValue, zonesDrawn, hasPointAreas],
  )

  const { points: resolvedPoints, mapTour, loading: resolvingPoints } = useResolvedTourPoints(pickupTour as ResolveTourSource)

  // Guards: must own a pickup-offering booking that is still editable.
  const bookingStatus = String(booking?.status || '')
  const isEditable = ['PENDING', 'CONFIRMED'].includes(bookingStatus)
  const travelDate = booking?.travelDate ? new Date(booking.travelDate) : null
  // Page-load snapshot; the backend re-validates the cutoff authoritatively.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const isFuture = travelDate != null && !Number.isNaN(travelDate.getTime()) && travelDate.getTime() > now
  const isEligible = showPickupLocation && isEditable && isFuture

  const buildSelection = (): Record<string, unknown> | null => {
    if (contact.pickupLater) return { skipValidation: true }
    // Explicit exclusion (no-pickup) zones are still rejected by the server
    // even with skipValidation, so they cannot be saved.
    if (pickupZoneStatusValue === 'excluded') return null
    const hasPickupAddress =
      contact.pickupLat != null && contact.pickupLng != null && contact.location.trim().length > 0
    // An out-of-zone address is allowed with skipValidation; the address is
    // still stored so the supplier sees the traveller's chosen location.
    const pickupOutOfZone = pickupZoneStatusValue === 'outside'
    if (showPickupLocation && (contact.pickupArea || hasPickupAddress)) {
      return {
        mode: zonesDrawn || hasPointAreas ? 'area' : (pickupTour.pickupType as 'area' | 'address') || 'area',
        ...(pickupOutOfZone ? { skipValidation: true } : {}),
        ...(!hasPickupAddress && contact.pickupArea ? { areaName: contact.pickupArea } : {}),
        ...(hasPickupAddress
          ? { address: { name: contact.location.trim(), address: contact.location.trim(), lat: contact.pickupLat, lng: contact.pickupLng } }
          : {}),
      }
    }
    return null
  }

  const handleSave = async (defer: boolean) => {
    setSaveError(null)
    if (defer) {
      setSaving(true)
      try {
        await updatePickup.mutateAsync({ id: bookingId!, pickup: { skipValidation: true } })
        toast.success('We’ll arrange pickup with you shortly.')
        navigate(`/booking/confirmation/${bookingId}`)
      } catch (err) {
        setSaveError((err as Error).message)
      } finally {
        setSaving(false)
      }
      return
    }

    const selection = buildSelection()
    if (!selection) {
      setSaveError('Please choose a pickup location, or choose to arrange it later.')
      setTouched((t) => ({ ...t, location: true }))
      return
    }
    setSaving(true)
    try {
      await updatePickup.mutateAsync({ id: bookingId!, pickup: selection })
      toast.success('Pickup details saved.')
      navigate(`/booking/confirmation/${bookingId}`)
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <MapPin className="mx-auto size-10 text-slate-300" />
          <h1 className="mt-4 text-lg font-bold text-slate-900">Sign in to manage your pickup</h1>
          <p className="mt-2 text-sm text-slate-500">Log in to choose or update your pickup location.</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-emerald-50/40 px-6 py-5">
            <h1 className="text-xl font-bold text-slate-900">Manage your pickup</h1>
            <p className="mt-1 text-sm text-slate-500">
              Choose a pickup location, or let us arrange it with you later.
            </p>
          </div>

          <div className="grid gap-4 border-b border-slate-100 px-6 py-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Experience</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {(booking?.tour as { title?: string })?.title || '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Date</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <Calendar className="size-3.5 text-slate-400" />
                {fmtDate(booking?.travelDate)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Confirmation</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <Ticket className="size-3.5 text-slate-400" />
                {booking?.bookingNumber}
              </p>
            </div>
          </div>

          <div className="px-6 py-6">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                <Loader2 className="size-4 animate-spin" />
                Loading your booking…
              </div>
            )}

            {!isLoading && (isError || !booking) && (
              <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                We couldn’t load this booking. It may not exist or isn’t yours.
              </p>
            )}

            {!isLoading && booking && !isEligible && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center">
                <p className="text-sm font-semibold text-amber-800">
                  {!showPickupLocation
                    ? 'This tour doesn’t include pickup.'
                    : !isEditable
                      ? `Pickup can no longer be updated for a ${String(bookingStatus).toLowerCase()} booking.`
                      : 'Pickup can only be updated before the activity date.'}
                </p>
                <button
                  onClick={() => navigate(`/booking/confirmation/${bookingId}`)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:brightness-110"
                >
                  View booking
                </button>
              </div>
            )}

            {!isLoading && booking && isEligible && (
              <div className="space-y-5">
                <PickupLocationSection
                  tour={pickupTour}
                  contact={contact}
                  onContactChange={handleContactChange}
                  locationValid={pickupLocationValid}
                  touched={touched}
                  onSetTouched={setTouched}
                  resolvedPoints={resolvedPoints}
                  mapTour={mapTour as ResolveTourSource}
                  resolvingPoints={resolvingPoints}
                  onOpenMap={() => setShowMapModal(true)}
                />

                {saveError && (
                  <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">{saveError}</p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                    Arrange pickup later
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSave(false)}
                    disabled={saving || !pickupLocationValid}
                    className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed ${
                      pickupLocationValid ? 'bg-emerald-600 hover:brightness-110' : 'bg-slate-300'
                    }`}
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Save pickup location
                  </motion.button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showMapModal && (
          <MapErrorBoundary resetKey={mapTour || pickupTour}>
            <PickupSelectModal
              open={showMapModal}
              onClose={() => setShowMapModal(false)}
              tour={pickupTour}
              points={resolvedPoints}
              mapTour={mapTour as ResolveTourSource}
              contact={contact}
              onContactChange={handleContactChange}
              loading={resolvingPoints}
            />
          </MapErrorBoundary>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Loose type for the flattened pickup-tour built by extractMeetingInfo. */
type PickupLocationSectionTourLoose = {
  id?: string
  slug?: string
  meetingMode?: 'meeting_point' | 'pickup' | 'none'
  meetingPoint?: string
  meetingPointAddress?: string
  meetingPointLat?: number | null
  meetingPointLng?: number | null
  pickupType?: 'area' | 'address'
  pickupTiming?: 'at_start' | 'before_start'
  pickupFinalLocationTiming?: 'day_before' | 'after_selection'
  referenceStartTime?: string
  pickupAreas?: PickupAreaShape[]
  pickupLocations?: { name?: string; address?: string; lat?: number | null; lng?: number | null }[]
  pickupDescription?: string
  [key: string]: unknown
}
