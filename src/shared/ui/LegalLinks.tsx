import { type AnchorHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { getPrivacyUrl, getTermsUrl } from '@/shared/config/legalLinks';
import { cn } from './cn';

export const LEGAL_LINK_CLASS =
  'underline underline-offset-4 transition-colors duration-150 ease-(--ease-out) hover:text-fg focus-visible:text-fg';

/** Enlace externo legal compatible con `<Trans components={{ ... }} />`. */
export function LegalAnchor({
  children,
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className={cn(LEGAL_LINK_CLASS, className)}
      {...props}
    >
      {children}
    </a>
  );
}

/** Fila compacta de enlaces legales y copyright (reemplaza al Footer global). */
export function LegalLinksRow({
  showCopyright = true,
  className,
}: {
  showCopyright?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted', className)}
    >
      <a
        href={getTermsUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className={LEGAL_LINK_CLASS}
      >
        {t('legal.terms')}
      </a>
      <span aria-hidden="true">·</span>
      <a
        href={getPrivacyUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className={LEGAL_LINK_CLASS}
      >
        {t('legal.privacy')}
      </a>
      {showCopyright ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{t('footer.copyright')}</span>
        </>
      ) : null}
    </div>
  );
}
