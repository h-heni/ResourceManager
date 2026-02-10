import i18n from 'i18next';
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

// ═══════════════════════════════════════════════════════════════
// LANGUAGE STRATEGY (ROOT CAUSE FIX)
// ─────────────────────────────────────────────────────────────
// REMOVED: i18next-browser-languagedetector
//   → It used ['localStorage', 'navigator'] which let the browser
//     language override company settings on every cold start.
//
// NEW APPROACH:
//   1. On init: use persisted language from localStorage (user-specific key)
//   2. After login: AuthContext fetches /Settings and calls
//      setAppLanguage(lang) to set i18n + persist to localStorage.
//   3. LanguageSelector calls setAppLanguage on user change.
//   4. On logout: language is NOT reset (stays until next login).
//   5. Fallback: 'fr' (French) if nothing is persisted.
// ═══════════════════════════════════════════════════════════════

/** Get the persisted language, falling back to 'fr' */
function getPersistedLanguage(): string {
  try {
    return localStorage.getItem('app_language') || 'fr';
  } catch {
    return 'fr';
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getPersistedLanguage(), // Explicit — no detector, no browser override
    fallbackLng: 'fr',
    debug: false,
    interpolation: {
      escapeValue: false
    }
  });

/**
 * Authoritative language setter. Call this:
 * - After login (with company's InvoiceLanguage from /Settings)
 * - When user manually changes language via LanguageSelector
 * - NEVER from browser detection
 */
export function setAppLanguage(lang: string): void {
  if (!lang || !resources[lang as keyof typeof resources]) return;
  i18n.changeLanguage(lang);
  localStorage.setItem('app_language', lang);
  // Handle RTL for Arabic
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
}

export default i18n;
