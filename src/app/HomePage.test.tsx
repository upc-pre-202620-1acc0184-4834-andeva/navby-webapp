import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDaysIso, getTodayInLima } from '@/features/search/searchCriteria';
import { setSessionToken } from '@/shared/api/client';
import { type City, type RoutePreviewResponse } from '@/shared/api/schemas';
import { HomePage } from './HomePage';

vi.mock('@/features/map/components/RouteMap', () => ({
  default: ({ preview }: { preview: RoutePreviewResponse | null | undefined }) => (
    <div
      data-testid="lazy-route-map"
      data-route={preview?.best_route?.airports.map((a) => a.iata).join('-') ?? 'empty'}
    />
  ),
}));

const LIMA: City = {
  city: 'Lima',
  city_es: 'Lima',
  country: 'Peru',
  airports: [{ iata: 'LIM', name: 'Jorge Chávez Intl', lat: -12.02, lon: -77.11 }],
};

const TOKYO: City = {
  city: 'Tokyo',
  city_es: 'Tokio',
  country: 'Japan',
  airports: [
    { iata: 'HND', name: 'Haneda Airport', lat: 35.55, lon: 139.78 },
    { iata: 'NRT', name: 'Narita International', lat: 35.77, lon: 140.39 },
  ],
};

function renderHome(initialUrl: string) {
  setSessionToken('jwt-test', 900);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter([{ path: '/', element: <HomePage /> }], {
    initialEntries: [initialUrl],
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { router };
}

describe('HomePage (Plan 2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('muestra título, buscador y recarga una búsqueda compartida desde la URL (US-12 y US-14)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/api/v1/routing/cities')) {
        const q = new URL(url, 'http://localhost').searchParams.get('q') ?? '';
        const cities = q === 'LIM' ? [LIMA] : q === 'HND' ? [TOKYO] : [];
        return new Response(JSON.stringify({ cities }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (url.includes('/api/v1/routing/preview')) {
        return new Response(
          JSON.stringify({
            reachable: true,
            pairs: [{ origin: 'LIM', destination: 'HND', min_stops: 1, t_min_minutes: 1320 }],
            best_route: {
              t_min_minutes: 1320,
              airports: [
                { iata: 'LIM', lat: -12.02, lon: -77.11 },
                { iata: 'LAX', lat: 33.94, lon: -118.41 },
                { iata: 'HND', lat: 35.55, lon: 139.78 },
              ],
            },
            telemetry: {
              pairs_evaluated: 1,
              bfs_ms: 4,
              astar_ms: 9,
              astar_nodes_expanded: 14,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      if (url.includes('/api/v1/quotes/search')) {
        return new Response(
          JSON.stringify({
            search_id: 'srch_01HOMEPAGETEST00000000000',
            expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
            credits_charged: 0,
            credits_remaining: 10,
            partial: false,
            pairs_quoted: [{ origin: 'LIM', destination: 'HND' }],
            t_min_minutes: 2760,
            offers_received: 12,
            pareto_size: 4,
            preferences: {
              profile: 'BALANCED',
              weights: { price: 0.5, duration: 0.3, stops: 0.2 },
            },
            price_disclaimer: 'Precio referencial.',
            podium: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      return new Response('{}', { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const futureDep = addDaysIso(getTodayInLima(), 14);
    renderHome(
      `/?trip=ONE_WAY&from=LIM&to=HND,NRT&dep=${futureDep}&ad=1&ch=0&in=0&cabin=ECONOMY&cur=USD`,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Buscador de vuelos' }),
    ).toBeInTheDocument();

    expect(
      await screen.findByText(/Tramos estimados: LIM → LAX → HND \(1 escala\)/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Ruta física más rápida/)).not.toBeInTheDocument();

    expect(screen.getByTestId('lazy-route-map')).toHaveAttribute('data-route', 'LIM-LAX-HND');
  });

  it('sincroniza la URL y el mapa al enviar Buscar (US-11 y US-12)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/api/v1/routing/cities')) {
        const q = (new URL(url, 'http://localhost').searchParams.get('q') ?? '').toLowerCase();
        const cities = q.includes('lim') ? [LIMA] : q.includes('tok') ? [TOKYO] : [];
        return new Response(JSON.stringify({ cities }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (url.includes('/api/v1/routing/preview')) {
        return new Response(
          JSON.stringify({
            reachable: true,
            pairs: [{ origin: 'LIM', destination: 'HND', min_stops: 1, t_min_minutes: 2760 }],
            best_route: {
              t_min_minutes: 1320,
              airports: [
                { iata: 'LIM', lat: -12.02, lon: -77.11 },
                { iata: 'LAX', lat: 33.94, lon: -118.41 },
                { iata: 'HND', lat: 35.55, lon: 139.78 },
              ],
            },
            telemetry: {
              pairs_evaluated: 2,
              bfs_ms: 5,
              astar_ms: 10,
              astar_nodes_expanded: 18,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      if (url.includes('/api/v1/quotes/search')) {
        return new Response(
          JSON.stringify({
            search_id: 'srch_01HOMEPAGETEST00000000000',
            expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
            credits_charged: 0,
            credits_remaining: 10,
            partial: false,
            pairs_quoted: [{ origin: 'LIM', destination: 'HND' }],
            t_min_minutes: 2760,
            offers_received: 12,
            pareto_size: 4,
            preferences: {
              profile: 'BALANCED',
              weights: { price: 0.5, duration: 0.3, stops: 0.2 },
            },
            price_disclaimer: 'Precio referencial.',
            podium: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      return new Response('{}', { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);
    const { router } = renderHome('/');

    const user = userEvent.setup();
    await user.type(screen.getByRole('combobox', { name: 'Origen' }), 'Lim');
    await user.click(await screen.findByRole('option', { name: /Lima, Perú/ }));

    await user.type(screen.getByRole('combobox', { name: 'Destino' }), 'Tok');
    await user.click(await screen.findByRole('option', { name: /Tokio, Japón/ }));

    // Selecciona salida y regreso en el calendario popover.
    await user.click(screen.getByRole('button', { name: 'Salida' }));
    const depDays = screen.getAllByRole('gridcell');
    const enabledDay = depDays
      .map((cell) => cell.querySelector('button:not([disabled])'))
      .find((btn): btn is HTMLButtonElement => btn !== null);
    expect(enabledDay).toBeDefined();
    await user.click(enabledDay!);

    await user.click(screen.getByRole('button', { name: 'Regreso' }));
    const retDays = screen
      .getAllByRole('gridcell')
      .map((cell) => cell.querySelector('button:not([disabled])'))
      .filter((btn): btn is HTMLButtonElement => btn !== null);
    await user.click(retDays[1] ?? retDays[0]!);

    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(router.state.location.search).toContain('from=LIM');
      expect(router.state.location.search).toContain('to=HND%2CNRT');
    });

    // Al buscar, la vista pasa a resultados con Ver detalles, Simular ruta y flecha atrás para volver.
    const detailsButtons = await screen.findAllByRole('button', { name: 'Ver detalles' });
    await user.click(detailsButtons[0]!);
    expect(await screen.findByText('Detalles del análisis')).toBeInTheDocument();
    expect(screen.getByText('5.00 ms')).toBeInTheDocument();
    expect(screen.getByText('10.00 ms')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();

    // Abre la simulación animada paso a paso y recorre fases/pares.
    await user.click(screen.getByRole('button', { name: 'Simular cómo se halló la ruta' }));
    expect(await screen.findByText('1. Expansión por niveles desde origen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Siguiente fase' }));
    expect(await screen.findByText('2. Búsqueda guiada por pares')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Siguiente fase' }));
    expect(await screen.findByText('3. Comparación y convergencia')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Cerrar' })[0]!);

    const backBtn = await screen.findByRole('button', { name: 'Volver al buscador' });
    await user.click(backBtn);

    expect(await screen.findByRole('button', { name: 'Ver recomendaciones' })).toBeInTheDocument();
  });
});
