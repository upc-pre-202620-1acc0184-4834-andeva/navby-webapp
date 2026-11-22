import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, type InitialEntry, RouterProvider } from 'react-router';
import { vi } from 'vitest';
// Precalienta la ruta principal lazy durante la carga del módulo para evitar timeouts en el primer test.
import '@/app/HomePage';
import { routes } from '@/app/router';
import { bindSessionSync } from '@/shared/auth/useSession';
import { packagesResponse, transactionsPage } from '@/test/fixtures/billing';
import { exchangeRatesResponse } from '@/test/fixtures/fx';
import { itineraryPage } from '@/test/fixtures/itineraries';
import { wallet } from '@/test/fixtures/podium';

export type ApiHandler = (init: RequestInit | undefined, url?: URL) => Response | Promise<Response>;

/** Respuesta JSON (o RFC 7807 si `status >= 400`). */
export function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: {
      'content-type': status >= 400 ? 'application/problem+json' : 'application/json',
    },
  });
}

export function problem(status: number, code: string): Response {
  return jsonResponse(status, { title: code, status, detail: code, code });
}

export const verifiedSession = {
  access_token: 'jwt-test',
  token_type: 'Bearer',
  expires_in: 900,
  user: { user_id: 'usr-1', email: 'ana@mail.com', full_name: 'Ana Torres', email_verified: true },
};

/** Saldo por defecto de la barra superior; cada prueba puede sobrescribirlo. */
const defaultHandlers: Record<string, ApiHandler> = {
  // Tipo de cambio público: con él las tarifas en USD se muestran en soles.
  'GET /fx/rates': () => jsonResponse(200, exchangeRatesResponse),
  'GET /billing/wallet': () => jsonResponse(200, wallet),
  'GET /billing/packages': () => jsonResponse(200, packagesResponse()),
  'GET /billing/transactions': () => jsonResponse(200, transactionsPage()),
  // Sin guardados: la lista de itinerarios se pide al ver un podio (US-22).
  'GET /itineraries': () => jsonResponse(200, itineraryPage([])),
};

/** Mock de `fetch` por "MÉTODO /ruta" (sin `/api/v1` ni query); lo no declarado falla. */
export function mockApi(overrides: Record<string, ApiHandler>) {
  const handlers = { ...defaultHandlers, ...overrides };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = String(input);
    const url = new URL(rawUrl, 'http://localhost');
    const path = rawUrl.replace('/api/v1', '').split('?')[0];
    const key = `${init?.method ?? 'GET'} ${path}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unmocked API call: ${key}`);
    return handler(init, url);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function renderApp(initialEntry: InitialEntry) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  bindSessionSync(queryClient);
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  return {
    router,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}
