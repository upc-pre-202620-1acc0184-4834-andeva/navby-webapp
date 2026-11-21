import { useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowLeft, Loader2, Search } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { sileo } from 'sileo';
import { formatResetTime, walletKeys } from '@/features/billing/hooks/useWallet';
import { SaveItineraryButton } from '@/features/itineraries/components/SaveItineraryButton';
import { useSavedOfferIds } from '@/features/itineraries/hooks/useItineraries';
import { MapErrorBoundary } from '@/features/map/components/MapErrorBoundary';
import { RouteTextLegend } from '@/features/map/components/RouteTextLegend';
import { PodiumPanel } from '@/features/podium/components/PodiumPanel';
import { PreferenceSelector } from '@/features/podium/components/PreferenceSelector';
import { SearchDetailsDialog } from '@/features/podium/components/SearchDetailsDialog';
import { podiumQueryOptions, usePodium } from '@/features/podium/hooks/usePodium';
import { useQuoteSearch } from '@/features/podium/hooks/useQuoteSearch';
import {
  parsePreferences,
  type PreferenceSelection,
  preferenceKey,
  readDefaultPreference,
  writePreferences,
} from '@/features/podium/preferences';
import { isQuoteErrorShownInline } from '@/features/podium/quoteErrors';
import { MapBottomSheet, type SheetSnap } from '@/features/search/components/MapBottomSheet';
import { SearchPanel } from '@/features/search/components/SearchPanel';
import { useRoutePreview } from '@/features/search/hooks/useRoutePreview';
import {
  buildSearchParams,
  computeFastestHours,
  isoToUtcDate,
  parseSearchParams,
  type SearchCriteria,
} from '@/features/search/searchCriteria';
import { isApiError } from '@/shared/api/errors';
import { type City, type CityAirport, type PodiumOffer, type Wallet } from '@/shared/api/schemas';
import { markEmailUnverified, useSession } from '@/shared/auth/useSession';
import { formatPrice } from '@/shared/format/flight';
import { useIntlLocale } from '@/shared/i18n/useIntlLocale';
import { saveLastSearch } from '@/shared/search/lastSearch';
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

