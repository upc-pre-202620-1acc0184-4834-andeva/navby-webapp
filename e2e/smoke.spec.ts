import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

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

for (const theme of ['light', 'dark'] as const) {
  test(`la portada autenticada carga sin errores de accesibilidad (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('navby-theme', t), theme);
    await page.route('**/api/v1/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSession),
      }),
    );

    await page.goto('./');

    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);

    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(violations).toEqual([]);
  });
}
