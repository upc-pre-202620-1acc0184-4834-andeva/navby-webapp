import AxeBuilder from '@axe-core/playwright';
import { type Page, type Route } from '@playwright/test';
import { expect } from './fixtures';

/** Mocks de la API compartidos por los specs del podio y de los itinerarios. */
export const SESSION = {
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

export const CITIES = [
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

export const PREVIEW = {
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

export const LIM = { iata: 'LIM', lat: -12.0219, lon: -77.1143, timezone: 'America/Lima' };
export const MAD = { iata: 'MAD', lat: 40.4719, lon: -3.5626, timezone: 'Europe/Madrid' };
export const PTY = { iata: 'PTY', lat: 9.0714, lon: -79.3835, timezone: 'America/Panama' };

export function offer(rank: number, amount: string, stops: number) {
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

export const PODIUM = {
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

export function futureIso(daysFromToday: number): string {
  return new Date(Date.now() + daysFromToday * 86_400_000).toISOString().slice(0, 10);
}

export const SEARCH_URL = `/app/?trip=ONE_WAY&from=LIM&to=MAD&dep=${futureIso(30)}&ad=1&ch=0&in=0&cabin=ECONOMY&cur=USD`;

export const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({
    status,
    contentType: status >= 400 ? 'application/problem+json' : 'application/json',
    body: JSON.stringify(body),
  });

export async function mockApi(page: Page, quote: (route: Route) => Promise<void> | void) {
  await page.route('https://basemaps.cartocdn.com/**', (route) =>
    json(route, 200, { version: 8, sources: {}, layers: [] }),
  );
  await page.route('**/api/v1/auth/refresh', (route) => json(route, 200, SESSION));
  await page.route('**/api/v1/routing/cities*', (route) => json(route, 200, { cities: CITIES }));
  await page.route('**/api/v1/routing/preview*', (route) => json(route, 200, PREVIEW));
  await page.route('**/api/v1/quotes/search', quote);
}

export async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
}
