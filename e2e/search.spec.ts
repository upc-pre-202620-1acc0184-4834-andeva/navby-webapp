import AxeBuilder from '@axe-core/playwright';
import { type Page, type Route } from '@playwright/test';
import { expect, test } from './fixtures';

test.use({ locale: 'es-PE' });

const MOCK_SESSION = {
  access_token: 'e2e-access-jwt',
  token_type: 'Bearer',
  expires_in: 900,
  user: {
    user_id: 'usr-e2e',
    email: 'ana@mail.com',
    full_name: 'Ana Torres',
    email_verified: true,
  },
};

const OFFLINE_VECTOR_STYLE = {
  version: 8,
  sources: {},
  layers: [],
};

const CITIES = {
  LIM: {
    city: 'Lima',
    city_es: 'Lima',
    country: 'Peru',
    airports: [{ iata: 'LIM', name: 'Jorge Chávez Intl', lat: -12.0219, lon: -77.1143 }],
  },
  TYO: {
    city: 'Tokyo',
    city_es: 'Tokio',
    country: 'Japan',
    airports: [
      { iata: 'HND', name: 'Haneda Airport', lat: 35.5523, lon: 139.7798 },
      { iata: 'NRT', name: 'Narita International', lat: 35.7647, lon: 140.3864 },
    ],
  },
  LON: {
    city: 'London',
    city_es: 'Londres',
    country: 'United Kingdom',
    airports: [
      { iata: 'LHR', name: 'Heathrow Airport', lat: 51.4706, lon: -0.4619 },
      { iata: 'LGW', name: 'Gatwick Airport', lat: 51.1481, lon: -0.1903 },
    ],
  },
  BOG: {
    city: 'Bogota',
    city_es: 'Bogotá',
    country: 'Colombia',
    airports: [{ iata: 'BOG', name: 'El Dorado Intl', lat: 4.7016, lon: -74.1469 }],
  },
  IPC: {
    city: 'Hanga Roa',
    city_es: 'Isla de Pascua',
    country: 'Chile',
    airports: [{ iata: 'IPC', name: 'Mataveri Intl', lat: -27.1648, lon: -109.4219 }],
  },
  FNJ: {
    city: 'Pyongyang',
    city_es: 'Pionyang',
    country: 'North Korea',
    airports: [{ iata: 'FNJ', name: 'Pyongyang Sunan', lat: 39.2241, lon: 125.6701 }],
  },
};

function futureIso(daysFromToday: number): string {
  const date = new Date(Date.now() + daysFromToday * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function normalizeQuery(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function setupAuthenticatedMocks(
  page: Page,
  counters?: { cityCalls: string[]; previewCalls: string[] },
) {
  await page.route('https://basemaps.cartocdn.com/**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(OFFLINE_VECTOR_STYLE),
    }),
  );

  await page.route('**/api/v1/auth/refresh', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SESSION),
    }),
  );

  await page.route('**/api/v1/routing/cities*', (route: Route) => {
    if (route.request().headers().authorization !== `Bearer ${MOCK_SESSION.access_token}`) {
      return route.fulfill({
        status: 401,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          title: 'No autenticado',
          status: 401,
          detail: 'Falta token Bearer',
          code: 'UNAUTHENTICATED',
        }),
      });
    }
    const url = new URL(route.request().url());
    const rawQ = url.searchParams.get('q') ?? '';
    counters?.cityCalls.push(rawQ);
    const q = normalizeQuery(rawQ);

    const pool = [CITIES.LIM, CITIES.TYO, CITIES.LON, CITIES.BOG, CITIES.IPC, CITIES.FNJ];
    const matches = pool.filter((c) => {
      const haystack = normalizeQuery(
        `${c.city} ${c.city_es ?? ''} ${c.airports.map((a) => a.iata).join(' ')}`,
      );
      return haystack.includes(q);
    });

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cities: matches }),
    });
  });

  // Buscar también cotiza (Plan 4); aquí basta un podio vacío para no salir a la API real.
  await page.route('**/api/v1/quotes/search', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        search_id: 'srch_01JE2ESEARCHSPEC000000000000',
        expires_at: '2026-11-17T23:30:00Z',
        credits_charged: 0,
        credits_remaining: 10,
        partial: false,
        pairs_quoted: [],
        t_min_minutes: 0,
        offers_received: 0,
        pareto_size: 0,
        preferences: { profile: 'BALANCED', weights: { price: 0.5, duration: 0.3, stops: 0.2 } },
        price_disclaimer: '',
        podium: [],
      }),
    }),
  );

  await page.route('**/api/v1/routing/preview*', (route: Route) => {
    if (route.request().headers().authorization !== `Bearer ${MOCK_SESSION.access_token}`) {
      return route.fulfill({
        status: 401,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          title: 'No autenticado',
          status: 401,
          detail: 'Falta token Bearer',
          code: 'UNAUTHENTICATED',
        }),
      });
    }
    const url = new URL(route.request().url());
    const origins = (url.searchParams.get('origins') ?? '').split(',').filter(Boolean);
    const destinations = (url.searchParams.get('destinations') ?? '').split(',').filter(Boolean);
    const tripType = url.searchParams.get('trip_type') ?? 'ROUND_TRIP';
    counters?.previewCalls.push(url.search);

    if (origins.includes('IPC') && destinations.includes('FNJ')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reachable: false,
          pairs: [],
          best_route: null,
          telemetry: { pairs_evaluated: 1, bfs_ms: 3, astar_ms: 0, astar_nodes_expanded: 4 },
        }),
      });
    }

    const destIata = destinations[0] ?? 'HND';
    const outboundMinutes = 1320;
    const roundTripMinutes = 2760;

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reachable: true,
        pairs: [
          {
            origin: origins[0] ?? 'LIM',
            destination: destIata,
            min_stops: 1,
            t_min_minutes: tripType === 'ROUND_TRIP' ? roundTripMinutes : outboundMinutes,
          },
        ],
        best_route: {
          t_min_minutes: outboundMinutes,
          airports: [
            { iata: origins[0] ?? 'LIM', lat: -12.0219, lon: -77.1143 },
            { iata: 'LAX', lat: 33.9416, lon: -118.4085 },
            { iata: destIata, lat: 35.5523, lon: 139.7798 },
          ],
        },
        telemetry: { pairs_evaluated: 2, bfs_ms: 4, astar_ms: 9, astar_nodes_expanded: 18 },
      }),
    });
  });
}

