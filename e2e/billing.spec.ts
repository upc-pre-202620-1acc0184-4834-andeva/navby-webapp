import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoAxeViolations, json, SESSION } from './podiumMocks';

test.use({ locale: 'es-PE' });

const ORDER_ID = '550e8400-e29b-41d4-a716-446655440000';
const SANDBOX_CHECKOUT_URL =
  'https://sandbox.mercadopago.com.pe/checkout/v1/redirect?pref_id=e2e-pref-1';

async function expectAxeLightAndDark(page: Page) {
  await page.locator('html').evaluate((el) => el.classList.remove('dark'));
  await page.waitForTimeout(220);
  await expectNoAxeViolations(page);
  await page.locator('html').evaluate((el) => el.classList.add('dark'));
  await page.waitForTimeout(220);
  await expectNoAxeViolations(page);
  await page.locator('html').evaluate((el) => el.classList.remove('dark'));
  await page.waitForTimeout(220);
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.locator('html').evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(hasOverflow).toBe(false);
}

function makeTransactions(count: number, startOffset: number) {
  return Array.from({ length: count }, (_, idx) => {
    const n = startOffset + idx;
    const isPurchase = n === 0;
    return {
      id: `tx-e2e-${n}`,
      type: isPurchase ? 'PURCHASE' : 'SEARCH_DEBIT',
      free_delta: isPurchase ? 0 : -5,
      paid_delta: isPurchase ? 100 : 0,
      reference_id: isPurchase ? ORDER_ID : `srch_e2e_${n}`,
      created_at: new Date(Date.UTC(2026, 10, 19, 12) - n * 3_600_000).toISOString(),
    };
  });
}

