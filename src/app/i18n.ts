import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

// Detección: ?lang= → localStorage → navegador (docs/navby-webapp-documentation.md §5).
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { es: { translation: es }, en: { translation: en } },
    supportedLngs: ['es', 'en'],
    fallbackLng: 'es',
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'navby-lang',
      caches: ['localStorage'],
    },
  });

i18n.on('languageChanged', (lng) => document.documentElement.setAttribute('lang', lng));

export default i18n;
