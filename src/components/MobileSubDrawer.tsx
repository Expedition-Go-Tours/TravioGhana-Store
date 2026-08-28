import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Check, CheckCheck, Globe, DollarSign } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n/config'
import { useCurrency, availableCurrencies } from '../contexts/CurrencyContext'
import { LANGUAGES } from './LanguageCurrencyModal'
import { fetchWithAuth } from '../lib/api'

export type SubDrawerTab = 'language' | 'currency' | 'updates'

interface SubDrawerProps {
  tab: SubDrawerTab | null
  onClose: () => void
  onNavigate: (path: string) => void
}

interface PreviewNotification {
  id: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function MobileSubDrawer({ tab, onClose, onNavigate }: SubDrawerProps) {
  const { t } = useTranslation()
  const { currency, setCurrency } = useCurrency()
  const [notifications, setNotifications] = useState<PreviewNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [markedAllRead, setMarkedAllRead] = useState(false)

  useEffect(() => {
    if (tab !== 'updates') return
    let cancelled = false
    setLoading(true)
    setMarkedAllRead(false)
    setNotifications([])
    ;(async () => {
      try {
        const res = await fetchWithAuth('/notifications?page=1&limit=5')
        if (!res.ok || cancelled) return
        const payload = await res.json().catch(() => ({}))
        const data = payload.data ?? payload
        if (!cancelled) setNotifications(data.notifications ?? [])
      } catch {
        /* transient */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab])

  const markAllRead = useCallback(() => {
    fetchWithAuth('/notifications/mark-all-read', { method: 'PATCH' }).catch(() => {})
    setNotifications([])
    setMarkedAllRead(true)
  }, [])

  const title = tab === 'language' ? t('nav.language') : tab === 'currency' ? t('nav.currency') : t('nav.updates', 'Updates')

  return (
    <AnimatePresence>
      {tab && (
        <>
          <motion.div
            className="nav-subdrawer-overlay"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className="nav-subdrawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="nav-subdrawer-header">
              <div className="nav-subdrawer-title-wrap">
                {tab === 'language' && <Globe size={20} />}
                {tab === 'currency' && <DollarSign size={20} />}
                <h3 className="nav-subdrawer-title">{title}</h3>
              </div>
              <button type="button" className="nav-subdrawer-close" onClick={onClose} aria-label="Close">
                <X size={22} />
              </button>
            </div>

            {tab === 'language' && (
              <div className="nav-subdrawer-list">
                {LANGUAGES.map((lang) => {
                  const active = i18n.language.substring(0, 2) === lang.code
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      className={`nav-subdrawer-item${active ? ' active' : ''}`}
                      onClick={() => {
                        i18n.changeLanguage(lang.code)
                        onClose()
                      }}
                    >
                      <span className="nav-subdrawer-item-symbol">{lang.flag}</span>
                      <span className="nav-subdrawer-item-label">{t(`languages.${lang.code}`)}</span>
                      {active && <Check size={18} className="nav-subdrawer-check" />}
                    </button>
                  )
                })}
              </div>
            )}

            {tab === 'currency' && (
              <div className="nav-subdrawer-list">
                {availableCurrencies.map((c) => {
                  const active = currency.code === c.code
                  return (
                    <button
                      key={c.code}
                      type="button"
                      className={`nav-subdrawer-item${active ? ' active' : ''}`}
                      onClick={() => {
                        setCurrency(c.code)
                        onClose()
                      }}
                    >
                      <span className="nav-subdrawer-item-symbol">{c.symbol}</span>
                      <span className="nav-subdrawer-item-label">
                        <span className="nav-subdrawer-item-code">{c.code}</span>
                        <span className="nav-subdrawer-item-sub">{c.label}</span>
                      </span>
                      {active && <Check size={18} className="nav-subdrawer-check" />}
                    </button>
                  )
                })}
              </div>
            )}

            {tab === 'updates' && (
              <>
                <button type="button" className="nav-subdrawer-mark-read" onClick={markAllRead}>
                  <CheckCheck size={14} />
                  {t('nav.markAllAsRead', 'Mark all as read')}
                </button>
                <div className="nav-subdrawer-list">
                  {loading ? (
                    <div className="nav-subdrawer-empty">Loading updates…</div>
                  ) : notifications.length === 0 ? (
                    <div className="nav-subdrawer-empty">
                      {markedAllRead
                        ? t('nav.allCaughtUp', 'You are all caught up.')
                        : t('nav.noUpdates', 'No updates yet.')}
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className="nav-updates-preview"
                        onClick={() => onNavigate('/dashboard/notifications')}
                      >
                        <div className="nav-updates-preview-top">
                          {!n.read && <span className="nav-updates-dot" />}
                          <span className="nav-updates-preview-title">{n.title}</span>
                          <span className="nav-updates-preview-time">{timeAgo(n.createdAt)}</span>
                        </div>
                        <p className="nav-updates-preview-msg">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
