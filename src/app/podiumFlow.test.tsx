import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { sileo } from 'sileo';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatPrice } from '@/features/podium/format';
import { addDaysIso, getTodayInLima } from '@/features/search/searchCriteria';
import { type City } from '@/shared/api/schemas';
import { at, oneWayOffers, podiumResponse, roundTripOffer, wallet } from '@/test/fixtures/podium';
import {
  type ApiHandler,
  jsonResponse,
  mockApi,
  problem,
  renderApp,
  verifiedSession,
} from '@/test/renderApp';

vi.mock('@/features/map/components/RouteMap', () => ({
  default: () => <div data-testid="mock-route-map" />,
}));

const LIMA: City = {
  city: 'Lima',
  city_es: 'Lima',
  country: 'Peru',
  airports: [{ iata: 'LIM', name: 'Jorge Chávez Intl', lat: -12.02, lon: -77.11 }],
};
const MADRID: City = {
  city: 'Madrid',
  city_es: 'Madrid',
  country: 'Spain',
  airports: [{ iata: 'MAD', name: 'Barajas', lat: 40.47, lon: -3.56 }],
};

const preview = {
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

const SID = podiumResponse().search_id;
const dep = addDaysIso(getTodayInLima(), 20);
const ret = addDaysIso(getTodayInLima(), 30);
const ONE_WAY_URL = `/?trip=ONE_WAY&from=LIM&to=MAD&dep=${dep}&ad=1&ch=0&in=0&cabin=ECONOMY&cur=USD`;
const ROUND_TRIP_URL = `/?trip=ROUND_TRIP&from=LIM&to=MAD&dep=${dep}&ret=${ret}&ad=1&ch=0&in=0&cabin=ECONOMY&cur=USD`;

function setup(handlers: Record<string, ApiHandler>) {
  return mockApi({
    'POST /auth/refresh': () => jsonResponse(200, verifiedSession),
    'GET /routing/cities': () => jsonResponse(200, { cities: [LIMA, MADRID] }),
    'GET /routing/preview': () => jsonResponse(200, preview),
    ...handlers,
  });
}

function callsTo(fetchMock: ReturnType<typeof mockApi>, method: string, pathPart: string) {
  return fetchMock.mock.calls.filter(
    ([url, init]) => (init?.method ?? 'GET') === method && String(url).includes(pathPart),
  );
}

async function search(url = ONE_WAY_URL) {
  const result = renderApp(url);
  const user = userEvent.setup();
  const submit = await screen.findByRole('button', { name: 'Buscar' });
  await waitFor(() => expect(submit).toBeEnabled());
  await user.click(submit);
  return { ...result, user };
}

async function findCards() {
  const list = await screen.findByRole('list', {
    name: 'Recomendaciones ordenadas de mejor a peor',
  });
  return Array.from(list.children) as HTMLElement[];
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Podio (US-13, US-31)', () => {
  it('cotiza al pulsar Buscar y muestra 3 recomendaciones ordenadas con Comprar y aviso', async () => {
    const fetchMock = setup({ 'POST /quotes/search': () => jsonResponse(200, podiumResponse()) });
    const { router } = await search();

    const list = await screen.findByRole('list', {
      name: 'Recomendaciones ordenadas de mejor a peor',
    });
    const cards = Array.from(list.children) as HTMLElement[];
    expect(
      cards.map((card) => within(card).getByRole('heading', { level: 3 }).textContent),
    ).toEqual(['1Opción 1', '2Opción 2', '3Opción 3']);

    const first = cards[0]!;
    expect(within(first).getByText('82 % afinidad')).toBeInTheDocument();
    expect(within(first).getByText(/USD\s?240/)).toBeInTheDocument();
    expect(
      within(first).getByText('6 h 15 min · Directo · +15 min sobre el mínimo físico'),
    ).toBeInTheDocument();
    expect(within(first).getByText('LATAM Airlines')).toBeInTheDocument();

    // US-13: Comprar lleva al sitio del vendedor en otra pestaña.
    const buy = within(first).getByRole('link', { name: /Comprar/ });
    expect(buy).toHaveAttribute('href', 'https://book.navby.example/ow1');
    expect(buy).toHaveAttribute('target', '_blank');
    expect(buy).toHaveAttribute('rel', 'noopener noreferrer');

    // US-31: cada precio con su aviso referencial.
    expect(screen.getAllByText(/Precio referencial obtenido de terceros/)).toHaveLength(3);
    // US-13: sin categorías aisladas.
    expect(within(list).queryByText(/más barat|más rápid/i)).not.toBeInTheDocument();

    // Escala con su conexión en la opción 2.
    expect(within(cards[1]!).getByText(/escala en PTY de 1 h 20 min/)).toBeInTheDocument();

    // US-19: el search_id queda en la URL; y el cuerpo usa el perfil Equilibrado.
    await waitFor(() => expect(router.state.location.search).toContain(`sid=${SID}`));
    const [, init] = callsTo(fetchMock, 'POST', '/quotes/search')[0]!;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      trip_type: 'ONE_WAY',
      origins: ['LIM'],
      destinations: ['MAD'],
      return_date: null,
      passengers: { adults: 1, children: 0, infants: 0 },
      preferences: { profile: 'BALANCED' },
    });
    expect(screen.getByText('3 recomendaciones listas')).toBeInTheDocument();
  });

  it('ida y vuelta: cada recomendación incluye ida y regreso con precio y duración totales', async () => {
    setup({
      'POST /quotes/search': () => jsonResponse(200, podiumResponse({ podium: [roundTripOffer] })),
    });
    await search(ROUND_TRIP_URL);

    const card = (await findCards())[0]!;
    expect(within(card).getByText('Ida')).toBeInTheDocument();
    expect(within(card).getByText('Vuelta')).toBeInTheDocument();
    expect(within(card).getByText(/USD\s?980[.,]50/)).toBeInTheDocument();
    expect(within(card).getByText(/^12 h 40 min · Directo/)).toBeInTheDocument();
  });

  it('descuenta créditos: actualiza el saldo de la barra tras un cobro', async () => {
    let walletCalls = 0;
    setup({
      'POST /quotes/search': () => jsonResponse(200, podiumResponse()),
      'GET /billing/wallet': () => {
        walletCalls += 1;
        return jsonResponse(200, walletCalls > 1 ? { ...wallet, total_credits: 45 } : wallet);
      },
    });
    await search();

    expect(await screen.findByText('45 créditos')).toBeInTheDocument();
  });
});

