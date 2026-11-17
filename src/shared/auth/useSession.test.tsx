import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applySession,
  clearSession,
  clearSessionToken,
  getAccessToken,
  refreshSession,
} from '@/shared/api/client';
import { bindSessionSync, sessionKeys, useSession } from './useSession';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const sessionPayload = {
  access_token: 'jwt-123',
  token_type: 'Bearer',
  expires_in: 900,
  user: {
    user_id: 'usr-1',
    email: 'ana@mail.com',
    full_name: 'Ana Torres',
    email_verified: true,
  },
};

describe('useSession & bindSessionSync', () => {
  afterEach(() => {
    clearSessionToken();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('restaura la sesión silenciosamente al iniciar cuando hay cookie válida', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(sessionPayload), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );

    const queryClient = new QueryClient();
    bindSessionSync(queryClient);

    const { result } = renderHook(() => useSession(), { wrapper: createWrapper(queryClient) });
    expect(result.current.isPending).toBe(true);

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('ana@mail.com');
    expect(getAccessToken()).toBe('jwt-123');
  });

  it('degrada a null sin sesión en 401 sin marcar error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              title: 'Refresh token inválido',
              status: 401,
              detail: 'Expirado',
              code: 'INVALID_REFRESH_TOKEN',
            }),
            { status: 401, headers: { 'content-type': 'application/problem+json' } },
          ),
      ),
    );

    const queryClient = new QueryClient();
    bindSessionSync(queryClient);

    const { result } = renderHook(() => useSession(), { wrapper: createWrapper(queryClient) });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('expone isError ante fallo de red en lugar de fingir sesión nula y limpia caché de perfil al expirar sesión', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Network down');
      }),
    );

    const queryClient = new QueryClient();
    queryClient.setQueryData(sessionKeys.profile, { email: 'cached@mail.com' });
    bindSessionSync(queryClient);

    const { result } = renderHook(() => useSession(), { wrapper: createWrapper(queryClient) });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isError).toBe(true);
    expect(result.current.user).toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              detail: 'bad',
              code: 'INVALID_REFRESH_TOKEN',
              status: 401,
              title: '401',
            }),
            {
              status: 401,
              headers: { 'content-type': 'application/problem+json' },
            },
          ),
      ),
    );

    await act(async () => {
      await refreshSession();
    });
    expect(queryClient.getQueryData(sessionKeys.profile)).toBeUndefined();
  });

  it('applySession/clearSession sincronizan la caché y vacían datos al cambiar de usuario', () => {
    const queryClient = new QueryClient();
    bindSessionSync(queryClient);
    const session = (id: string) => ({
      access_token: `jwt-${id}`,
      token_type: 'Bearer',
      expires_in: 900,
      user: { user_id: id, email: `${id}@mail.com`, full_name: id, email_verified: true },
    });

    applySession(session('a'));
    expect(getAccessToken()).toBe('jwt-a');
    queryClient.setQueryData(['itineraries'], ['de a']);

    clearSession();
    expect(getAccessToken()).toBeNull();
    expect(queryClient.getQueryData(sessionKeys.current)).toBeNull();
    expect(queryClient.getQueryData(['itineraries'])).toBeUndefined();

    queryClient.setQueryData(['itineraries'], ['de a, aún montada']);
    applySession(session('b'));
    expect(queryClient.getQueryData(['itineraries'])).toBeUndefined();
  });
});
