import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchCancellationChoicePreview,
  submitCancellationChoice,
  type CancellationChoicePreview,
} from '../lib/cancellationChoice'

/**
 * Preview for the public /cancellation-choice page (one-time token taken from
 * the `?token=` query string). Never retried: a bad/expired token must surface
 * its backend `{ message }` immediately instead of hammering the endpoint.
 */
export function useCancellationChoicePreview(token: string | null) {
  return useQuery<CancellationChoicePreview>({
    queryKey: ['cancellation-choice', token],
    queryFn: ({ signal }) => fetchCancellationChoicePreview(token as string, signal),
    enabled: Boolean(token),
    retry: false,
    staleTime: 0,
    gcTime: 5 * 60_000,
  })
}

/** Submits the customer's decision (REFUND or RESCHEDULE). */
export function useSubmitCancellationChoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: submitCancellationChoice,
    onSuccess: () => {
      // The booking list must immediately reflect the answer (banner off,
      // muted "You chose …" line on), and the preview becomes read-only.
      void queryClient.invalidateQueries({ queryKey: ['expedition', 'bookings'] })
      void queryClient.invalidateQueries({ queryKey: ['cancellation-choice'] })
    },
  })
}
