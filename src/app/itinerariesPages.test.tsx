import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { itineraryKeys } from '@/features/itineraries/itineraryKeys';
import { formatCalendarDate, formatInstantDate } from '@/shared/format/date';
import { formatLocalPrice } from '@/shared/format/money';
import { TEST_RATES } from '@/test/fixtures/fx';
import {
  itineraryJson,
  itineraryPage,
  manyItineraries,
  QUOTED_AT,
  roundTripItinerary,
} from '@/test/fixtures/itineraries';
import { at } from '@/test/fixtures/podium';
import { quote, savedStore } from '@/test/itineraryApi';
import { callsTo, findCards, ONE_WAY_URL, setup } from '@/test/podiumFlow';
import { jsonResponse, problem, renderApp } from '@/test/renderApp';

vi.mock('@/features/map/components/RouteMap', () => ({
  default: (props: {
    floatingPanel?: boolean;
    regionLabel?: string;
    podium?: { rank: number }[];
  }) => (
    <div
      data-testid="mock-route-map"
      data-floating={String(props.floatingPanel ?? true)}
      data-region-label={props.regionLabel ?? ''}
      data-ranks={props.podium?.map((offer) => offer.rank).join(',')}
    />
  ),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const LIST_URL = '/itineraries';
const RECENT = itineraryJson({ id: '00000000-0000-4000-8000-0000000000b1' });
const OLDER = {
  ...roundTripItinerary,
  id: '00000000-0000-4000-8000-0000000000b2',
  name: 'LIM → MAD · 2026-11-01 (ida y vuelta)',
};

// Intl usa un espacio fino que Testing Library normaliza en el DOM, no en el texto esperado.
// Las tarifas llegan en USD y la página (español) las muestra en soles con el tipo de cambio de prueba.
const price = (amount: string) =>
  formatLocalPrice(amount, 'USD', 'PEN', TEST_RATES, 'es-PE').replace(/\s/g, ' ');
const OLDEST = itineraryJson({
  id: '00000000-0000-4000-8000-0000000000b3',
  name: 'LIM → CUZ · 2026-12-03',
  departure_date: '2026-12-03',
  created_at: '2026-10-01T12:00:00Z',
});

const rowsOf = async () => {
  const list = await screen.findByRole('list', { name: 'Itinerarios guardados' });
  return Array.from(list.children) as HTMLElement[];
};

describe('Lista de itinerarios (US-23)', () => {
  it('muestra los guardados en el orden del servidor con fechas, precio y aviso', async () => {
    setup(savedStore([RECENT, OLDER, OLDEST]).handlers);
    renderApp(LIST_URL);

    const rows = await rowsOf();
    expect(rows.map((row) => within(row).getByRole('link').textContent)).toEqual([
      'LIM → MAD · 2026-11-01',
      'LIM → MAD · 2026-11-01 (ida y vuelta)',
      'LIM → CUZ · 2026-12-03',
    ]);
    expect(within(at(rows, 0)).getByRole('link')).toHaveAttribute(
      'href',
      `/itineraries/${RECENT.id}`,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Mis itinerarios' })).toBeInTheDocument();
    expect(screen.getByText('3 de 50')).toBeInTheDocument();

    // Solo ida: una fecha; ida y vuelta: las dos.
    const departure = formatCalendarDate('2026-11-01', 'es-PE');
    expect(within(at(rows, 0)).getByText(departure)).toBeInTheDocument();
    expect(
      within(at(rows, 1)).getByText(`${departure} – ${formatCalendarDate('2026-11-15', 'es-PE')}`),
    ).toBeInTheDocument();
    expect(within(at(rows, 0)).getByText(/6 h 15 min · Directo/)).toBeInTheDocument();
    expect(await within(at(rows, 0)).findByText(price('240.00'))).toBeInTheDocument();
    expect(
      within(at(rows, 0)).getByText(`Guardado el ${formatInstantDate(RECENT.created_at, 'es-PE')}`),
    ).toBeInTheDocument();

    // RL-03: un solo aviso bajo la lista, con la nota de que el precio es del momento de guardar.
    expect(screen.getAllByText(/Precio referencial obtenido de terceros/)).toHaveLength(1);
    expect(
      screen.getByText('Los precios son del momento en que guardaste cada itinerario'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al buscador' })).toHaveAttribute('href', '/');
  });

  it('filtra por texto y ordena por precio o próxima salida con estado vacío limpio', async () => {
    const EXPENSIVE = itineraryJson({
      id: '00000000-0000-4000-8000-0000000000c1',
      name: 'Viaje lejano',
      origin: 'LIM',
      destination: 'HND',
      departure_date: '2027-02-10',
      offer: {
        ...RECENT.offer,
        price: { amount: '950.00', currency: 'USD' },
      },
    });
    setup(savedStore([EXPENSIVE, OLDER, OLDEST]).handlers);
    renderApp(LIST_URL);
    const user = userEvent.setup();
    await rowsOf();

    const searchInput = screen.getByRole('searchbox', { name: 'Buscar en mis itinerarios' });
    await user.type(searchInput, 'CUZ');
    const filtered = await rowsOf();
    expect(filtered).toHaveLength(1);
    expect(within(at(filtered, 0)).getByRole('link').textContent).toBe('LIM → CUZ · 2026-12-03');

    await user.clear(searchInput);
    await user.type(searchInput, 'NOEXISTE');
    expect(await screen.findByText('No hay itinerarios que coincidan')).toBeInTheDocument();
    const clearButtons = screen.getAllByRole('button', { name: 'Limpiar búsqueda' });
    await user.click(clearButtons[clearButtons.length - 1]!);
    expect(await rowsOf()).toHaveLength(3);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Ordenar por' }), 'departureAsc');
    const sorted = await rowsOf();
    expect(sorted.map((row) => within(row).getByRole('link').textContent)).toEqual([
      'LIM → MAD · 2026-11-01 (ida y vuelta)',
      'LIM → CUZ · 2026-12-03',
      'Viaje lejano',
    ]);
  });

  it('vacío: invita a buscar vuelos y no muestra contador', async () => {
    setup(savedStore().handlers);
    renderApp(LIST_URL);

    expect(await screen.findByText('Aún no guardas itinerarios')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buscar vuelos' })).toHaveAttribute('href', '/');
    expect(screen.queryByText(/ de 50$/)).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Itinerarios guardados' })).not.toBeInTheDocument();
  });

  it('error: ofrece Reintentar y luego muestra la lista', async () => {
    let calls = 0;
    setup({
      'GET /itineraries': () => {
        calls += 1;
        return calls === 1 ? problem(500, 'INTERNAL') : jsonResponse(200, itineraryPage([RECENT]));
      },
    });
    renderApp(LIST_URL);
    const user = userEvent.setup();

    expect(await screen.findByText('No pudimos cargar tus itinerarios')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await rowsOf()).toHaveLength(1);
  });

  it('lleno (50): avisa del máximo y muestra 50 de 50', async () => {
    setup(savedStore(manyItineraries(50)).handlers);
    renderApp(LIST_URL);

    expect(await rowsOf()).toHaveLength(50);
    expect(screen.getByText('50 de 50')).toBeInTheDocument();
    expect(
      screen.getByText('Llegaste al máximo de 50. Elimina alguno para guardar otro'),
    ).toBeInTheDocument();
  });
});

describe('Eliminar itinerarios (US-24)', () => {
  const deleteButton = (name: string) => screen.getByRole('button', { name: `Eliminar ${name}` });

  it('con 50: pide confirmación, baja el contador a 49, quita el aviso y vuelve a permitir guardar', async () => {
    const all = manyItineraries(50);
    const first = at(all, 0);
    const fetchMock = setup({ ...quote(), ...savedStore(all).handlers });
    const { router } = renderApp(LIST_URL);
    const user = userEvent.setup();
    await rowsOf();

    await user.click(deleteButton(first.name));
    const dialog = screen.getByRole('dialog', { name: '¿Eliminar este itinerario?' });
    expect(within(dialog).getByText(first.name)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(screen.getByText('49 de 50')).toBeInTheDocument());
    expect(callsTo(fetchMock, 'DELETE', `/itineraries/${first.id}`)).toHaveLength(1);
    expect(screen.getByText('Itinerario eliminado')).toBeInTheDocument();
    expect(screen.queryByText(/Llegaste al máximo/)).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await rowsOf()).toHaveLength(49);
    expect(screen.getByRole('heading', { level: 1, name: 'Mis itinerarios' })).toHaveFocus();

    // De vuelta al podio, Guardar funciona de nuevo.
    await act(() => router.navigate(ONE_WAY_URL));
    const buscar = await screen.findByRole('button', { name: 'Buscar' });
    await waitFor(() => expect(buscar).toBeEnabled());
    await user.click(buscar);
    const cards = await findCards();
    await user.click(within(at(cards, 1)).getByRole('button', { name: /^Guardar/ }));
    expect(
      await within(at(cards, 1)).findByRole('link', { name: 'Guardado. Ver itinerario' }),
    ).toBeInTheDocument();
  });

  it('inexistente (404): avisa que ya no existe y quita la fila', async () => {
    const store = savedStore([RECENT, OLDER]);
    setup({
      ...store.handlers,
      // Ya lo borró otra pestaña: el servidor no lo tiene y responde 404.
      [`DELETE /itineraries/${RECENT.id}`]: () => {
        store.items.shift();
        return problem(404, 'ITINERARY_NOT_FOUND');
      },
    });
    renderApp(LIST_URL);
    const user = userEvent.setup();
    await rowsOf();

    await user.click(deleteButton(RECENT.name));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByText('Ese itinerario ya no existe')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('1 de 50')).toBeInTheDocument());
  });

  it('cancelar no borra nada', async () => {
    const fetchMock = setup(savedStore([RECENT]).handlers);
    renderApp(LIST_URL);
    const user = userEvent.setup();
    await rowsOf();

    await user.click(deleteButton(RECENT.name));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(callsTo(fetchMock, 'DELETE', '/itineraries/')).toHaveLength(0);
    expect(await rowsOf()).toHaveLength(1);
  });

  it('error de red: el diálogo sigue abierto con el aviso y la fila se mantiene', async () => {
    setup({
      ...savedStore([RECENT]).handlers,
      [`DELETE /itineraries/${RECENT.id}`]: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderApp(LIST_URL);
    const user = userEvent.setup();
    await rowsOf();

    await user.click(deleteButton(RECENT.name));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    expect(
      await within(dialog).findByText('No pudimos eliminarlo. Inténtalo de nuevo.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    expect(await rowsOf()).toHaveLength(1);
    expect(within(dialog).getByRole('button', { name: 'Eliminar' })).toBeEnabled();
  });
});

describe('Detalle del itinerario (US-23)', () => {
  const detailUrl = (id: string) => `/itineraries/${id}`;

  it('muestra la ruta, el precio de ese momento y el aviso con la fecha de la cotización', async () => {
    setup({ [`GET /itineraries/${RECENT.id}`]: () => jsonResponse(200, RECENT) });
    renderApp(detailUrl(RECENT.id));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'LIM → MAD · 2026-11-01' }),
    ).toBeInTheDocument();
    const map = await screen.findByTestId('mock-route-map');
    expect(map).toHaveAttribute('data-floating', 'false');
    expect(map).toHaveAttribute('data-region-label', 'Mapa de la ruta guardada');
    expect(map).toHaveAttribute('data-ranks', '1');
    expect(screen.getByText('Ruta guardada:')).toBeInTheDocument();

    const card = screen.getByRole('group', { name: 'Cotizado con el perfil Equilibrado' });
    expect(await within(card).findByText(price('240.00'))).toBeInTheDocument();
    expect(
      within(card).getByText(
        `Precio del ${formatInstantDate(QUOTED_AT, 'es-PE')}; puede haber cambiado. Precio referencial obtenido de terceros.`,
      ),
    ).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /Comprar/ })).toHaveAttribute(
      'href',
      'https://book.navby.example/ow1',
    );
    expect(screen.queryByText(/Opción/)).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /Guardar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buscar precios actuales' })).toHaveAttribute(
      'href',
      '/?trip=ONE_WAY&from=LIM&to=MAD&dep=2026-11-01',
    );
  });

  it('un puesto fuera del podio (5) y un perfil distinto se muestran sin romper', async () => {
    setup({ [`GET /itineraries/${OLDER.id}`]: () => jsonResponse(200, OLDER) });
    renderApp(detailUrl(OLDER.id));

    const card = await screen.findByRole('group', { name: 'Cotizado con el perfil Ahorro' });
    expect(within(card).getByText('Ida')).toBeInTheDocument();
    expect(within(card).getByText('Vuelta')).toBeInTheDocument();
    expect(screen.getByTestId('mock-route-map')).toHaveAttribute('data-ranks', '1');
  });

  it.each([
    [404, 'ITINERARY_NOT_FOUND'],
    [422, 'VALIDATION_ERROR'],
  ])('ajeno o inexistente (%i): dice que no existe sin revelar nada', async (status, code) => {
    setup({ 'GET /itineraries/no-es-mio': () => problem(status, code) });
    renderApp(detailUrl('no-es-mio'));

    expect(await screen.findByText('Este itinerario no existe')).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Volver a mis itinerarios' }).at(-1),
    ).toHaveAttribute('href', '/itineraries');
    expect(screen.queryByTestId('mock-route-map')).not.toBeInTheDocument();
  });

  it('error de red: ofrece Reintentar', async () => {
    let calls = 0;
    setup({
      [`GET /itineraries/${RECENT.id}`]: () => {
        calls += 1;
        if (calls === 1) throw new TypeError('Failed to fetch');
        return jsonResponse(200, RECENT);
      },
    });
    renderApp(detailUrl(RECENT.id));
    const user = userEvent.setup();

    expect(await screen.findByText('No pudimos cargar el itinerario')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'LIM → MAD · 2026-11-01' }),
    ).toBeInTheDocument();
  });

  it('eliminar desde el detalle vuelve a la lista con el anuncio', async () => {
    const fetchMock = setup({
      ...savedStore([RECENT, OLDER]).handlers,
      [`GET /itineraries/${RECENT.id}`]: () => jsonResponse(200, RECENT),
    });
    const { router, queryClient } = renderApp(detailUrl(RECENT.id));
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: 'LIM → MAD · 2026-11-01' });
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/itineraries'));
    expect(await screen.findByText('Itinerario eliminado')).toBeInTheDocument();
    expect(await rowsOf()).toHaveLength(1);
    expect(callsTo(fetchMock, 'DELETE', `/itineraries/${RECENT.id}`)).toHaveLength(1);
    // El detalle eliminado no se vuelve a pedir ni queda en caché.
    expect(callsTo(fetchMock, 'GET', `/itineraries/${RECENT.id}`)).toHaveLength(1);
    expect(queryClient.getQueryData(itineraryKeys.detail(RECENT.id))).toBeUndefined();
  });
});
