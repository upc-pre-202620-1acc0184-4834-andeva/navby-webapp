import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-[90rem] flex-col gap-2 px-4 py-4 text-xs text-fg-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>{t('footer.copyright')}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>{t('footer.terms')}</span>
          <span>{t('footer.privacy')}</span>
          <span className="hidden sm:inline" aria-hidden="true">
            ·
          </span>
          <span>{t('footer.legalSoon')}</span>
        </div>
      </div>
    </footer>
  );
}
