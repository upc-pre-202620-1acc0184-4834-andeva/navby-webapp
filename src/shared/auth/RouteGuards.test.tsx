import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type AuthRedirectState } from './authRedirect';
import { RedirectIfAuthenticated, RequireAuth } from './RouteGuards';
import { bindSessionSync } from './useSession';

function LoginProbe() {
  const location = useLocation();
  const state = location.state as AuthRedirectState | null;
  const fromPath = state?.from ? `${state.from.pathname}${state.from.search}` : 'none';
  return <div>Login page · from: {fromPath}</div>;
}

function renderGuardedRoute(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  bindSessionSync(queryClient);

  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginProbe /> },
      {
        element: <RequireAuth />,
        children: [{ path: '/billing', element: <div>Billing protegido</div> }],
      },
    ],
    { initialEntries: [initialEntry] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('RequireAuth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('redirige a /login conservando ruta y query string cuando no hay sesión (401)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              title: 'Invalid',
              status: 401,
              detail: 'Missing',
              code: 'INVALID_REFRESH_TOKEN',
            }),
            { status: 401, headers: { 'content-type': 'application/problem+json' } },
          ),
      ),
    );

    renderGuardedRoute('/billing?pack=100');

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    await waitFor(() =>
      expect(screen.getByText('Login page · from: /billing?pack=100')).toBeInTheDocument(),
    );
  });

  it('permite acceso cuando la sesión se restaura', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              access_token: 'jwt-ok',
              token_type: 'Bearer',
              expires_in: 900,
              user: {
                user_id: 'usr-1',
                email: 'ana@mail.com',
                full_name: 'Ana Torres',
                email_verified: true,
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );

    renderGuardedRoute('/billing');
    await waitFor(() => expect(screen.getByText('Billing protegido')).toBeInTheDocument());
  });

  it('muestra error con Reintentar ante caída de red y recupera al reintentar', async () => {
    const user = userEvent.setup();
    let attempt = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        attempt += 1;
        if (attempt === 1) throw new TypeError('Offline');
        return new Response(
          JSON.stringify({
            access_token: 'jwt-recovered',
            token_type: 'Bearer',
            expires_in: 900,
            user: {
              user_id: 'usr-1',
              email: 'ana@mail.com',
              full_name: 'Ana Torres',
              email_verified: true,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    renderGuardedRoute('/billing');

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByText('Billing protegido')).toBeInTheDocument());
  });
});

describe('RedirectIfAuthenticated', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function renderGuestRoute(
    initialEntries: NonNullable<Parameters<typeof createMemoryRouter>[1]>['initialEntries'],
  ) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    bindSessionSync(queryClient);

    const router = createMemoryRouter(
      [
        { path: '/', element: <div>Home autenticado</div> },
        { path: '/billing', element: <div>Billing destino</div> },
        {
          element: <RedirectIfAuthenticated />,
          children: [{ path: '/login', element: <div>Formulario login</div> }],
        },
      ],
      { initialEntries },
    );

    return render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  }

  it('redirige a la ruta original (o /) si ya hay sesión iniciada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              access_token: 'jwt-ok',
              token_type: 'Bearer',
              expires_in: 900,
              user: {
                user_id: 'usr-1',
                email: 'ana@mail.com',
                full_name: 'Ana Torres',
                email_verified: true,
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );

    renderGuestRoute([
      {
        pathname: '/login',
        state: { from: { pathname: '/billing', search: '?pack=100', hash: '' } },
      },
    ]);

    await waitFor(() => expect(screen.getByText('Billing destino')).toBeInTheDocument());
  });

  it('permite ver /login incluso si el refresh silencioso falla por red', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Offline');
      }),
    );

    renderGuestRoute(['/login']);
    await waitFor(() => expect(screen.getByText('Formulario login')).toBeInTheDocument());
  });
});
