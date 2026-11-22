import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDaysIso, getTodayInLima } from '@/features/search/searchCriteria';
import { type City } from '@/shared/api/schemas';
import { podiumResponse } from '@/test/fixtures/podium';
import {
  type ApiHandler,
  jsonResponse,
  mockApi,
  renderApp,
  verifiedSession,
} from '@/test/renderApp';

/** Helpers compartidos por las pruebas de flujo del podio y de itinerarios. */
export const LIMA: City = {
  city: 'Lima',
  city_es: 'Lima',
  country: 'Peru',
  airports: [{ iata: 'LIM', name: 'Jorge Chávez Intl', lat: -12.02, lon: -77.11 }],
};
export const MADRID: City = {
  city: 'Madrid',
  city_es: 'Madrid',
  country: 'Spain',
  airports: [{ iata: 'MAD', name: 'Barajas', lat: 40.47, lon: -3.56 }],
};

export const preview = {
  reachable: true,
  pairs: [{ origin: 'LIM', destination: 'MAD', min_stops: 0, t_min_minutes: 360 }],
  best_route: {
    t_min_minutes: 360,
    airports: [
      { iata: 'LIM', lat: -12.02, lon: -77.11 },
      { iata: 'MAD', lat: 40.47, lon: -3.56 },
    ],
  },
  telemetry: { pairs_evaluated: 1, bfs_ms: 1, astar_ms: 1, astar_nodes_expanded: 2 },
};

export const SID = podiumResponse().search_id;
export const dep = addDaysIso(getTodayInLima(), 20);
export const ret = addDaysIso(getTodayInLima(), 30);
export const ONE_WAY_URL = `/?trip=ONE_WAY&from=LIM&to=MAD&dep=${dep}&ad=1&ch=0&in=0&cabin=ECONOMY`;
export const ROUND_TRIP_URL = `/?trip=ROUND_TRIP&from=LIM&to=MAD&dep=${dep}&ret=${ret}&ad=1&ch=0&in=0&cabin=ECONOMY`;

export function setup(handlers: Record<string, ApiHandler>) {
  return mockApi({
    'POST /auth/refresh': () => jsonResponse(200, verifiedSession),
    'GET /routing/cities': () => jsonResponse(200, { cities: [LIMA, MADRID] }),
    'GET /routing/preview': () => jsonResponse(200, preview),
    ...handlers,
  });
}

export function callsTo(fetchMock: ReturnType<typeof mockApi>, method: string, pathPart: string) {
  return fetchMock.mock.calls.filter(
    ([url, init]) => (init?.method ?? 'GET') === method && String(url).includes(pathPart),
  );
}

export async function search(url = ONE_WAY_URL) {
  const result = renderApp(url);
  const user = userEvent.setup();
  const submit = await screen.findByRole('button', { name: 'Buscar' });
  await waitFor(() => expect(submit).toBeEnabled());
  await user.click(submit);
  return { ...result, user };
}

export async function findCards() {
  const list = await screen.findByRole('list', {
    name: 'Recomendaciones ordenadas de mejor a peor',
  });
  return Array.from(list.children) as HTMLElement[];
}
