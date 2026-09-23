import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onClose: () => void
}

/**
 * Responsive confirmation dialog: bottom sheet on mobile, centered on
 * desktop. Accessible: focus trapped, Escape/backdrop close, labelled region.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    confirmRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const focusables = confirmRef.current?.parentElement?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (!focusables || focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previouslyFocused.current?.focus()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 48, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 48, scale: 0.99 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl sm:border sm:border-slate-100"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>

            <div className="px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-7">
              <div
                className={`mx-auto mb-4 flex size-12 items-center justify-center rounded-full sm:size-13 ${
                  tone === 'danger' ? 'bg-red-50' : 'bg-emerald-50'
                }`}
              >
                <AlertTriangle
                  className={`size-6 ${tone === 'danger' ? 'text-red-500' : 'text-emerald-600'}`}
                />
              </div>

              <h2 className="text-center text-lg font-bold leading-snug text-slate-900 sm:text-xl">
                {title}
              </h2>
              <p className="mt-2 text-center text-sm leading-relaxed text-slate-500">{message}</p>

              <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 active:scale-[0.98] sm:w-auto sm:flex-1"
                >
                  {cancelLabel}
                </button>
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={onConfirm}
                  autoFocus
                  className={`inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-110 active:scale-[0.98] sm:w-auto sm:flex-1 ${
                    tone === 'danger'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
