import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setSessionToken } from '@/shared/api/client';
import { ApiError } from '@/shared/api/errors';
import { type City, type RoutePreviewResponse } from '@/shared/api/schemas';
import { addDaysIso, DEFAULT_SEARCH_CRITERIA, getTodayInLima } from '../searchCriteria';
import { SearchPanel, type SearchPanelProps } from './SearchPanel';

const LIMA: City = {
  city: 'Lima',
  city_es: null,
  country: 'Peru',
  airports: [
    { iata: 'LIM', name: 'Jorge Chavez International Airport', lat: -12.0219, lon: -77.1143 },
  ],
};

const TOKYO: City = {
  city: 'Tokyo',
  city_es: 'Tokio',
  country: 'Japan',
  airports: [
    { iata: 'HND', name: 'Tokyo Haneda International Airport', lat: 35.5523, lon: 139.78 },
    { iata: 'NRT', name: 'Narita International Airport', lat: 35.7647, lon: 140.3864 },
  ],
};

const REACHABLE_PREVIEW: RoutePreviewResponse = {
  reachable: true,
  pairs: [
    { origin: 'LIM', destination: 'NRT', min_stops: 1, t_min_minutes: 2562 },
    { origin: 'LIM', destination: 'HND', min_stops: 1, t_min_minutes: 2570 },
  ],
  best_route: {
    t_min_minutes: 1281,
    airports: [
      { iata: 'LIM', lat: -12.0219, lon: -77.1143 },
      { iata: 'LAX', lat: 33.9425, lon: -118.4081 },
      { iata: 'NRT', lat: 35.7647, lon: 140.3864 },
    ],
  },
  telemetry: { pairs_evaluated: 2, bfs_ms: 0.8, astar_ms: 1.5, astar_nodes_expanded: 190 },
};

function renderPanel(overrides: Partial<SearchPanelProps> = {}) {
  setSessionToken('jwt-test', 900);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props: SearchPanelProps = {
    initialCriteria: DEFAULT_SEARCH_CRITERIA,
    hasActiveSearch: false,
    preview: undefined,
    previewError: null,
    isPreviewLoading: false,
    isPreviewFetching: false,
    isRateLimitCooldown: false,
    onRetryPreview: vi.fn(),
    onSubmitCriteria: vi.fn(),
    onAirportsDebouncedChange: vi.fn(),
    ...overrides,
  };

  return {
    ...render(
      <QueryClientProvider client={client}>
        <SearchPanel {...props} />
      </QueryClientProvider>,
    ),
    props,
  };
}

describe('SearchPanel (US-12 y US-34)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('envía un viaje familiar válido en ejecutiva (US-34)', async () => {
    const today = getTodayInLima();
    const dep = addDaysIso(today, 10);
    const ret = addDaysIso(today, 20);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const cities = url.includes('LIM') ? [LIMA] : [TOKYO];
        return new Response(JSON.stringify({ cities }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    const onSubmitCriteria = vi.fn();
    renderPanel({
      initialCriteria: {
        ...DEFAULT_SEARCH_CRITERIA,
        origins: ['LIM'],
        destinations: ['HND', 'NRT'],
        departureDate: dep,
        returnDate: ret,
      },
      onSubmitCriteria,
    });

    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Origen' })).toHaveValue('Lima, Perú'),
    );

    await user.click(screen.getByRole('button', { name: /Pasajeros/ }));
    await user.click(screen.getByRole('button', { name: 'Aumentar Adultos' }));
    await user.click(screen.getByRole('button', { name: 'Aumentar Niños' }));
    await user.click(screen.getByRole('button', { name: 'Aumentar Infantes' }));

    await user.selectOptions(screen.getByLabelText('Cabina'), 'BUSINESS');

    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() =>
      expect(onSubmitCriteria).toHaveBeenCalledWith({
        tripType: 'ROUND_TRIP',
        origins: ['LIM'],
        destinations: ['HND', 'NRT'],
        departureDate: dep,
        returnDate: ret,
        adults: 2,
        children: 1,
        infants: 1,
        cabin: 'BUSINESS',
      }),
    );
  });

  it('muestra errores de pasajeros y fechas inválidas desde URL sin enviar búsqueda (US-34)', async () => {
    const today = getTodayInLima();
    const pastDate = addDaysIso(today, -1);

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ cities: [LIMA, TOKYO] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );

    const onSubmitCriteria = vi.fn();
    renderPanel({
      initialCriteria: {
        ...DEFAULT_SEARCH_CRITERIA,
        origins: ['LIM'],
        destinations: ['HND'],
        departureDate: pastDate,
        returnDate: addDaysIso(today, -3),
        adults: 1,
        children: 0,
        infants: 2,
      },
      onSubmitCriteria,
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByText('Cada infante debe viajar con un adulto.')).toBeVisible();
    expect(screen.getByText('La salida no puede ser anterior a hoy (hora de Lima).')).toBeVisible();
    expect(screen.getByText('El regreso no puede ser anterior a la salida.')).toBeVisible();
    expect(onSubmitCriteria).not.toHaveBeenCalled();
  });

  it('no muestra el aviso de duración física previa, sí muestra ruta imposible y error 429 (US-12)', () => {
    const { rerender } = renderPanel({
      initialCriteria: { ...DEFAULT_SEARCH_CRITERIA, tripType: 'ROUND_TRIP' },
      preview: REACHABLE_PREVIEW,
    });

    expect(screen.queryByText(/Ruta física más rápida/)).not.toBeInTheDocument();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <SearchPanel
          initialCriteria={{ ...DEFAULT_SEARCH_CRITERIA, tripType: 'ONE_WAY', returnDate: null }}
          hasActiveSearch={true}
          preview={{ ...REACHABLE_PREVIEW, reachable: false, pairs: [], best_route: null }}
          previewError={null}
          isPreviewLoading={false}
          isPreviewFetching={false}
          isRateLimitCooldown={false}
          onRetryPreview={vi.fn()}
          onSubmitCriteria={vi.fn()}
          onAirportsDebouncedChange={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(
      screen.getByText('No hay rutas con 2 escalas o menos entre estas ciudades.'),
    ).toBeVisible();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <SearchPanel
          initialCriteria={DEFAULT_SEARCH_CRITERIA}
          hasActiveSearch={true}
          preview={undefined}
          previewError={
            new ApiError({
              status: 429,
              code: 'RATE_LIMITED',
              title: 'Too Many Requests',
              detail: 'Slow down',
            })
          }
          isPreviewLoading={false}
          isPreviewFetching={false}
          isRateLimitCooldown={true}
          onRetryPreview={vi.fn()}
          onSubmitCriteria={vi.fn()}
          onAirportsDebouncedChange={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/Demasiadas consultas/);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDisabled();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <SearchPanel
          initialCriteria={DEFAULT_SEARCH_CRITERIA}
          hasActiveSearch={true}
          preview={undefined}
          previewError={
            new ApiError({
              status: 401,
              code: 'UNAUTHENTICATED',
              title: 'No autenticado',
              detail: 'Token vencido',
            })
          }
          isPreviewLoading={false}
          isPreviewFetching={false}
          isRateLimitCooldown={false}
          onRetryPreview={vi.fn()}
          onSubmitCriteria={vi.fn()}
          onAirportsDebouncedChange={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Inicia sesión para continuar.');
  });
});
