import { apiFetch, refreshSession } from './client';
import {
  type HealthStatus,
  HealthSchema,
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
