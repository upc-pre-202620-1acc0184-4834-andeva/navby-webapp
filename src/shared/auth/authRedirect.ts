import { type Location } from 'react-router';

export interface AuthRedirectState {
  from?: Location;
}

const AUTH_ROUTE_PATHS = new Set([
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
]);

/** Conserva el destino original tras autenticar sin sobrescribirlo con rutas de acceso. */
export function resolveAuthRedirectFrom(
  location: Location,
  state?: AuthRedirectState | null,
): Location | undefined {
  const effectiveState = state ?? (location.state as AuthRedirectState | null);
  const candidate = effectiveState?.from;
  if (candidate && !AUTH_ROUTE_PATHS.has(candidate.pathname)) {
    return candidate;
  }
  if (!AUTH_ROUTE_PATHS.has(location.pathname)) {
    return location;
  }
  return undefined;
}
