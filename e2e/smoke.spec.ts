import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  test(`la portada carga sin errores de accesibilidad (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('navby-theme', t), theme);
    await page.goto('./');

    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);

    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(violations).toEqual([]);
  });
}
