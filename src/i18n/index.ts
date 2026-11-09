import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import ar from './locales/ar.json'

/**
 * To add a language: drop `locales/<code>.json` next to en.json, import it here,
 * and append it to `languages`. Data content (fabric names etc.) uses LText objects
 * that fall back to English for any missing locale.
 */
export const languages = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
] as const

export type LangCode = (typeof languages)[number]['code']

export const dirFor = (code: string) => languages.find((l) => l.code === code)?.dir ?? 'ltr'

function applyDocumentLang(code: string) {
  const base = code.split('-')[0]
  document.documentElement.lang = base
  document.documentElement.dir = dirFor(base)
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, ar: { translation: ar } },
    supportedLngs: languages.map((l) => l.code),
    nonExplicitSupportedLngs: true,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], lookupLocalStorage: 'naseej-lang', caches: ['localStorage'] },
  })

applyDocumentLang(i18n.resolvedLanguage ?? 'en')
i18n.on('languageChanged', applyDocumentLang)

export default i18n
