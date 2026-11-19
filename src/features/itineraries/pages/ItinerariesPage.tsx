import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from 'boneyard-js/react';
import { Bookmark, Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { isApiError } from '@/shared/api/errors';
import { type Itinerary } from '@/shared/api/schemas';
import { useIntlLocale } from '@/shared/i18n/useIntlLocale';
import { Button } from '@/shared/ui/Button';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { PriceDisclaimer } from '@/shared/ui/PriceDisclaimer';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { DeleteItineraryDialog } from '../components/DeleteItineraryDialog';
import { ItineraryRow } from '../components/ItineraryRow';
import { type DeleteResult, useItineraries } from '../hooks/useItineraries';
import { itineraryKeys } from '../itineraryKeys';

/** Tope de itinerarios guardados (RN-13). */
const MAX_ITINERARIES = 50;

/** Estado de navegación con el anuncio que deja el detalle al eliminar. */
interface ItinerariesLocationState {
  announce?: string;
}

/** Mientras no existan huesos generados (`pnpm bones`): mismos bloques que una fila. */
function ItinerariesFallback({ label }: { label: string }) {
  return (
    <div aria-hidden="true" title={label} className="flex flex-col gap-3">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4"
        >
          <div className="h-5 w-48 animate-pulse rounded bg-skeleton" />
          <div className="h-4 w-40 animate-pulse rounded bg-skeleton" />
          <div className="h-4 w-56 animate-pulse rounded bg-skeleton" />
        </div>
      ))}
    </div>
  );
}

/** Mis itinerarios (US-23, US-24): del más reciente al más antiguo, sin mapa. */
export default function ItinerariesPage() {
  const { t } = useTranslation();
  const locale = useIntlLocale();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data, isPending, error, refetch } = useItineraries();

  const incoming = (location.state as ItinerariesLocationState | null)?.announce ?? '';
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeadingRef = useRef(false);
  const [toDelete, setToDelete] = useState<Itinerary | null>(null);
  const [announcement, setAnnouncement] = useState(incoming);

  // Llegando del detalle tras eliminar, el foco vuelve al título (el anuncio ya viene en el estado).
  useEffect(() => {
    if (incoming) headingRef.current?.focus();
  }, [incoming]);

  // Con la fila ya sin su botón, el foco no puede volver a él: va al título (tras cerrar el diálogo).
  useEffect(() => {
    if (toDelete === null && focusHeadingRef.current) {
      focusHeadingRef.current = false;
      headingRef.current?.focus();
    }
  }, [toDelete]);

  const handleDeleted = (itinerary: Itinerary, result: DeleteResult) => {
    queryClient.removeQueries({ queryKey: itineraryKeys.detail(itinerary.id) });
    setAnnouncement(t(result === 'gone' ? 'itineraries.gone' : 'itineraries.deleted'));
    focusHeadingRef.current = true;
    setToDelete(null);
  };

  const items = data?.items ?? [];
  const isFull = (data?.total ?? 0) >= MAX_ITINERARIES;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold text-fg focus:outline-none"
        >
          {t('itineraries.title')}
        </h1>
        {items.length > 0 ? (
          <p className="text-sm text-fg-muted tabular-nums">
            {t('itineraries.count', { count: data?.total ?? items.length, max: MAX_ITINERARIES })}
          </p>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {isFull ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-line bg-surface-sunken p-3 text-sm text-fg"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
          {t('itineraries.full')}
        </div>
      ) : null}

      {error && !data ? (
        <StatusMessage
          variant="error"
          title={t('itineraries.error.title')}
          description={
            isApiError(error) && error.code === 'NETWORK_ERROR'
              ? t('errors.NETWORK_ERROR')
              : t('errors.UNKNOWN')
          }
          action={
            <Button variant="secondary" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (
        <Skeleton
          name="itineraries-list"
          loading={isPending}
          transition={150}
          fallback={<ItinerariesFallback label={t('common.loading')} />}
        >
          {items.length === 0 ? (
            <StatusMessage
              variant="empty"
              icon={Bookmark}
              title={t('itineraries.empty.title')}
              description={t('itineraries.empty.description')}
              action={
                <Link to="/" className={buttonVariants({ variant: 'primary' })}>
                  {t('itineraries.empty.action')}
                </Link>
              }
            />
          ) : (
            <>
              <ul aria-label={t('itineraries.listLabel')} className="flex flex-col gap-3">
                {items.map((itinerary) => (
                  <li key={itinerary.id}>
                    <ItineraryRow itinerary={itinerary} locale={locale} onDelete={setToDelete} />
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-1">
                <PriceDisclaimer />
                <p className="pl-5.5 text-xs text-fg-muted">{t('itineraries.priceNote')}</p>
              </div>
            </>
          )}
        </Skeleton>
      )}

      <DeleteItineraryDialog
        itinerary={toDelete}
        onDeleted={handleDeleted}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
