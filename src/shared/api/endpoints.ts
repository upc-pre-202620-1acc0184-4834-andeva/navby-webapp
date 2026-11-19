import { apiFetch, applySession, CAPTCHA_HEADER, clearSession, refreshSession } from './client';
import {
  type CitiesResponse,
  CitiesResponseSchema,
  type HealthStatus,
  HealthSchema,
  type PodiumResponse,
  PodiumResponseSchema,
  type RegisterResponse,
  RegisterResponseSchema,
  type RoutePreviewResponse,
  RoutePreviewResponseSchema,
  type Session,
  SessionSchema,
  type UserProfile,
  UserProfileSchema,
  type UserSummary,
  type Wallet,
  WalletSchema,
} from './schemas';

export async function bootstrapSession(): Promise<UserSummary | null> {
  const session = await refreshSession();
  return session?.user ?? null;
}

async function openSession(path: string, body: unknown, headers?: HeadersInit): Promise<Session> {
  const session = await apiFetch(path, {
    method: 'POST',
    auth: 'none',
    body,
    headers,
    schema: SessionSchema,
  });
  applySession(session);
  return session;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  accept_terms: boolean;
}

export function registerAccount(
  payload: RegisterPayload,
  captchaToken: string,
): Promise<RegisterResponse> {
  return apiFetch('/auth/register', {
    method: 'POST',
    auth: 'none',
    body: payload,
    headers: { [CAPTCHA_HEADER]: captchaToken },
    schema: RegisterResponseSchema,
  });
}

export function verifyEmail(payload: { email: string; code: string }): Promise<Session> {
  return openSession('/auth/verify-email', payload);
}

export function resendVerificationCode(payload: { email: string }): Promise<void> {
  return apiFetch('/auth/verify-email/resend', {
    method: 'POST',
    auth: 'none',
    body: payload,
    parseVoid: true,
  });
}

export function login(
  payload: { email: string; password: string },
  captchaToken: string,
): Promise<Session> {
  return openSession('/auth/login', payload, { [CAPTCHA_HEADER]: captchaToken });
}

export function loginWithGoogle(payload: {
  id_token: string;
  accept_terms?: boolean;
}): Promise<Session> {
  return openSession('/auth/google', payload);
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST', auth: 'none', parseVoid: true });
  clearSession();
}

export function requestPasswordReset(
  payload: { email: string },
  captchaToken: string,
): Promise<void> {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    auth: 'none',
    body: payload,
    headers: { [CAPTCHA_HEADER]: captchaToken },
    parseVoid: true,
  });
}

/** El backend revoca todas las sesiones al cambiar la contraseña (US-08). */
export async function resetPassword(payload: {
  token: string;
  new_password: string;
}): Promise<void> {
  await apiFetch('/auth/reset-password', {
    method: 'POST',
    auth: 'none',
    body: payload,
    parseVoid: true,
  });
  clearSession();
}

export async function deleteMyAccount(payload: { confirmation: string }): Promise<void> {
  await apiFetch('/users/me', {
    method: 'DELETE',
    auth: 'required',
    body: payload,
    parseVoid: true,
  });
  clearSession();
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

/** Perfil de preferencias; `weights` (fracciones que suman 1) solo con `CUSTOM`. */
export interface ApiPreferences {
  profile: string;
  weights?: { price: number; duration: number; stops: number };
}

export interface QuoteSearchPayload {
  trip_type: 'ONE_WAY' | 'ROUND_TRIP';
  origins: string[];
  destinations: string[];
  departure_date: string;
  return_date: string | null;
  passengers: { adults: number; children: number; infants: number };
  cabin: string;
  currency: string;
  preferences: ApiPreferences;
}

export function searchQuotes(payload: QuoteSearchPayload): Promise<PodiumResponse> {
  return apiFetch('/quotes/search', {
    method: 'POST',
    auth: 'required',
    body: payload,
    schema: PodiumResponseSchema,
  });
}

/**
 * Reordena un podio vigente con otro perfil (gratis, RN-11). También sirve para leerlo al
 * recargar: `404 SEARCH_NOT_FOUND` si venció o es de otro usuario (US-19).
 */
export function rankQuotes(
  searchId: string,
  preferences: ApiPreferences,
  signal?: AbortSignal,
): Promise<PodiumResponse> {
  return apiFetch(`/quotes/${encodeURIComponent(searchId)}/rank`, {
    method: 'POST',
    signal,
    auth: 'required',
    body: preferences,
    schema: PodiumResponseSchema,
  });
}

export function getWallet(signal?: AbortSignal): Promise<Wallet> {
  return apiFetch('/billing/wallet', {
    signal,
    auth: 'required',
    schema: WalletSchema,
  });
}
