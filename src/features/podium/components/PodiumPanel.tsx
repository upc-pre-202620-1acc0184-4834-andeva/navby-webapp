import { Skeleton } from 'boneyard-js/react';
import { BadgeCheck } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import '@/shared/ui/initBoneyard';
import { isApiError } from '@/shared/api/errors';
import { HANDLED_ELSEWHERE } from '../quoteErrors';
import { type PodiumOffer, type PodiumResponse } from '@/shared/api/schemas';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/ui/cn';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { PodiumCard } from './PodiumCard';

export interface PodiumPanelProps {
  /** Cotización en curso (`POST /quotes/search`). */
  isQuoting: boolean;
  /** Lectura de un podio por `sid` en curso (`GET /quotes/{id}`). */
  isLoadingPodium: boolean;
  podium: PodiumResponse | undefined;
  /** El resultado viene de esta cotización y no costó créditos (US-16). */
  isFreeResult: boolean;
  quoteError: unknown;
  podiumError: unknown;
  /** La ruta no es alcanzable: el aviso ya lo muestra el buscador. */
  isRouteUnreachable: boolean;
  /** Los aeropuertos cambiaron después de la última cotización. */
  isStale: boolean;
  onRetry: () => void;
  locale: string;
  /** Escritorio: al llegar un podio nuevo el panel se desplaza hasta él. */
  scrollIntoViewOnResult?: boolean;
  /** Contenido que captura `pnpm bones` (ruta de desarrollo `/__bones/podium`). */
  skeletonFixture?: ReactNode;
  /** Selector de perfil (US-20, US-21): se muestra sobre un podio con ofertas. */
  preferences?: ReactNode;
  /** Reordenando con otro perfil: las tarjetas actuales siguen a la vista. */
  isReranking?: boolean;
  /** Anuncio tras reordenar («Ordenadas por Ahorro»); reemplaza el de «listas». */
  rerankAnnouncement?: string;
  /** Acciones de cada tarjeta (Guardar, US-22); el podio no conoce los itinerarios. */
  renderOfferActions?: (offer: PodiumOffer) => ReactNode;
}

function quoteErrorDescription(t: (key: string) => string, error: unknown): string {
  if (!isApiError(error)) return t('errors.UNKNOWN');
  switch (error.code) {
    case 'SEARCH_IN_PROGRESS':
    case 'ROUTE_NOT_REACHABLE':
    case 'VALIDATION_ERROR':
    case 'INVALID_WEIGHTS':
    case 'RATE_LIMITED':
    case 'NETWORK_ERROR':
      return t(`errors.${error.code}`);
    case 'AIRPORT_NOT_FOUND':
      return t('search.errors.airportNotFound');
    default:
      return t('errors.UNKNOWN');
  }
}

/** Errores sin causa en los datos del usuario: se ofrece reintentar. */
function isRetryable(error: unknown): boolean {
  return !isApiError(error) || error.code === 'NETWORK_ERROR' || error.status >= 500;
}

