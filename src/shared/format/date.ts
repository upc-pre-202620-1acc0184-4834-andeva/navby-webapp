/** Fecha de calendario `YYYY-MM-DD` («1 nov 2026»): sin hora, así que no depende de la zona. */
export function formatCalendarDate(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** Día de un instante (`created_at`, `quoted_at`) en la zona horaria del usuario. */
export function formatInstantDate(isoInstant: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(isoInstant));
}

/** Fecha y hora de un movimiento en la zona horaria del usuario con reloj de 24 horas (`h23`). */
export function formatInstantDateTime(isoInstant: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(isoInstant));
}
