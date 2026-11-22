import { z } from 'zod';
import { type RoutePreviewResponse } from '@/shared/api/schemas';

export const TRIP_TYPES = ['ONE_WAY', 'ROUND_TRIP'] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export const CABIN_CLASSES = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'] as const;
export type CabinClass = (typeof CABIN_CLASSES)[number];

export const MAX_PASSENGERS = 9;
export const MAX_AIRPORTS_PER_SIDE = 5;
export const MAX_ADVANCE_DAYS = 330;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IATA_RE = /^[A-Z]{3}$/;

export interface SearchCriteria {
  tripType: TripType;
  origins: string[];
  destinations: string[];
  departureDate: string;
  returnDate: string | null;
  adults: number;
  children: number;
  infants: number;
  cabin: CabinClass;
}

export const DEFAULT_SEARCH_CRITERIA: SearchCriteria = {
  tripType: 'ROUND_TRIP',
  origins: [],
  destinations: [],
  departureDate: '',
  returnDate: '',
  adults: 1,
  children: 0,
  infants: 0,
  cabin: 'ECONOMY',
};

/** Fecha actual en zona horaria `America/Lima` (UTC−5) en formato `YYYY-MM-DD` (RN-04). */
export function getTodayInLima(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    return now.toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
}

export function isoToUtcDate(isoDate: string): Date | undefined {
  if (!ISO_DATE_RE.test(isoDate)) return undefined;
  const [yStr, mStr, dStr] = isoDate.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return date;
}

export function utcDateToIso(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const base = isoToUtcDate(isoDate);
  if (!base) return isoDate;
  const shifted = new Date(base.getTime() + days * 86_400_000);
  return utcDateToIso(shifted);
}

export function createSearchCriteriaSchema(todayLima: string = getTodayInLima()) {
  const maxDateLima = addDaysIso(todayLima, MAX_ADVANCE_DAYS);

  return z
    .object({
      tripType: z.enum(TRIP_TYPES),
      origins: z
        .array(z.string().regex(IATA_RE, 'search.errors.originRequired'))
        .min(1, 'search.errors.originRequired')
        .max(MAX_AIRPORTS_PER_SIDE, 'search.errors.tooManyAirports'),
      destinations: z
        .array(z.string().regex(IATA_RE, 'search.errors.destinationRequired'))
        .min(1, 'search.errors.destinationRequired')
        .max(MAX_AIRPORTS_PER_SIDE, 'search.errors.tooManyAirports'),
      departureDate: z.string().min(1, 'search.errors.departureRequired'),
      returnDate: z.string().nullable(),
      adults: z
        .number()
        .int('search.errors.invalidPassengers')
        .min(1, 'search.errors.minAdults')
        .max(MAX_PASSENGERS, 'search.errors.maxPassengers'),
      children: z
        .number()
        .int('search.errors.invalidPassengers')
        .min(0, 'search.errors.invalidPassengers')
        .max(8, 'search.errors.maxPassengers'),
      infants: z
        .number()
        .int('search.errors.invalidPassengers')
        .min(0, 'search.errors.invalidPassengers'),
      cabin: z.enum(CABIN_CLASSES),
    })
    .superRefine((data, ctx) => {
      const originSet = new Set(data.origins);
      if (data.destinations.some((iata) => originSet.has(iata))) {
        ctx.addIssue({
          code: 'custom',
          message: 'search.errors.sameAirport',
          path: ['destinations'],
        });
      }

      const depValid = isoToUtcDate(data.departureDate) !== undefined;
      if (data.departureDate && !depValid) {
        ctx.addIssue({
          code: 'custom',
          message: 'search.errors.invalidDateFormat',
          path: ['departureDate'],
        });
      } else if (depValid) {
        if (data.departureDate < todayLima) {
          ctx.addIssue({
            code: 'custom',
            message: 'search.errors.departurePast',
            path: ['departureDate'],
          });
        } else if (data.departureDate > maxDateLima) {
          ctx.addIssue({
            code: 'custom',
            message: 'search.errors.dateTooFar',
            path: ['departureDate'],
          });
        }
      }

      if (data.tripType === 'ROUND_TRIP') {
        const ret = data.returnDate ?? '';
        if (!ret) {
          ctx.addIssue({
            code: 'custom',
            message: 'search.errors.returnRequired',
            path: ['returnDate'],
          });
        } else {
          const retValid = isoToUtcDate(ret) !== undefined;
          if (!retValid) {
            ctx.addIssue({
              code: 'custom',
              message: 'search.errors.invalidDateFormat',
              path: ['returnDate'],
            });
          } else {
            if (depValid && ret < data.departureDate) {
              ctx.addIssue({
                code: 'custom',
                message: 'search.errors.returnBeforeDeparture',
                path: ['returnDate'],
              });
            }
            if (ret > maxDateLima) {
              ctx.addIssue({
                code: 'custom',
                message: 'search.errors.dateTooFar',
                path: ['returnDate'],
              });
            }
          }
        }
      }

      if (data.infants > data.adults) {
        ctx.addIssue({
          code: 'custom',
          message: 'search.errors.infantsExceedAdults',
          path: ['infants'],
        });
      }

      if (data.adults + data.children + data.infants > MAX_PASSENGERS) {
        ctx.addIssue({
          code: 'custom',
          message: 'search.errors.maxPassengers',
          path: ['adults'],
        });
      }
    });
}

