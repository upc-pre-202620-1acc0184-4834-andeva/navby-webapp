/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// La webapp vive en navby.andeva.tech/app: base /app/ y salida en dist/app para que
// Vercel sirva /app/assets/* sin reescrituras extra (ver AGENTS.md §1).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    base: '/app/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: { outDir: 'dist/app', emptyOutDir: true },
    server: {
      port: 5173,
      strictPort: true,
      // Mismo origen que en producción: la cookie navby_refresh es de primera parte y no hay CORS.
      proxy: { '/api': env.VITE_API_PROXY_TARGET || 'http://localhost:8000' },
    },
    preview: { port: 5173, strictPort: true },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
  };
});
