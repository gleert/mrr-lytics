import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { resources, supportedLanguages, type SupportedLanguage } from './locales'

const LANGUAGE_STORAGE_KEY = 'mrrlytics-language'

// Get stored language or detect from browser
function getInitialLanguage(): SupportedLanguage {
  // Check localStorage first
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (stored && supportedLanguages.includes(stored as SupportedLanguage)) {
    return stored as SupportedLanguage
  }

  // Detect from browser
  const browserLang = navigator.language.split('-')[0]
  if (supportedLanguages.includes(browserLang as SupportedLanguage)) {
    return browserLang as SupportedLanguage
  }

  // Fallback to English
  return 'en'
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    supportedLngs: supportedLanguages,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  })

// Persist language changes to localStorage
i18n.on('languageChanged', (lng) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
  // Update HTML lang attribute for accessibility
  document.documentElement.lang = lng
})

// Set initial HTML lang attribute
document.documentElement.lang = i18n.language

// Helper function to change language
export async function changeLanguage(lang: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(lang)
}

// Helper to get current language
export function getCurrentLanguage(): SupportedLanguage {
  return i18n.language as SupportedLanguage
}

export default i18n
