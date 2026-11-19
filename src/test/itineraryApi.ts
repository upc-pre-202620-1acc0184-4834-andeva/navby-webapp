import {
  type ItineraryJson,
  itineraryJson,
  itineraryPage,
  savedOffer,
} from '@/test/fixtures/itineraries';
import { at, oneWayOffers, podiumResponse } from '@/test/fixtures/podium';
import { type ApiHandler, jsonResponse } from '@/test/renderApp';

/** Id del itinerario que crea el POST simulado. */
export const CREATED_ID = '00000000-0000-4000-8000-0000000000a2';

/** Guardados del backend simulado: el POST crea (201) o reconoce (200), el GET y el DELETE lo reflejan. */
export function savedStore(initial: ItineraryJson[] = []) {
  const items = [...initial];
  const handlers: Record<string, ApiHandler> = {
    'GET /itineraries': () => jsonResponse(200, itineraryPage(items)),
    'POST /itineraries': (init) => {
      const { offer_id } = JSON.parse(String(init?.body)) as { offer_id: string };
      const existing = items.find((item) => item.offer.offer_id === offer_id);
      if (existing) return jsonResponse(200, existing);
      const created = itineraryJson({ id: CREATED_ID, offer: savedOffer(at(oneWayOffers, 1)) });
      items.unshift(created);
      return jsonResponse(201, created);
    },
  };
  // Cada DELETE quita su fila (204); los ids son fijos y por eso se declaran uno por uno.
  for (const { id } of initial) {
    handlers[`DELETE /itineraries/${id}`] = () => {
      const index = items.findIndex((item) => item.id === id);
      if (index >= 0) items.splice(index, 1);
      return jsonResponse(204);
    };
  }
  return { items, handlers };
}

/** `POST /quotes/search` con un podio vigente (o con los cambios que pida la prueba). */
export const quote = (overrides = {}) => ({
  'POST /quotes/search': () => jsonResponse(200, podiumResponse(overrides)),
});
