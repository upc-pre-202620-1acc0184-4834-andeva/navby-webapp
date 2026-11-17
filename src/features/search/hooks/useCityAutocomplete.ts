import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { searchCities } from '@/shared/api/endpoints';
import { type CitiesResponse, type City } from '@/shared/api/schemas';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debounced;
}

export function useCitySearchQuery(rawQuery: string) {
  const trimmed = rawQuery.trim();
  const debounced = useDebouncedValue(trimmed, 200);
  const enabled = debounced.length >= 2;

  return useQuery({
    queryKey: ['routing', 'cities', debounced.toLowerCase()],
    queryFn: ({ signal }) => searchCities({ q: debounced, limit: 10 }, signal),
    enabled,
    staleTime: 5 * 60_000,
  });
}

function findCachedCityByIata(
  entries: ReadonlyArray<[readonly unknown[], CitiesResponse | undefined]>,
  iata: string,
): City | null {
  for (const [, data] of entries) {
    if (!data) continue;
    const match = data.cities.find((city) => city.airports.some((a) => a.iata === iata));
    if (match) return match;
  }
  return null;
}

export interface HydratedCityResult {
  city: City | null;
  notFound: boolean;
  crossCityMismatch: boolean;
  isLoading: boolean;
}

/**
 * Reconstruye la ciudad completa y su lista de aeropuertos a partir de los códigos IATA de la URL.
 */
export function useHydrateCityByIata(
  iatas: ReadonlyArray<string>,
  enabled: boolean,
): HydratedCityResult {
  const queryClient = useQueryClient();
  const firstIata = iatas[0] ?? '';
  const shouldFetch = enabled && firstIata.length === 3;

  const query = useQuery({
    queryKey: ['routing', 'city-hydrate', firstIata],
    queryFn: async ({ signal }): Promise<CitiesResponse> => {
      const cachedQueries = queryClient.getQueriesData<CitiesResponse>({
        queryKey: ['routing', 'cities'],
      });
      const cached = findCachedCityByIata(cachedQueries, firstIata);
      if (cached) {
        return { cities: [cached] };
      }
      return searchCities({ q: firstIata, limit: 20 }, signal);
    },
    enabled: shouldFetch,
    staleTime: 10 * 60_000,
  });

  if (!shouldFetch) {
    return {
      city: null,
      notFound: false,
      crossCityMismatch: false,
      isLoading: false,
    };
  }

  const cities = query.data?.cities ?? [];
  const matchedCity =
    cities.find((city) => city.airports.some((airport) => airport.iata === firstIata)) ?? null;

  const notFound = query.isSuccess && matchedCity === null;
  const crossCityMismatch =
    matchedCity !== null &&
    iatas.some((code) => !matchedCity.airports.some((airport) => airport.iata === code));

  return {
    city: matchedCity,
    notFound,
    crossCityMismatch,
    isLoading: query.isLoading,
  };
}
