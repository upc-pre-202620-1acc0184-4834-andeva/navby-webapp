import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { sileo } from 'sileo';
import { formatResetTime, walletKeys } from '@/features/billing/hooks/useWallet';
import { MapErrorBoundary } from '@/features/map/components/MapErrorBoundary';
import { PodiumPanel } from '@/features/podium/components/PodiumPanel';
import { PreferenceSelector } from '@/features/podium/components/PreferenceSelector';
import { isQuoteErrorShownInline } from '@/features/podium/quoteErrors';
import { podiumQueryOptions, usePodium } from '@/features/podium/hooks/usePodium';
import {
  parsePreferences,
  type PreferenceSelection,
  preferenceKey,
  writePreferences,
} from '@/features/podium/preferences';
import { useQuoteSearch } from '@/features/podium/hooks/useQuoteSearch';
import { RouteTextLegend } from '@/features/map/components/RouteTextLegend';
import { SearchPanel } from '@/features/search/components/SearchPanel';
import { useRoutePreview } from '@/features/search/hooks/useRoutePreview';
import {
  buildSearchParams,
  computeFastestHours,
  parseSearchParams,
  type SearchCriteria,
} from '@/features/search/searchCriteria';
import { isApiError } from '@/shared/api/errors';
import { type City, type CityAirport, type UserSummary, type Wallet } from '@/shared/api/schemas';
import { sessionKeys } from '@/shared/auth/useSession';
import { usePodiumHighlight } from '@/shared/state/podiumHighlight';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/ui/cn';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { useMediaQuery } from '@/shared/ui/useMediaQuery';
import { toQuotePayload } from './quotePayload';

/** Parámetro de la URL con el `search_id` vigente (US-19). */
const SEARCH_ID_PARAM = 'sid';

const LazyRouteMap = lazy(() => import('@/features/map/components/RouteMap'));

function hasValidRoutePair(criteria: SearchCriteria): boolean {
  if (criteria.origins.length === 0 || criteria.origins.length > 5) return false;
  if (criteria.destinations.length === 0 || criteria.destinations.length > 5) return false;
  const originSet = new Set(criteria.origins);
  return !criteria.destinations.some((iata) => originSet.has(iata));
}

function filterCityAirports(city: City | null, selectedIatas: string[]): CityAirport[] {
  if (!city) return [];
  if (selectedIatas.length === 0) return city.airports;
  const allowed = new Set(selectedIatas);
  const filtered = city.airports.filter((airport) => allowed.has(airport.iata));
  return filtered.length > 0 ? filtered : city.airports;
}

