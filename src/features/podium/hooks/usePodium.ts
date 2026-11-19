import { useQuery } from '@tanstack/react-query';
import { rankQuotes } from '@/shared/api/endpoints';
import { type PreferenceSelection, preferenceKey, toApiPreferences } from '../preferences';
import { quoteKeys } from '../quoteKeys';

/** Opciones de la query del podio; `usePodium` y el cambio de perfil comparten la misma. */
export function podiumQueryOptions(searchId: string, selection: PreferenceSelection) {
  return {
    queryKey: quoteKeys.podium(searchId, preferenceKey(selection)),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      rankQuotes(searchId, toApiPreferences(selection), signal),
    staleTime: Infinity,
    retry: false,
  } as const;
}

/**
 * Podio vigente por `search_id` y perfil (US-19, US-20). Tras cotizar viene sembrado en caché;
 * al recargar se lee con `POST /rank` (gratis). Sin reintentos: 404 = vencida o ajena.
 */
export function usePodium(searchId: string | null, selection: PreferenceSelection) {
  return useQuery({
    ...podiumQueryOptions(searchId ?? '', selection),
    enabled: searchId !== null,
  });
}
