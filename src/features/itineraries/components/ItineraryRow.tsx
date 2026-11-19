import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { type Itinerary } from '@/shared/api/schemas';
import { formatCalendarDate, formatInstantDate } from '@/shared/format/date';
import { formatDuration, formatPrice, formatStops } from '@/shared/format/flight';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';

export interface ItineraryRowProps {
  itinerary: Itinerary;
  locale: string;
  onDelete: (itinerary: Itinerary) => void;
}

/** Fila de la lista (US-23): nombre → fechas → precio del momento → cuándo se guardó. */
export function ItineraryRow({ itinerary, locale, onDelete }: ItineraryRowProps) {
  const { t } = useTranslation();
  const { offer } = itinerary;
  const departure = formatCalendarDate(itinerary.departure_date, locale);
  const dates = itinerary.return_date
    ? t('itineraries.dates', {
        departure,
        return: formatCalendarDate(itinerary.return_date, locale),
      })
    : departure;

  return (
    <Card className="relative flex items-center gap-3 transition-colors duration-150 ease-(--ease-out) hover:border-line-strong">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* El enlace cubre toda la fila; Eliminar queda por encima. */}
        <Link
          to={`/itineraries/${itinerary.id}`}
          className="truncate text-base font-semibold text-fg after:absolute after:inset-0 after:rounded-xl"
        >
          {itinerary.name}
        </Link>
        <p className="text-sm text-fg-muted tabular-nums">{dates}</p>
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm tabular-nums">
          <span className="font-semibold text-fg">
            {formatPrice(offer.price.amount, offer.price.currency, locale)}
          </span>
          <span className="text-fg-muted">
            {[formatDuration(t, offer.duration_minutes), formatStops(t, offer.stops)].join(' · ')}
          </span>
        </p>
        <p className="text-xs text-fg-muted">
          {t('itineraries.savedOn', { date: formatInstantDate(itinerary.created_at, locale) })}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="relative z-10 shrink-0"
        aria-label={t('itineraries.deleteAria', { name: itinerary.name })}
        onClick={() => onDelete(itinerary)}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </Card>
  );
}
