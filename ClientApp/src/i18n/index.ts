import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ar from './locales/ar.json';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  de: { translation: de },
  ar: { translation: ar }
};

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
