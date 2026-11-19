import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  deleteItinerary,
  getItinerary,
  listItineraries,
  saveItinerary,
} from '@/shared/api/endpoints';
import { isApiError } from '@/shared/api/errors';
import { type ItineraryPage } from '@/shared/api/schemas';
import { itineraryKeys } from '../itineraryKeys';

/** Los guardados del usuario, el más reciente primero. Una sola página: el tope es 50 (RN-13). */
export function useItineraries(enabled = true) {
  return useQuery({
    queryKey: itineraryKeys.list(),
    queryFn: ({ signal }) => listItineraries(signal),
    enabled,
  });
}

/** Detalle: sin `initialData` (la fila de la lista no trae nada que el detalle no tenga). */
export function useItinerary(id: string) {
  return useQuery({
    queryKey: itineraryKeys.detail(id),
    queryFn: ({ signal }) => getItinerary(id, signal),
  });
}

/** `offer_id` → id del itinerario guardado, para marcar «Guardado» en las tarjetas del podio. */
export function useSavedOfferIds(enabled: boolean): Map<string, string> {
  const { data } = useItineraries(enabled);
  return useMemo(
    () => new Map((data?.items ?? []).map((item) => [item.offer.offer_id, item.id])),
    [data],
  );
}

/** Guardar es gratis e idempotente: nunca toca el saldo (RN-13). */
export function useSaveItinerary() {
  const queryClient = useQueryClient();
  const invalidateList = () => queryClient.invalidateQueries({ queryKey: itineraryKeys.list() });

  return useMutation({
    mutationFn: saveItinerary,
    onSuccess: (itinerary) => {
      queryClient.setQueryData<ItineraryPage>(itineraryKeys.list(), (page) =>
        !page || page.items.some((item) => item.id === itinerary.id)
          ? page
          : { ...page, items: [itinerary, ...page.items], total: page.total + 1 },
      );
      void invalidateList();
    },
    onError: (error) => {
      // La caché decía que había lugar: el servidor dice que no.
      if (isApiError(error) && error.code === 'ITINERARY_LIMIT_REACHED') void invalidateList();
    },
  });
}

export type DeleteResult = 'deleted' | 'gone';

/**
 * Eliminar no es optimista: el diálogo espera la respuesta. `404` también cierra el caso
 * («gone»): el itinerario ya no existe. El detalle en caché lo quita quien llama, después de navegar.
 */
export function useDeleteItinerary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<DeleteResult> => {
      try {
        await deleteItinerary(id);
        return 'deleted';
      } catch (error) {
        if (isApiError(error) && error.status === 404) return 'gone';
        throw error;
      }
    },
    onSuccess: (_result, id) => {
      queryClient.setQueryData<ItineraryPage>(itineraryKeys.list(), (page) => {
        if (!page || !page.items.some((item) => item.id === id)) return page;
        return {
          ...page,
          items: page.items.filter((item) => item.id !== id),
          total: Math.max(0, page.total - 1),
        };
      });
      void queryClient.invalidateQueries({ queryKey: itineraryKeys.list() });
    },
  });
}
