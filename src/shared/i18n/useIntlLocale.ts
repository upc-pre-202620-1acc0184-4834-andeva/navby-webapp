import { useTranslation } from 'react-i18next';

/** Locale de `Intl` para el idioma activo de la interfaz. */
export function useIntlLocale(): 'en-US' | 'es-PE' {
  const { i18n } = useTranslation();
  return (i18n.resolvedLanguage ?? i18n.language).startsWith('en') ? 'en-US' : 'es-PE';
}
