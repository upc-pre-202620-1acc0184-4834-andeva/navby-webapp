import { E2E_WALLET, expect, test } from './fixtures';
import { expectNoAxeViolations, json, mockApi, PODIUM, SEARCH_URL } from './podiumMocks';

test.use({ locale: 'es-PE' });

test.describe('Podio (Plan 4)', () => {
  test('buscar → podio → resaltar → Comprar en pestaña nueva, con axe en claro y oscuro', async ({
    page,
    context,
  }) => {
    let wallet = E2E_WALLET;
    await page.route('**/api/v1/billing/wallet', (route) => json(route, 200, wallet));
    await mockApi(page, (route) => {
      wallet = { ...E2E_WALLET, free_credits: 5, total_credits: 5, searches_available: 1 };
      return json(route, 200, PODIUM);
    });

    await page.goto(SEARCH_URL);
    await expect(page.getByRole('link', { name: /Saldo: 10 créditos/ })).toBeVisible();
    await page.getByRole('button', { name: 'Buscar' }).click();

    const list = page.getByRole('list', { name: 'Recomendaciones ordenadas de mejor a peor' });
    await expect(list.locator(':scope > li')).toHaveCount(3);
    await expect(page.getByText('3 recomendaciones listas')).toBeAttached();
    await expect(page).toHaveURL(/sid=srch_01JE2EPODIUM/);
    await expect(page.getByRole('link', { name: /Saldo: 5 créditos/ })).toBeVisible();

    const first = list.locator(':scope > li').first();
    await expect(first.getByText('USD 812.40')).toBeVisible();
    await expect(first.getByText('80 % afinidad')).toBeVisible();

    // Resaltado tarjeta → ruta (borde primary en la tarjeta activa).
    await first.hover();
    await expect(first.locator('[role="group"]')).toHaveClass(/border-primary/);

    const hasOverflow = await page
      .locator('html')
      .evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(hasOverflow).toBe(false);

    await expectNoAxeViolations(page);
    await page.locator('html').evaluate((el) => el.classList.add('dark'));
    await expectNoAxeViolations(page);

    // El vendedor no existe en pruebas: se sirve una página mínima en su dominio.
    await context.route('https://book.navby.example/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Vendedor</title>' }),
    );
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      first.getByRole('link', { name: /Comprar/ }).click(),
    ]);
    expect(popup.url()).toContain('https://book.navby.example/offer-1');
  });

  test('preferencias: Rapidez y Personalizado reordenan sin costo, con axe en claro y oscuro', async ({
    page,
  }) => {
    const rankBodies: unknown[] = [];
    let walletCalls = 0;
    await page.route('**/api/v1/billing/wallet', (route) => {
      walletCalls += 1;
      return json(route, 200, E2E_WALLET);
    });
    await mockApi(page, (route) => json(route, 200, PODIUM));
    await page.route('**/api/v1/quotes/*/rank', (route) => {
      const body = route.request().postDataJSON() as { profile: string; weights?: unknown };
      rankBodies.push(body);
      const reversed = [...PODIUM.podium].reverse().map((o, i) => ({ ...o, rank: i + 1 }));
      return json(route, 200, {
        ...PODIUM,
        credits_charged: 0,
        podium: reversed,
        preferences: {
          profile: body.profile,
          weights: body.weights ?? { price: 0.2, duration: 0.6, stops: 0.2 },
        },
      });
    });

    await page.goto(SEARCH_URL);
    await page.getByRole('button', { name: 'Buscar' }).click();
    const first = page
      .getByRole('list', { name: 'Recomendaciones ordenadas de mejor a peor' })
      .locator(':scope > li')
      .first();
    await expect(first.getByText('USD 812.40')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Equilibrado' })).toBeChecked();
    await expect.poll(() => walletCalls).toBe(2);
    const walletCallsAfterSearch = walletCalls;

    await page.getByText('Rapidez', { exact: true }).click();
    await expect(first.getByText('USD 905.10')).toBeVisible();
    await expect(page).toHaveURL(/profile=FAST/);
    expect(rankBodies).toEqual([{ profile: 'FAST' }]);

    await page.getByText('Personalizado', { exact: true }).click();
    const price = page.getByRole('slider', { name: 'Precio' });
    await expect(price).toHaveValue('20');
    await price.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('30 %', { exact: true })).toBeVisible();
    // Rapidez 20/60/20 → precio 30: los otros dos se reparten la diferencia (50/20).
    await expect(page).toHaveURL(/profile=CUSTOM.*w=30%2C50%2C20/);
    expect(walletCalls).toBe(walletCallsAfterSearch);
    await expect(page.getByRole('link', { name: /Saldo: 10 créditos/ })).toBeVisible();

    const hasOverflow = await page
      .locator('html')
      .evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(hasOverflow).toBe(false);
    await expectNoAxeViolations(page);
    await page.locator('html').evaluate((el) => el.classList.add('dark'));
    await expectNoAxeViolations(page);
  });

  test('sin créditos (402): toast con la recarga y acceso a créditos', async ({ page }) => {
    await mockApi(page, (route) =>
      json(route, 402, {
        title: 'Créditos insuficientes',
        status: 402,
        detail: 'Saldo insuficiente',
        code: 'INSUFFICIENT_CREDITS',
      }),
    );

    await page.goto(SEARCH_URL);
    await expect(page.getByRole('link', { name: /Saldo: 10 créditos/ })).toBeVisible();
    await page.getByRole('button', { name: 'Buscar' }).click();

    await expect(page.getByText('No tienes créditos suficientes')).toBeVisible();
    // sileo despliega la descripción y la acción al pasar el cursor por el toast.
    await page.locator('[data-sileo-toast]').hover();
    await expect(page.getByText(/recarga gratuita a las 00:00/)).toBeVisible();
    await page.locator('[data-sileo-button]').click();
    await expect(page).toHaveURL(/\/app\/billing$/);
  });
});
