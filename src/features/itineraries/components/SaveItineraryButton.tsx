import { AlertCircle, Bookmark, BookmarkCheck, Info } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { isApiError } from '@/shared/api/errors';
import { type PodiumOffer } from '@/shared/api/schemas';
import { Button } from '@/shared/ui/Button';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { useSaveItinerary } from '../hooks/useItineraries';

export interface SaveItineraryButtonProps {
  searchId: string;
  expiresAt: string;
  offer: PodiumOffer;
  /** Ya está en la lista de guardados (misma oferta del mismo usuario). */
  savedItineraryId: string | undefined;
  /** La búsqueda ya se sabe vencida: el aviso único vive bajo el selector de perfil. */
  isExpired: boolean;
  isReranking: boolean;
  onExpired: () => void;
  onSaved: (name: string) => void;
}

function Notice({
  icon,
  children,
  action,
}: {
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="status"
      className="flex basis-full flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted"
    >
      <p className="flex min-w-0 flex-1 items-start gap-1.5">
        {icon}
        <span>{children}</span>
      </p>
      {action}
    </div>
  );
}

/** Guardar (US-22): gratis e idempotente; pasa a «Guardado» con un enlace al detalle. */
export function SaveItineraryButton({
  searchId,
  expiresAt,
  offer,
  savedItineraryId,
  isExpired,
  isReranking,
  onExpired,
  onSaved,
}: SaveItineraryButtonProps) {
  const { t } = useTranslation();
  const save = useSaveItinerary();
  const savedId = savedItineraryId ?? save.data?.id;

  const handleSave = () => {
    // El reloj del cliente es orientativo; el 404 del servidor es la verdad (RN-10).
    if (Date.parse(expiresAt) <= Date.now()) {
      onExpired();
      return;
    }
    save.mutate(
      { search_id: searchId, offer_id: offer.offer_id },
      {
        onSuccess: (itinerary) => onSaved(itinerary.name),
        onError: (error) => {
          if (isApiError(error) && error.code === 'SEARCH_NOT_FOUND') onExpired();
        },
      },
    );
  };

  if (savedId) {
    return (
      <Link
        to={`/itineraries/${savedId}`}
        aria-label={t('podium.save.savedAria')}
        className={buttonVariants({ variant: 'secondary', className: 'shrink-0' })}
      >
        <BookmarkCheck className="h-4 w-4 text-success-ink" aria-hidden="true" />
        {t('podium.save.saved')}
      </Link>
    );
  }

  const errorCode = isApiError(save.error) ? save.error.code : null;
  const notice =
    !save.isError || errorCode === 'SEARCH_NOT_FOUND' ? null : errorCode ===
      'ITINERARY_LIMIT_REACHED' ? (
      <Notice icon={<Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}>
        {t('podium.save.limit')}.{' '}
        <Link to="/itineraries" className="font-semibold text-brand-ink underline">
          {t('podium.save.limitLink')}
        </Link>
      </Notice>
    ) : (
      <Notice
        icon={<AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error-ink" aria-hidden="true" />}
        action={
          <Button variant="ghost" onClick={handleSave}>
            {t('podium.errors.retry')}
          </Button>
        }
      >
        {t('podium.save.error')}
      </Notice>
    );

  return (
    <>
      <Button
        variant="secondary"
        className="shrink-0"
        loading={save.isPending}
        disabled={isExpired || isReranking}
        onClick={handleSave}
        icon={<Bookmark className="h-4 w-4" aria-hidden="true" />}
      >
        {t('podium.save.save')}
        <span className="sr-only">{t('podium.save.hint', { rank: offer.rank })}</span>
      </Button>
      {notice}
    </>
  );
}