function parseIataList(raw: string | null): string[] {
  if (!raw) return [];
  const unique: string[] = [];
  for (const part of raw.split(',')) {
    const clean = part.trim().toUpperCase();
    if (IATA_RE.test(clean) && !unique.includes(clean)) {
      unique.push(clean);
    }
  }
  return unique;
}

function parseIntParam(raw: string | null, fallback: number): number {
  if (raw === null || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export interface ParsedSearchUrl {
  criteria: SearchCriteria;
  hasSearchQuery: boolean;
}

const SEARCH_PARAM_KEYS = ['trip', 'from', 'to', 'dep', 'ret', 'ad', 'ch', 'in', 'cabin'] as const;

/**
 * Lee los criterios desde la URL preservando valores inválidos (p. ej. `?ad=1&in=2` o fechas
 * vencidas) para que Zod señale el error exacto sin descartar la intención del enlace compartido.
 */
export function parseSearchParams(searchParams: URLSearchParams): ParsedSearchUrl {
  const hasSearchQuery = SEARCH_PARAM_KEYS.some((key) => searchParams.has(key));

  const tripRaw = searchParams.get('trip')?.trim().toUpperCase();
  const tripType: TripType =
    tripRaw === 'ONE_WAY' || tripRaw === 'ROUND_TRIP' ? tripRaw : DEFAULT_SEARCH_CRITERIA.tripType;

  const origins = parseIataList(searchParams.get('from'));
  const destinations = parseIataList(searchParams.get('to'));
  const departureDate = searchParams.get('dep')?.trim() ?? '';
  const returnRaw = searchParams.get('ret')?.trim() ?? '';
  const returnDate = tripType === 'ONE_WAY' ? null : returnRaw;

  const adults = parseIntParam(searchParams.get('ad'), DEFAULT_SEARCH_CRITERIA.adults);
  const children = parseIntParam(searchParams.get('ch'), DEFAULT_SEARCH_CRITERIA.children);
  const infants = parseIntParam(searchParams.get('in'), DEFAULT_SEARCH_CRITERIA.infants);

  const cabinRaw = searchParams.get('cabin')?.trim().toUpperCase();
  const cabin: CabinClass = (CABIN_CLASSES as ReadonlyArray<string>).includes(cabinRaw ?? '')
    ? (cabinRaw as CabinClass)
    : DEFAULT_SEARCH_CRITERIA.cabin;

  return {
    hasSearchQuery,
    criteria: {
      tripType,
      origins,
      destinations,
      departureDate,
      returnDate,
      adults,
      children,
      infants,
      cabin,
    },
  };
}

/**
 * Serializa los criterios de búsqueda en `URLSearchParams` conservando parámetros ajenos al
 * buscador (como `profile` o `lang`) y limpiando `ret` cuando `tripType === 'ONE_WAY'`.
 */
export function buildSearchParams(
  criteria: SearchCriteria,
  existingParams?: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(existingParams);

  next.set('trip', criteria.tripType);
  if (criteria.origins.length > 0) {
    next.set('from', criteria.origins.join(','));
  } else {
    next.delete('from');
  }

  if (criteria.destinations.length > 0) {
    next.set('to', criteria.destinations.join(','));
  } else {
    next.delete('to');
  }

  if (criteria.departureDate) {
    next.set('dep', criteria.departureDate);
  } else {
    next.delete('dep');
  }

  if (criteria.tripType === 'ROUND_TRIP' && criteria.returnDate) {
    next.set('ret', criteria.returnDate);
  } else {
    next.delete('ret');
  }

  next.set('ad', String(criteria.adults));
  next.set('ch', String(criteria.children));
  next.set('in', String(criteria.infants));
  next.set('cabin', criteria.cabin);
  // Los enlaces viejos con `cur` se limpian al reescribir la URL.
  next.delete('cur');

  return next;
}

export function computeFastestHours(
  preview: RoutePreviewResponse,
  tripType: TripType,
): number | null {
  if (!preview.reachable || !preview.best_route) return null;

  let minutes = preview.best_route.t_min_minutes;
  if (tripType === 'ROUND_TRIP' && preview.pairs.length > 0) {
    minutes = Math.min(...preview.pairs.map((pair) => pair.t_min_minutes));
  }
  return Math.max(1, Math.round(minutes / 60));
}
