import { type PodiumOffer } from '@/shared/api/schemas';
import { at, oneWayOffers, roundTripOffer } from './podium';

/** Itinerario tal como lo responde la API: los tramos traen `from_iata` / `to_iata`. */
export interface ItineraryJson {
  id: string;
  name: string;
  trip_type: 'ONE_WAY' | 'ROUND_TRIP';
  origin: string;
  destination: string;
  departure_date: string;
  return_date: string | null;
  price_disclaimer: string;
  offer: Record<string, unknown>;
  created_at: string;
}

/** Mismo instante que `quoted_at`: a mediodía UTC la fecha local no cambia en casi ninguna zona. */
export const QUOTED_AT = '2026-10-15T12:00:00Z';

export function savedOffer(
  base: PodiumOffer,
  { rank = base.rank, profile = 'BALANCED' }: { rank?: number; profile?: string } = {},
): Record<string, unknown> {
  return {
    ...base,
    rank,
    legs: base.legs.map((leg) => ({
      ...leg,
      segments: leg.segments.map(({ from, to, ...segment }) => ({
        ...segment,
        from_iata: from,
        to_iata: to,
      })),
    })),
    profile,
    weights: { price: 0.5, duration: 0.3, stops: 0.2 },
    quoted_at: QUOTED_AT,
  };
}

export function itineraryJson(overrides: Partial<ItineraryJson> = {}): ItineraryJson {
  const offer = at(oneWayOffers, 0);
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'LIM → MAD · 2026-11-01',
    trip_type: 'ONE_WAY',
    origin: 'LIM',
    destination: 'MAD',
    departure_date: '2026-11-01',
    return_date: null,
    price_disclaimer:
      'Precio referencial obtenido de terceros; se confirma en el sitio del vendedor.',
    offer: savedOffer(offer),
    created_at: '2026-10-15T12:00:00Z',
    ...overrides,
  };
}

/** Ida y vuelta guardada con el puesto 5 (no existe en el podio de hoy). */
export const roundTripItinerary = itineraryJson({
  id: '00000000-0000-4000-8000-000000000002',
  name: 'LIM → MAD · 2026-11-01',
  trip_type: 'ROUND_TRIP',
  return_date: '2026-11-15',
  offer: savedOffer(roundTripOffer, { rank: 5, profile: 'SAVER' }),
  created_at: '2026-10-14T12:00:00Z',
});

export function itineraryPage(items: ItineraryJson[], total = items.length) {
  return { items, page: 1, page_size: 50, total };
}

/** `count` itinerarios, el más reciente primero (como responde el backend). */
export function manyItineraries(count: number): ItineraryJson[] {
  return Array.from({ length: count }, (_, index) => {
    const departure = new Date(Date.UTC(2026, 11, 1 + index)).toISOString().slice(0, 10);
    return itineraryJson({
      id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
      name: `LIM → MAD · ${departure}`,
      departure_date: departure,
      created_at: new Date(Date.UTC(2026, 9, 15, 12) - index * 3_600_000).toISOString(),
    });
  });
}
