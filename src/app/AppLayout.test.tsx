import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindSessionSync } from '@/shared/auth/useSession';
import { THEME_STORAGE_KEY } from '@/shared/ui/theme';
import { routes } from './router';

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
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('AppLayout & shell', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('visitante sin sesión es redirigido de / a /login, ve preferencias y pie legal sin saldo', async () => {
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

    expect(screen.queryByText('— créditos')).not.toBeInTheDocument();
    expect(screen.getByText(/© 2026 Andeva/)).toBeInTheDocument();
    expect(screen.getByText('Términos y condiciones')).toBeInTheDocument();
    expect(screen.getByText('Política de privacidad')).toBeInTheDocument();

    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Menú de cuenta y preferencias' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/register');

    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('usuario autenticado ve HomePage, saldo placeholder, menú de cuenta y puede cambiar tema e idioma', async () => {
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

    renderAppAt('/?lang=es');

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'Buscador de vuelos' }),
      ).toBeInTheDocument(),
    );

    const creditsLink = screen.getByRole('link', { name: /Saldo de créditos/ });
    expect(creditsLink).toHaveAttribute('href', '/billing');
    expect(creditsLink).toHaveTextContent('— créditos');

    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Menú de cuenta y preferencias' });
    await user.click(trigger);

    expect(screen.getByText('ana@mail.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Itinerarios' })).toHaveAttribute(
      'href',
      '/itineraries',
    );
    expect(screen.getByRole('link', { name: 'Créditos' })).toHaveAttribute('href', '/billing');
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('href', '/account');

    await user.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'English' }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('lang', 'en'));
    expect(screen.getByRole('heading', { level: 1, name: 'Flight search' })).toBeInTheDocument();
  });
});