export function PodiumPanel({
  isQuoting,
  isLoadingPodium,
  podium,
  isFreeResult,
  quoteError,
  podiumError,
  isRouteUnreachable,
  isStale,
  onRetry,
  locale,
  scrollIntoViewOnResult = false,
  skeletonFixture,
  preferences,
  isReranking = false,
  rerankAnnouncement,
  renderOfferActions,
}: PodiumPanelProps) {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const resultId = isQuoting || isLoadingPodium ? null : (podium?.search_id ?? null);

  useEffect(() => {
    if (!scrollIntoViewOnResult || !resultId) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    sectionRef.current?.scrollIntoView({
      block: 'start',
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [resultId, scrollIntoViewOnResult]);
  const isLoading = isQuoting || isLoadingPodium;
  const offers = podium?.podium ?? [];

  const quoteErrorCode = isApiError(quoteError) ? quoteError.code : null;
  const showQuoteError =
    !isQuoting &&
    Boolean(quoteError) &&
    !HANDLED_ELSEWHERE.has(quoteErrorCode ?? '') &&
    !(quoteErrorCode === 'ROUTE_NOT_REACHABLE' && isRouteUnreachable);
  const isExpired = isApiError(podiumError) && podiumError.code === 'SEARCH_NOT_FOUND';

  // Al reordenar no se anuncia nada hasta que termina (no pisa el valor de los sliders).
  const statusText = isLoading
    ? t('podium.status.searching')
    : podium && !isStale
      ? offers.length > 0
        ? isReranking
          ? ''
          : (rerankAnnouncement ?? t('podium.status.ready', { count: offers.length }))
        : t('podium.empty.title')
      : '';

  return (
    <section
      ref={sectionRef}
      aria-labelledby="podium-heading"
      className="flex scroll-mt-4 flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="podium-heading" className="text-lg font-semibold text-fg">
          {t('podium.title')}
        </h2>
        {isFreeResult && offers.length > 0 && !isLoading && !isStale ? (
          <Badge variant="success">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t('podium.freeResult')}
          </Badge>
        ) : null}
      </div>

      {/* Una sola línea anunciada: no se leen las tarjetas completas al llegar. */}
      <p role="status" aria-live="polite" className="sr-only">
        {statusText}
      </p>

      {isStale && !isLoading ? (
        <StatusMessage
          variant="info"
          title={t('podium.stale.title')}
          description={t('podium.stale.description')}
        />
      ) : null}

      {isRouteUnreachable && !isLoading && !isStale && !podium ? (
        <StatusMessage
          variant="empty"
          title={t('search.unreachableTitle')}
          description={t('search.unreachableDescription')}
        />
      ) : null}

      {showQuoteError ? (
        <StatusMessage
          variant={quoteErrorCode === 'SEARCH_IN_PROGRESS' ? 'info' : 'error'}
          title={t(
            quoteErrorCode === 'SEARCH_IN_PROGRESS'
              ? 'podium.errors.inProgressTitle'
              : 'podium.errors.title',
          )}
          description={quoteErrorDescription(t, quoteError)}
          action={
            isRetryable(quoteError) ? (
              <Button variant="secondary" onClick={onRetry}>
                {t('podium.errors.retry')}
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {isExpired && !isLoading ? (
        <StatusMessage
          variant="info"
          title={t('podium.expired.title')}
          description={t('podium.expired.description')}
          action={
            <Button variant="secondary" onClick={onRetry}>
              {t('podium.expired.action')}
            </Button>
          }
        />
      ) : null}

      {podiumError && !isExpired && !isLoading ? (
        <StatusMessage
          variant="error"
          title={t('podium.errors.title')}
          description={t('errors.UNKNOWN')}
        />
      ) : null}

      <Skeleton
        name="podium-panel"
        loading={isLoading}
        transition={150}
        fixture={skeletonFixture}
        fallback={<PodiumFallback label={t('podium.status.searching')} />}
      >
        {podium && !isStale ? (
          offers.length === 0 ? (
            <StatusMessage
              variant="empty"
              title={t('podium.empty.title')}
              description={t('podium.empty.description')}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {preferences}
              {podium.partial ? (
                <StatusMessage
                  variant="warning"
                  title={t('podium.partial.title')}
                  description={t('podium.partial.description')}
                />
              ) : null}
              <ol
                aria-label={t('podium.listLabel')}
                aria-busy={isReranking}
                className={cn(
                  'flex flex-col gap-3 transition-opacity duration-150 ease-(--ease-out)',
                  isReranking && 'opacity-60',
                )}
              >
                {offers.map((offer) => (
                  // El estado de cada tarjeta (p. ej. Guardar) no se hereda entre búsquedas.
                  <li key={`${podium.search_id}:${offer.offer_id}`}>
                    <PodiumCard
                      offer={offer}
                      locale={locale}
                      actions={renderOfferActions?.(offer)}
                    />
                  </li>
                ))}
              </ol>
            </div>
          )
        ) : null}
      </Skeleton>
    </section>
  );
}

/** Mientras no existan huesos generados (`pnpm bones`): mismos bloques que una tarjeta. */
function PodiumFallback({ label }: { label: string }) {
  return (
    <div aria-hidden="true" title={label} className="flex flex-col gap-3">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
        >
          <div className="flex items-center justify-between">
            <div className="h-7 w-24 animate-pulse rounded-full bg-skeleton" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-skeleton" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-lg bg-skeleton" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-skeleton" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-skeleton" />
        </div>
      ))}
    </div>
  );
}
