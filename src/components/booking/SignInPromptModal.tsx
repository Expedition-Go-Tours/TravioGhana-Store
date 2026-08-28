import { motion } from 'framer-motion'
import { LogIn, X } from 'lucide-react'

interface SignInPromptModalProps {
  onSignIn: () => void
  onClose: () => void
}

export default function SignInPromptModal({ onSignIn, onClose }: SignInPromptModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="size-4" />
        </button>

        <div className="px-6 pb-6 pt-8 sm:p-8">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-emerald-50 sm:size-16">
            <LogIn className="size-7 text-emerald-600 sm:size-8" />
          </div>

          <h2 className="text-center text-xl font-bold text-slate-900 sm:text-2xl">
            Sign in to continue booking
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500 leading-relaxed">
            Your booking details are saved — you won't lose what you've entered. Sign in to continue booking your tour.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={onSignIn}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 active:scale-[0.98]"
            >
              <LogIn className="size-4" />
              Sign in
            </button>
            <button
              onClick={onClose}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-800 active:scale-[0.98]"
            >
              Not now
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
