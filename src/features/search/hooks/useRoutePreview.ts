import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { getRoutePreview, type RoutePreviewParams } from '@/shared/api/endpoints';
import { isApiError } from '@/shared/api/errors';

const RATE_LIMIT_COOLDOWN_MS = 15_000;

function hasDisjointValidAirports(params: RoutePreviewParams | null): params is RoutePreviewParams {
  if (!params) return false;
  if (params.origins.length === 0 || params.destinations.length === 0) return false;
  if (params.origins.length > 5 || params.destinations.length > 5) return false;
  const originSet = new Set(params.origins);
  return !params.destinations.some((iata) => originSet.has(iata));
}

export function useRoutePreview(params: RoutePreviewParams | null) {
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const valid = hasDisjointValidAirports(params);
  const originsKey = valid ? [...params.origins].sort().join(',') : '';
  const destinationsKey = valid ? [...params.destinations].sort().join(',') : '';
  const tripType = params?.tripType ?? 'ROUND_TRIP';

  const query = useQuery({
    queryKey: ['routing', 'preview', originsKey, destinationsKey, tripType],
    queryFn: async ({ signal }) => {
      if (!params) throw new Error('Route preview params missing');
      try {
        return await getRoutePreview(params, signal);
      } catch (err) {
        if (isApiError(err) && (err.status === 429 || err.code === 'RATE_LIMITED')) {
          const until = Date.now() + RATE_LIMIT_COOLDOWN_MS;
          setCooldownUntil(until);
          setNowMs(Date.now());
        }
        throw err;
      }
    },
    enabled: valid,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  const isCooldownActive = cooldownUntil > nowMs;

  useEffect(() => {
    if (!isCooldownActive) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (current >= cooldownUntil) {
        window.clearInterval(timer);
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [cooldownUntil, isCooldownActive]);

  const safeRefetch = useCallback(() => {
    if (cooldownUntil > Date.now()) return;
    void query.refetch();
  }, [cooldownUntil, query]);

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isCooldownActive,
    refetch: safeRefetch,
  };
}
