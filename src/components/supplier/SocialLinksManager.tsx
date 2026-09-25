/**
 * Social media links editor for the supplier business profile.
 *
 * Ported from the supplier platform settings screen
 * (`TravioGhana-Supplier/src/features/settings/components/SocialMediaManager.jsx`)
 * so registration and the supplier dashboard look and behave the same:
 *
 * - Saved links render as brand chips (edit + remove).
 * - "Add Social Media" opens an animated popover with two screens:
 *     1. Pick a platform.
 *     2. Enter the handle with the platform URL prefix pre-filled, then save.
 *
 * Registration variant: controlled only (`value` maps storeKey → full URL,
 * `onChange` receives the next map). Nothing is persisted here — the wizard
 * keeps it in the draft and submits it with `businessInfo`.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronLeft, Link2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import {
  buildSocialUrl,
  extractHandle,
  SOCIAL_PLATFORMS,
  type SocialLinks,
  type SocialPlatform,
} from '@/lib/socialLinks'
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  PinterestIcon,
  TikTokIcon,
  WhatsAppIcon,
  XIcon,
  YouTubeIcon,
} from './SocialBrandIcons'

export const SOCIAL_BRAND_ICONS: Record<string, typeof XIcon> = {
  twitter: XIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  linkedin: LinkedInIcon,
  whatsapp: WhatsAppIcon,
  pinterest: PinterestIcon,
}

const PANEL_WIDTH = 328

interface SocialLinksManagerProps {
  value?: SocialLinks
  onChange: (next: SocialLinks) => void
  disabled?: boolean
}

export default function SocialLinksManager({ value = {}, onChange, disabled }: SocialLinksManagerProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'pick' | 'add'>('pick')
  const [selected, setSelected] = useState<SocialPlatform | null>(null)
  const [handle, setHandle] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const added = useMemo(
    () => SOCIAL_PLATFORMS.filter((platform) => value[platform.storeKey]),
    [value]
  )

  const computePos = () => {
    const el = anchorRef.current || triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const panelEl = panelRef.current
    const panelH = panelEl ? panelEl.offsetHeight : 320
    const margin = 12
    const gap = 8
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Prefer opening below the button; flip above when there isn't room, then
    // clamp so the panel always stays fully inside the viewport.
    const below = rect.bottom + gap
    const above = rect.top - gap - panelH
    const placeBelow = below + panelH <= vh - margin
    const top = placeBelow
      ? Math.max(margin, below)
      : Math.max(margin, Math.min(above, vh - panelH - margin))
    const left = Math.max(margin, Math.min(rect.left, vw - PANEL_WIDTH - margin))
    setPos({ top, left })
  }

  const close = () => {
    setOpen(false)
    setStep('pick')
    setSelected(null)
    setHandle('')
    anchorRef.current = null
  }

  const openAdd = (platform: SocialPlatform, anchorEl?: HTMLElement) => {
    if (anchorEl) anchorRef.current = anchorEl
    setSelected(platform)
    setHandle(extractHandle(platform, value[platform.storeKey] || ''))
    setStep('add')
    setOpen(true)
  }

  const commit = () => {
    if (!selected) return
    const clean = handle.trim().replace(/^@/, '')
    if (!clean) {
      toast.error(`Enter ${selected.hint || 'your username'}`)
      return
    }
    onChange({ ...value, [selected.storeKey]: buildSocialUrl(selected, clean) })
    toast.success(`${selected.name} link added`)
    close()
  }

  const remove = (platform: SocialPlatform) => {
    onChange({ ...value, [platform.storeKey]: '' })
    toast.success(`${platform.name} link removed`)
  }

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(computePos)
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      const menu = document.getElementById('social-links-menu')
      if (menu?.contains(target)) return
      close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const onRepos = () => computePos()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onRepos, true)
    window.addEventListener('resize', onRepos)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onRepos, true)
      window.removeEventListener('resize', onRepos)
    }
  }, [open, step])

  const fullUrlPreview = selected ? buildSocialUrl(selected, handle) : ''

  return (
    <>
      <div className="space-y-3">
        {added.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {added.map((platform) => {
              const Icon = SOCIAL_BRAND_ICONS[platform.storeKey]
              return (
                <span
                  key={platform.storeKey}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 py-1.5 pl-2 pr-1.5"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                    style={{ color: '#fff', backgroundColor: platform.color }}
                  >
                    <Icon width={12} height={12} />
                  </span>
                  <span className="max-w-[140px] truncate text-xs font-medium text-slate-700">
                    {extractHandle(platform, value[platform.storeKey])}
                  </span>
                  <span className="flex items-center">
                    <button
                      type="button"
                      onClick={(event) => openAdd(platform, event.currentTarget)}
                      title={`Edit ${platform.name} link`}
                      aria-label={`Edit ${platform.name} link`}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(platform)}
                      title={`Remove ${platform.name} link`}
                      aria-label={`Remove ${platform.name} link`}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </span>
              )
            })}
          </div>
        )}

        <button
          ref={triggerRef}
          type="button"
          onClick={(event) => {
            anchorRef.current = event.currentTarget
            setStep('pick')
            setOpen((current) => !current)
          }}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition-all hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-50"
        >
          <Plus size={13} />
          Add Social Media
        </button>
      </div>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="social-links-menu"
              ref={panelRef}
              id="social-links-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Add social media link"
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              style={{ top: pos.top, left: pos.left, width: PANEL_WIDTH }}
              className="fixed z-[80] max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10"
            >
              {/* Header */}
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                {step === 'add' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStep('pick')
                      setHandle('')
                    }}
                    title="Back to platforms"
                    aria-label="Back to platforms"
                    className="-ml-1 rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                  >
                    <ChevronLeft size={16} />
                  </button>
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Link2 size={13} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {step === 'pick' ? 'Add Social Media' : selected?.name}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {step === 'pick' ? 'Choose a platform' : 'Add your profile link'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  title="Close"
                  aria-label="Close"
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Screens */}
              <div className="relative h-[248px]">
                <AnimatePresence mode="popLayout" initial={false}>
                  {step === 'pick' ? (
                    <motion.div
                      key="pick"
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="absolute inset-0 grid grid-cols-2 content-start gap-1.5 overflow-y-auto p-3"
                    >
                      {SOCIAL_PLATFORMS.map((platform) => {
                        const Icon = SOCIAL_BRAND_ICONS[platform.storeKey]
                        const isAdded = Boolean(value[platform.storeKey])
                        return (
                          <button
                            key={platform.storeKey}
                            type="button"
                            onClick={() => openAdd(platform)}
                            disabled={isAdded}
                            className={cn(
                              'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all',
                              isAdded
                                ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                            )}
                          >
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                              style={{ color: '#fff', backgroundColor: platform.color }}
                            >
                              <Icon width={13} height={13} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold text-slate-700">{platform.name}</span>
                              <span className="block truncate text-[10px] text-slate-400">
                                {isAdded ? 'Added' : platform.prefix.replace(/^https?:\/\//, '')}
                              </span>
                            </span>
                            {isAdded && <Check size={13} className="text-emerald-500" />}
                          </button>
                        )
                      })}
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`add-${selected?.storeKey}`}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="absolute inset-0 flex flex-col p-3"
                    >
                      {selected && (
                        <>
                          {/* Pre-filled URL input */}
                          <label className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                            Profile URL
                          </label>
                          <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white transition-all focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-500/20">
                            <span
                              className="flex items-center gap-1.5 whitespace-nowrap border-r border-slate-200 bg-slate-50 px-2.5 text-[11px]"
                              style={{ color: selected.color }}
                            >
                              <SocialPreviewIcon storeKey={selected.storeKey} />
                              <span className="text-slate-500">{selected.prefix.replace(/^https?:\/\//, '')}</span>
                            </span>
                            <input
                              autoFocus
                              value={handle}
                              onChange={(event) => setHandle(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  commit()
                                }
                              }}
                              placeholder={selected.hint || 'your username'}
                              className="min-w-0 flex-1 px-2.5 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none"
                              disabled={disabled}
                            />
                          </div>

                          <p className="mt-2 text-[11px] text-slate-400">{selected.hint || 'your username'}</p>

                          {/* Live preview */}
                          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              Link preview
                            </p>
                            <p className="truncate font-mono text-xs font-medium text-slate-600">
                              {fullUrlPreview || '—'}
                            </p>
                          </div>

                          <div className="mt-auto flex items-center justify-end gap-2 pt-3">
                            <button
                              type="button"
                              onClick={close}
                              className="rounded-xl px-3.5 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={commit}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-200 transition-colors hover:bg-emerald-700"
                            >
                              <Check size={13} />
                              Save Link
                            </button>
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

function SocialPreviewIcon({ storeKey }: { storeKey: string }) {
  const Icon = SOCIAL_BRAND_ICONS[storeKey]
  return Icon ? <Icon width={12} height={12} /> : null
}