function formatShortDate(iso: string, locale: string): string {
  const date = isoToUtcDate(iso);
  if (!date) return '';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

function resolveCityName(city: City | null, fallbackIatas: string[], lang: 'es' | 'en'): string {
  if (city) {
    return lang === 'es' ? (city.city_es ?? city.city) : city.city;
  }
  return fallbackIatas.join(', ');
}

export function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const locale = useIntlLocale();
  const lang: 'es' | 'en' = (i18n.resolvedLanguage ?? i18n.language).startsWith('en') ? 'en' : 'es';

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

  const { user } = useSession();
  const defaultPreference = useMemo(() => readDefaultPreference(user?.user_id), [user?.user_id]);
  const searchId = hasActiveSearch ? searchParams.get(SEARCH_ID_PARAM) : null;
  const selection = useMemo(
    () => parsePreferences(searchParams, defaultPreference),
    [defaultPreference, searchParams],
  );
  const selectionKey = preferenceKey(selection);
  const quoteSearch = useQuoteSearch();
  const podiumQuery = usePodium(searchId, selection);
  const [isPodiumStale, setIsPodiumStale] = useState(false);
  const setHighlightedRank = usePodiumHighlight((state) => state.setHighlightedRank);

  // Modo de vista dentro del panel: formulario o resultados (reemplaza los inputs al buscar).
  const [viewMode, setViewMode] = useState<'search' | 'results'>(() =>
    searchId ? 'results' : 'search',
  );
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>(() => (searchId ? 'half' : 'half'));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const resultsScrollRef = useRef<HTMLDivElement>(null);

  // Recuerda la búsqueda activa para restaurarla al volver desde el logo o links de navegación.
  useEffect(() => {
    if (!user?.user_id || !hasActiveSearch) return;
    const clean = new URLSearchParams(searchParams);
    clean.delete('lang');
    const serialized = clean.toString();
    if (serialized) {
      saveLastSearch(user.user_id, `?${serialized}`);
    }
  }, [user?.user_id, hasActiveSearch, searchParams]);

  // Si se limpia la URL estando en `/` (p. ej. clic en el logo), vuelve a la vista inicial.
  const [prevHasSearchQuery, setPrevHasSearchQuery] = useState(hasSearchQuery);
  if (prevHasSearchQuery !== hasSearchQuery) {
    setPrevHasSearchQuery(hasSearchQuery);
    if (!hasSearchQuery && !quoteSearch.isPending && viewMode !== 'search') {
      setViewMode('search');
    }
  }

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
        markEmailUnverified(queryClient);
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
      mutateQuote(toQuotePayload(nextCriteria, parsePreferences(targetParams, defaultPreference)), {
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
    [defaultPreference, handleQuoteError, mutateQuote, queryClient, setSearchParams],
  );

  const handleSubmitCriteria = useCallback(
    (nextCriteria: SearchCriteria) => {
      const next = writePreferences(buildSearchParams(nextCriteria, searchParams), selection);
      next.delete(SEARCH_ID_PARAM);
      setSearchParams(next);
      setFitTrigger((count) => count + 1);
      setViewMode('results');
      setSheetSnap('half');
      if (resultsScrollRef.current) resultsScrollRef.current.scrollTop = 0;
      // Preview (por el cambio de URL) y cotización van en paralelo.
      runQuote(nextCriteria, next);
    },
    [runQuote, searchParams, selection, setSearchParams],
  );

  const handleAirportsDebouncedChange = useCallback(
    (nextCriteria: SearchCriteria) => {
      const next = buildSearchParams(nextCriteria, searchParams);
      // Otros aeropuertos = otro podio: no se recotiza solo (cuesta créditos).
      if (next.has(SEARCH_ID_PARAM) || quoteSearch.data !== undefined) setIsPodiumStale(true);
      next.delete(SEARCH_ID_PARAM);
      pendingQuoteParamsRef.current = null;
      resetQuote();
      setSearchParams(next, { replace: true });
      setFitTrigger((count) => count + 1);
    },
    [quoteSearch.data, resetQuote, searchParams, setSearchParams],
  );

  const handleRetryQuote = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete(SEARCH_ID_PARAM);
    setViewMode('results');
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
    () => (hasActiveSearch && preview ? computeFastestHours(preview, criteria.tripType) : null),
    [hasActiveSearch, preview, criteria.tripType],
  );

  const podium = podiumQuery.data;

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
  const isReranking = activePendingRank !== null;

  // US-22: guardar es gratis; la lista (≤ 50) dice qué ofertas ya están guardadas.
  const savedOfferIds = useSavedOfferIds(searchId !== null && (podium?.podium.length ?? 0) > 0);
  const renderOfferActions = useCallback(
    (offer: PodiumOffer) =>
      podium && searchId ? (
        <SaveItineraryButton
          searchId={searchId}
          expiresAt={podium.expires_at}
          offer={offer}
          savedItineraryId={savedOfferIds.get(offer.offer_id)}
          isExpired={isRankExpired}
          isReranking={isReranking}
          onExpired={() => setExpiredSid(searchId)}
          onSaved={(name) =>
            setRankAnnouncement({
              sid: searchId,
              key: selectionKey,
              text: t('podium.save.announce', { name }),
            })
          }
        />
      ) : null,
    [isRankExpired, isReranking, podium, savedOfferIds, searchId, selectionKey, t],
  );
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

  const activeView: 'search' | 'results' = showPodium ? viewMode : 'search';

  const originLabel = resolveCityName(resolvedCities.origin, criteria.origins, lang);
  const destLabel = resolveCityName(resolvedCities.destination, criteria.destinations, lang);
  const routeTitle = originLabel && destLabel ? `${originLabel} → ${destLabel}` : t('home.title');

  const datesLabel = criteria.departureDate
    ? criteria.tripType === 'ROUND_TRIP' && criteria.returnDate
      ? `${formatShortDate(criteria.departureDate, locale)} – ${formatShortDate(criteria.returnDate, locale)}`
      : formatShortDate(criteria.departureDate, locale)
    : '';
  const totalPassengers = criteria.adults + criteria.children + criteria.infants;
  const routeMeta = [
    datesLabel,
    t('search.adult', { count: totalPassengers }),
    t(`search.cabins.${criteria.cabin}`),
  ]
    .filter(Boolean)
    .join(' · ');

  const canShowDetails = activeView === 'results' && Boolean(preview?.telemetry || podium);

  const handleBackToSearch = () => {
    setViewMode('search');
    if (!isDesktop) setSheetSnap('full');
  };

  const handleOpenResults = () => {
    setViewMode('results');
    if (!isDesktop) setSheetSnap('half');
  };

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
      scrollIntoViewOnResult={false}
      isReranking={isReranking}
      renderOfferActions={renderOfferActions}
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

  const desktopResultsHeader = (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('home.backToSearch')}
        onClick={handleBackToSearch}
        className="shrink-0 rounded-full"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-bold text-fg sm:text-base">{routeTitle}</h1>
        {routeMeta ? (
          <p className="truncate text-xs text-fg-muted tabular-nums">{routeMeta}</p>
        ) : null}
      </div>
      {canShowDetails ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setDetailsOpen(true)}
          className="shrink-0 rounded-full"
        >
          <Activity className="h-3.5 w-3.5 text-brand-ink" aria-hidden="true" />
          <span>{t('podium.details.openButton')}</span>
        </Button>
      ) : null}
    </div>
  );

  const searchPanelNode = (
    <SearchPanel
      variant={isDesktop ? 'card' : 'embedded'}
      initialCriteria={criteria}
      hasActiveSearch={hasActiveSearch}
      preview={hasActiveSearch ? preview : undefined}
      previewError={hasActiveSearch ? previewError : null}
      isPreviewLoading={hasActiveSearch && isPreviewLoading}
      isPreviewFetching={hasActiveSearch && isPreviewFetching}
      isRateLimitCooldown={isCooldownActive}
      isQuoting={quoteSearch.isPending}
      hasStoredResults={Boolean(searchId || podium)}
      onViewResults={handleOpenResults}
      onRetryPreview={retryPreview}
      onSubmitCriteria={handleSubmitCriteria}
      onAirportsDebouncedChange={handleAirportsDebouncedChange}
      onResolvedCitiesChange={handleResolvedCitiesChange}
    />
  );

  const mobileBottomInset = sheetSnap === 'peek' ? 168 : sheetSnap === 'half' ? 360 : 48;

  const sheetSummary =
    activeView === 'results' ? (
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          data-no-drag="true"
          aria-label={t('home.backToSearch')}
          onClick={handleBackToSearch}
          className="-ml-1.5 h-9 w-9 shrink-0 rounded-full sm:h-9 sm:w-9"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold text-fg">{routeTitle}</h1>
          <p className="truncate text-xs text-fg-muted tabular-nums">
            {podium && podium.podium.length > 0
              ? t('home.sheetBestOffer', {
                  price: formatPrice(
                    podium.podium[0]!.price.amount,
                    podium.podium[0]!.price.currency,
                    locale,
                  ),
                })
              : routeMeta || t('podium.title')}
          </p>
        </div>
        {canShowDetails ? (
          <Button
            variant="secondary"
            size="sm"
            data-no-drag="true"
            aria-label={t('podium.details.openButton')}
            onClick={() => setDetailsOpen(true)}
            className="shrink-0 rounded-full px-2.5"
          >
            <Activity className="h-3.5 w-3.5 text-brand-ink" aria-hidden="true" />
            <span className="hidden min-[420px]:inline">{t('podium.details.openButton')}</span>
          </Button>
        ) : null}
      </div>
    ) : (
      <div className="min-w-0">
        <h1 className="truncate text-sm font-bold text-fg">{t('home.title')}</h1>
        <p className="truncate text-xs text-fg-muted tabular-nums">
          {hasActiveSearch && fastestHours !== null
            ? `${routeTitle} · ${t('home.sheetFastestMin', { hours: fastestHours })}`
            : t('home.mobileSearchPrompt')}
        </p>
      </div>
    );

  return (
    <div className="relative flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col overflow-hidden">
      {/* Lienzo del mapa a sangre en todos los breakpoints (Desktop, Laptop, Tablet, Mobile). */}
      <div className="absolute inset-0">
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
                className="flex h-full w-full items-center justify-center gap-2 bg-surface-sunken text-sm text-fg-muted lg:pl-[440px]"
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
              bottomInset={isDesktop ? 0 : mobileBottomInset}
              onUnavailableChange={setMapUnavailable}
            />
          </Suspense>
        </MapErrorBoundary>
      </div>

      {isDesktop ? (
        /* Laptop y Desktop: panel flotante sin scroll en búsqueda y reemplazo en sitio por resultados. */
        <div
          className={cn(
            'pointer-events-none absolute top-3 left-3 z-10 w-[392px] xl:top-4 xl:left-4 xl:w-[420px]',
          )}
        >
          <div
            className={cn(
              'pointer-events-auto flex flex-col overflow-hidden rounded-xl',
              activeView === 'results'
                ? 'max-h-[calc(100dvh-5.25rem)] border border-line bg-surface shadow-lg'
                : 'max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain',
            )}
          >
            {activeView === 'results' ? (
              <>
                <div className="shrink-0 border-b border-line bg-surface px-4 py-3">
                  {desktopResultsHeader}
                </div>
                <div
                  ref={resultsScrollRef}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
                >
                  {podiumPanel}
                </div>
              </>
            ) : (
              searchPanelNode
            )}
          </div>
        </div>
      ) : (
        /* Mobile y Tablet: barra flotante superior + hoja inferior arrastrable estilo Google Maps. */
        <>
          {sheetSnap !== 'full' ? (
            <div className="pointer-events-none absolute inset-x-3 top-3 z-20 md:right-auto md:left-4 md:w-[480px]">
              <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('search');
                    setSheetSnap('full');
                  }}
                  className="flex min-h-9 min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <Search className="h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">
                      {hasActiveSearch ? routeTitle : t('home.mobileSearchPrompt')}
                    </span>
                    {routeMeta ? (
                      <span className="block truncate text-xs text-fg-muted tabular-nums">
                        {routeMeta}
                      </span>
                    ) : null}
                  </span>
                </button>

                {canShowDetails ? (
                  <button
                    type="button"
                    onClick={() => setDetailsOpen(true)}
                    aria-label={t('podium.details.openButton')}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-surface-sunken px-2.5 text-xs font-semibold text-brand-ink transition-colors duration-150 ease-(--ease-out) hover:bg-line/60"
                  >
                    <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">{t('podium.details.openButton')}</span>
                  </button>
                ) : null}

                {activeView === 'results' ? (
                  <button
                    type="button"
                    onClick={handleBackToSearch}
                    className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-line px-2.5 text-xs font-semibold text-fg transition-colors duration-150 ease-(--ease-out) hover:bg-surface-sunken"
                  >
                    {t('home.editSearch')}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <MapBottomSheet snap={sheetSnap} onSnapChange={setSheetSnap} summary={sheetSummary}>
            {activeView === 'results' ? podiumPanel : searchPanelNode}

            <div className={mapUnavailable ? 'mt-4 border-t border-line pt-3' : 'sr-only'}>
              <RouteTextLegend
                preview={hasActiveSearch ? preview : null}
                fastestHours={fastestHours}
                hasActiveSearch={hasActiveSearch}
                forceVisible={mapUnavailable}
                podium={podium?.podium}
              />
            </div>
          </MapBottomSheet>
        </>
      )}

      {/* Leyenda textual: visible en fallback o sr-only en escritorio activo. */}
      {isDesktop ? (
        <div
          className={cn(
            mapUnavailable
              ? 'pointer-events-auto absolute right-6 bottom-6 left-[444px] z-10'
              : 'sr-only',
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
      ) : null}

      <SearchDetailsDialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        routeTitle={routeTitle}
        preview={hasActiveSearch ? preview : null}
        podium={podium}
        locale={locale}
      />
    </div>
  );
}
