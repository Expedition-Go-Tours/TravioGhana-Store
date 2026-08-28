import { motion } from 'framer-motion'
import { Clock, Save, RefreshCw } from 'lucide-react'

interface ExpiredHoldModalProps {
  contact: { firstName: string; lastName: string; email: string }
  onRehold: () => void
  onSaveAndLeave: () => void
}

export default function ExpiredHoldModal({ contact, onRehold, onSaveAndLeave }: ExpiredHoldModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="px-6 pb-6 pt-8 sm:p-8">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-amber-50 sm:size-16">
            <Clock className="size-7 text-amber-500 sm:size-8" />
          </div>

          <h2 className="text-center text-xl font-bold text-slate-900 sm:text-2xl">
            Your hold has expired
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500 leading-relaxed">
            The reservation timer ran out. Your form details have been saved — you won't lose what you've entered.
          </p>

          {contact.firstName && (
            <div className="mx-auto mt-5 max-w-xs rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-center text-sm text-slate-600">
              Saved for <span className="font-semibold text-slate-800">{contact.firstName} {contact.lastName}</span>
              {contact.email && <span className="block text-xs text-slate-400">{contact.email}</span>}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={onRehold}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 active:scale-[0.98]"
            >
              <RefreshCw className="size-4" />
              Re-hold for 25 minutes
            </button>
            <button
              onClick={onSaveAndLeave}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-800 active:scale-[0.98]"
            >
              <Save className="size-4" />
              Save &amp; come back later
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-slate-400">
            Prices may have changed while your hold was expired.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
