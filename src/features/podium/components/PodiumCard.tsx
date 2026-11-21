import { ExternalLink, Plane } from 'lucide-react';
import { type FocusEvent, type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { type Leg, type PodiumOffer } from '@/shared/api/schemas';
import { formatDuration, formatExtra, formatPrice, formatStops } from '@/shared/format/flight';
import { type PodiumRank, usePodiumHighlight } from '@/shared/state/podiumHighlight';
import { dayOffset, formatLocalTime, layoverMinutes } from '@/shared/time/flightTime';
import { Badge } from '@/shared/ui/Badge';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { Card } from '@/shared/ui/Card';
import { cn } from '@/shared/ui/cn';
import { PriceDisclaimer } from '@/shared/ui/PriceDisclaimer';

/** Borde del puesto con el color de su ruta en el mapa (el número da la señal sin color). */
const RANK_RING: Record<PodiumRank, string> = {
  1: 'border-route-1 bg-route-1 text-white',
  2: 'border-route-2 text-fg',
  3: 'border-route-3 text-fg',
};

export interface PodiumCardProps {
  offer: PodiumOffer;
  locale: string;
  /** Acciones junto a Comprar (p. ej. Guardar); el podio no sabe de itinerarios. */
  actions?: ReactNode;
  /** Aviso de precio propio (itinerario guardado); por defecto el aviso RL-03 del idioma. */
  disclaimer?: string;
  /** Reemplaza puesto y afinidad (un itinerario guardado no tiene puesto en el podio de hoy). */
  heading?: ReactNode;
}

function LegSummary({ leg, locale }: { leg: Leg; locale: string }) {
  const { t } = useTranslation();
  const first = leg.segments[0];
  const last = leg.segments[leg.segments.length - 1];
  if (!first || !last) return null;
  const nextDay = dayOffset(leg.departure, leg.arrival);
  const layovers = leg.segments.slice(1).map((segment, index) => ({
    iata: segment.from,
    minutes: layoverMinutes(leg.segments[index]?.arrival ?? segment.departure, segment.departure),
  }));
  const flightCodes = leg.segments.map((segment) => segment.flight_number).join(' · ');

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface-sunken/75 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-fg-muted">
          {t(leg.direction === 'OUTBOUND' ? 'podium.outbound' : 'podium.inbound')}
        </span>
        <span className="truncate text-fg-muted tabular-nums">{flightCodes}</span>
      </div>

      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <div className="flex flex-col">
          <span className="text-base leading-tight font-bold text-fg tabular-nums">
            {formatLocalTime(leg.departure, locale)}
          </span>
          <span className="text-xs font-semibold text-fg-muted">{first.from}</span>
        </div>

        <div className="flex min-w-0 flex-col items-center gap-1 text-center">
          <span className="text-xs font-medium text-fg-muted tabular-nums">
            {formatDuration(t, leg.duration_minutes)}
          </span>
          <div className="relative flex w-full items-center">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
            <span className="h-px flex-1 bg-line-strong" aria-hidden="true" />
            {layovers.map((stop) => (
              <span
                key={stop.iata}
                className="mx-0.5 h-2 w-2 shrink-0 rounded-full border border-surface bg-brand-ink"
                aria-hidden="true"
              />
            ))}
            {layovers.length > 0 ? (
              <span className="h-px flex-1 bg-line-strong" aria-hidden="true" />
            ) : null}
            <Plane className="ml-0.5 h-3 w-3 shrink-0 text-fg-muted" aria-hidden="true" />
          </div>
          <span className="max-w-full truncate text-xs text-fg-muted tabular-nums">
            {layovers.length === 0
              ? t('podium.direct')
              : layovers
                  .map((stop) =>
                    t('podium.layover', {
                      iata: stop.iata,
                      duration: formatDuration(t, stop.minutes),
                    }),
                  )
                  .join(' · ')}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-base leading-tight font-bold text-fg tabular-nums">
            {formatLocalTime(leg.arrival, locale)}
            {nextDay > 0 ? (
              <sup className="ml-0.5 text-xs font-semibold text-brand-ink">
                {t('podium.nextDay', { count: nextDay })}
              </sup>
            ) : null}
          </span>
          <span className="text-xs font-semibold text-fg-muted">{last.to}</span>
        </div>
      </div>
    </div>
  );
}

/** Tarjeta del podio (DESIGN.md §Tarjeta): puesto y afinidad → precio y aerolíneas → línea de tiempo → acción. */
export function PodiumCard({ offer, locale, actions, disclaimer, heading }: PodiumCardProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const rank = offer.rank as PodiumRank;
  const isHighlighted = usePodiumHighlight((state) => state.highlightedRank === rank);
  const setHighlightedRank = usePodiumHighlight((state) => state.setHighlightedRank);

  const clearHighlight = () => {
    if (usePodiumHighlight.getState().highlightedRank === rank) setHighlightedRank(null);
  };
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) clearHighlight();
  };

  return (
    <Card
      variant={isHighlighted ? 'highlighted' : 'default'}
      aria-labelledby={titleId}
      role="group"
      onPointerEnter={() => setHighlightedRank(rank)}
      onPointerLeave={clearHighlight}
      onFocus={() => setHighlightedRank(rank)}
      onBlur={handleBlur}
      className={cn(
        'flex flex-col gap-3 p-3.5 transition-colors duration-150 ease-(--ease-out) sm:p-4',
        !isHighlighted && rank === 1 && heading === undefined && 'border-primary/40',
        isHighlighted && 'shadow-sm',
      )}
    >
      {heading !== undefined ? (
        <p id={titleId} className="text-sm font-semibold text-fg">
          {heading}
        </p>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <h3 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-fg">
            <span
              aria-hidden="true"
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums',
                RANK_RING[rank],
              )}
            >
              {rank}
            </span>
            {t('podium.rankLabel', { rank })}
          </h3>
          <Badge variant="affinity">{t('podium.affinity', { pct: offer.match_pct })}</Badge>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-2xl font-extrabold tracking-tight text-fg tabular-nums sm:text-3xl">
            {formatPrice(offer.price.amount, offer.price.currency, locale)}
          </p>
          <ul
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1"
            aria-label={t('podium.airlines')}
          >
            {offer.airlines.map((airline) => (
              <li
                key={airline.iata}
                className="flex items-center gap-1.5 text-xs font-semibold text-fg"
              >
                {airline.logo ? (
                  <img
                    src={airline.logo}
                    alt=""
                    width={16}
                    height={16}
                    loading="lazy"
                    className="h-4 w-4 rounded-sm"
                  />
                ) : null}
                <span>{airline.name}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-fg-muted tabular-nums">
          {[
            formatDuration(t, offer.duration_minutes),
            formatStops(t, offer.stops),
            formatExtra(t, offer.extra_minutes_vs_t_min),
          ].join(' · ')}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {offer.legs.map((leg) => (
          <LegSummary key={leg.direction} leg={leg} locale={locale} />
        ))}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-line pt-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={offer.deep_link}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'buy', className: 'flex-1 shrink-0' })}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {t('podium.buy')}
            <span className="sr-only">
              {heading !== undefined ? t('podium.buyHintSaved') : t('podium.buyHint', { rank })}
            </span>
          </a>
          {actions}
        </div>
        <PriceDisclaimer text={disclaimer} />
      </div>
    </Card>
  );
}
