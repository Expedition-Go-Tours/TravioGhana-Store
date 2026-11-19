import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import { canonicalizeDetectedLanguage, resolveLanguage, SUPPORTED_LANGUAGE_CODES } from './languages'

// Only English ships in the entry bundle. Every other locale is fetched as a
// separate chunk the first time it's selected. A glob (rather than 40 explicit
// imports) means a missing locale file cannot break Vite's module graph and
// blank the app; the selection simply falls back to English until the file is
// generated.
const localeLoaders = import.meta.glob<{ default: Record<string, unknown> }>([
  './locales/*.json',
  // English is bundled synchronously above; do not emit a second lazy copy.
  '!./locales/en.json',
])

async function loadLocaleBundle(lng: string) {
  const code = resolveLanguage(lng)?.code ?? 'en'
  if (code === 'en' || i18n.hasResourceBundle(code, 'translation')) return
  const loader = localeLoaders[`./locales/${code}.json`]
  if (!loader) return
  try {
    const mod = await loader()
    i18n.addResourceBundle(code, 'translation', mod.default ?? mod, true, true)
  } catch {
    // Offline or chunk-load failure: fall back to the bundled English strings.
  }
}

function syncDocumentLanguage(lng: string) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = resolveLanguage(lng)?.code ?? 'en'
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    partialBundledLanguages: true,
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGE_CODES],
    nonExplicitSupportedLngs: true,
    defaultNS: 'translation',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      convertDetectedLanguage: (lng) => canonicalizeDetectedLanguage(lng),
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      // Non-English bundles are fetched after `languageChanged` fires (see
      // loadLocaleBundle). Without this, react-i18next only re-renders on the
      // language change itself and the UI keeps the English fallback until the
      // next unrelated render — i.e. switching language appeared to do nothing.
      bindI18nStore: 'added',
    },
  })
  .then(() => {
    syncDocumentLanguage(i18n.language)
    return loadLocaleBundle(i18n.language)
  })

i18n.on('languageChanged', (lng) => {
  syncDocumentLanguage(lng)
  void loadLocaleBundle(lng)
})

export default i18n
