import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n/config'
import { useCurrency, availableCurrencies } from '../contexts/CurrencyContext'

interface LanguageCurrencyModalProps {
  onClose: () => void
}

const LANGUAGES = [
  { code: 'en', flag: '🇬🇧' },
  { code: 'es', flag: '🇪🇸' },
  { code: 'fr', flag: '🇫🇷' },
  { code: 'de', flag: '🇩🇪' },
  { code: 'nl', flag: '🇳🇱' },
]

const TABS = [
  { key: 'language' as const },
  { key: 'currency' as const },
]

type TabKey = (typeof TABS)[number]['key']

export default function LanguageCurrencyModal({ onClose }: LanguageCurrencyModalProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabKey>('language')
  const currentLang = i18n.language.substring(0, 2)
  const { currency, setCurrency: setAppCurrency } = useCurrency()

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 flex w-full max-w-[420px] max-h-[90vh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-end border-b border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex-1 pb-3 pt-2 text-sm font-semibold transition text-center ${
                activeTab === tab.key
                  ? 'text-emerald-700'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.key === 'language' ? t('nav.language') : t('nav.currency')}
              {activeTab === tab.key && (
                <motion.div
                  layoutId="active-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto px-6 pb-6 pt-5 min-h-[300px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeInOut' }}
            >
              {activeTab === 'language' && (
                <div className="space-y-1">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { i18n.changeLanguage(lang.code); onClose() }}
                      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition ${
                        currentLang === lang.code
                          ? 'bg-emerald-50 text-emerald-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span className="flex-1">{t(`languages.${lang.code}`)}</span>
                      {currentLang === lang.code && (
                        <Check className="size-4 text-emerald-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'currency' && (
                <div className="grid grid-cols-2 gap-2">
                  {availableCurrencies.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => { setAppCurrency(c.code); onClose() }}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        currency.code === c.code
                          ? 'bg-emerald-50 text-emerald-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 shrink-0">
                        {c.symbol}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-medium leading-tight">{c.code}</span>
                        <span className="block text-[10px] text-slate-400 truncate leading-tight">{c.label}</span>
                      </div>
                      {currency.code === c.code && (
                        <Check className="size-3.5 shrink-0 text-emerald-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
