/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// Replica en local el rewrite `/app -> /app/index.html` de vercel.json para evitar 404 sin barra final.
function vercelAppRewritePlugin(): Plugin {
  const rewriteAppEntry = (req: { url?: string }) => {
    if (req.url === '/app' || req.url?.startsWith('/app?')) {
      req.url = req.url.replace(/^\/app/, '/app/');
    }
  };

  return {
    name: 'vercel-app-rewrite',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewriteAppEntry(req);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewriteAppEntry(req);
        next();
      });
    },
  };
}

// La webapp vive en navby.andeva.tech/app: base /app/ y salida en dist/app para que
// Vercel sirva /app/assets/* sin reescrituras extra (ver AGENTS.md §1).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    base: '/app/',
    plugins: [vercelAppRewritePlugin(), react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      outDir: 'dist/app',
      emptyOutDir: true,
      rolldownOptions: {
        output: {
          codeSplitting: {
            includeDependenciesRecursively: false,
            groups: [
              {
                name: 'vendor-react',
                test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
                priority: 30,
              },
              {
                name: 'vendor-query',
                test: /node_modules[\\/]@tanstack[\\/]/,
                priority: 25,
              },
              {
                name: 'vendor-i18n',
                test: /node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/,
                priority: 25,
              },
              {
                name: 'vendor-forms',
                test: /node_modules[\\/](zod|react-hook-form|@hookform)[\\/]/,
                priority: 25,
              },
              {
                name: 'vendor-maplibre',
                test: /node_modules[\\/](maplibre-gl|react-map-gl)[\\/]/,
                priority: 25,
              },
              {
                name: 'vendor-deckgl',
                test: /node_modules[\\/](@deck\.gl|@luma\.gl|@math\.gl|@loaders\.gl|@probe\.gl)[\\/]/,
                priority: 25,
              },
            ],
          },
        },
      },
    },
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
      testTimeout: 15000,
    },
  };
});
