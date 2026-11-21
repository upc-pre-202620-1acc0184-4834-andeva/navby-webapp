import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindSessionSync } from '@/shared/auth/useSession';
import { THEME_STORAGE_KEY } from '@/shared/ui/theme';
import { wallet } from '@/test/fixtures/podium';
// Precalienta HomePage y LoginPage lazy antes de los tests de AppLayout.
import './HomePage';
import '@/features/auth/pages/LoginPage';
import { routes } from './router';

vi.mock('@/features/map/components/RouteMap', () => ({
  default: () => <div data-testid="mock-route-map" />,
}));

const sessionPayload = {
  access_token: 'jwt-app',
  token_type: 'Bearer',
  expires_in: 900,
  user: {
    user_id: 'usr-1',
    email: 'ana@mail.com',
    full_name: 'Ana Torres',
    email_verified: true,
  },
};

function renderAppAt(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  bindSessionSync(queryClient);

  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  return {
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}

describe('AppLayout & shell', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('usuario sin sesión es redirigido de / a /login sin TopBar ni Footer global, con controles de tema/idioma y enlaces legales', async () => {
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

    renderAppAt('/');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeInTheDocument(),
    );

    expect(
      screen.queryByRole('button', { name: 'Menú de cuenta y preferencias' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.queryByText('— créditos')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Términos y condiciones' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Política de privacidad' })).toBeInTheDocument();
    expect(screen.getByText(/© 2026 Andeva/)).toBeInTheDocument();
  });

  it('usuario autenticado ve HomePage, saldo, menú de cuenta con enlaces legales y puede cambiar tema e idioma', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (input: RequestInfo | URL) =>
          new Response(
            JSON.stringify(String(input).includes('/billing/wallet') ? wallet : sessionPayload),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );

    renderAppAt('/?lang=es');

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'Buscador de vuelos' }),
      ).toBeInTheDocument(),
    );

    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();

    // US-26: total, búsquedas disponibles y hora de recarga (00:00 Lima).
    const creditsLink = await screen.findByRole('link', {
      name: 'Saldo: 50 créditos (10 búsquedas). Los gratuitos se renuevan a las 00:00, hora de Lima.',
    });
    expect(creditsLink).toHaveAttribute('href', '/billing');
    expect(creditsLink).toHaveTextContent('50 créditos');

    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Menú de cuenta y preferencias' });
    await user.click(trigger);

    expect(screen.getByText('ana@mail.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Itinerarios' })).toHaveAttribute(
      'href',
      '/itineraries',
    );
    expect(screen.getByRole('link', { name: /^Créditos/ })).toHaveAttribute('href', '/billing');
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('href', '/account');
    expect(screen.queryByRole('link', { name: 'Términos y condiciones' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Política de privacidad' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'English' }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('lang', 'en'));
    expect(screen.getByRole('heading', { level: 1, name: 'Flight search' })).toBeInTheDocument();
  });

  it('conserva la ruta original de búsqueda al cambiar entre /login y /register', async () => {
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

    const { router } = renderAppAt('/?trip=ONE_WAY&from=LIM&to=HND');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeInTheDocument(),
    );

    const user = userEvent.setup();
    const [registerLink] = screen.getAllByRole('link', { name: 'Crear una cuenta' });
    expect(registerLink).toBeDefined();
    if (registerLink) {
      await user.click(registerLink);
    }

    await waitFor(() => expect(router.state.location.pathname).toBe('/register'));
    const redirectState = router.state.location.state as {
      from?: { pathname?: string; search?: string };
    } | null;
    expect(redirectState?.from?.pathname).toBe('/');
    expect(redirectState?.from?.search).toBe('?trip=ONE_WAY&from=LIM&to=HND');
  });
});
