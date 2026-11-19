import { ExternalLink } from 'lucide-react';
import { type FocusEvent, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { type Leg, type PodiumOffer } from '@/shared/api/schemas';
import { type PodiumRank, usePodiumHighlight } from '@/shared/state/podiumHighlight';
import { dayOffset, formatLocalTime, layoverMinutes } from '@/shared/time/flightTime';
import { Badge } from '@/shared/ui/Badge';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { Card } from '@/shared/ui/Card';
import { cn } from '@/shared/ui/cn';
import { PriceDisclaimer } from '@/shared/ui/PriceDisclaimer';
import { formatDuration, formatExtra, formatPrice, formatStops } from '../format';

/** Borde del puesto con el color de su ruta en el mapa (el número da la señal sin color). */
const RANK_RING: Record<PodiumRank, string> = {
  1: 'border-route-1',
  2: 'border-route-2',
  3: 'border-route-3',
};

export interface PodiumCardProps {
  offer: PodiumOffer;
  locale: string;
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

  return (
    <div className="flex flex-col gap-0.5">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-fg tabular-nums">
        <span className="text-xs font-semibold text-fg-muted">
          {t(leg.direction === 'OUTBOUND' ? 'podium.outbound' : 'podium.inbound')}
        </span>
        <span className="font-semibold">
          {formatLocalTime(leg.departure, locale)} {first.from}
          <span aria-hidden="true"> → </span>
          <span className="sr-only"> {t('podium.to')} </span>
          {formatLocalTime(leg.arrival, locale)} {last.to}
          {nextDay > 0 ? (
            <sup className="ml-0.5 text-xs font-semibold text-fg-muted">
              {t('podium.nextDay', { count: nextDay })}
            </sup>
          ) : null}
        </span>
      </p>
      <p className="text-xs text-fg-muted tabular-nums">
        {[
          formatDuration(t, leg.duration_minutes),
          ...layovers.map((stop) =>
            t('podium.layover', { iata: stop.iata, duration: formatDuration(t, stop.minutes) }),
          ),
          leg.segments.map((segment) => segment.flight_number).join(' · '),
        ].join(' · ')}
      </p>
    </div>
  );
}

/** Tarjeta del podio (DESIGN.md §Tarjeta): puesto y afinidad → precio → duración → aerolíneas → acción. */
export function PodiumCard({ offer, locale }: PodiumCardProps) {
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
      className="flex flex-col gap-3 transition-colors duration-150 ease-(--ease-out)"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-fg">
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-full border-[3px] text-sm font-bold tabular-nums',
              RANK_RING[rank],
            )}
          >
            {rank}
          </span>
          {t('podium.rankLabel', { rank })}
        </h3>
        <Badge variant="affinity">{t('podium.affinity', { pct: offer.match_pct })}</Badge>
      </div>

      <div>
        <p className="text-3xl font-extrabold tracking-tight text-fg tabular-nums">
          {formatPrice(offer.price.amount, offer.price.currency, locale)}
        </p>
        <p className="mt-1 text-sm text-fg-muted tabular-nums">
          {[
            formatDuration(t, offer.duration_minutes),
            formatStops(t, offer.stops),
            formatExtra(t, offer.extra_minutes_vs_t_min),
          ].join(' · ')}
        </p>
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label={t('podium.airlines')}>
        {offer.airlines.map((airline) => (
          <li key={airline.iata} className="flex items-center gap-1.5 text-sm font-medium text-fg">
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
            {airline.name}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        {offer.legs.map((leg) => (
          <LegSummary key={leg.direction} leg={leg} locale={locale} />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PriceDisclaimer className="sm:max-w-[60%]" />
        <a
          href={offer.deep_link}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'buy', className: 'shrink-0' })}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          {t('podium.buy')}
          <span className="sr-only">{t('podium.buyHint', { rank })}</span>
        </a>
      </div>
    </Card>
  );
}
