import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Sincroniza `document.title` con la ruta activa e idioma actual (WCAG 2.4.2).
 */
export function useDocumentTitle(titleKey?: string) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!titleKey) {
      document.title = 'Navby';
      return;
    }
    const pageTitle = t(titleKey);
    document.title = t('routes.titleTemplate', { title: pageTitle });
  }, [t, titleKey]);
}
