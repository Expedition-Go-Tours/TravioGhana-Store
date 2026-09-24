import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'

// Only English ships in the entry bundle. Other locales are fetched as
// separate chunks the first time they're selected — saving ~270 KB of JSON
// parse/download for the (majority) English-first visit.
const localeLoaders: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  es: () => import('./locales/es.json'),
  fr: () => import('./locales/fr.json'),
  de: () => import('./locales/de.json'),
  nl: () => import('./locales/nl.json'),
}

async function loadLocaleBundle(lng: string) {
  const base = (lng || 'en').split('-')[0]
  if (base === 'en' || i18n.hasResourceBundle(base, 'translation')) return
  const loader = localeLoaders[base]
  if (!loader) return
  try {
    const mod = await loader()
    i18n.addResourceBundle(base, 'translation', mod.default ?? mod, true, true)
  } catch {
    // Offline or chunk-load failure: fall back to the bundled English strings.
  }
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
    supportedLngs: ['en', 'es', 'fr', 'de', 'nl'],
    defaultNS: 'translation',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
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
  .then(() => loadLocaleBundle(i18n.language))

i18n.on('languageChanged', (lng) => {
  void loadLocaleBundle(lng)
})

export default i18n
