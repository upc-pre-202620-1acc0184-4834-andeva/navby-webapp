import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test.use({ locale: 'es-PE' });

const mockSession = {
  access_token: 'e2e-access-jwt',
  token_type: 'Bearer',
  expires_in: 900,
  user: {
    user_id: 'usr-e2e',
    email: 'ana@mail.com',
    full_name: 'Ana Torres',
    email_verified: true,
  },
};

test.describe('Armazón de navegación, sesión y paridad /app', () => {
  test('soporta /app sin barra final, /app/ y rutas profundas como /app/billing', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSession),
      }),
    );

    const appNoSlash = await page.goto('/app');
    expect(appNoSlash?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Buscador de vuelos' })).toBeVisible();

    await page.goto('/app/billing');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Créditos y paquetes' }),
    ).toBeVisible();
  });

  test('usuario sin sesión es redirigido a /app/login preservando layout y pasa axe en claro y oscuro', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/refresh', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          title: 'Refresh token inválido',
          status: 401,
          detail: 'Sesión expirada',
          code: 'INVALID_REFRESH_TOKEN',
        }),
      }),
    );

    await page.goto('/app/');
    await expect(page).toHaveURL(/\/app\/login$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByText('— créditos')).toBeHidden();

    const hasHorizontalOverflow = await page
      .locator('html')
      .evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);

    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(violations).toEqual([]);
  });

  test('menú de cuenta, cambio de tema/idioma persistente, cero desbordamiento y axe abierto', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSession),
      }),
    );

    await page.goto('/app/');
    await expect(page.getByRole('link', { name: /Saldo de créditos/ })).toBeVisible();

    const trigger = page.getByRole('button', { name: 'Menú de cuenta y preferencias' });
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Auditoría axe con el menú de cuenta abierto.
    const openAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(openAxe.violations).toEqual([]);

    // Cambiar a tema oscuro y a inglés.
    await page.getByRole('button', { name: 'Oscuro' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1, name: 'Flight search' })).toBeVisible();

    // Cerrar con Escape y verificar retorno de foco (ahora con etiqueta traducida al inglés).
    const englishTrigger = page.getByRole('button', { name: 'Account and preferences menu' });
    await page.keyboard.press('Escape');
    await expect(englishTrigger).toHaveAttribute('aria-expanded', 'false');
    await expect(englishTrigger).toBeFocused();

    // Verificar ausencia de scroll horizontal en el viewport actual (1440 o 390).
    const overflow = await page.locator('html').evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(overflow).toBe(false);

    // Recargar y comprobar persistencia de tema oscuro e inglés (US-06 + preferencias).
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1, name: 'Flight search' })).toBeVisible();

    const darkEnAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(darkEnAxe.violations).toEqual([]);
  });
});
