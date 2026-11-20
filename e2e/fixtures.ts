import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';

/** Credencial que entrega el stub de Google Identity Services al pulsar su botón. */
export const GOOGLE_E2E_ID_TOKEN = 'e2e-google-id-token';

// Stub de https://accounts.google.com/gsi/client: nunca se llama a Google desde las pruebas.
const GIS_STUB = `
window.google = { accounts: { id: {
  initialize: function (config) { window.__gisCallback = config.callback; },
  renderButton: function (el) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Continuar con Google (stub)';
    b.style.cssText = 'min-height:44px;padding:0 16px;background:#fff;color:#1f1f1f;border:1px solid #747775;border-radius:4px';
    b.onclick = function () { window.__gisCallback({ credential: '${GOOGLE_E2E_ID_TOKEN}' }); };
    el.replaceChildren(b);
  },
} } };`;

export const E2E_WALLET = {
  free_credits: 10,
  paid_credits: 0,
  total_credits: 10,
  searches_available: 2,
  free_credits_reset_at: '2026-11-18T05:00:00Z',
};

export const E2E_PACKAGES = {
  currency: 'PEN',
  packages: [
    {
      code: 'pack_50',
      name: 'Escapada',
      credits: 50,
      searches: 10,
      price: '9.90',
      usd_reference: '2.49',
    },
    {
      code: 'pack_100',
      name: 'Viajero Frecuente',
      credits: 100,
      searches: 20,
      price: '16.90',
      usd_reference: '4.49',
    },
    {
      code: 'pack_250',
      name: 'Nómada',
      credits: 250,
      searches: 50,
      price: '34.90',
      usd_reference: '8.99',
    },
  ],
};

export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route('https://accounts.google.com/gsi/client**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/javascript', body: GIS_STUB }),
    );
    // Saldo de la barra superior (US-26); cada spec puede sobrescribirlo con su propio route.
    await page.route('**/api/v1/billing/wallet', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(E2E_WALLET),
      }),
    );
    await page.route('**/api/v1/billing/packages', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(E2E_PACKAGES),
      }),
    );
    await page.route('**/api/v1/billing/transactions*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], page: 1, page_size: 20, total: 0 }),
      }),
    );
    // Lista de itinerarios vacía por defecto (US-22 a US-24); cada spec la sobrescribe.
    await page.route('**/api/v1/itineraries?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], page: 1, page_size: 50, total: 0 }),
      }),
    );
    await provide(page);
  },
});
