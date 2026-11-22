import { type Itinerary } from '@/shared/api/schemas';

/** Construye la ruta a `/` con los criterios de un itinerario guardado para cotizar precios actuales. */
export function buildLiveSearchHref(itinerary: Itinerary): string {
  const params = new URLSearchParams();
  params.set('trip', itinerary.trip_type);
  params.set('from', itinerary.origin);
  params.set('to', itinerary.destination);
  params.set('dep', itinerary.departure_date);
  if (itinerary.trip_type === 'ROUND_TRIP' && itinerary.return_date) {
    params.set('ret', itinerary.return_date);
  }
  return `/?${params.toString()}`;
}
