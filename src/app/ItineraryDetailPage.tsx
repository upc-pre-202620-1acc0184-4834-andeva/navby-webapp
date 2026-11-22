import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { DeleteItineraryDialog } from '@/features/itineraries/components/DeleteItineraryDialog';
import { type DeleteResult, useItinerary } from '@/features/itineraries/hooks/useItineraries';
import { itineraryKeys } from '@/features/itineraries/itineraryKeys';
import { buildLiveSearchHref } from '@/features/itineraries/liveSearchHref';
import { MapErrorBoundary } from '@/features/map/components/MapErrorBoundary';
import { RouteTextLegend } from '@/features/map/components/RouteTextLegend';
import { PodiumCard } from '@/features/podium/components/PodiumCard';
import { isApiError } from '@/shared/api/errors';
import { type Itinerary } from '@/shared/api/schemas';
import { formatCalendarDate, formatInstantDate } from '@/shared/format/date';
import { useMoney } from '@/shared/format/useMoney';
import { useIntlLocale } from '@/shared/i18n/useIntlLocale';
import { usePodiumHighlight } from '@/shared/state/podiumHighlight';
import { Button } from '@/shared/ui/Button';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { StatusMessage } from '@/shared/ui/StatusMessage';

// Mismo `import()` que HomePage: un solo chunk para el mapa.
const LazyRouteMap = lazy(() => import('@/features/map/components/RouteMap'));

function BackLink({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/itineraries"
      className={buttonVariants({ variant: 'ghost', className: className ?? '-ml-3 px-3' })}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span>{t('itineraries.detail.back')}</span>
    </Link>
  );
}

/** Detalle de un itinerario guardado (US-23): ruta en el mapa y precio del momento de la cotización. */
export default function ItineraryDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const locale = useIntlLocale();
  const { fxNote } = useMoney();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: itinerary, error, isPending, refetch } = useItinerary(id);
  const setHighlightedRank = usePodiumHighlight((state) => state.setHighlightedRank);
  const [confirming, setConfirming] = useState(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);

  // Un resaltado que dejó el podio no significa nada aquí.
  useEffect(() => setHighlightedRank(null), [setHighlightedRank]);

  // Fuera del podio de hoy el puesto original no significa nada: una sola ruta, la del Top 1.
  const offer = useMemo(() => (itinerary ? { ...itinerary.offer, rank: 1 } : null), [itinerary]);
  const podium = useMemo(() => (offer ? [offer] : undefined), [offer]);

  const handleDeleted = async (deleted: Itinerary, result: DeleteResult) => {
    await navigate('/itineraries', {
      state: { announce: t(result === 'gone' ? 'itineraries.gone' : 'itineraries.deleted') },
    });
    // Después de navegar: antes, el detalle montado volvería a pedirlo y vería un 404.
    queryClient.removeQueries({ queryKey: itineraryKeys.detail(deleted.id) });
  };

  if (!itinerary || !offer || !podium) {
    const isMissing = isApiError(error) && (error.status === 404 || error.status === 422);
    return (
      <div className="flex flex-col gap-6">
        <h1 className="sr-only">{t('itineraries.title')}</h1>
        {isPending ? (
          <>
            <BackLink className="-ml-3 self-start px-3" />
            <div role="status" aria-busy="true" className="flex flex-col gap-4">
              <span className="sr-only">{t('itineraries.detail.loading')}</span>
              <div className="flex flex-col gap-2">
                <div aria-hidden="true" className="h-8 w-64 animate-pulse rounded bg-skeleton" />
                <div aria-hidden="true" className="h-4 w-72 animate-pulse rounded bg-skeleton" />
              </div>
              <div
                aria-hidden="true"
                className="h-60 animate-pulse rounded-xl bg-skeleton lg:h-80"
              />
              <div aria-hidden="true" className="h-80 animate-pulse rounded-xl bg-skeleton" />
            </div>
          </>
        ) : isMissing ? (
          <StatusMessage
            variant="empty"
            title={t('itineraries.detail.notFound.title')}
            description={t('itineraries.detail.notFound.description')}
            action={<BackLink className="" />}
          />
        ) : (
          <>
            <BackLink className="-ml-3 self-start px-3" />
            <StatusMessage
              variant="error"
              title={t('itineraries.detail.error.title')}
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
          </>
        )}
      </div>
    );
  }

  const profile = t(`podium.preferences.profiles.${itinerary.offer.profile}`);
  const departure = formatCalendarDate(itinerary.departure_date, locale);
  const dates = itinerary.return_date
    ? t('itineraries.dates', {
        departure,
        return: formatCalendarDate(itinerary.return_date, locale),
      })
    : departure;
  const liveSearchHref = buildLiveSearchHref(itinerary);

  const legend = (forceVisible: boolean) => (
    <RouteTextLegend
      preview={null}
      fastestHours={null}
      hasActiveSearch={true}
      forceVisible={forceVisible}
      podium={podium}
      heading={t('itineraries.detail.legendHeading')}
      routeLabel={t('itineraries.detail.routeLabel')}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink className="-ml-3 self-start px-3" />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-2xl font-bold text-fg">{itinerary.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted tabular-nums">
              <span className="rounded-md bg-surface-sunken px-2 py-0.5 text-xs font-bold tracking-wide text-fg">
                {itinerary.origin} → {itinerary.destination}
              </span>
              <span>{t(`itineraries.tripType.${itinerary.trip_type}`)}</span>
              <span>{dates}</span>
              <span>
                {t('itineraries.savedOn', {
                  date: formatInstantDate(itinerary.created_at, locale),
                })}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              to={liveSearchHref}
              className={buttonVariants({ variant: 'secondary', className: 'flex-1 sm:flex-none' })}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>{t('itineraries.detail.searchLive')}</span>
            </Link>
            <Button
              variant="danger"
              icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              onClick={() => setConfirming(true)}
            >
              {t('itineraries.delete')}
            </Button>
          </div>
        </div>
      </div>

      <div className="relative h-60 w-full overflow-hidden rounded-xl border border-line bg-surface-sunken lg:h-80">
        <MapErrorBoundary floatingPanel={false} onError={() => setMapUnavailable(true)}>
          <Suspense
            fallback={
              <div
                role="status"
                aria-live="polite"
                className="flex h-full w-full items-center justify-center gap-2 text-sm text-fg-muted"
              >
                <Loader2
                  className="h-4 w-4 animate-spin motion-reduce:opacity-75"
                  aria-hidden="true"
                />
                <span>{t('map.loading')}</span>
              </div>
            }
          >
            <LazyRouteMap
              preview={null}
              podium={podium}
              originAirports={[]}
              destinationAirports={[]}
              fitTrigger={0}
              floatingPanel={false}
              instantReveal={true}
              regionLabel={t('itineraries.detail.mapLabel')}
              onUnavailableChange={setMapUnavailable}
            />
          </Suspense>
        </MapErrorBoundary>
      </div>
      {legend(mapUnavailable)}

      <PodiumCard
        offer={offer}
        locale={locale}
        note={fxNote}
        heading={t('itineraries.detail.profile', { profile })}
        disclaimer={t('itineraries.detail.disclaimer', {
          date: formatInstantDate(itinerary.offer.quoted_at, locale),
          legal: t('legal.priceDisclaimer'),
        })}
      />

      <DeleteItineraryDialog
        itinerary={confirming ? itinerary : null}
        onDeleted={(deleted, result) => void handleDeleted(deleted, result)}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
