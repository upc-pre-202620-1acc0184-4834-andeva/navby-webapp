import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

function syncHtmlLang(lng?: string): void {
  const resolved = i18n.resolvedLanguage ?? lng ?? 'es';
  document.documentElement.setAttribute('lang', resolved.startsWith('en') ? 'en' : 'es');
}

i18n.on('languageChanged', syncHtmlLang);

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
  })
  .then(() => {
    syncHtmlLang();
  });

export default i18n;