test.describe('Créditos y pagos (Plan 7)', () => {
  test('saldo, paquetes, paginación del historial y redirección sandbox en /app/billing', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/refresh', (route) => json(route, 200, SESSION));
    await page.route('**/api/v1/billing/wallet', (route) =>
      json(route, 200, {
        free_credits: 5,
        paid_credits: 45,
        total_credits: 50,
        searches_available: 10,
        free_credits_reset_at: '2026-11-20T05:00:00Z',
      }),
    );
    await page.route('**/api/v1/billing/transactions*', (route) => {
      const url = new URL(route.request().url());
      const requestedPage = Number(url.searchParams.get('page') ?? '1');
      if (requestedPage === 2) {
        return json(route, 200, {
          items: makeTransactions(5, 20),
          page: 2,
          page_size: 20,
          total: 25,
        });
      }
      return json(route, 200, {
        items: makeTransactions(20, 0),
        page: 1,
        page_size: 20,
        total: 25,
      });
    });

    await page.route(`**/api/v1/billing/orders/${ORDER_ID}`, (route) =>
      json(route, 200, {
        order_id: ORDER_ID,
        package_code: 'pack_100',
        credits: 100,
        amount: '16.90',
        currency: 'PEN',
        status: 'APPROVED',
        expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      }),
    );

    await page.route('**/api/v1/billing/orders', (route) =>
      json(route, 201, {
        order_id: ORDER_ID,
        package_code: 'pack_100',
        credits: 100,
        amount: '16.90',
        currency: 'PEN',
        status: 'PENDING',
        expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
        checkout_url: SANDBOX_CHECKOUT_URL,
      }),
    );

    // Nunca se llama a Mercado Pago real (RL-04): interceptamos el destino sandbox.
    await page.route('https://sandbox.mercadopago.com.pe/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body><h1>Mercado Pago Sandbox Stub</h1></body></html>',
      }),
    );

    await page.goto('/app/billing');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Créditos y paquetes' }),
    ).toBeVisible();
    const walletSection = page.getByRole('region', { name: 'Tu saldo' });
    await expect(walletSection.getByText('50 créditos', { exact: true })).toBeVisible();
    await expect(walletSection.getByText('5 / 10')).toBeVisible();
    await expect(walletSection.getByText(/00:00 \(hora de Lima\)/)).toBeVisible();

    await expect(page.getByRole('heading', { level: 3, name: 'Viajero Frecuente' })).toBeVisible();
    await expect(page.getByText('Recomendado')).toBeVisible();
    await expect(page.getByText(/Mercado Pago opera en modo sandbox/)).toBeHidden();

    // Detalle de movimiento / comprobante de compra desde el historial.
    await page.getByRole('button', { name: /Ver detalle de Compra de paquete/ }).click();
    const receiptDialog = page.getByRole('dialog');
    await expect(
      receiptDialog.getByRole('heading', { level: 2, name: 'Comprobante de compra' }),
    ).toBeVisible();
    await expect(receiptDialog.getByText('Aprobado')).toBeVisible();
    await expect(receiptDialog.getByText('Viajero Frecuente')).toBeVisible();
    await receiptDialog.getByRole('button', { name: 'Cerrar' }).last().click();
    await expect(receiptDialog).toBeHidden();

    // Paginación de historial: página 1 -> página 2 -> página 1.
    await expect(page.getByText('Página 1 de 2')).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText('Página 2 de 2')).toBeVisible();
    await page.getByRole('button', { name: 'Anterior' }).click();
    await expect(page.getByText('Página 1 de 2')).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectAxeLightAndDark(page);

    // Iniciar compra de pack_100 hacia el stub de Mercado Pago sandbox.
    await page.getByRole('button', { name: /Comprar Viajero Frecuente/ }).click();
    await expect(page).toHaveURL(/sandbox\.mercadopago\.com\.pe/);
    await expect(page.getByRole('heading', { name: 'Mercado Pago Sandbox Stub' })).toBeVisible();
  });

  test('retorno /app/billing/result sondea PENDING -> APPROVED y actualiza el saldo en TopBar', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/refresh', (route) => json(route, 200, SESSION));

    let orderStatus: 'PENDING' | 'APPROVED' = 'PENDING';

    await page.route('**/api/v1/billing/wallet', (route) =>
      json(route, 200, {
        free_credits: 10,
        paid_credits: orderStatus === 'APPROVED' ? 100 : 0,
        total_credits: orderStatus === 'APPROVED' ? 110 : 10,
        searches_available: orderStatus === 'APPROVED' ? 22 : 2,
        free_credits_reset_at: '2026-11-20T05:00:00Z',
      }),
    );

    await page.route(`**/api/v1/billing/orders/${ORDER_ID}`, (route) =>
      json(route, 200, {
        order_id: ORDER_ID,
        package_code: 'pack_100',
        credits: 100,
        amount: '16.90',
        currency: 'PEN',
        status: orderStatus,
        expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      }),
    );

    await page.goto(`/app/billing/result?external_reference=${ORDER_ID}&status=pending`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Estado de tu compra' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Confirmando tu pago…' }),
    ).toBeVisible();

    orderStatus = 'APPROVED';
    await expect(page.getByRole('heading', { level: 2, name: '¡Pago aprobado!' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole('link', { name: /Saldo: 110 créditos/, includeHidden: true }),
    ).toBeAttached();

    await expectNoHorizontalOverflow(page);
    await expectAxeLightAndDark(page);
  });

  test('maneja orden REJECTED y orden 404 en /app/billing/result sin errores de accesibilidad', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/refresh', (route) => json(route, 200, SESSION));
    await page.route(`**/api/v1/billing/orders/${ORDER_ID}`, (route) =>
      json(route, 200, {
        order_id: ORDER_ID,
        package_code: 'pack_100',
        credits: 100,
        amount: '16.90',
        currency: 'PEN',
        status: 'REJECTED',
        expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      }),
    );

    await page.goto(`/app/billing/result?external_reference=${ORDER_ID}&status=rejected`);
    await expect(page.getByRole('heading', { level: 2, name: 'Pago rechazado' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Intentar de nuevo' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAxeLightAndDark(page);

    const missingOrder = '11111111-1111-4111-8111-111111111111';
    await page.route(`**/api/v1/billing/orders/${missingOrder}`, (route) =>
      json(route, 404, {
        title: 'No encontrada',
        status: 404,
        detail: 'No encontrada',
        code: 'ORDER_NOT_FOUND',
      }),
    );

    await page.goto(`/app/billing/result?external_reference=${missingOrder}`);
    await expect(
      page.getByRole('heading', { level: 2, name: 'No encontramos esa orden de compra' }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAxeLightAndDark(page);
  });
});
