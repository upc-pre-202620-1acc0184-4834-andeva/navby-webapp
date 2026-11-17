import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  apiFetch,
  clearSessionToken,
  getAccessToken,
  refreshSession,
  registerSessionListener,
  resetApiClientForTests,
  setSessionToken,
} from './client';
import { bootstrapSession, getHealth, getMyProfile } from './endpoints';
import { ApiError } from './errors';

const sessionPayload = {
  access_token: 'fresh-jwt',
  token_type: 'Bearer',
  expires_in: 900,
  user: {
    user_id: 'usr-1',
    email: 'ana@mail.com',
    full_name: 'Ana Torres',
    email_verified: true,
  },
};

function jsonResponse(body: unknown, status = 200, contentType = 'application/json') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': contentType },
  });
}

describe('shared/api client & endpoints', () => {
  afterEach(() => {
    resetApiClientForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rechaza rutas absolutas, protocol-relative y prefijos /api/v1 duplicados', async () => {
    const schema = z.object({ ok: z.boolean() });
    await expect(apiFetch('https://evil.test/api', { schema })).rejects.toThrow();
    await expect(apiFetch('//evil.test/api', { schema })).rejects.toThrow();
    await expect(apiFetch('/api/v1/health', { schema })).rejects.toThrow();
  });

  it('conserva el token solo en memoria, lo envía como Bearer y ejecuta refresh single-flight con reintento único', async () => {
    setSessionToken('expired-jwt', 900);
    const listener = vi.fn();
    registerSessionListener(listener);

    let refreshCount = 0;
    let resourceCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(init?.credentials).toBe('include');

      if (url === '/api/v1/auth/refresh') {
        refreshCount += 1;
        await new Promise((r) => setTimeout(r, 15));
        return jsonResponse(sessionPayload, 200);
      }

      if (url === '/api/v1/users/me') {
        resourceCalls += 1;
        const headers = new Headers(init?.headers);
        if (headers.get('Authorization') === 'Bearer expired-jwt') {
          return jsonResponse(
            {
              title: 'No autenticado',
              status: 401,
              detail: 'Token expirado',
              code: 'UNAUTHENTICATED',
            },
            401,
            'application/problem+json',
          );
        }
        expect(headers.get('Authorization')).toBe('Bearer fresh-jwt');
        return jsonResponse({
          ...sessionPayload.user,
          has_password: true,
          has_google: false,
          created_at: '2026-10-01T10:00:00Z',
        });
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const [p1, p2] = await Promise.all([getMyProfile(), getMyProfile()]);
    expect(p1.email).toBe('ana@mail.com');
    expect(p2.user_id).toBe('usr-1');
    expect(refreshCount).toBe(1);
    expect(resourceCalls).toBe(4);
    expect(getAccessToken()).toBe('fresh-jwt');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(sessionPayload.user);
  });

  it('reintenta una sola vez aunque el reintento vuelva a responder 401 y limpia la sesión', async () => {
    setSessionToken('stale-jwt', 900);
    const listener = vi.fn();
    registerSessionListener(listener);
    let refreshCount = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/v1/auth/refresh') {
        refreshCount += 1;
        return jsonResponse(sessionPayload, 200);
      }
      return jsonResponse(
        {
          title: 'No autenticado',
          status: 401,
          detail: 'Sigue inválido',
          code: 'UNAUTHENTICATED',
        },
        401,
        'application/problem+json',
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getMyProfile()).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
    expect(refreshCount).toBe(1);
    expect(getAccessToken()).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null);
  });

  it('no dispara refresh ante 401 INVALID_CREDENTIALS ni en auth: none', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        {
          title: 'Credenciales inválidas',
          status: 401,
          detail: 'Correo o contraseña incorrectos.',
          code: 'INVALID_CREDENTIALS',
        },
        401,
        'application/problem+json',
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiFetch('/auth/login', {
        method: 'POST',
        auth: 'none',
        headers: { 'X-Captcha-Response': 'token-xyz' },
        body: { email: 'a@b.com', password: 'bad' },
        schema: z.object({ ok: z.boolean() }),
      }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCallInit = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(firstCallInit?.headers).get('X-Captcha-Response')).toBe('token-xyz');
  });

  it('refresca proactivamente antes de enviar cuando el token vence en <= 30s', async () => {
    setSessionToken('soon-expired', 10);
    const seenUrls: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        seenUrls.push(url);
        if (url === '/api/v1/auth/refresh') return jsonResponse(sessionPayload, 200);
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fresh-jwt');
        return jsonResponse({
          ...sessionPayload.user,
          has_password: true,
          has_google: false,
          created_at: '2026-10-01T10:00:00Z',
        });
      }),
    );

    await getMyProfile();
    expect(seenUrls).toEqual(['/api/v1/auth/refresh', '/api/v1/users/me']);
  });

  it('bootstrapSession retorna null sin error en 401 y limpia token en memoria', async () => {
    setSessionToken('old', 900);
    const listener = vi.fn();
    registerSessionListener(listener);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            title: 'Refresh token inválido',
            status: 401,
            detail: 'Expirado',
            code: 'INVALID_REFRESH_TOKEN',
          },
          401,
          'application/problem+json',
        ),
      ),
    );

    const user = await bootstrapSession();
    expect(user).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(listener).toHaveBeenCalledWith(null);
  });

  it('propaga NETWORK_ERROR con status 0 y respeta AbortError sin envolverlo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    await expect(refreshSession()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('Aborted', 'AbortError');
      }),
    );

    await expect(getHealth()).rejects.toSatisfy(
      (err: unknown) => err instanceof DOMException && err.name === 'AbortError',
    );
  });

  it('getHealth acepta respuestas 200 y 503 validadas con Zod', async () => {
    clearSessionToken();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            status: 'DOWN',
            postgres: 'UP',
            redis: 'DOWN',
            graph: { status: 'UP', nodes: 3354, edges: 37326 },
          },
          503,
        ),
      ),
    );

    const health = await getHealth();
    expect(health.status).toBe('DOWN');
    expect(health.redis).toBe('DOWN');
    expect(health.graph.nodes).toBe(3354);
  });

  it('convierte respuestas 200 con schema inválido en ApiError INVALID_RESPONSE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ unexpected: true }, 200)),
    );

    await expect(getHealth()).rejects.toSatisfy(
      (err: unknown) => err instanceof ApiError && err.code === 'INVALID_RESPONSE',
    );
  });
});
