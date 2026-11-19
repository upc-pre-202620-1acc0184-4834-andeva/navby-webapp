import AxeBuilder from '@axe-core/playwright';
import { type Page, type Route } from '@playwright/test';
import { E2E_WALLET, expect, test } from './fixtures';

test.use({ locale: 'es-PE' });

const SESSION = {
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

const CITIES = [
  {
    city: 'Lima',
    city_es: 'Lima',
    country: 'Peru',
    airports: [{ iata: 'LIM', name: 'Jorge Chávez Intl', lat: -12.0219, lon: -77.1143 }],
  },
  {
    city: 'Madrid',
    city_es: 'Madrid',
    country: 'Spain',
    airports: [{ iata: 'MAD', name: 'Barajas', lat: 40.4719, lon: -3.5626 }],
  },
];

const PREVIEW = {
  reachable: true,
  pairs: [{ origin: 'LIM', destination: 'MAD', min_stops: 0, t_min_minutes: 720 }],
  best_route: {
    t_min_minutes: 720,
    airports: [
      { iata: 'LIM', lat: -12.0219, lon: -77.1143 },
      { iata: 'MAD', lat: 40.4719, lon: -3.5626 },
    ],
  },
  telemetry: { pairs_evaluated: 1, bfs_ms: 1, astar_ms: 1, astar_nodes_expanded: 2 },
};

const LIM = { iata: 'LIM', lat: -12.0219, lon: -77.1143, timezone: 'America/Lima' };
const MAD = { iata: 'MAD', lat: 40.4719, lon: -3.5626, timezone: 'Europe/Madrid' };
const PTY = { iata: 'PTY', lat: 9.0714, lon: -79.3835, timezone: 'America/Panama' };

function offer(rank: number, amount: string, stops: number) {
  const segments =
    stops === 0
      ? [
          {
            from: 'LIM',
            to: 'MAD',
            departure: '2026-12-10T08:30:00',
            arrival: '2026-12-11T02:45:00',
            flight_number: `LA25${rank}0`,
            airline: 'LA',
          },
        ]
      : [
          {
            from: 'LIM',
            to: 'PTY',
            departure: '2026-12-10T06:00:00',
            arrival: '2026-12-10T09:40:00',
            flight_number: 'CM490',
            airline: 'CM',
          },
          {
            from: 'PTY',
            to: 'MAD',
            departure: '2026-12-10T11:00:00',
            arrival: '2026-12-11T04:30:00',
            flight_number: 'CM492',
            airline: 'CM',
          },
        ];
  return {
    rank,
    offer_id: `offer-${rank}`,
    score: rank / 10,
    match_pct: 90 - rank * 10,
    price: { amount, currency: 'USD' },
    duration_minutes: 795 + rank * 30,
    extra_minutes_vs_t_min: 75 + rank * 30,
    stops,
    airlines: [
      { iata: stops ? 'CM' : 'LA', name: stops ? 'Copa Airlines' : 'LATAM Airlines', logo: '' },
    ],
    legs: [
      {
        direction: 'OUTBOUND',
        departure: segments[0]!.departure,
        arrival: segments[segments.length - 1]!.arrival,
        duration_minutes: 795 + rank * 30,
        stops,
        segments,
      },
    ],
    airports: stops ? [LIM, PTY, MAD] : [LIM, MAD],
    deep_link: `https://book.navby.example/offer-${rank}`,
  };
}

const PODIUM = {
  search_id: 'srch_01JE2EPODIUM00000000000000',
  // Vigente al correr la prueba (RN-10): cambiar de perfil exige una búsqueda no vencida.
  expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  credits_charged: 5,
  credits_remaining: 5,
  partial: false,
  pairs_quoted: [{ origin: 'LIM', destination: 'MAD' }],
  t_min_minutes: 720,
  offers_received: 3,
  pareto_size: 3,
  preferences: { profile: 'BALANCED', weights: { price: 0.5, duration: 0.3, stops: 0.2 } },
  price_disclaimer:
    'Precio referencial obtenido de terceros; se confirma en el sitio del vendedor.',
  podium: [offer(1, '812.40', 0), offer(2, '760.00', 1), offer(3, '905.10', 0)],
};

function futureIso(daysFromToday: number): string {
  return new Date(Date.now() + daysFromToday * 86_400_000).toISOString().slice(0, 10);
}

const SEARCH_URL = `/app/?trip=ONE_WAY&from=LIM&to=MAD&dep=${futureIso(30)}&ad=1&ch=0&in=0&cabin=ECONOMY&cur=USD`;

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({
    status,
    contentType: status >= 400 ? 'application/problem+json' : 'application/json',
    body: JSON.stringify(body),
  });

async function mockApi(page: Page, quote: (route: Route) => Promise<void> | void) {
  await page.route('https://basemaps.cartocdn.com/**', (route) =>
    json(route, 200, { version: 8, sources: {}, layers: [] }),
  );
  await page.route('**/api/v1/auth/refresh', (route) => json(route, 200, SESSION));
  await page.route('**/api/v1/routing/cities*', (route) => json(route, 200, { cities: CITIES }));
  await page.route('**/api/v1/routing/preview*', (route) => json(route, 200, PREVIEW));
  await page.route('**/api/v1/quotes/search', quote);
}

async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
}

