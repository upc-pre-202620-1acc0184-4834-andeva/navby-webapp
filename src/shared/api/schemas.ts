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
