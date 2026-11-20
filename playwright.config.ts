import { defineConfig, devices } from '@playwright/test';

// Servidor propio en 5174 (no reutiliza tu `pnpm dev` de 5173) con un Client ID falso de
// Google para que el botón se muestre; e2e/fixtures.ts sustituye el script de Google por un stub.
const E2E_PORT = 5174;
const E2E_URL = `http://localhost:${E2E_PORT}/app/`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: E2E_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `pnpm dev --port ${E2E_PORT}`,
    url: E2E_URL,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_GOOGLE_CLIENT_ID: 'e2e-google-client.apps.googleusercontent.com',
      VITE_TURNSTILE_SITE_KEY: '',
    },
  },
});
