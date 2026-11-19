import { describe, expect, it } from 'vitest';
import { itineraryJson, itineraryPage, roundTripItinerary } from '@/test/fixtures/itineraries';
import { ItineraryPageSchema, ItinerarySchema } from './schemas';

describe('schemas de itinerarios', () => {
  it('normaliza from_iata / to_iata de la oferta guardada a from / to', () => {
    const itinerary = ItinerarySchema.parse(itineraryJson());
    const segment = itinerary.offer.legs[0]?.segments[0];
    expect(segment).toMatchObject({ from: 'LIM', to: 'MAD', flight_number: 'LA2510' });
    expect(segment).not.toHaveProperty('from_iata');
  });

  it('acepta también los tramos con from / to', () => {
    const json = itineraryJson();
    const offer = json.offer as { legs: { segments: Record<string, unknown>[] }[] };
    const segment = offer.legs[0]!.segments[0]!;
    const { from_iata, to_iata, ...rest } = segment;
    offer.legs[0]!.segments[0] = { ...rest, from: from_iata, to: to_iata };
    expect(ItinerarySchema.parse(json).offer.legs[0]?.segments[0]?.from).toBe('LIM');
  });

  it('acepta un puesto fuera del podio y un perfil desconocido', () => {
    const json = {
      ...roundTripItinerary,
      offer: { ...roundTripItinerary.offer, profile: 'FUTURE_PROFILE' },
    };
    const itinerary = ItinerarySchema.parse(json);
    expect(itinerary.offer.rank).toBe(5);
    expect(itinerary.offer.profile).toBe('BALANCED');
    expect(itinerary.return_date).toBe('2026-11-15');
  });

  it('valida la página de la lista', () => {
    const page = ItineraryPageSchema.parse(itineraryPage([itineraryJson(), roundTripItinerary]));
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(2);
  });

  it('rechaza un itinerario sin oferta', () => {
    expect(ItinerarySchema.safeParse({ ...itineraryJson(), offer: undefined }).success).toBe(false);
  });
});
