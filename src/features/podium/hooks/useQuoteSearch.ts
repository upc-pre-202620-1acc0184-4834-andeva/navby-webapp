import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type QuoteSearchPayload, searchQuotes } from '@/shared/api/endpoints';
import { preferenceKey, selectionFromApi } from '../preferences';
import { quoteKeys } from '../quoteKeys';

/** Cotizar cuesta créditos: es una mutación, nunca una query que se reintente sola. */
export function useQuoteSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: QuoteSearchPayload) => searchQuotes(payload),
    onSuccess: (data) => {
      // Siembra el podio con el perfil cotizado: usePodium lo lee sin otra petición.
      const key = preferenceKey(selectionFromApi(data.preferences));
      queryClient.setQueryData(quoteKeys.podium(data.search_id, key), data);
    },
  });
}
