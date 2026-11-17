import { type z } from 'zod';
import { ApiError, parseApiError } from './errors';
import { type Session, SessionSchema, type UserSummary } from './schemas';

const API_BASE = '/api/v1';
const REFRESH_SAFETY_WINDOW_MS = 30_000;

interface TokenEntry {
  token: string;
  expiresAt: number;
}

type SessionListener = (user: UserSummary | null) => void;

// El access token vive solo en memoria de este módulo (AGENTS.md §6).
let sessionToken: TokenEntry | null = null;
let inflightRefresh: Promise<Session | null> | null = null;
const sessionListeners = new Set<SessionListener>();

export function getAccessToken(): string | null {
  return sessionToken?.token ?? null;
}

export function setSessionToken(token: string, expiresInSeconds: number): void {
  sessionToken = {
    token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
}

export function clearSessionToken(): void {
  sessionToken = null;
}

export function registerSessionListener(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

export function resetApiClientForTests(): void {
  sessionToken = null;
  inflightRefresh = null;
  sessionListeners.clear();
}

function notifySession(user: UserSummary | null): void {
  for (const listener of [...sessionListeners]) {
    listener(user);
  }
}

function isTokenExpiringSoon(): boolean {
  if (!sessionToken) return true;
  return sessionToken.expiresAt - Date.now() <= REFRESH_SAFETY_WINDOW_MS;
}

function validateRelativeApiPath(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith(API_BASE)) {
    throw new Error(`apiFetch requires a relative path under ${API_BASE} (received "${path}")`);
  }
  return path;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function buildNetworkError(cause: unknown): ApiError {
  return new ApiError({
    status: 0,
    code: 'NETWORK_ERROR',
    title: 'Network Error',
    detail: 'Could not reach the server.',
    cause,
  });
}

function buildInvalidResponseError(status: number, cause?: unknown): ApiError {
  return new ApiError({
    status,
    code: 'INVALID_RESPONSE',
    title: 'Invalid Response',
    detail: 'Server response did not match the expected contract.',
    cause,
  });
}

/**
 * Rota la cookie HttpOnly `navby_refresh` y actualiza el access token en memoria.
 * Las peticiones concurrentes dentro de la misma pestaña comparten una única llamada.
 */
export async function refreshSession(): Promise<Session | null> {
  if (inflightRefresh) {
    return inflightRefresh;
  }

  inflightRefresh = (async () => {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
    } catch (error) {
      throw buildNetworkError(error);
    }

    if (response.status === 401) {
      clearSessionToken();
      notifySession(null);
      return null;
    }

    if (!response.ok) {
      throw await parseApiError(response);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (error) {
      throw buildInvalidResponseError(response.status, error);
    }

    const parsed = SessionSchema.safeParse(json);
    if (!parsed.success) {
      throw buildInvalidResponseError(response.status, parsed.error);
    }

    setSessionToken(parsed.data.access_token, parsed.data.expires_in);
    notifySession(parsed.data.user);
    return parsed.data;
  })().finally(() => {
    inflightRefresh = null;
  });

  return inflightRefresh;
}

export interface ApiFetchBaseOptions {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  auth?: 'required' | 'optional' | 'none';
  expectedStatuses?: ReadonlyArray<number>;
}

export interface ApiFetchSchemaOptions<T> extends ApiFetchBaseOptions {
  schema: z.ZodType<T>;
  parseVoid?: false;
}

export interface ApiFetchVoidOptions extends ApiFetchBaseOptions {
  parseVoid: true;
  schema?: undefined;
}

function serializeBody(body: unknown, headers: Headers): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (
    typeof body === 'string' ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  ) {
    return body as BodyInit;
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return JSON.stringify(body);
}

export async function apiFetch<T>(path: string, options: ApiFetchSchemaOptions<T>): Promise<T>;
export async function apiFetch(path: string, options: ApiFetchVoidOptions): Promise<void>;
export async function apiFetch<T>(
  path: string,
  options: ApiFetchSchemaOptions<T> | ApiFetchVoidOptions,
): Promise<T | void> {
  const cleanPath = validateRelativeApiPath(path);
  const authMode = options.auth ?? 'optional';

  if (authMode === 'required' && (isTokenExpiringSoon() || inflightRefresh !== null)) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      throw new ApiError({
        status: 401,
        code: 'UNAUTHENTICATED',
        title: 'No autenticado',
        detail: 'La sesión expiró o no está iniciada.',
      });
    }
  }

  const execute = async (bearerToken: string | null): Promise<Response> => {
    const headers = new Headers(options.headers);
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
    if (authMode !== 'none' && bearerToken) {
      headers.set('Authorization', `Bearer ${bearerToken}`);
    } else if (authMode === 'none') {
      headers.delete('Authorization');
    }

    const body = serializeBody(options.body, headers);

    try {
      return await fetch(`${API_BASE}${cleanPath}`, {
        method: options.method ?? 'GET',
        credentials: 'include',
        headers,
        body,
        signal: options.signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      throw buildNetworkError(error);
    }
  };

  const usedToken = getAccessToken();
  let response = await execute(usedToken);

  if (response.status === 401) {
    const apiError = await parseApiError(response);
    const shouldRefresh =
      authMode !== 'none' && (apiError.code === 'UNAUTHENTICATED' || apiError.code === 'HTTP_401');

    if (!shouldRefresh) {
      throw apiError;
    }

    const currentToken = getAccessToken();
    let nextToken = currentToken && currentToken !== usedToken ? currentToken : null;

    if (!nextToken) {
      const refreshed = await refreshSession();
      if (!refreshed) {
        throw apiError;
      }
      nextToken = refreshed.access_token;
    }

    response = await execute(nextToken);
    if (response.status === 401) {
      const retryError = await parseApiError(response);
      if (retryError.code === 'UNAUTHENTICATED' || retryError.code === 'HTTP_401') {
        clearSessionToken();
        notifySession(null);
      }
      throw retryError;
    }
  }

  const accepted = response.ok || (options.expectedStatuses?.includes(response.status) ?? false);
  if (!accepted) {
    throw await parseApiError(response);
  }

  if (options.parseVoid) {
    return undefined;
  }

  let rawText: string;
  try {
    rawText = await response.text();
  } catch (error) {
    throw buildInvalidResponseError(response.status, error);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch (error) {
    throw buildInvalidResponseError(response.status, error);
  }

  const validated = options.schema.safeParse(parsedJson);
  if (!validated.success) {
    throw buildInvalidResponseError(response.status, validated.error);
  }

  return validated.data;
}