describe('Casos especiales del podio (tabla §2)', () => {
  it('no cotiza al cargar una búsqueda compartida sin sid (cuesta créditos)', async () => {
    const fetchMock = setup({});
    renderApp(ONE_WAY_URL);
    await screen.findByText('Ruta física más rápida: ~6 h');
    expect(callsTo(fetchMock, 'POST', '/quotes/search')).toHaveLength(0);
    expect(
      screen.queryByRole('heading', { name: 'Tus 3 recomendaciones' }),
    ).not.toBeInTheDocument();
  });

  it('US-19: con sid en la URL lee el podio vigente sin cotizar de nuevo', async () => {
    const fetchMock = setup({
      [`POST /quotes/${SID}/rank`]: () =>
        jsonResponse(200, { ...podiumResponse(), credits_charged: 0 }),
    });
    renderApp(`${ONE_WAY_URL}&sid=${SID}`);

    expect(await findCards()).toHaveLength(3);
    expect(callsTo(fetchMock, 'POST', '/quotes/search')).toHaveLength(0);
    // Leer con /rank siempre trae credits_charged 0: no es un «resultado reciente sin costo».
    expect(screen.queryByText('Resultado reciente: sin costo')).not.toBeInTheDocument();
  });

  it('US-19: búsqueda vencida o ajena (404) pide buscar otra vez', async () => {
    setup({ [`POST /quotes/${SID}/rank`]: () => problem(404, 'SEARCH_NOT_FOUND') });
    renderApp(`${ONE_WAY_URL}&sid=${SID}`);

    expect(await screen.findByText('Estos resultados vencieron')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar otra vez' })).toBeInTheDocument();
  });

  it('US-16 / US-17: resultado reciente sin costo (incluso con 0 créditos)', async () => {
    setup({
      'POST /quotes/search': () =>
        jsonResponse(200, podiumResponse({ credits_charged: 0, credits_remaining: 0 })),
      'GET /billing/wallet': () => jsonResponse(200, { ...wallet, total_credits: 0 }),
    });
    await search();

    expect(await screen.findByText('Resultado reciente: sin costo')).toBeInTheDocument();
    expect(await findCards()).toHaveLength(3);
  });

  it('US-15: podio vacío informa que no se cobró, sin indicador de costo', async () => {
    setup({
      'POST /quotes/search': () =>
        jsonResponse(200, podiumResponse({ podium: [], credits_charged: 0 })),
    });
    await search();

    expect(
      await screen.findByText('No se te cobró. Prueba con otra fecha u otros aeropuertos.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Resultado reciente: sin costo')).not.toBeInTheDocument();
  });

  it('US-15: resultados parciales avisan y se cobran', async () => {
    let walletCalls = 0;
    setup({
      'POST /quotes/search': () => jsonResponse(200, podiumResponse({ partial: true })),
      'GET /billing/wallet': () => {
        walletCalls += 1;
        return jsonResponse(200, wallet);
      },
    });
    await search();

    expect(await screen.findByText('Algunos aeropuertos no respondieron')).toBeInTheDocument();
    await waitFor(() => expect(walletCalls).toBe(2));
  });

  it('US-15: proveedor caído (503) avisa con toast que no se cobró y no recarga el saldo', async () => {
    const toast = vi.spyOn(sileo, 'error');
    let walletCalls = 0;
    setup({
      'POST /quotes/search': () => problem(503, 'PROVIDER_UNAVAILABLE'),
      'GET /billing/wallet': () => {
        walletCalls += 1;
        return jsonResponse(200, wallet);
      },
    });
    await search();

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'No pudimos consultar precios. No se te cobró.' }),
      ),
    );
    expect(walletCalls).toBe(1);
  });

  it('US-17: sin créditos (402) ofrece comprar o esperar la recarga de las 00:00', async () => {
    const toast = vi.spyOn(sileo, 'error');
    setup({ 'POST /quotes/search': () => problem(402, 'INSUFFICIENT_CREDITS') });
    const { router } = await search();

    await waitFor(() => expect(toast).toHaveBeenCalled());
    const options = toast.mock.calls[0]![0];
    expect(options.title).toBe('No tienes créditos suficientes');
    expect(options.description).toContain('00:00');
    options.button!.onClick();
    await waitFor(() => expect(router.state.location.pathname).toBe('/billing'));
  });

  it('US-18: Buscar queda deshabilitado mientras cotiza', async () => {
    setup({ 'POST /quotes/search': () => new Promise<Response>(() => {}) });
    await search();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled());
    expect(screen.getByText('Buscando vuelos…')).toBeInTheDocument();
  });

  it('US-18: si otra pestaña ya cotiza (409) informa que hay una búsqueda en curso', async () => {
    setup({ 'POST /quotes/search': () => problem(409, 'SEARCH_IN_PROGRESS') });
    await search();

    expect(await screen.findByText('Búsqueda en curso')).toBeInTheDocument();
    expect(screen.getByText(/Ya hay una búsqueda en curso/)).toBeInTheDocument();
  });

  it('correo sin verificar (403) lleva a /verify-email', async () => {
    setup({ 'POST /quotes/search': () => problem(403, 'EMAIL_NOT_VERIFIED') });
    const { router } = await search();

    await waitFor(() => expect(router.state.location.pathname).toBe('/verify-email'));
  });

  it.each([
    ['VALIDATION_ERROR', 422, 'Revisa los datos e inténtalo de nuevo.'],
    ['AIRPORT_NOT_FOUND', 404, 'Alguno de los aeropuertos indicados no existe en el sistema.'],
    ['RATE_LIMITED', 429, /Demasiados intentos/],
  ])('%s se muestra en el panel', async (code, status, text) => {
    setup({ 'POST /quotes/search': () => problem(status, code) });
    await search();
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('error de red ofrece reintentar la cotización', async () => {
    let attempts = 0;
    setup({
      'POST /quotes/search': () => {
        attempts += 1;
        if (attempts === 1) throw new TypeError('Failed to fetch');
        return jsonResponse(200, podiumResponse());
      },
    });
    const { user } = await search();

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await findCards()).toHaveLength(3);
  });

  it('ROUTE_NOT_REACHABLE muestra un solo aviso cuando el preview ya lo indica', async () => {
    setup({
      'GET /routing/preview': () =>
        jsonResponse(200, { ...preview, reachable: false, best_route: null, pairs: [] }),
      'POST /quotes/search': () => problem(422, 'ROUTE_NOT_REACHABLE'),
    });
    await search();

    // El aviso lo da el buscador; el panel del podio no lo repite como error.
    expect(await screen.findByText('Ruta no disponible')).toBeInTheDocument();
    expect(screen.queryByText('No pudimos mostrar recomendaciones')).not.toBeInTheDocument();
  });
});

