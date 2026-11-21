import { type PodiumOffer, type PodiumResponse, type Wallet } from '@/shared/api/schemas';

/** Basado en el mock de FlightAPI de navby-platform (`fixtures/flightapi/default_oneway.json`). */
const LIM = { iata: 'LIM', lat: -12.0219, lon: -77.1143, timezone: 'America/Lima' };
const MAD = { iata: 'MAD', lat: 40.4719, lon: -3.5626, timezone: 'Europe/Madrid' };
const PTY = { iata: 'PTY', lat: 9.0714, lon: -79.3835, timezone: 'America/Panama' };

const airlines = {
  LA: { iata: 'LA', name: 'LATAM Airlines', logo: 'https://logos.example/LA.png' },
  CM: { iata: 'CM', name: 'Copa Airlines', logo: '' },
  AA: { iata: 'AA', name: 'American Airlines', logo: 'https://logos.example/AA.png' },
};

export const oneWayOffers: PodiumOffer[] = [
  {
    rank: 1,
    offer_id: 'a1b2c3d4e5f60001',
    score: 0.1834,
    match_pct: 82,
    price: { amount: '240.00', currency: 'USD' },
    duration_minutes: 375,
    extra_minutes_vs_t_min: 15,
    stops: 0,
    airlines: [airlines.LA],
    legs: [
      {
        direction: 'OUTBOUND',
        departure: '2026-11-01T08:30:00',
        arrival: '2026-11-01T14:45:00',
        duration_minutes: 375,
        stops: 0,
        segments: [
          {
            from: 'LIM',
            to: 'MAD',
            departure: '2026-11-01T08:30:00',
            arrival: '2026-11-01T14:45:00',
            flight_number: 'LA2510',
            airline: 'LA',
          },
        ],
      },
    ],
    airports: [LIM, MAD],
    deep_link: 'https://book.navby.example/ow1',
  },
  {
    rank: 2,
    offer_id: 'a1b2c3d4e5f60002',
    score: 0.31,
    match_pct: 69,
    price: { amount: '210.00', currency: 'USD' },
    duration_minutes: 510,
    extra_minutes_vs_t_min: 150,
    stops: 1,
    airlines: [airlines.CM],
    legs: [
      {
        direction: 'OUTBOUND',
        departure: '2026-11-01T06:00:00',
        arrival: '2026-11-01T14:30:00',
        duration_minutes: 510,
        stops: 1,
        segments: [
          {
            from: 'LIM',
            to: 'PTY',
            departure: '2026-11-01T06:00:00',
            arrival: '2026-11-01T09:40:00',
            flight_number: 'CM490',
            airline: 'CM',
          },
          {
            from: 'PTY',
            to: 'MAD',
            departure: '2026-11-01T11:00:00',
            arrival: '2026-11-01T14:30:00',
            flight_number: 'CM492',
            airline: 'CM',
          },
        ],
      },
    ],
    airports: [LIM, PTY, MAD],
    deep_link: 'https://book.navby.example/ow2',
  },
  {
    rank: 3,
    offer_id: 'a1b2c3d4e5f60003',
    score: 0.42,
    match_pct: 58,
    price: { amount: '275.00', currency: 'USD' },
    duration_minutes: 360,
    extra_minutes_vs_t_min: 0,
    stops: 0,
    airlines: [airlines.AA],
    legs: [
      {
        direction: 'OUTBOUND',
        departure: '2026-11-01T10:15:00',
        arrival: '2026-11-01T16:15:00',
        duration_minutes: 360,
        stops: 0,
        segments: [
          {
            from: 'LIM',
            to: 'MAD',
            departure: '2026-11-01T10:15:00',
            arrival: '2026-11-01T16:15:00',
            flight_number: 'AA988',
            airline: 'AA',
          },
        ],
      },
    ],
    airports: [LIM, MAD],
    deep_link: 'https://book.navby.example/ow3',
  },
];

/** Acceso indexado con garantía para pruebas (`noUncheckedIndexedAccess`). */
export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Fixture sin índice ${index}`);
  return item;
}

export function podiumResponse(overrides: Partial<PodiumResponse> = {}): PodiumResponse {
  return {
    search_id: 'srch_01JTESTPODIUM0000000000000',
    // Vigente al correr la prueba (RN-10: 30 min desde la cotización).
    expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    credits_charged: 5,
    credits_remaining: 5,
    partial: false,
    pairs_quoted: [{ origin: 'LIM', destination: 'MAD' }],
    t_min_minutes: 360,
    offers_received: 3,
    pareto_size: 3,
    preferences: { profile: 'BALANCED', weights: { price: 0.5, duration: 0.3, stops: 0.2 } },
    price_disclaimer: 'Precio referencial obtenido de terceros.',
    podium: oneWayOffers,
    ...overrides,
  };
}

/** Oferta ida y vuelta: dos tramos, precio y duración del viaje completo. */
export const roundTripOffer: PodiumOffer = {
  ...at(oneWayOffers, 0),
  price: { amount: '980.50', currency: 'USD' },
  duration_minutes: 760,
  legs: [
    at(at(oneWayOffers, 0).legs, 0),
    {
      direction: 'INBOUND',
      departure: '2026-11-15T16:00:00',
      arrival: '2026-11-15T22:25:00',
      duration_minutes: 385,
      stops: 0,
      segments: [
        {
          from: 'MAD',
          to: 'LIM',
          departure: '2026-11-15T16:00:00',
          arrival: '2026-11-15T22:25:00',
          flight_number: 'LA2511',
          airline: 'LA',
        },
      ],
    },
  ],
};

export const wallet: Wallet = {
  free_credits: 5,
  paid_credits: 45,
  total_credits: 50,
  searches_available: 10,
  free_credits_reset_at: '2026-11-18T05:00:00Z',
};
