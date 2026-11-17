import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';
import i18n from '@/app/i18n';
import { resetApiClientForTests } from '@/shared/api/client';

beforeAll(async () => {
  await i18n.changeLanguage('es');
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }
});

afterEach(async () => {
  cleanup();
  resetApiClientForTests();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  document.documentElement.setAttribute('lang', 'es');
  await i18n.changeLanguage('es');
});