describe('Preferencias (US-20, US-21)', () => {
  type Weights = { price: number; duration: number; stops: number };
  const EXPIRED_TEXT =
    'Las recomendaciones duran 30 minutos. Busca otra vez para cambiar tus preferencias.';

  /** El mismo podio en orden inverso, como lo reordenaría otro perfil. */
  function reranked(profile: 'BALANCED' | 'SAVER' | 'FAST' | 'CUSTOM', weights: Weights) {
    const offers = [...oneWayOffers]
      .reverse()
      .map((offer, index) => ({ ...offer, rank: index + 1 }));
    return podiumResponse({
      credits_charged: 0,
      podium: offers,
      preferences: { profile, weights },
    });
  }

  const customRank = (init: RequestInit | undefined) =>
    jsonResponse(200, reranked('CUSTOM', JSON.parse(String(init?.body)).weights as Weights));

  const priceOf = (index: number) => {
    const { amount, currency } = at(oneWayOffers, index).price;
    // Testing Library normaliza el espacio fino de Intl en el DOM, no en el texto esperado.
    return formatPrice(amount, currency, 'es-PE').replace(/\s/g, ' ');
  };

  const rankBodies = (fetchMock: ReturnType<typeof mockApi>) =>
    callsTo(fetchMock, 'POST', '/rank').map(([, init]) => JSON.parse(String(init?.body)));

  async function firstCardShows(price: string) {
    await waitFor(async () =>
      expect(within(at(await findCards(), 0)).getByText(price)).toBeInTheDocument(),
    );
  }

  it('Perfil por defecto: sin elegir, cotiza y marca Equilibrado', async () => {
    setup({ 'POST /quotes/search': () => jsonResponse(200, podiumResponse()) });
    await search();
    await findCards();
    expect(screen.getByRole('radio', { name: 'Equilibrado' })).toBeChecked();
  });

  it('Cambiar a Ahorro: reordena gratis, deja el perfil en la URL y no toca el saldo', async () => {
    let walletCalls = 0;
    const fetchMock = setup({
      'POST /quotes/search': () => jsonResponse(200, podiumResponse()),
      [`POST /quotes/${SID}/rank`]: () =>
        jsonResponse(200, reranked('SAVER', { price: 0.7, duration: 0.2, stops: 0.1 })),
      'GET /billing/wallet': () => {
        walletCalls += 1;
        return jsonResponse(200, wallet);
      },
    });
    const { user, router } = await search();
    await firstCardShows(priceOf(0));
    const walletCallsBefore = walletCalls;

    await user.click(screen.getByRole('radio', { name: 'Ahorro' }));

    await firstCardShows(priceOf(2));
    expect(rankBodies(fetchMock)).toEqual([{ profile: 'SAVER' }]);
    expect(router.state.location.search).toContain('profile=SAVER');
    expect(screen.getByRole('radio', { name: 'Ahorro' })).toBeChecked();
    expect(
      screen.getByText('Recomendaciones ordenadas por Ahorro. Sin costo.'),
    ).toBeInTheDocument();
    expect(walletCalls).toBe(walletCallsBefore);
    expect(screen.getByText('50 créditos')).toBeInTheDocument();

    // Volver a un perfil ya visto sale de caché, sin otra petición.
    await user.click(screen.getByRole('radio', { name: 'Equilibrado' }));
    await firstCardShows(priceOf(0));
    expect(rankBodies(fetchMock)).toHaveLength(1);
    expect(router.state.location.search).not.toContain('profile=');
  });

  it('Pesos válidos: 40/40/20 con los sliders reordena sin costo', async () => {
    const fetchMock = setup({
      'POST /quotes/search': () => jsonResponse(200, podiumResponse()),
      [`POST /quotes/${SID}/rank`]: customRank,
    });
    const { user, router } = await search();
    await findCards();

    await user.click(screen.getByRole('radio', { name: 'Personalizado' }));
    // Personalizado arranca con los pesos del perfil activo (Equilibrado).
    await waitFor(() =>
      expect(rankBodies(fetchMock)).toEqual([
        { profile: 'CUSTOM', weights: { price: 0.5, duration: 0.3, stops: 0.2 } },
      ]),
    );

    const price = await screen.findByRole('slider', { name: 'Precio' });
    fireEvent.change(price, { target: { value: '45' } });
    fireEvent.change(price, { target: { value: '40' } });
    expect(screen.getByRole('slider', { name: 'Duración' })).toHaveValue('40');
    expect(screen.getByRole('slider', { name: 'Escalas' })).toHaveValue('20');

    await waitFor(() =>
      expect(rankBodies(fetchMock).at(-1)).toEqual({
        profile: 'CUSTOM',
        weights: { price: 0.4, duration: 0.4, stops: 0.2 },
      }),
    );
    // Un solo reordenamiento por el gesto completo (debounce).
    expect(rankBodies(fetchMock)).toHaveLength(2);
    await waitFor(() => expect(router.state.location.search).toContain('w=40%2C40%2C20'));
  });

  it('recarga con pesos propios en la URL: lee el podio con esos pesos', async () => {
    const fetchMock = setup({ [`POST /quotes/${SID}/rank`]: customRank });
    renderApp(`${ONE_WAY_URL}&profile=CUSTOM&w=40,40,20&sid=${SID}`);

    await firstCardShows(priceOf(2));
    expect(rankBodies(fetchMock)).toEqual([
      { profile: 'CUSTOM', weights: { price: 0.4, duration: 0.4, stops: 0.2 } },
    ]);
    expect(screen.getByRole('slider', { name: 'Precio' })).toHaveValue('40');
  });

  it('Pesos rechazados por el servidor (422): el podio no cambia', async () => {
    const fetchMock = setup({
      'POST /quotes/search': () => jsonResponse(200, podiumResponse()),
      [`POST /quotes/${SID}/rank`]: () => problem(422, 'INVALID_WEIGHTS'),
    });
    const { user, router } = await search();
    await firstCardShows(priceOf(0));

    await user.click(screen.getByRole('radio', { name: 'Personalizado' }));

    expect(
      await screen.findByText('Los pesos deben sumar 100 %. Tus recomendaciones no cambiaron.'),
    ).toBeInTheDocument();
    expect(rankBodies(fetchMock)).toHaveLength(1);
    expect(await findCards()).toHaveLength(3);
    await firstCardShows(priceOf(0));
    expect(screen.getByRole('radio', { name: 'Equilibrado' })).toBeChecked();
    expect(router.state.location.search).not.toContain('profile=');
  });

  it('error de red al reordenar: se mantiene el podio y se puede reintentar', async () => {
    let attempts = 0;
    const fetchMock = setup({
      'POST /quotes/search': () => jsonResponse(200, podiumResponse()),
      [`POST /quotes/${SID}/rank`]: () => {
        attempts += 1;
        if (attempts === 1) throw new TypeError('Failed to fetch');
        return jsonResponse(200, reranked('FAST', { price: 0.2, duration: 0.6, stops: 0.2 }));
      },
    });
    const { user } = await search();
    await firstCardShows(priceOf(0));

    await user.click(screen.getByRole('radio', { name: 'Rapidez' }));
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));

    await firstCardShows(priceOf(2));
    expect(rankBodies(fetchMock)).toEqual([{ profile: 'FAST' }, { profile: 'FAST' }]);
    expect(screen.getByRole('radio', { name: 'Rapidez' })).toBeChecked();
  });

  it('US-20 Búsqueda vencida: al cambiar de perfil pide buscar de nuevo, sin llamar al servidor', async () => {
    const fetchMock = setup({
      'POST /quotes/search': () =>
        jsonResponse(
          200,
          podiumResponse({ expires_at: new Date(Date.now() - 1000).toISOString() }),
        ),
    });
    const { user } = await search();
    await findCards();

    await user.click(screen.getByRole('radio', { name: 'Ahorro' }));

    expect(await screen.findByText(EXPIRED_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar otra vez' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Ahorro' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Equilibrado' })).toBeChecked();
    expect(rankBodies(fetchMock)).toHaveLength(0);
    // Las tarjetas siguen a la vista (con su aviso de precio).
    expect(await findCards()).toHaveLength(3);
  });

  it('US-20 Búsqueda vencida en el servidor (404): mismo aviso y el podio sigue', async () => {
    setup({
      'POST /quotes/search': () => jsonResponse(200, podiumResponse()),
      [`POST /quotes/${SID}/rank`]: () => problem(404, 'SEARCH_NOT_FOUND'),
    });
    const { user } = await search();
    await firstCardShows(priceOf(0));

    await user.click(screen.getByRole('radio', { name: 'Rapidez' }));

    expect(await screen.findByText(EXPIRED_TEXT)).toBeInTheDocument();
    await firstCardShows(priceOf(0));
  });

  it('US-21 Búsqueda vencida: los pesos propios no se recalculan', async () => {
    const expired = new Date(Date.now() - 1000).toISOString();
    const fetchMock = setup({
      [`POST /quotes/${SID}/rank`]: (init) =>
        jsonResponse(200, {
          ...reranked('CUSTOM', JSON.parse(String(init?.body)).weights as Weights),
          expires_at: expired,
        }),
    });
    renderApp(`${ONE_WAY_URL}&profile=CUSTOM&w=40,40,20&sid=${SID}`);
    await firstCardShows(priceOf(2));

    fireEvent.change(screen.getByRole('slider', { name: 'Precio' }), { target: { value: '60' } });

    expect(await screen.findByText(EXPIRED_TEXT)).toBeInTheDocument();
    expect(rankBodies(fetchMock)).toHaveLength(1);
    expect(screen.getByRole('slider', { name: 'Precio' })).toBeDisabled();
    await firstCardShows(priceOf(2));
  });
});
