import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAPTCHA_HEADER } from '@/shared/api/client';
import { TURNSTILE_DUMMY_TOKEN } from '@/shared/ui/TurnstileField';
import { jsonResponse, mockApi, problem, renderApp, verifiedSession } from '@/test/renderApp';

vi.mock('@/features/map/components/RouteMap', () => ({
  default: () => <div data-testid="mock-route-map" />,
}));

const noSession = () => problem(401, 'INVALID_REFRESH_TOKEN');
const bodyOf = (init: RequestInit | undefined) => JSON.parse(String(init?.body)) as unknown;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('/login (US-04)', () => {
  it('envía el captcha, abre sesión y vuelve a la ruta original con su query', async () => {
    const fetchMock = mockApi({
      'POST /auth/refresh': noSession,
      'POST /auth/login': () => jsonResponse(200, verifiedSession),
    });
    const { router } = renderApp('/billing?pack=2');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Correo'), 'Ana@Mail.com');
    await user.type(screen.getByLabelText('Contraseña'), 'Viajar2026');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/billing'));
    expect(router.state.location.search).toBe('?pack=2');

    const [, init] = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/auth/login'))!;
    expect(new Headers(init?.headers).get(CAPTCHA_HEADER)).toBe(TURNSTILE_DUMMY_TOKEN);
    expect(bodyOf(init)).toEqual({ email: 'ana@mail.com', password: 'Viajar2026' });
  });

  it('muestra un error genérico ante 401 INVALID_CREDENTIALS', async () => {
    mockApi({
      'POST /auth/refresh': noSession,
      'POST /auth/login': () => problem(401, 'INVALID_CREDENTIALS'),
    });
    renderApp('/login');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Correo'), 'ana@mail.com');
    await user.type(screen.getByLabelText('Contraseña'), 'mala');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
  });

  it('403 EMAIL_NOT_VERIFIED lleva a /verify-email con el correo y sin cooldown', async () => {
    mockApi({
      'POST /auth/refresh': noSession,
      'POST /auth/login': () => problem(403, 'EMAIL_NOT_VERIFIED'),
    });
    const { router } = renderApp('/login');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Correo'), 'ana@mail.com');
    await user.type(screen.getByLabelText('Contraseña'), 'Viajar2026');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/verify-email'));
    expect(await screen.findByRole('button', { name: 'Reenviar código' })).toBeEnabled();
    expect(screen.getByLabelText('Correo')).toHaveValue('ana@mail.com');
  });
});

