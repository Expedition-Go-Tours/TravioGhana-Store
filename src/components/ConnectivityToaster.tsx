import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Toaster, toast } from 'react-hot-toast'
import useOnlineStatus from '../hooks/useOnlineStatus'

/**
 * One toast id: going offline/online updates the same toast in place instead
 * of stacking a second one on top.
 */
const CONNECTIVITY_TOAST_ID = 'connectivity'

/**
 * Connectivity status toasts ("currently offline" / "currently online"),
 * rendered by react-hot-toast at the bottom of the screen. Sonner keeps
 * handling every other toast in the app — this dedicated toaster exists so
 * connectivity messages can be tinted red/green and stay sticky while the
 * visitor is offline.
 */
export default function ConnectivityToaster() {
  const online = useOnlineStatus()
  const { t } = useTranslation()
  // Tracked so the "online" toast only appears after the visitor actually saw
  // the offline one — a normal page load must stay silent.
  const wasOffline = useRef(!online)

  useEffect(() => {
    if (!online) {
      wasOffline.current = true
      toast.error(t('connectivity.offline'), {
        id: CONNECTIVITY_TOAST_ID,
        // Sticky: stays on screen until connectivity returns.
        duration: Infinity,
      })
      return
    }

    if (wasOffline.current) {
      wasOffline.current = false
      // Same id turns the sticky red toast green in place, then this finite
      // duration lets it auto-dismiss.
      toast.success(t('connectivity.online'), {
        id: CONNECTIVITY_TOAST_ID,
        duration: 2500,
      })
    }
  }, [online, t])

  return (
    <Toaster
      position="bottom-center"
      toastOptions={{
        error: {
          style: {
            background: 'var(--bv-danger-bg, #fef3f2)',
            color: 'var(--bv-danger-text, #b42318)',
          },
        },
        success: {
          style: {
            background: 'var(--bv-success-bg, #ecfdf3)',
            color: 'var(--bv-success-text, #067647)',
          },
        },
      }}
    />
  )
}
