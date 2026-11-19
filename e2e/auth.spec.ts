import AxeBuilder from '@axe-core/playwright';
import { type Page } from '@playwright/test';
import { expect, GOOGLE_E2E_ID_TOKEN, test } from './fixtures';

test.use({ locale: 'es-PE' });

const user = {
  user_id: 'usr-e2e',
  email: 'ana@mail.com',
  full_name: 'Ana Torres',
  email_verified: true,
};
const session = { access_token: 'e2e-jwt', token_type: 'Bearer', expires_in: 900, user };
const profile = {
  ...user,
  has_password: true,
  has_google: true,
  created_at: '2026-03-15T10:00:00Z',
};

function json(status: number, body?: unknown) {
  return {
    status,
    contentType: status >= 400 ? 'application/problem+json' : 'application/json',
    body: body === undefined ? '' : JSON.stringify(body),
  };
}
const problem = (status: number, code: string) =>
  json(status, { title: code, status, detail: code, code });

async function mockRefresh(page: Page, signedIn: boolean) {
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill(signedIn ? json(200, session) : problem(401, 'INVALID_REFRESH_TOKEN')),
  );
}

async function expectAccessible(page: Page) {
  const overflow = await page.locator('html').evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(overflow).toBe(false);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
}

async function settleAnimations(page: Page) {
  await page.locator('html').evaluate((el) =>
    Promise.all(
      (
        el as unknown as {
          getAnimations(opts: { subtree: boolean }): { finished: Promise<unknown> }[];
        }
      )
        .getAnimations({ subtree: true })
        .map((a) => a.finished),
    ),
  );
}

async function expectAccessibleLightAndDark(page: Page) {
  await page.locator('html').evaluate((el) => el.classList.remove('dark'));
  await settleAnimations(page);
  await expectAccessible(page);
  await page.locator('html').evaluate((el) => el.classList.add('dark'));
  await settleAnimations(page);
  await expectAccessible(page);
  await page.locator('html').evaluate((el) => el.classList.remove('dark'));
  await settleAnimations(page);
}

