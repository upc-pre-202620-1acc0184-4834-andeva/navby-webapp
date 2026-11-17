import { apiFetch, refreshSession } from './client';
import {
  type CitiesResponse,
  CitiesResponseSchema,
  type HealthStatus,
  HealthSchema,
  type RoutePreviewResponse,
  RoutePreviewResponseSchema,
  type UserProfile,
  UserProfileSchema,
  type UserSummary,
} from './schemas';

export async function bootstrapSession(): Promise<UserSummary | null> {
  const session = await refreshSession();
  return session?.user ?? null;
}

export function getMyProfile(signal?: AbortSignal): Promise<UserProfile> {
  return apiFetch('/users/me', {
    signal,
    auth: 'required',
    schema: UserProfileSchema,
  });
}

export function getHealth(signal?: AbortSignal): Promise<HealthStatus> {
  return apiFetch('/health', {
    signal,
    auth: 'none',
    expectedStatuses: [200, 503],
    schema: HealthSchema,
  });
}

export interface SearchCitiesParams {
  q: string;
  limit?: number;
}

export function searchCities(
  { q, limit = 10 }: SearchCitiesParams,
  signal?: AbortSignal,
): Promise<CitiesResponse> {
  const params = new URLSearchParams({
    q: q.trim(),
    limit: String(limit),
  });

  return apiFetch(`/routing/cities?${params.toString()}`, {
    signal,
    auth: 'required',
    schema: CitiesResponseSchema,
  });
}

export interface RoutePreviewParams {
  origins: ReadonlyArray<string>;
  destinations: ReadonlyArray<string>;
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
}

export function getRoutePreview(
  { origins, destinations, tripType }: RoutePreviewParams,
  signal?: AbortSignal,
): Promise<RoutePreviewResponse> {
  const params = new URLSearchParams({
    origins: origins.join(','),
    destinations: destinations.join(','),
    trip_type: tripType,
  });

  return apiFetch(`/routing/preview?${params.toString()}`, {
    signal,
    auth: 'required',
    schema: RoutePreviewResponseSchema,
  });
}
