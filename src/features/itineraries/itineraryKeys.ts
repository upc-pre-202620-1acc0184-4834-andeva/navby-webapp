/** Claves de TanStack Query de los itinerarios guardados (US-22 a US-24). */
export const itineraryKeys = {
  all: ['itineraries'] as const,
  list: () => ['itineraries', 'list'] as const,
  detail: (id: string) => ['itineraries', 'detail', id] as const,
};
