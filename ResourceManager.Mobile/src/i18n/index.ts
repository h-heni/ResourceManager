import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './locales/en.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ar from './locales/ar.json';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  de: { translation: de },
  ar: { translation: ar },
};

const deviceLocale = Localization.getLocales()?.[0]?.languageCode ?? 'en';
const supportedLng = Object.keys(resources).includes(deviceLocale) ? deviceLocale : 'en';

i18n.use(initReactI18next).init({
  resources,
  lng: supportedLng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