test.describe('Buscador y mapa preliminar (Plan 2)', () => {
  test('usuario sin sesión con parámetros de búsqueda es redirigido a /login (US-12)', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/refresh', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          title: 'Refresh token inválido',
          status: 401,
          detail: 'Sesión expirada',
          code: 'INVALID_REFRESH_TOKEN',
        }),
      }),
    );

    await page.goto(`/app/?trip=ONE_WAY&from=LIM&to=HND&dep=${futureIso(10)}`);
    await expect(page).toHaveURL(/\/app\/login$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
  });

  test('autocompletado (US-11), selector de aeropuertos (US-14), pasajeros/moneda (US-34) y ruta preliminar (US-12)', async ({
    page,
  }, testInfo) => {
    const counters = { cityCalls: [] as string[], previewCalls: [] as string[] };
    await setupAuthenticatedMocks(page, counters);

    await page.goto('/app/');
    await expect(page.getByRole('heading', { level: 1, name: 'Buscador de vuelos' })).toBeVisible();

    const originInput = page.getByRole('combobox', { name: 'Origen' });
    await originInput.fill('a');
    await page.waitForTimeout(300);
    expect(counters.cityCalls).toEqual([]);

    await originInput.fill('Lim');
    await page.getByRole('option', { name: /Lima, Perú/ }).click();

    const destInput = page.getByRole('combobox', { name: 'Destino' });
    await destInput.fill('LHR');
    await expect(page.getByRole('option', { name: /Londres, Reino Unido/ })).toBeVisible();

    await destInput.fill('bogota');
    await expect(page.getByRole('option', { name: /Bogotá, Colombia/ })).toBeVisible();

    await destInput.fill('Tok');
    await page.getByRole('option', { name: /Tokio, Japón/ }).click();

    // Selecciona salida y regreso válidos en calendario.
    await page.getByRole('button', { name: 'Salida' }).click();
    const depButton = page.locator('[role="gridcell"] button:not([disabled])').first();
    await depButton.click();

    await page.getByRole('button', { name: 'Regreso' }).click();
    const retButton = page.locator('[role="gridcell"] button:not([disabled])').nth(2);
    await retButton.click();

    // US-34: configura viaje familiar + ejecutiva + PEN y valida reglas de infantes/máximo 9.
    await page.getByRole('button', { name: 'Pasajeros' }).click();
    await page.getByRole('button', { name: 'Aumentar Adultos' }).click(); // 2 adultos
    await page.getByRole('button', { name: 'Aumentar Niños' }).click();
    await page.getByRole('button', { name: 'Aumentar Niños' }).click();
    // Intenta superar 2 infantes -> bloqueado en 2 infantes (RN-02: infantes <= adultos).
    await page.getByRole('button', { name: 'Aumentar Infantes' }).click();
    await page.getByRole('button', { name: 'Aumentar Infantes' }).click();
    await expect(page.getByRole('button', { name: 'Aumentar Infantes' })).toBeDisabled();
    await page.getByRole('button', { name: 'Disminuir Infantes' }).click();
    await page.getByRole('button', { name: 'Disminuir Infantes' }).click();

    // Prueba límite máximo de 9 pasajeros (8 adultos + 1 niño -> no permite segundo niño).
    for (let i = 0; i < 5; i += 1) {
      await page.getByRole('button', { name: 'Aumentar Adultos' }).click();
    }
    await expect(page.getByRole('button', { name: 'Aumentar Niños' })).toBeDisabled();
    // Regresa a 2 adultos + 2 niños para el envío.
    for (let i = 0; i < 5; i += 1) {
      await page.getByRole('button', { name: 'Disminuir Adultos' }).click();
    }
    await page.keyboard.press('Escape');

    await page.getByLabel('Cabina').selectOption('BUSINESS');
    await page.getByLabel('Moneda').selectOption('PEN');

    await page.getByRole('button', { name: 'Buscar' }).click();

    await expect(page).toHaveURL(/from=LIM/);
    await expect(page).toHaveURL(/to=HND%2CNRT/);
    await expect(page).toHaveURL(/cabin=BUSINESS/);
    await expect(page).toHaveURL(/cur=PEN/);

    await expect(page.getByText('Ruta física más rápida (ida y vuelta): ~46 h')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Mapa de ruta preliminar' })).toBeVisible();
    await expect(page.getByText('Origen: LIM')).toBeAttached();
    await expect(page.getByText('Escala: LAX')).toBeAttached();
    await expect(page.getByText('Destino: HND')).toBeAttached();

    const legendSummary = page.getByText(/Tramos estimados: LIM → LAX → HND \(1 escala\)/);
    if (testInfo.project.name === 'mobile') {
      await expect(legendSummary).toBeVisible();
    } else {
      await expect(legendSummary).toBeAttached();
    }

    // US-14: excluir Narita (NRT) tras búsqueda activa dispara recálculo debounced a HND.
    await page.getByRole('button', { name: /Aeropuertos de Tokio \(2\/2\)/ }).click();
    await page.getByLabel(/Narita International/).uncheck();
    await expect(page.getByLabel(/Haneda Airport/)).toBeDisabled();

    await expect.poll(() => new URL(page.url()).searchParams.get('to')).toBe('HND');
    await expect
      .poll(() => counters.previewCalls.some((qs) => qs.includes('destinations=HND')))
      .toBe(true);
    await expect(page.getByRole('button', { name: 'Buscar' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Buscar' })).toHaveCSS('opacity', '1');

    const overflow = await page.locator('html').evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(overflow).toBe(false);

    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(violations).toEqual([]);
  });

  test('ruta imposible IPC -> FNJ, modo oscuro, URL compartida recargable y prefers-reduced-motion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('navby-theme', 'dark'));
    await setupAuthenticatedMocks(page);

    const sharedUrl = `/app/?trip=ONE_WAY&from=IPC&to=FNJ&dep=${futureIso(12)}&ad=1&ch=0&in=0&cabin=ECONOMY&cur=USD`;
    await page.goto(sharedUrl);

    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('heading', { name: 'Ruta no disponible' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ruta no disponible' })).toBeVisible();

    // Cambia a Solo ida con ruta válida LIM -> HND y valida ausencia de pulso con reduced-motion.
    await page.goto(
      `/app/?trip=ONE_WAY&from=LIM&to=HND&dep=${futureIso(12)}&ad=1&ch=0&in=0&cabin=ECONOMY&cur=USD`,
    );
    await expect(page.getByText('Ruta física más rápida: ~22 h')).toBeVisible();
    await expect(page.locator('.navby-preview-pulse')).toHaveCount(0);

    const overflow = await page.locator('html').evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(overflow).toBe(false);

    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(violations).toEqual([]);
  });

  test('fechas vencidas en URL compartida muestran validación al enviar (US-34)', async ({
    page,
  }) => {
    const counters = { cityCalls: [] as string[], previewCalls: [] as string[] };
    await setupAuthenticatedMocks(page, counters);

    await page.goto(
      '/app/?trip=ONE_WAY&from=LIM&to=HND&dep=2020-01-01&ad=1&ch=0&in=0&cabin=ECONOMY&cur=USD',
    );
    await page.getByRole('button', { name: 'Buscar' }).click();

    await expect(
      page.getByText('La salida no puede ser anterior a hoy (hora de Lima).'),
    ).toBeVisible();
  });
});
