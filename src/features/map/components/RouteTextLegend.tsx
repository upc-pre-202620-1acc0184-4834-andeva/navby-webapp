import { useTranslation } from 'react-i18next';
import { type PodiumOffer, type RoutePreviewResponse } from '@/shared/api/schemas';
import { Card } from '@/shared/ui/Card';
import { cn } from '@/shared/ui/cn';

export interface RouteTextLegendProps {
  preview: RoutePreviewResponse | null | undefined;
  fastestHours: number | null;
  hasActiveSearch: boolean;
  forceVisible?: boolean;
  /** Rutas del podio: equivalente textual de los 3 arcos (tramos y escalas). */
  podium?: PodiumOffer[];
  /** Título propio (el detalle de un itinerario no es una ruta «preliminar»). */
  heading?: string;
  /** Rótulo único de cada ruta del podio en lugar de «Ruta de la opción N:». */
  routeLabel?: string;
}

function legChain(offer: PodiumOffer): string[] {
  return offer.legs.map((leg) =>
    [leg.segments[0]?.from, ...leg.segments.map((segment) => segment.to)].join(' → '),
  );
}

/**
 * Resumen textual de la ruta preliminar. Permanece accesible para lectores de pantalla
 * en escritorio cuando el mapa WebGL está activo y visible bajo el mapa en móvil o en fallback.
 */
export function RouteTextLegend({
  preview,
  fastestHours,
  hasActiveSearch,
  forceVisible = false,
  podium,
  heading,
  routeLabel,
}: RouteTextLegendProps) {
  const { t } = useTranslation();

  const routeAirports = preview?.reachable ? (preview.best_route?.airports ?? []) : [];
  const hasRoute = routeAirports.length >= 2 && fastestHours !== null;
  const stopsCount = Math.max(0, routeAirports.length - 2);
  const routeChain = routeAirports.map((a) => a.iata).join(' → ');
  const hasPodium = hasActiveSearch && podium !== undefined && podium.length > 0;

  return (
    <section
      aria-label={heading ?? t('map.legendHeading')}
      className={cn(forceVisible ? 'block' : 'lg:sr-only')}
    >
      <Card padding="md">
        <h2 className="text-sm font-semibold text-fg">{heading ?? t('map.legendHeading')}</h2>
        {!hasActiveSearch ? (
          <p className="mt-1.5 text-sm text-fg-muted">{t('map.legendEmpty')}</p>
        ) : preview && !preview.reachable ? (
          <p className="mt-1.5 text-sm text-warning-ink">
            {t('search.unreachableTitle')}. {t('search.unreachableDescription')}
          </p>
        ) : hasRoute ? (
          <p className="mt-1.5 text-sm text-fg-muted tabular-nums">
            {t('map.legendSummary', {
              route: routeChain,
              stops: t('map.stops', { count: stopsCount }),
              hours: fastestHours,
            })}
          </p>
        ) : hasPodium ? null : (
          <p className="mt-1.5 text-sm text-fg-muted">{t('search.previewLoading')}</p>
        )}
        {hasPodium ? (
          <ol className="mt-2 flex flex-col gap-1 text-sm text-fg-muted tabular-nums">
            {podium.map((offer) => (
              <li key={offer.offer_id}>
                <span className="font-semibold text-fg">
                  {routeLabel ?? t('map.legendPodiumRoute', { rank: offer.rank })}
                </span>{' '}
                {legChain(offer).join(' · ')}
              </li>
            ))}
          </ol>
        ) : null}
      </Card>
    </section>
  );
}
