import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ar from './locales/ar.json';
import { validateTranslationResources } from './translationValidator';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  de: { translation: de },
  ar: { translation: ar }
};

if (import.meta.env.DEV) {
  const translationMap = Object.fromEntries(
    Object.entries(resources).map(([language, value]) => [language, value.translation as Record<string, unknown>])
  );

  const validation = validateTranslationResources(translationMap, 'en');

  if (!validation.isValid) {
    console.warn('[i18n] Translation key mismatch detected compared to en locale.');
    for (const [language, keys] of Object.entries(validation.missingByLanguage)) {
      if (keys.length > 0) {
        console.warn(`[i18n] Missing keys in ${language}:`, keys);
      }
    }
    for (const [language, keys] of Object.entries(validation.extraByLanguage)) {
      if (keys.length > 0) {
        console.warn(`[i18n] Extra keys in ${language}:`, keys);
      }
    }
  }
}

function applyDocumentLanguage(lang: string): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'app_language',
      caches: ['localStorage']
    },
    fallbackLng: 'fr',
    supportedLngs: Object.keys(resources),
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    debug: false,
    returnNull: false,
    returnEmptyString: false,
    parseMissingKeyHandler: (key) => key,
    interpolation: {
      escapeValue: false
    }
  });

applyDocumentLanguage(i18n.resolvedLanguage || i18n.language || 'fr');
i18n.on('languageChanged', applyDocumentLanguage);

export function setAppLanguage(lang: string): void {
  if (!lang || !resources[lang as keyof typeof resources]) return;
  i18n.changeLanguage(lang);
  localStorage.setItem('app_language', lang);
  applyDocumentLanguage(lang);
}

export default i18n;
