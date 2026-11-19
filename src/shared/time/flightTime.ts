/**
 * Horas de vuelo: el backend entrega horas de pared locales de cada aeropuerto sin offset
 * («2026-11-01T08:30:00»). Se tratan como UTC solo para formatear/restar sin desplazarlas.
 */
function naiveToUtcMs(naiveIso: string): number {
  return Date.parse(`${naiveIso.slice(0, 19)}Z`);
}

/** «08:30» (24 h, compacto como en un pase de abordar) en la hora local del aeropuerto. */
export function formatLocalTime(naiveIso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(naiveToUtcMs(naiveIso));
}

/** «1 nov» en la fecha local del aeropuerto. */
export function formatLocalDate(naiveIso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(naiveToUtcMs(naiveIso));
}

/** Días que la llegada cae después de la salida (fechas locales), p. ej. +1. */
export function dayOffset(departureIso: string, arrivalIso: string): number {
  const day = (iso: string) => Math.floor(naiveToUtcMs(iso) / 86_400_000);
  return day(arrivalIso) - day(departureIso);
}

/**
 * Minutos de conexión: llegada y salida son del mismo aeropuerto (misma zona horaria),
 * así que la resta directa de horas de pared es exacta.
 */
export function layoverMinutes(arrivalIso: string, nextDepartureIso: string): number {
  return Math.max(
    0,
    Math.round((naiveToUtcMs(nextDepartureIso) - naiveToUtcMs(arrivalIso)) / 60_000),
  );
}

export function splitMinutes(totalMinutes: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.round(totalMinutes));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}
