import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { itineraryKeys } from '@/features/itineraries/itineraryKeys';
import { type ItineraryPage } from '@/shared/api/schemas';
import { CREATED_ID, quote, savedStore } from '@/test/itineraryApi';
import { callsTo, findCards, ONE_WAY_URL, search, setup, SID } from '@/test/podiumFlow';
import { itineraryJson, itineraryPage, savedOffer } from '@/test/fixtures/itineraries';
import { at, oneWayOffers, podiumResponse } from '@/test/fixtures/podium';
import { jsonResponse, problem, renderApp } from '@/test/renderApp';

vi.mock('@/features/map/components/RouteMap', () => ({
  default: () => <div data-testid="mock-route-map" />,
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Guardar desde el podio (US-22)', () => {
  it('Guardar vigente: envía search_id y offer_id, pasa a Guardado y no toca el saldo', async () => {
    const store = savedStore();
    const fetchMock = setup({ ...quote(), ...store.handlers });
    const { user } = await search();
    const cards = await findCards();
    // La cotización sí cobró y refrescó el saldo; guardar no debe pedirlo otra vez.
    await waitFor(() => expect(callsTo(fetchMock, 'GET', '/billing/wallet')).toHaveLength(2));

    await user.click(within(at(cards, 1)).getByRole('button', { name: /^Guardar/ }));

    const link = await within(at(cards, 1)).findByRole('link', {
      name: 'Guardado. Ver itinerario',
    });
    expect(link).toHaveAttribute('href', `/itineraries/${CREATED_ID}`);
    expect(
      within(at(cards, 1)).queryByRole('button', { name: /^Guardar/ }),
    ).not.toBeInTheDocument();

    const [, init] = callsTo(fetchMock, 'POST', '/itineraries')[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      search_id: SID,
      offer_id: at(oneWayOffers, 1).offer_id,
    });
    // Las otras dos siguen sin guardar y el saldo no se vuelve a pedir.
    expect(screen.getAllByRole('button', { name: /^Guardar/ })).toHaveLength(2);
    expect(callsTo(fetchMock, 'GET', '/billing/wallet')).toHaveLength(2);
    expect(
      screen.getByText('Guardado en tus itinerarios: LIM → MAD · 2026-11-01'),
    ).toBeInTheDocument();
  });

  it('Guardar dos veces: una oferta ya guardada sale como Guardado sin pedir nada', async () => {
    const saved = itineraryJson({ id: CREATED_ID, offer: savedOffer(at(oneWayOffers, 1)) });
    const store = savedStore([saved]);
    const fetchMock = setup({ ...quote(), ...store.handlers });
    await search();
    const cards = await findCards();

    expect(
      await within(at(cards, 1)).findByRole('link', { name: 'Guardado. Ver itinerario' }),
    ).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST', '/itineraries')).toHaveLength(0);
  });

  it('Guardar dos veces: si el servidor responde 200 la lista en caché no duplica', async () => {
    const existing = itineraryJson({ id: CREATED_ID, offer: savedOffer(at(oneWayOffers, 1)) });
    let listCalls = 0;
    const fetchMock = setup({
      ...quote(),
      // La primera lectura aún no lo tenía (guardado desde otra pestaña): luego sí.
      'GET /itineraries': () => {
        listCalls += 1;
        return jsonResponse(200, itineraryPage(listCalls === 1 ? [] : [existing]));
      },
      'POST /itineraries': () => jsonResponse(200, existing),
    });
    const { user, queryClient } = await search();
    const cards = await findCards();

    await user.click(within(at(cards, 1)).getByRole('button', { name: /^Guardar/ }));
    await within(at(cards, 1)).findByRole('link', { name: 'Guardado. Ver itinerario' });

    await waitFor(() => expect(listCalls).toBeGreaterThan(1));
    const page = queryClient.getQueryData<ItineraryPage>(itineraryKeys.list());
    expect(page?.items.map((item) => item.id)).toEqual([CREATED_ID]);
    expect(page?.total).toBe(1);
    expect(callsTo(fetchMock, 'POST', '/itineraries')).toHaveLength(1);
  });

  it('Límite de 50: avisa en la tarjeta con enlace a la lista y sigue pudiendo reintentar', async () => {
    const store = savedStore();
    const fetchMock = setup({
      ...quote(),
      ...store.handlers,
      'POST /itineraries': () => problem(409, 'ITINERARY_LIMIT_REACHED'),
    });
    const { user } = await search();
    const cards = await findCards();
    const listCallsBefore = callsTo(fetchMock, 'GET', '/itineraries').length;

    await user.click(within(at(cards, 0)).getByRole('button', { name: /^Guardar/ }));

    expect(
      await within(at(cards, 0)).findByText(/Ya tienes 50 itinerarios\. Elimina alguno/),
    ).toBeInTheDocument();
    expect(within(at(cards, 0)).getByRole('link', { name: 'Ver mis itinerarios' })).toHaveAttribute(
      'href',
      '/itineraries',
    );
    expect(within(at(cards, 0)).queryByText('Guardado')).not.toBeInTheDocument();
    expect(within(at(cards, 0)).getByRole('button', { name: /^Guardar/ })).toBeEnabled();
    // La caché decía que había lugar: se vuelve a leer la lista.
    await waitFor(() =>
      expect(callsTo(fetchMock, 'GET', '/itineraries').length).toBeGreaterThan(listCallsBefore),
    );
  });

  it('Error de red o 5xx: aviso en la tarjeta y Reintentar guarda', async () => {
    const store = savedStore();
    let attempts = 0;
    setup({
      ...quote(),
      ...store.handlers,
      'POST /itineraries': (init) => {
        attempts += 1;
        return attempts === 1
          ? problem(503, 'PROVIDER_UNAVAILABLE')
          : store.handlers['POST /itineraries']!(init);
      },
    });
    const { user } = await search();
    const cards = await findCards();

    await user.click(within(at(cards, 1)).getByRole('button', { name: /^Guardar/ }));
    expect(
      await within(at(cards, 1)).findByText('No pudimos guardarlo. Inténtalo de nuevo.'),
    ).toBeInTheDocument();

    await user.click(within(at(cards, 1)).getByRole('button', { name: 'Reintentar' }));
    expect(
      await within(at(cards, 1)).findByRole('link', { name: 'Guardado. Ver itinerario' }),
    ).toBeInTheDocument();
  });

  it('Búsqueda vencida (reloj): no llama al servidor, un solo aviso y Guardar deshabilitado', async () => {
    const fetchMock = setup({
      ...quote({ expires_at: new Date(Date.now() - 1000).toISOString() }),
      ...savedStore().handlers,
    });
    const { user } = await search();
    const cards = await findCards();

    await user.click(within(at(cards, 0)).getByRole('button', { name: /^Guardar/ }));

    expect(await screen.findAllByText('Estos resultados vencieron')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Buscar otra vez' })).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST', '/itineraries')).toHaveLength(0);
    for (const button of screen.getAllByRole('button', { name: /^Guardar/ })) {
      expect(button).toBeDisabled();
    }
  });

  it('Búsqueda vencida (404 SEARCH_NOT_FOUND): mismo aviso único', async () => {
    setup({
      ...quote(),
      ...savedStore().handlers,
      'POST /itineraries': () => problem(404, 'SEARCH_NOT_FOUND'),
    });
    const { user } = await search();
    const cards = await findCards();

    await user.click(within(at(cards, 0)).getByRole('button', { name: /^Guardar/ }));

    expect(await screen.findAllByText('Estos resultados vencieron')).toHaveLength(1);
    expect(screen.queryByText('No pudimos guardarlo. Inténtalo de nuevo.')).not.toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: /^Guardar/ })) {
      expect(button).toBeDisabled();
    }
  });

  it('Mientras se reordena, Guardar queda deshabilitado y se reactiva al terminar', async () => {
    let release: (response: Response) => void = () => {};
    setup({
      ...quote(),
      ...savedStore().handlers,
      [`POST /quotes/${SID}/rank`]: () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });
    const { user } = await search();
    await findCards();

    await user.click(screen.getByRole('radio', { name: 'Ahorro' }));
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^Guardar/ })[0]).toBeDisabled(),
    );

    release(jsonResponse(200, podiumResponse({ credits_charged: 0 })));
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^Guardar/ })[0]).toBeEnabled(),
    );
  });

  it('con un podio recargado por sid, la lista de guardados también marca Guardado', async () => {
    const saved = itineraryJson({ id: CREATED_ID, offer: savedOffer(at(oneWayOffers, 0)) });
    setup({
      ...savedStore([saved]).handlers,
      [`POST /quotes/${SID}/rank`]: () =>
        jsonResponse(200, { ...podiumResponse(), credits_charged: 0 }),
    });
    renderApp(`${ONE_WAY_URL}&sid=${SID}`);
    const cards = await findCards();

    expect(
      await within(at(cards, 0)).findByRole('link', { name: 'Guardado. Ver itinerario' }),
    ).toBeInTheDocument();
    expect(within(at(cards, 1)).getByRole('button', { name: /^Guardar/ })).toBeEnabled();
  });
});
