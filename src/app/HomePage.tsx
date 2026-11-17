import { Loader2 } from 'lucide-react';
import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { MapErrorBoundary } from '@/features/map/components/MapErrorBoundary';
import { RouteTextLegend } from '@/features/map/components/RouteTextLegend';
import { SearchPanel } from '@/features/search/components/SearchPanel';
import { useRoutePreview } from '@/features/search/hooks/useRoutePreview';
import {
  buildSearchParams,
  computeFastestHours,
  parseSearchParams,
  type SearchCriteria,
} from '@/features/search/searchCriteria';
import { type City, type CityAirport } from '@/shared/api/schemas';
import { cn } from '@/shared/ui/cn';

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
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

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

  const [fitTrigger, setFitTrigger] = useState(0);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [resolvedCities, setResolvedCities] = useState<{
    origin: City | null;
    destination: City | null;
  }>({ origin: null, destination: null });

  const handleSubmitCriteria = useCallback(
    (nextCriteria: SearchCriteria) => {
      setSearchParams(buildSearchParams(nextCriteria, searchParams));
      setFitTrigger((count) => count + 1);
    },
    [searchParams, setSearchParams],
  );

  const handleAirportsDebouncedChange = useCallback(
    (nextCriteria: SearchCriteria) => {
      setSearchParams(buildSearchParams(nextCriteria, searchParams), { replace: true });
      setFitTrigger((count) => count + 1);
    },
    [searchParams, setSearchParams],
  );

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
            onRetryPreview={retryPreview}
            onSubmitCriteria={handleSubmitCriteria}
            onAirportsDebouncedChange={handleAirportsDebouncedChange}
            onResolvedCitiesChange={handleResolvedCitiesChange}
          />
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
                originAirports={originAirports}
                destinationAirports={destinationAirports}
                fitTrigger={fitTrigger}
                onUnavailableChange={setMapUnavailable}
              />
            </Suspense>
          </MapErrorBoundary>
        </div>
      </div>

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
        />
      </div>
    </div>
  );
}
