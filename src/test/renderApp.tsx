import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, type InitialEntry, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { routes } from '@/app/router';
import { bindSessionSync } from '@/shared/auth/useSession';

export type ApiHandler = (init: RequestInit | undefined) => Response | Promise<Response>;

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

/** Mock de `fetch` por "MÉTODO /ruta" (sin `/api/v1` ni query); lo no declarado falla. */
export function mockApi(handlers: Record<string, ApiHandler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace('/api/v1', '').split('?')[0];
    const key = `${init?.method ?? 'GET'} ${path}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unmocked API call: ${key}`);
    return handler(init);
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