export function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const locale = (i18n.resolvedLanguage ?? i18n.language).startsWith('en') ? 'en-US' : 'es-PE';

  const { hasSearchQuery, criteria } = useMemo(
    () => parseSearchParams(searchParams),
    [searchParams],
  );

  const hasActiveSearch = hasSearchQuery && hasValidRoutePair(criteria);
  const activePreviewParams = useMemo(
    () =>
      hasActiveSearch
        ? {
            origins: criteria.origins,
            destinations: criteria.destinations,
            tripType: criteria.tripType,
          }
        : null,
    [hasActiveSearch, criteria.origins, criteria.destinations, criteria.tripType],
  );

  const {
    data: preview,
    error: previewError,
    isLoading: isPreviewLoading,
    isFetching: isPreviewFetching,
    isCooldownActive,
    refetch: retryPreview,
  } = useRoutePreview(activePreviewParams);

  const searchId = hasActiveSearch ? searchParams.get(SEARCH_ID_PARAM) : null;
  const selection = useMemo(() => parsePreferences(searchParams), [searchParams]);
  const selectionKey = preferenceKey(selection);
  const quoteSearch = useQuoteSearch();
  const podiumQuery = usePodium(searchId, selection);
  const [isPodiumStale, setIsPodiumStale] = useState(false);
  const setHighlightedRank = usePodiumHighlight((state) => state.setHighlightedRank);

  // Un podio nuevo, otro sid u otro perfil empieza sin ruta resaltada (el puesto 1 puede cambiar).
  useEffect(() => {
    setHighlightedRank(null);
  }, [searchId, selectionKey, setHighlightedRank]);

  // Cambio de perfil (US-20, US-21): todo va atado al sid para que otra búsqueda lo descarte.
  const [pendingRank, setPendingRank] = useState<{
    sid: string;
    selection: PreferenceSelection;
  } | null>(null);
  const [rankFailure, setRankFailure] = useState<{
    sid: string;
    selection: PreferenceSelection;
    error: unknown;
  } | null>(null);
  const [expiredSid, setExpiredSid] = useState<string | null>(null);
  const [rankAnnouncement, setRankAnnouncement] = useState<{
    sid: string;
    key: string;
    text: string;
  } | null>(null);
  const rankRequestRef = useRef(0);

  const [fitTrigger, setFitTrigger] = useState(0);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [resolvedCities, setResolvedCities] = useState<{
    origin: City | null;
    destination: City | null;
  }>({ origin: null, destination: null });

  const handleQuoteError = useCallback(
    (error: unknown) => {
      if (!isApiError(error)) return;
      if (error.code === 'INSUFFICIENT_CREDITS') {
        // US-17: comprar un paquete o esperar la recarga diaria.
        const wallet = queryClient.getQueryData<Wallet>(walletKeys.current);
        sileo.error({
          title: t('podium.errors.insufficientTitle'),
          description: wallet
            ? t('podium.errors.insufficientWithReset', {
                time: formatResetTime(wallet.free_credits_reset_at, locale),
              })
            : t('podium.errors.insufficient'),
          button: { title: t('podium.errors.viewCredits'), onClick: () => navigate('/billing') },
        });
        void queryClient.invalidateQueries({ queryKey: walletKeys.current });
      } else if (error.code === 'PROVIDER_UNAVAILABLE') {
        sileo.error({
          title: t('podium.errors.providerTitle'),
          description: t('podium.errors.providerUnavailable'),
        });
      } else if (error.code === 'EMAIL_NOT_VERIFIED') {
        // RequireAuth lleva a /verify-email con el estado que esa pantalla espera.
        queryClient.setQueryData<UserSummary | null>(sessionKeys.current, (user) =>
          user ? { ...user, email_verified: false } : user,
        );
      }
    },
    [locale, navigate, queryClient, t],
  );

  const { mutate: mutateQuote, reset: resetQuote } = quoteSearch;

  // URL de la cotización en curso; null si el usuario cambió la búsqueda mientras tanto.
  const pendingQuoteParamsRef = useRef<URLSearchParams | null>(null);

  const runQuote = useCallback(
    (nextCriteria: SearchCriteria, targetParams: URLSearchParams) => {
      setIsPodiumStale(false);
      pendingQuoteParamsRef.current = targetParams;
      mutateQuote(toQuotePayload(nextCriteria, parsePreferences(targetParams)), {
        onSuccess: (data) => {
          if (data.credits_charged > 0) {
            void queryClient.invalidateQueries({ queryKey: walletKeys.current });
          }
          // No se compara con la URL actual: la navegación de Buscar puede no haberse aplicado aún.
          if (pendingQuoteParamsRef.current !== targetParams) return;
          pendingQuoteParamsRef.current = null;
          const withSid = new URLSearchParams(targetParams);
          withSid.set(SEARCH_ID_PARAM, data.search_id);
          setSearchParams(withSid, { replace: true });
        },
        onError: (error) => {
          if (pendingQuoteParamsRef.current === targetParams) pendingQuoteParamsRef.current = null;
          handleQuoteError(error);
        },
      });
    },
    [handleQuoteError, mutateQuote, queryClient, setSearchParams],
  );

  const handleSubmitCriteria = useCallback(
    (nextCriteria: SearchCriteria) => {
      const next = buildSearchParams(nextCriteria, searchParams);
      next.delete(SEARCH_ID_PARAM);
      setSearchParams(next);
      setFitTrigger((count) => count + 1);
      // Preview (por el cambio de URL) y cotización van en paralelo.
      runQuote(nextCriteria, next);
    },
    [runQuote, searchParams, setSearchParams],
  );

  const hasQuoteResult = quoteSearch.data !== undefined;

  const handleAirportsDebouncedChange = useCallback(
    (nextCriteria: SearchCriteria) => {
      const next = buildSearchParams(nextCriteria, searchParams);
      // Otros aeropuertos = otro podio: no se recotiza solo (cuesta créditos).
      if (next.has(SEARCH_ID_PARAM) || hasQuoteResult) setIsPodiumStale(true);
      next.delete(SEARCH_ID_PARAM);
      pendingQuoteParamsRef.current = null;
      resetQuote();
      setSearchParams(next, { replace: true });
      setFitTrigger((count) => count + 1);
    },
    [hasQuoteResult, resetQuote, searchParams, setSearchParams],
  );

  const handleRetryQuote = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete(SEARCH_ID_PARAM);
    runQuote(criteria, next);
  }, [criteria, runQuote, searchParams]);

  const handleResolvedCitiesChange = useCallback(
    (cities: { origin: City | null; destination: City | null }) => {
      setResolvedCities((prev) =>
        prev.origin === cities.origin && prev.destination === cities.destination ? prev : cities,
      );
    },
    [],
  );

  const originAirports = useMemo(
    () => filterCityAirports(resolvedCities.origin, criteria.origins),
    [resolvedCities.origin, criteria.origins],
  );

  const destinationAirports = useMemo(
    () => filterCityAirports(resolvedCities.destination, criteria.destinations),
    [resolvedCities.destination, criteria.destinations],
  );

  const fastestHours = useMemo(
    () => (preview ? computeFastestHours(preview, criteria.tripType) : null),
    [preview, criteria.tripType],
  );

  const podium = podiumQuery.data;

  /**
   * Pide el podio del perfil nuevo y solo entonces lo escribe en la URL: mientras tanto (y si
   * falla) las tarjetas actuales siguen a la vista. Volver a un perfil ya visto sale de caché.
   */
  const handleSelectionChange = useCallback(
    async (next: PreferenceSelection) => {
      if (!searchId || !podium) return;
      const sid = searchId;
      // El reloj del cliente es orientativo; el 404 del servidor es la verdad (RN-10, RN-11).
      if (Date.parse(podium.expires_at) <= Date.now()) {
        setExpiredSid(sid);
        return;
      }
      const requestId = ++rankRequestRef.current;
      const options = podiumQueryOptions(sid, next);
      setRankFailure(null);
      if (queryClient.getQueryData(options.queryKey) === undefined) {
        setPendingRank({ sid, selection: next });
      }
      try {
        await queryClient.fetchQuery(options);
        if (rankRequestRef.current !== requestId) return;
        setPendingRank(null);
        setRankAnnouncement({
          sid,
          key: preferenceKey(next),
          text: t('podium.preferences.reordered', {
            profile: t(`podium.preferences.profiles.${next.profile}`),
          }),
        });
        setSearchParams(
          (prev) => (prev.get(SEARCH_ID_PARAM) === sid ? writePreferences(prev, next) : prev),
          { replace: true },
        );
      } catch (error) {
        if (rankRequestRef.current !== requestId) return;
        setPendingRank(null);
        if (isApiError(error) && error.code === 'SEARCH_NOT_FOUND') {
          setExpiredSid(sid);
        } else {
          handleQuoteError(error);
          setRankFailure({ sid, selection: next, error });
        }
      }
    },
    [handleQuoteError, podium, queryClient, searchId, setSearchParams, t],
  );

  const isRankExpired = searchId !== null && expiredSid === searchId;
  const activePendingRank = pendingRank?.sid === searchId ? pendingRank : null;
  const activeRankFailure = rankFailure?.sid === searchId ? rankFailure : null;
  const rankFailureCode = isApiError(activeRankFailure?.error)
    ? activeRankFailure.error.code
    : null;

  const preferenceNotice = isRankExpired ? (
    <StatusMessage
      variant="info"
      title={t('podium.expired.title')}
      description={t('podium.preferences.expired')}
      action={
        <Button variant="secondary" onClick={handleRetryQuote}>
          {t('podium.expired.action')}
        </Button>
      }
    />
  ) : activeRankFailure ? (
    <StatusMessage
      variant="error"
      title={t('podium.preferences.errors.title')}
      description={
        rankFailureCode === 'INVALID_WEIGHTS'
          ? t('podium.preferences.errors.invalidWeights')
          : rankFailureCode === 'NETWORK_ERROR'
            ? t('errors.NETWORK_ERROR')
            : t('errors.UNKNOWN')
      }
      action={
        rankFailureCode === 'INVALID_WEIGHTS' ? undefined : (
          <Button
            variant="secondary"
            onClick={() => void handleSelectionChange(activeRankFailure.selection)}
          >
            {t('podium.errors.retry')}
          </Button>
        )
      }
    />
  ) : null;

  const isFreeResult =
    quoteSearch.data !== undefined &&
    quoteSearch.data.search_id === searchId &&
    quoteSearch.data.credits_charged === 0;
  const showPodium =
    hasActiveSearch &&
    (quoteSearch.isPending ||
      isQuoteErrorShownInline(quoteSearch.error) ||
      searchId !== null ||
      isPodiumStale);

  const podiumPanel = showPodium ? (
    <PodiumPanel
      isQuoting={quoteSearch.isPending}
      isLoadingPodium={podiumQuery.isLoading}
      podium={podium}
      isFreeResult={isFreeResult}
      quoteError={quoteSearch.error}
      podiumError={podiumQuery.error}
      isRouteUnreachable={preview?.reachable === false}
      isStale={isPodiumStale && searchId === null}
      onRetry={handleRetryQuote}
      locale={locale}
      scrollIntoViewOnResult={isDesktop}
      isReranking={activePendingRank !== null}
      rerankAnnouncement={
        rankAnnouncement?.sid === searchId && rankAnnouncement.key === selectionKey
          ? rankAnnouncement.text
          : undefined
      }
      preferences={
        <PreferenceSelector
          selection={activePendingRank?.selection ?? selection}
          onChange={(next) => void handleSelectionChange(next)}
          disabled={isRankExpired}
          isPending={activePendingRank !== null}
          notice={preferenceNotice}
        />
      }
    />
  ) : null;

  return (
    <div className="flex flex-1 flex-col lg:relative lg:min-h-[calc(100dvh-4rem)]">
      {/* Formulario de búsqueda primero en DOM/teclado; flotante a la izquierda sobre el mapa en escritorio. */}
      <div className="px-4 pt-4 pb-3 sm:px-6 lg:pointer-events-none lg:absolute lg:top-4 lg:left-4 lg:z-10 lg:max-h-[calc(100dvh-6rem)] lg:w-[420px] lg:overflow-y-auto lg:p-0">
        <div className="lg:pointer-events-auto">
          <SearchPanel
            initialCriteria={criteria}
            hasActiveSearch={hasActiveSearch}
            preview={preview}
            previewError={previewError}
            isPreviewLoading={isPreviewLoading}
            isPreviewFetching={isPreviewFetching}
            isRateLimitCooldown={isCooldownActive}
            isQuoting={quoteSearch.isPending}
            onRetryPreview={retryPreview}
            onSubmitCriteria={handleSubmitCriteria}
            onAirportsDebouncedChange={handleAirportsDebouncedChange}
            onResolvedCitiesChange={handleResolvedCitiesChange}
          />
          {/* Escritorio: el podio vive en el panel flotante, bajo el buscador. */}
          {isDesktop && podiumPanel ? (
            <div className="mt-3 rounded-xl border border-line bg-surface p-4 shadow-lg">
              {podiumPanel}
            </div>
          ) : null}
        </div>
      </div>

      {/* Lienzo del mapa: flujo bajo el formulario en móvil y fondo completo en escritorio. */}
      <div className="px-4 pb-3 sm:px-6 lg:absolute lg:inset-0 lg:p-0">
        <div className="relative h-[40dvh] min-h-[260px] w-full overflow-hidden rounded-xl border border-line bg-surface-sunken lg:h-full lg:min-h-0 lg:rounded-none lg:border-0">
          <MapErrorBoundary
            onError={() => setMapUnavailable(true)}
            fallbackLegend={
              <RouteTextLegend
                preview={preview}
                fastestHours={fastestHours}
                hasActiveSearch={hasActiveSearch}
                forceVisible={true}
                podium={podium?.podium}
              />
            }
          >
            <Suspense
              fallback={
                <div
                  role="status"
                  aria-live="polite"
                  className="flex h-full w-full items-center justify-center gap-2 bg-surface-sunken text-sm text-fg-muted lg:pl-[460px]"
                >
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>{t('map.loading')}</span>
                </div>
              }
            >
              <LazyRouteMap
                preview={hasActiveSearch ? preview : null}
                podium={podium?.podium}
                originAirports={originAirports}
                destinationAirports={destinationAirports}
                fitTrigger={fitTrigger}
                onUnavailableChange={setMapUnavailable}
              />
            </Suspense>
          </MapErrorBoundary>
        </div>
      </div>

      {/* Móvil: el podio en flujo bajo el mapa (orden DOM = orden visual). */}
      {!isDesktop && podiumPanel ? <div className="px-4 pb-4 sm:px-6">{podiumPanel}</div> : null}

      {/* Leyenda textual: visible bajo el mapa en móvil o en fallback, sr-only en escritorio activo. */}
      <div
        className={cn(
          'px-4 pb-6 sm:px-6',
          mapUnavailable
            ? 'lg:pointer-events-auto lg:absolute lg:right-6 lg:bottom-6 lg:left-[444px] lg:z-10 lg:p-0'
            : 'lg:p-0',
        )}
      >
        <RouteTextLegend
          preview={hasActiveSearch ? preview : null}
          fastestHours={fastestHours}
          hasActiveSearch={hasActiveSearch}
          forceVisible={mapUnavailable}
          podium={podium?.podium}
        />
      </div>
    </div>
  );
}
