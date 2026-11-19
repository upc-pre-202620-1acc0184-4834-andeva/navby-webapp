import { type TFunction } from 'i18next';
import { splitMinutes } from '@/shared/time/flightTime';

/** Precio total: sin decimales si es exacto («USD 240»), si no con 2 («USD 980.50»). */
export function formatPrice(amount: string, currency: string, locale: string): string {
  const value = Number(amount);
  const digits = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** «6 h 15 min», «45 min», «8 h». */
export function formatDuration(t: TFunction, totalMinutes: number): string {
  const { hours, minutes } = splitMinutes(totalMinutes);
  if (hours === 0) return t('podium.duration.minutes', { minutes });
  if (minutes === 0) return t('podium.duration.hours', { hours });
  return t('podium.duration.hoursMinutes', { hours, minutes });
}

export function formatStops(t: TFunction, stops: number): string {
  return stops === 0 ? t('podium.direct') : t('podium.stops', { count: stops });
}

/** «+2 h 30 min sobre el mínimo físico» o «En el mínimo físico». */
export function formatExtra(t: TFunction, extraMinutes: number): string {
  return extraMinutes <= 0
    ? t('podium.atMinimum')
    : t('podium.overMinimum', { duration: formatDuration(t, extraMinutes) });
}
