import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';
import i18n from '@/app/i18n';
import { resetApiClientForTests } from '@/shared/api/client';

// Las rutas lazy con Suspense bajo workers paralelos de Vitest pueden superar los 1000 ms por defecto.
configure({ asyncUtilTimeout: 8000 });

// jsdom declara `en-US`; las pruebas simulan un navegador peruano (precios en soles).
Object.defineProperty(window.navigator, 'languages', { value: ['es-PE'], configurable: true });

beforeAll(async () => {
  await i18n.changeLanguage('es');
  // jsdom no trae ResizeObserver; boneyard-js lo usa para medir el skeleton.
  if (typeof window.ResizeObserver !== 'function') {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // jsdom no implementa <dialog>.showModal()/close(): se simula solo el atributo `open` y el evento.
  if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close() {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
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
  sessionStorage.clear();
  document.documentElement.classList.remove('dark');
  document.documentElement.setAttribute('lang', 'es');
  await i18n.changeLanguage('es');
});
