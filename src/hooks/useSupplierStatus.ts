import { useQuery } from '@tanstack/react-query'
import { useAuthUser } from './useAuthUser'
import { getAuthUserId, getStoredAuthTokens } from '../lib/auth'
import { getSupplierApplicationStatus, isApprovedSupplier, type SupplierProfile } from '../lib/supplier'

/**
 * Reactive supplier-approval status for the signed-in user.
 * Returns isApproved=true only for statuses that can use the
 * Travio Ghana-Supplier platform (APPROVED / ACTIVE). Any failure or a
 * missing application resolves to "not approved" so callers can safely
 * fall back to the regular supplier-acquisition flow.
 */
export function useSupplierStatus() {
  const user = useAuthUser()
  const userId = getAuthUserId(user)
  const hasToken = Boolean(getStoredAuthTokens().accessToken)

  const { data: profile, isLoading } = useQuery<SupplierProfile | null>({
    queryKey: ['supplier', 'status', userId],
    queryFn: getSupplierApplicationStatus,
    enabled: Boolean(userId && hasToken),
    staleTime: 60 * 1000,
    retry: 0,
  })

  return {
    profile: profile ?? null,
    isApproved: isApprovedSupplier(profile?.status),
    isLoading,
  }
}