test.describe('Podio (Plan 4)', () => {
  test('buscar → podio → resaltar → Comprar en pestaña nueva, con axe en claro y oscuro', async ({
    page,
    context,
  }) => {
    let wallet = E2E_WALLET;
    await page.route('**/api/v1/billing/wallet', (route) => json(route, 200, wallet));
    await mockApi(page, (route) => {
      wallet = { ...E2E_WALLET, free_credits: 5, total_credits: 5, searches_available: 1 };
      return json(route, 200, PODIUM);
    });

    await page.goto(SEARCH_URL);
    await expect(page.getByRole('link', { name: /Saldo: 10 créditos/ })).toBeVisible();
    await page.getByRole('button', { name: 'Buscar' }).click();

    const list = page.getByRole('list', { name: 'Recomendaciones ordenadas de mejor a peor' });
    await expect(list.locator(':scope > li')).toHaveCount(3);
    await expect(page.getByText('3 recomendaciones listas')).toBeAttached();
    await expect(page).toHaveURL(/sid=srch_01JE2EPODIUM/);
    await expect(page.getByRole('link', { name: /Saldo: 5 créditos/ })).toBeVisible();

    const first = list.locator(':scope > li').first();
    await expect(first.getByText('USD 812.40')).toBeVisible();
    await expect(first.getByText('80 % afinidad')).toBeVisible();

    // Resaltado tarjeta → ruta (borde primary en la tarjeta activa).
    await first.hover();
    await expect(first.locator('[role="group"]')).toHaveClass(/border-primary/);

    const hasOverflow = await page
      .locator('html')
      .evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(hasOverflow).toBe(false);

    await expectNoAxeViolations(page);
    await page.locator('html').evaluate((el) => el.classList.add('dark'));
    await expectNoAxeViolations(page);

    // El vendedor no existe en pruebas: se sirve una página mínima en su dominio.
    await context.route('https://book.navby.example/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Vendedor</title>' }),
    );
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      first.getByRole('link', { name: /Comprar/ }).click(),
    ]);
    expect(popup.url()).toContain('https://book.navby.example/offer-1');
  });

  test('preferencias: Rapidez y Personalizado reordenan sin costo, con axe en claro y oscuro', async ({
    page,
  }) => {
    const rankBodies: unknown[] = [];
    let walletCalls = 0;
    await page.route('**/api/v1/billing/wallet', (route) => {
      walletCalls += 1;
      return json(route, 200, E2E_WALLET);
    });
    await mockApi(page, (route) => json(route, 200, PODIUM));
    await page.route('**/api/v1/quotes/*/rank', (route) => {
      const body = route.request().postDataJSON() as { profile: string; weights?: unknown };
      rankBodies.push(body);
      const reversed = [...PODIUM.podium].reverse().map((o, i) => ({ ...o, rank: i + 1 }));
      return json(route, 200, {
        ...PODIUM,
        credits_charged: 0,
        podium: reversed,
        preferences: {
          profile: body.profile,
          weights: body.weights ?? { price: 0.2, duration: 0.6, stops: 0.2 },
        },
      });
    });

    await page.goto(SEARCH_URL);
    await page.getByRole('button', { name: 'Buscar' }).click();
    const first = page
      .getByRole('list', { name: 'Recomendaciones ordenadas de mejor a peor' })
      .locator(':scope > li')
      .first();
    await expect(first.getByText('USD 812.40')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Equilibrado' })).toBeChecked();
    const walletCallsAfterSearch = walletCalls;

    await page.getByText('Rapidez', { exact: true }).click();
    await expect(first.getByText('USD 905.10')).toBeVisible();
    await expect(page).toHaveURL(/profile=FAST/);
    expect(rankBodies).toEqual([{ profile: 'FAST' }]);

    await page.getByText('Personalizado', { exact: true }).click();
    const price = page.getByRole('slider', { name: 'Precio' });
    await expect(price).toHaveValue('20');
    await price.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('30 %', { exact: true })).toBeVisible();
    // Rapidez 20/60/20 → precio 30: los otros dos se reparten la diferencia (50/20).
    await expect(page).toHaveURL(/profile=CUSTOM.*w=30%2C50%2C20/);
    expect(walletCalls).toBe(walletCallsAfterSearch);
    await expect(page.getByRole('link', { name: /Saldo: 10 créditos/ })).toBeVisible();

    const hasOverflow = await page
      .locator('html')
      .evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(hasOverflow).toBe(false);
    await expectNoAxeViolations(page);
    await page.locator('html').evaluate((el) => el.classList.add('dark'));
    await expectNoAxeViolations(page);
  });

  test('sin créditos (402): toast con la recarga y acceso a créditos', async ({ page }) => {
    await mockApi(page, (route) =>
      json(route, 402, {
        title: 'Créditos insuficientes',
        status: 402,
        detail: 'Saldo insuficiente',
        code: 'INSUFFICIENT_CREDITS',
      }),
    );

    await page.goto(SEARCH_URL);
    await expect(page.getByRole('link', { name: /Saldo: 10 créditos/ })).toBeVisible();
    await page.getByRole('button', { name: 'Buscar' }).click();

    await expect(page.getByText('No tienes créditos suficientes')).toBeVisible();
    // sileo despliega la descripción y la acción al pasar el cursor por el toast.
    await page.locator('[data-sileo-toast]').hover();
    await expect(page.getByText(/recarga gratuita a las 00:00/)).toBeVisible();
    await page.locator('[data-sileo-button]').click();
    await expect(page).toHaveURL(/\/app\/billing$/);
  });
});
