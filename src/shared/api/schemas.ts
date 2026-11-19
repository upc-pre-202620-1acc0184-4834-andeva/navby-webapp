import { z } from 'zod';

export const UserSummarySchema = z.object({
  user_id: z.string(),
  email: z.string(),
  full_name: z.string(),
  email_verified: z.boolean(),
});

export type UserSummary = z.infer<typeof UserSummarySchema>;

export const SessionSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string(),
  expires_in: z.number(),
  user: UserSummarySchema,
});

export type Session = z.infer<typeof SessionSchema>;

export const RegisterResponseSchema = z.object({
  user_id: z.string(),
  email: z.string(),
  email_verified: z.boolean(),
});

export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

export const UserProfileSchema = UserSummarySchema.extend({
  has_password: z.boolean(),
  has_google: z.boolean(),
  created_at: z.string(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const HealthSchema = z.object({
  status: z.enum(['UP', 'DOWN']),
  postgres: z.string(),
  redis: z.string(),
  graph: z.object({
    status: z.string(),
    nodes: z.number(),
    edges: z.number(),
  }),
});

export type HealthStatus = z.infer<typeof HealthSchema>;

export const CityAirportSchema = z.object({
  iata: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
});

export type CityAirport = z.infer<typeof CityAirportSchema>;

export const CitySchema = z.object({
  city: z.string(),
  city_es: z.string().nullish(),
  country: z.string(),
  airports: z.array(CityAirportSchema).min(1),
});

export type City = z.infer<typeof CitySchema>;

export const CitiesResponseSchema = z.object({
  cities: z.array(CitySchema),
});

export type CitiesResponse = z.infer<typeof CitiesResponseSchema>;

export const PreviewPairSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  min_stops: z.number().int(),
  t_min_minutes: z.number().int(),
});

export type PreviewPair = z.infer<typeof PreviewPairSchema>;

export const RouteAirportPointSchema = z.object({
  iata: z.string(),
  lat: z.number(),
  lon: z.number(),
});

export type RouteAirportPoint = z.infer<typeof RouteAirportPointSchema>;

export const BestRouteSchema = z.object({
  t_min_minutes: z.number().int(),
  airports: z.array(RouteAirportPointSchema),
});

export type BestRoute = z.infer<typeof BestRouteSchema>;

export const PreviewTelemetrySchema = z.object({
  pairs_evaluated: z.number().int(),
  bfs_ms: z.number(),
  astar_ms: z.number(),
  astar_nodes_expanded: z.number().int(),
});

export type PreviewTelemetry = z.infer<typeof PreviewTelemetrySchema>;

export const RoutePreviewResponseSchema = z.object({
  reachable: z.boolean(),
  pairs: z.array(PreviewPairSchema),
  best_route: BestRouteSchema.nullable(),
  telemetry: PreviewTelemetrySchema,
});

export type RoutePreviewResponse = z.infer<typeof RoutePreviewResponseSchema>;

export const SegmentSchema = z.object({
  from: z.string(),
  to: z.string(),
  departure: z.string(),
  arrival: z.string(),
  flight_number: z.string(),
  airline: z.string(),
});

export type Segment = z.infer<typeof SegmentSchema>;

export const LegSchema = z.object({
  direction: z.enum(['OUTBOUND', 'INBOUND']),
  departure: z.string(),
  arrival: z.string(),
  duration_minutes: z.number().int(),
  stops: z.number().int(),
  segments: z.array(SegmentSchema).min(1),
});

export type Leg = z.infer<typeof LegSchema>;

export const PodiumAirportSchema = z.object({
  iata: z.string(),
  lat: z.number(),
  lon: z.number(),
  timezone: z.string(),
});

export type PodiumAirport = z.infer<typeof PodiumAirportSchema>;

export const PodiumOfferSchema = z.object({
  rank: z.number().int().min(1).max(3),
  offer_id: z.string(),
  score: z.number(),
  match_pct: z.number().int(),
  price: z.object({ amount: z.string(), currency: z.string() }),
  duration_minutes: z.number().int(),
  extra_minutes_vs_t_min: z.number().int(),
  stops: z.number().int(),
  airlines: z.array(z.object({ iata: z.string(), name: z.string(), logo: z.string() })),
  legs: z.array(LegSchema).min(1),
  airports: z.array(PodiumAirportSchema),
  deep_link: z.string(),
});

export type PodiumOffer = z.infer<typeof PodiumOfferSchema>;

export const PodiumResponseSchema = z.object({
  search_id: z.string(),
  expires_at: z.string(),
  credits_charged: z.number().int(),
  credits_remaining: z.number().int(),
  partial: z.boolean(),
  pairs_quoted: z.array(z.object({ origin: z.string(), destination: z.string() })),
  t_min_minutes: z.number().int(),
  offers_received: z.number().int(),
  pareto_size: z.number().int(),
  preferences: z.object({
    // Un perfil futuro del backend no rompe la respuesta: se lee como Equilibrado.
    profile: z.enum(['BALANCED', 'SAVER', 'FAST', 'CUSTOM']).catch('BALANCED'),
    weights: z.object({ price: z.number(), duration: z.number(), stops: z.number() }),
  }),
  price_disclaimer: z.string(),
  podium: z.array(PodiumOfferSchema).max(3),
});

export type PodiumResponse = z.infer<typeof PodiumResponseSchema>;

export const WalletSchema = z.object({
  free_credits: z.number().int(),
  paid_credits: z.number().int(),
  total_credits: z.number().int(),
  searches_available: z.number().int(),
  free_credits_reset_at: z.string(),
});

export type Wallet = z.infer<typeof WalletSchema>;
