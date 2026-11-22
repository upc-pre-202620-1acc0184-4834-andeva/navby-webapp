import { type PreferenceSelection, toApiPreferences } from '@/features/podium/preferences';
import { type SearchCriteria } from '@/features/search/searchCriteria';
import { type QuoteSearchPayload } from '@/shared/api/endpoints';

/** Criterios y perfil de la URL → cuerpo de `POST /quotes/search`. */
export function toQuotePayload(
  criteria: SearchCriteria,
  selection: PreferenceSelection,
): QuoteSearchPayload {
  return {
    trip_type: criteria.tripType,
    origins: criteria.origins,
    destinations: criteria.destinations,
    departure_date: criteria.departureDate,
    return_date: criteria.tripType === 'ROUND_TRIP' ? criteria.returnDate || null : null,
    passengers: {
      adults: criteria.adults,
      children: criteria.children,
      infants: criteria.infants,
    },
    cabin: criteria.cabin,
    preferences: toApiPreferences(selection),
  };
}