describe('RequireAuth y correo sin verificar (RN-12)', () => {
  it('lleva una sesión sin verificar a /verify-email y la deja ahí', async () => {
    const unverified = {
      ...verifiedSession,
      user: { ...verifiedSession.user, email_verified: false },
    };
    mockApi({ 'POST /auth/refresh': () => jsonResponse(200, unverified) });
    const { router } = renderApp('/billing');

    expect(await screen.findByRole('heading', { name: 'Verifica tu correo' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/verify-email');
    expect(screen.getByLabelText('Correo')).toHaveValue('ana@mail.com');
  });
});

describe('/register → /verify-email (US-01, US-02, US-03)', () => {
  it('exige términos y valida la contraseña antes de llamar a la API', async () => {
    const fetchMock = mockApi({ 'POST /auth/refresh': noSession });
    renderApp('/register');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Nombre completo'), 'Ana Torres');
    await user.type(screen.getByLabelText('Correo'), 'ana@mail.com');
    await user.type(screen.getByLabelText('Contraseña'), 'sinnumeros');
    await user.click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(
      await screen.findByText('La contraseña debe tener letras y números.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Acepta los Términos y condiciones/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('registra, verifica el OTP y vuelve a `from`; el reenvío espera 60 s', async () => {
    const fetchMock = mockApi({
      'POST /auth/refresh': noSession,
      'POST /auth/register': () =>
        jsonResponse(201, { user_id: 'usr-1', email: 'ana@mail.com', email_verified: false }),
      'POST /auth/verify-email': () => jsonResponse(200, verifiedSession),
    });
    const { router } = renderApp({
      pathname: '/register',
      state: { from: { pathname: '/itineraries', search: '', hash: '', state: null, key: 'k' } },
    });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Nombre completo'), 'Ana Torres');
    await user.type(screen.getByLabelText('Correo'), 'ana@mail.com');
    await user.type(screen.getByLabelText('Contraseña'), 'Viajar2026');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Registrarme' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/verify-email'));
    expect(await screen.findByRole('button', { name: /Reenviar código en \d+ s/ })).toBeDisabled();

    await user.type(screen.getByLabelText('Código de verificación'), '849 201');
    await user.click(screen.getByRole('button', { name: 'Verificar' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/itineraries'));
    const [, init] = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/auth/verify-email'),
    )!;
    expect(bodyOf(init)).toEqual({ email: 'ana@mail.com', code: '849201' });
  });

  it('marca el correo ante 409 y 422 DISPOSABLE_EMAIL', async () => {
    let call = 0;
    mockApi({
      'POST /auth/refresh': noSession,
      'POST /auth/register': () =>
        ++call === 1 ? problem(409, 'EMAIL_ALREADY_REGISTERED') : problem(422, 'DISPOSABLE_EMAIL'),
    });
    renderApp('/register');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Nombre completo'), 'Ana Torres');
    await user.type(screen.getByLabelText('Correo'), 'ana@mail.com');
    await user.type(screen.getByLabelText('Contraseña'), 'Viajar2026');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(await screen.findByText('Ya existe una cuenta con este correo.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Verificar mi correo' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Registrarme' }));
    expect(await screen.findByText(/No aceptamos correos temporales/)).toBeInTheDocument();
    expect(screen.getByLabelText('Correo')).toHaveAttribute('aria-invalid', 'true');
  });

  it('muestra el error del código ante 400 INVALID_OTP y 429 OTP_ATTEMPTS_EXCEEDED', async () => {
    let calls = 0;
    mockApi({
      'POST /auth/refresh': noSession,
      'POST /auth/verify-email': () => {
        calls += 1;
        return calls === 1 ? problem(400, 'INVALID_OTP') : problem(429, 'OTP_ATTEMPTS_EXCEEDED');
      },
    });
    renderApp('/verify-email');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Correo'), 'ana@mail.com');
    await user.type(screen.getByLabelText('Código de verificación'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verificar' }));

    expect(await screen.findByText(/El código no es válido/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(await screen.findByText(/Demasiados intentos con este código/)).toBeInTheDocument();
  });

  it('reenvía el código con confirmación genérica (US-03)', async () => {
    const fetchMock = mockApi({
      'POST /auth/refresh': noSession,
      'POST /auth/verify-email/resend': () => jsonResponse(202),
    });
    renderApp('/verify-email');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Correo'), 'nadie@mail.com');
    await user.click(screen.getByRole('button', { name: 'Reenviar código' }));

    expect(await screen.findByText(/Si el correo tiene una cuenta pendiente/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reenviar código en \d+ s/ })).toBeDisabled();
    const [, init] = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/auth/verify-email/resend'),
    )!;
    expect(bodyOf(init)).toEqual({ email: 'nadie@mail.com' });
  });

  it('respeta 429 RATE_LIMITED al reenviar el código (US-03)', async () => {
    mockApi({
      'POST /auth/refresh': noSession,
      'POST /auth/verify-email/resend': () => problem(429, 'RATE_LIMITED'),
    });
    renderApp('/verify-email');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Correo'), 'ana@mail.com');
    await user.click(screen.getByRole('button', { name: 'Reenviar código' }));

    expect(await screen.findByText(/Demasiados intentos en poco tiempo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reenviar código en \d+ s/ })).toBeDisabled();
  });
});

describe('recuperación de contraseña (US-08)', () => {
  it('/forgot-password envía el captcha y responde igual exista o no el correo', async () => {
    const fetchMock = mockApi({
      'POST /auth/refresh': noSession,
      'POST /auth/forgot-password': () => jsonResponse(202),
    });
    renderApp('/forgot-password');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Correo'), 'ana@mail.com');
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(await screen.findByText(/Si el correo tiene una cuenta/)).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/auth/forgot-password'),
    )!;
    expect(new Headers(init?.headers).get(CAPTCHA_HEADER)).toBe(TURNSTILE_DUMMY_TOKEN);
  });

  it('/reset-password sin token pide un enlace nuevo', async () => {
    mockApi({ 'POST /auth/refresh': noSession });
    renderApp('/reset-password');
    expect(await screen.findByText(/no es válido o ya venció/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedir un enlace nuevo' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('/reset-password cambia la contraseña con un solo campo y quita el token de la URL', async () => {
    const fetchMock = mockApi({
      'POST /auth/refresh': noSession,
      'POST /auth/reset-password': () => new Response(null, { status: 204 }),
    });
    const { router } = renderApp('/reset-password?token=tok-1');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Contraseña nueva'), 'Nueva2026x');
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(await screen.findByText(/Tu contraseña cambió/)).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    const [, init] = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/auth/reset-password'),
    )!;
    expect(bodyOf(init)).toEqual({ token: 'tok-1', new_password: 'Nueva2026x' });
  });

  it('/reset-password con 400 INVALID_RESET_TOKEN ofrece pedir otro enlace', async () => {
    mockApi({
      'POST /auth/refresh': noSession,
      'POST /auth/reset-password': () => problem(400, 'INVALID_RESET_TOKEN'),
    });
    renderApp('/reset-password?token=usado');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Contraseña nueva'), 'Nueva2026x');
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(await screen.findByRole('link', { name: 'Pedir un enlace nuevo' })).toBeInTheDocument();
  });
});

const profile = {
  ...verifiedSession.user,
  has_password: true,
  has_google: false,
  created_at: '2026-03-15T10:00:00Z',
};

describe('/account (US-07, US-09, US-10)', () => {
  it('muestra el perfil y cierra sesión sin guardar /account como destino', async () => {
    mockApi({
      'POST /auth/refresh': () => jsonResponse(200, verifiedSession),
      'GET /users/me': () => jsonResponse(200, profile),
      'POST /auth/logout': () => new Response(null, { status: 204 }),
    });
    const { router } = renderApp('/account');
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeInTheDocument();
    expect(await screen.findByText('15 de marzo de 2026')).toBeInTheDocument();
    expect(screen.getByText('Correo verificado')).toBeInTheDocument();
    const methods = screen.getByText('Formas de acceso').parentElement!;
    expect(within(methods).getByText('Contraseña')).toBeInTheDocument();
    expect(within(methods).queryByText('Google')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.state).toBeNull();
  });

  it('cierra sesión desde el menú de TopBar', async () => {
    mockApi({
      'POST /auth/refresh': () => jsonResponse(200, verifiedSession),
      'POST /auth/logout': () => new Response(null, { status: 204 }),
    });
    const { router } = renderApp('/billing');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Menú de cuenta y preferencias' }));
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('rechaza una confirmación distinta y elimina la cuenta con ELIMINAR', async () => {
    const fetchMock = mockApi({
      'POST /auth/refresh': () => jsonResponse(200, verifiedSession),
      'GET /users/me': () => jsonResponse(200, profile),
      'DELETE /users/me': () => new Response(null, { status: 204 }),
    });
    const { router } = renderApp('/account');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Eliminar mi cuenta' }));
    const input = screen.getByLabelText('Escribe ELIMINAR para confirmar');
    await user.type(input, 'eliminar');
    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));
    expect(await screen.findByText(/Escribe exactamente ELIMINAR/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);

    await user.clear(input);
    await user.type(input, 'ELIMINAR');
    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    const [, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'DELETE')!;
    expect(bodyOf(init)).toEqual({ confirmation: 'ELIMINAR' });
  });

  describe('Acceso y seguridad', () => {
    it('cuenta solo-Google: crea contraseña sin la actual y entonces permite desvincular', async () => {
      let hasPassword = false;
      const fetchMock = mockApi({
        'POST /auth/refresh': () => jsonResponse(200, verifiedSession),
        'GET /users/me': () =>
          jsonResponse(200, { ...profile, has_password: hasPassword, has_google: true }),
        'PUT /users/me/password': () => {
          hasPassword = true;
          return new Response(null, { status: 204 });
        },
      });
      renderApp('/account');
      const user = userEvent.setup();

      // Sin contraseña no se puede desvincular Google.
      expect(await screen.findByRole('button', { name: 'Desvincular Google' })).toBeDisabled();
      expect(screen.getByText(/Crea una contraseña primero/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Crear contraseña' }));
      expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument();
      await user.type(screen.getByLabelText('Contraseña nueva'), 'Viajar2026');
      await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

      expect(await screen.findByRole('button', { name: 'Cambiar contraseña' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Desvincular Google' })).toBeEnabled();
      const [, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'PUT')!;
      expect(bodyOf(init)).toEqual({ new_password: 'Viajar2026' });
    });

    it('cambia la contraseña con la actual y marca una actual incorrecta en su campo', async () => {
      let attempts = 0;
      const fetchMock = mockApi({
        'POST /auth/refresh': () => jsonResponse(200, verifiedSession),
        'GET /users/me': () => jsonResponse(200, profile),
        'PUT /users/me/password': () => {
          attempts += 1;
          return attempts === 1
            ? problem(400, 'INVALID_CURRENT_PASSWORD')
            : new Response(null, { status: 204 });
        },
      });
      renderApp('/account');
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }));
      // Sin la actual ni se envía.
      await user.type(screen.getByLabelText('Contraseña nueva'), 'Nueva2026x');
      await user.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
      expect(await screen.findByText('Escribe tu contraseña actual.')).toBeInTheDocument();
      expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(false);

      await user.type(screen.getByLabelText('Contraseña actual'), 'Incorrecta1');
      await user.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
      expect(await screen.findByText('La contraseña actual no es correcta.')).toBeInTheDocument();

      await user.clear(screen.getByLabelText('Contraseña actual'));
      await user.type(screen.getByLabelText('Contraseña actual'), 'Viajar2026');
      await user.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Actualizar contraseña' })).toBeNull(),
      );
      const puts = fetchMock.mock.calls.filter(([, i]) => i?.method === 'PUT');
      expect(bodyOf(puts[1]![1])).toEqual({
        new_password: 'Nueva2026x',
        current_password: 'Viajar2026',
      });
    });

    it('desvincula Google tras confirmar y deja de ofrecerlo', async () => {
      let linked = true;
      const fetchMock = mockApi({
        'POST /auth/refresh': () => jsonResponse(200, verifiedSession),
        'GET /users/me': () => jsonResponse(200, { ...profile, has_google: linked }),
        'DELETE /users/me/google': () => {
          linked = false;
          return new Response(null, { status: 204 });
        },
      });
      renderApp('/account');
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Desvincular Google' }));
      const dialog = await screen.findByRole('dialog', { name: '¿Desvincular Google?' });
      await user.click(within(dialog).getByRole('button', { name: 'Desvincular' }));

      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Desvincular Google' })).toBeNull(),
      );
      expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(true);
    });
  });
});