test.describe('Acceso y cuenta (Plan 3)', () => {
  test('registro → código → vuelve a la ruta pedida (US-01, US-02, RL-01)', async ({ page }) => {
    await mockRefresh(page, false);
    await page.route('**/api/v1/auth/register', (route) =>
      route.fulfill(
        json(201, { user_id: 'usr-e2e', email: 'ana@mail.com', email_verified: false }),
      ),
    );
    await page.route('**/api/v1/auth/verify-email', (route) => route.fulfill(json(200, session)));

    await page.goto('/app/itineraries');
    await expect(page).toHaveURL(/\/app\/login$/);
    await expect(page.getByTestId('google-signin').getByRole('button')).toBeVisible();
    await expect(page.getByText(/Al continuar con Google aceptas/)).toBeVisible();
    await expectAccessibleLightAndDark(page);

    await page.getByRole('link', { name: 'Crear una cuenta' }).click();
    await page.getByLabel('Nombre completo').fill('Ana Torres');
    await page.getByLabel('Correo').fill('ana@mail.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('Viajar2026');
    await page.getByRole('checkbox').check();
    await expectAccessibleLightAndDark(page);
    await page.getByRole('button', { name: 'Registrarme' }).click();

    await expect(page).toHaveURL(/\/app\/verify-email$/);
    await expect(page.getByRole('button', { name: /Reenviar código en \d+ s/ })).toBeDisabled();
    await page.getByLabel('Código de verificación').fill('849201');
    await expectAccessibleLightAndDark(page);
    await page.getByRole('button', { name: 'Verificar' }).click();

    await expect(page).toHaveURL(/\/app\/itineraries$/);
  });

  test('Google acepta RL-01 con el aviso y vuelve a la ruta pedida (US-05)', async ({ page }) => {
    await mockRefresh(page, false);
    let googleBody: unknown;
    await page.route('**/api/v1/auth/google', (route) => {
      googleBody = route.request().postDataJSON();
      return route.fulfill(json(200, session));
    });

    await page.goto('/app/billing');
    await page.getByTestId('google-signin').getByRole('button').click();

    await expect(page).toHaveURL(/\/app\/billing$/);
    expect(googleBody).toEqual({ id_token: GOOGLE_E2E_ID_TOKEN, accept_terms: true });
  });

  test('recuperar y restablecer la contraseña en tema oscuro (US-08)', async ({ page }) => {
    await mockRefresh(page, false);
    await page.addInitScript(() => localStorage.setItem('navby-theme', 'dark'));
    await page.route('**/api/v1/auth/forgot-password', (route) => route.fulfill(json(202)));
    await page.route('**/api/v1/auth/reset-password', (route) =>
      route.fulfill({ status: 204, body: '' }),
    );

    await page.goto('/app/forgot-password');
    await page.getByLabel('Correo').fill('ana@mail.com');
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByText(/Si el correo tiene una cuenta/)).toBeVisible();
    await expectAccessible(page);

    await page.goto('/app/reset-password?token=tok-e2e');
    await page.getByLabel('Contraseña nueva').fill('Nueva2026x');
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await expect(page.getByText(/Tu contraseña cambió/)).toBeVisible();
    await expect(page).toHaveURL(/\/app\/reset-password$/);
  });

  test('/account muestra el perfil y elimina la cuenta con ELIMINAR (US-09, US-10)', async ({
    page,
  }) => {
    await mockRefresh(page, true);
    await page.route('**/api/v1/users/me', (route) =>
      route.request().method() === 'DELETE'
        ? route.fulfill({ status: 204, body: '' })
        : route.fulfill(json(200, profile)),
    );

    await page.goto('/app/account');
    await expect(page.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeVisible();
    await expect(page.getByText('15 de marzo de 2026')).toBeVisible();
    await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click();
    await expectAccessibleLightAndDark(page);

    const input = page.getByLabel('Escribe ELIMINAR para confirmar');
    await input.fill('borrar');
    await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
    await expect(page.getByText(/Escribe exactamente ELIMINAR/)).toBeVisible();

    await input.fill('ELIMINAR');
    await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
    await expect(page).toHaveURL(/\/app\/login$/);
  });

  test('en inglés la confirmación es DELETE y el menú permite cerrar sesión (US-07)', async ({
    page,
  }) => {
    await mockRefresh(page, true);
    await page.route('**/api/v1/users/me', (route) => route.fulfill(json(200, profile)));
    await page.route('**/api/v1/auth/logout', (route) => route.fulfill({ status: 204, body: '' }));

    await page.goto('/app/account?lang=en');
    await page.getByRole('button', { name: 'Delete my account' }).click();
    await expect(page.getByLabel('Type DELETE to confirm')).toBeVisible();

    await page.getByRole('button', { name: 'Account and preferences menu' }).click();
    await page
      .getByRole('navigation', { name: 'Account and preferences menu' })
      .getByRole('button', { name: 'Sign out' })
      .click();
    await expect(page).toHaveURL(/\/app\/login$/);
  });

  test('en inglés se elimina la cuenta escribiendo DELETE (US-10)', async ({ page }) => {
    await mockRefresh(page, true);
    let deleteBody: unknown;
    await page.route('**/api/v1/users/me', (route) => {
      if (route.request().method() !== 'DELETE') return route.fulfill(json(200, profile));
      deleteBody = route.request().postDataJSON();
      return route.fulfill({ status: 204, body: '' });
    });

    await page.goto('/app/account?lang=en');
    await page.getByRole('button', { name: 'Delete my account' }).click();
    await page.getByLabel('Type DELETE to confirm').fill('DELETE');
    await page.getByRole('button', { name: 'Delete permanently' }).click();

    await expect(page).toHaveURL(/\/app\/login$/);
    expect(deleteBody).toEqual({ confirmation: 'DELETE' });
  });
});
