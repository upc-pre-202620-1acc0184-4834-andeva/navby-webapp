import { ArrowLeftRight, ArrowRight, Calendar, ChevronRight, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { type Itinerary, type Leg } from '@/shared/api/schemas';
import { formatCalendarDate, formatInstantDate } from '@/shared/format/date';
import { formatDuration, formatStops } from '@/shared/format/flight';
import { useMoney } from '@/shared/format/useMoney';
import { dayOffset, formatLocalTime } from '@/shared/time/flightTime';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';

export interface ItineraryRowProps {
  itinerary: Itinerary;
  locale: string;
  onDelete: (itinerary: Itinerary) => void;
}

function LegTimeLine({ leg, locale }: { leg: Leg; locale: string }) {
  const { t } = useTranslation();
  const first = leg.segments[0];
  const last = leg.segments[leg.segments.length - 1];
  if (!first || !last) return null;
  const nextDay = dayOffset(leg.departure, leg.arrival);

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs tabular-nums">
      <div className="flex items-center gap-1.5">
        <span className="font-semibold text-fg-muted">
          {t(leg.direction === 'OUTBOUND' ? 'podium.outbound' : 'podium.inbound')}
        </span>
        <span className="font-semibold text-fg">
          {formatLocalTime(leg.departure, locale)} → {formatLocalTime(leg.arrival, locale)}
        </span>
        {nextDay > 0 ? (
          <span className="font-semibold text-brand-ink">
            {t('podium.nextDay', { count: nextDay })}
          </span>
        ) : null}
      </div>
      <span className="text-fg-muted">
        {first.from} → {last.to}
      </span>
    </div>
  );
}

/** Fila de la lista (US-23): tarjeta con forma de billete de vuelo (cuerpo + talón perforado). */
export function ItineraryRow({ itinerary, locale, onDelete }: ItineraryRowProps) {
  const { t } = useTranslation();
  const { format } = useMoney();
  const { offer } = itinerary;
  const departure = formatCalendarDate(itinerary.departure_date, locale);
  const dates = itinerary.return_date
    ? t('itineraries.dates', {
        departure,
        return: formatCalendarDate(itinerary.return_date, locale),
      })
    : departure;
  const RouteIcon = itinerary.trip_type === 'ROUND_TRIP' ? ArrowLeftRight : ArrowRight;

  return (
    <Card
      padding="none"
      className="group relative grid grid-cols-1 overflow-hidden transition-[border-color,background-color] duration-150 ease-(--ease-out) hover:border-line-strong has-[a.stretched-link:focus-visible]:border-primary has-[a.stretched-link:focus-visible]:ring-2 has-[a.stretched-link:focus-visible]:ring-ring/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-stretch"
    >
      <div className="flex min-w-0 flex-col gap-2.5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-sunken px-2 py-0.5 text-xs font-bold tracking-wide text-fg tabular-nums">
            <span>{itinerary.origin}</span>
            <RouteIcon className="h-3 w-3 text-brand-ink" aria-hidden="true" />
            <span>{itinerary.destination}</span>
          </span>
          <span className="text-xs font-medium text-fg-muted">
            {t(`itineraries.tripType.${itinerary.trip_type}`)}
          </span>
          <Badge variant={offer.profile === 'BALANCED' ? 'affinity' : 'neutral'}>
            {t(`podium.preferences.profiles.${offer.profile}`)}
          </Badge>
        </div>

        {/* El enlace cubre todo el billete; Eliminar queda por encima en z-10. */}
        <Link
          to={`/itineraries/${itinerary.id}`}
          className="stretched-link line-clamp-2 text-base leading-snug font-semibold text-fg after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none sm:truncate"
        >
          {itinerary.name}
        </Link>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted sm:text-sm">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{dates}</span>
          </span>
          {offer.airlines.length > 0 ? (
            <ul
              className="flex flex-wrap items-center gap-x-2.5 gap-y-1"
              aria-label={t('podium.airlines')}
            >
              {offer.airlines.map((airline) => (
                <li key={airline.iata} className="inline-flex items-center gap-1.5 text-fg">
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
                  <span className="text-xs font-medium">{airline.name}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-col gap-1 rounded-lg bg-surface-sunken/75 px-3 py-2">
          {offer.legs.map((leg) => (
            <LegTimeLine key={leg.direction} leg={leg} locale={locale} />
          ))}
          <p className="text-xs font-medium text-fg-muted tabular-nums">
            {[formatDuration(t, offer.duration_minutes), formatStops(t, offer.stops)].join(' · ')}
          </p>
        </div>

        <p className="text-xs text-fg-muted">
          {t('itineraries.savedOn', { date: formatInstantDate(itinerary.created_at, locale) })}
        </p>
      </div>

      {/* Talón del billete separado por línea perforada y muescas semicirculares */}
      <div className="relative flex items-center justify-between gap-3 border-t border-dashed border-line-strong/45 bg-surface-sunken/35 px-4 py-3.5 sm:min-w-[184px] sm:flex-col sm:items-end sm:border-t-0 sm:border-l sm:px-5 sm:py-5">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-2 -left-[9px] z-10 hidden h-4 w-4 rounded-full border border-line bg-bg transition-colors duration-150 ease-(--ease-out) group-hover:border-line-strong sm:block"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-2 -left-[9px] z-10 hidden h-4 w-4 rounded-full border border-line bg-bg transition-colors duration-150 ease-(--ease-out) group-hover:border-line-strong sm:block"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-[9px] -left-2 z-10 h-4 w-4 rounded-full border border-line bg-bg transition-colors duration-150 ease-(--ease-out) group-hover:border-line-strong sm:hidden"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-[9px] -right-2 z-10 h-4 w-4 rounded-full border border-line bg-bg transition-colors duration-150 ease-(--ease-out) group-hover:border-line-strong sm:hidden"
        />

        <div className="flex flex-col sm:items-end">
          <span className="text-xl font-extrabold tracking-tight text-fg tabular-nums sm:text-2xl">
            {format(offer.price.amount, offer.price.currency)}
          </span>
          <span className="text-xs text-fg-muted">{t('itineraries.priceAtSave')}</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand-ink"
          >
            <span>{t('itineraries.viewDetail')}</span>
            <ChevronRight className="h-3.5 w-3.5 transition-transform duration-150 ease-(--ease-out) group-hover:translate-x-0.5 motion-reduce:transform-none" />
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="relative z-10 shrink-0 text-fg-muted hover:text-error-ink"
            aria-label={t('itineraries.deleteAria', { name: itinerary.name })}
            onClick={() => onDelete(itinerary)}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
