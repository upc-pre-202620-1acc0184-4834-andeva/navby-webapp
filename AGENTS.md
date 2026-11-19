# AGENTS.md - Navby Webapp

Guía para agentes de IA (Claude Code, Antigravity/Gemini, Codex, etc.) y personas que
trabajen en este repositorio. Léela antes de proponer o aplicar cambios.

Navby recomienda los 3 mejores vuelos entre dos ciudades combinando precio, duración y
escalas en un solo puntaje (el **podio**). Este repositorio es **solo la webapp** (SPA).
El sitio web de marketing es `navby-website` y el backend es `navby-platform` (FastAPI).

---

## 1. Dónde vive: `navby.andeva.tech/app`

Navby es un producto de Andeva en el subdominio `navby.andeva.tech`. Todo lo que ve el
navegador vive en **un solo origen**:

| Ruta                                 | Qué es          | Proyecto                                          |
| :----------------------------------- | :-------------- | :------------------------------------------------ |
| `https://navby.andeva.tech/`         | Website (Astro) | `navby-website`                                   |
| `https://navby.andeva.tech/app/*`    | **Esta webapp** | `navby-webapp` (Vercel, rewrite desde el website) |
| `https://navby.andeva.tech/api/v1/*` | API             | `navby-platform` (proxy de Vercel → VM de Azure)  |

- Vite usa `base: '/app/'` y compila a `dist/app`; React Router usa `basename: '/app'`.
- La API se llama **siempre con rutas relativas** `/api/v1/...`. En local el proxy de Vite
  reenvía `/api` a `VITE_API_PROXY_TARGET` (por defecto `http://localhost:8000`). Nunca
  apuntes a una URL absoluta de la API: la cookie de sesión dejaría de ser de primera parte.
- No existe un dominio ni subdominio propio para la webapp.

## 2. Documentación (léela antes de escribir código)

| Documento                                                                  | Qué define                                                                           |
| :------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- |
| [`docs/navby-documentation.md`](docs/navby-documentation.md)               | Producto, reglas de negocio (RN-xx), legales (RL-xx). **Gana ante contradicciones.** |
| [`docs/navby-webapp-documentation.md`](docs/navby-webapp-documentation.md) | Pantallas, flujo de búsqueda, mapa, arquitectura y dependencias.                     |
| [`docs/navby-endpoints.md`](docs/navby-endpoints.md)                       | Contratos de la API.                                                                 |
| [`docs/user-stories.md`](docs/user-stories.md)                             | Historias y criterios de aceptación.                                                 |
| [`docs/roadmap.md`](docs/roadmap.md)                                       | Orden de construcción por planes y plantilla para pedir cada plan.                   |
| [`DESIGN.md`](DESIGN.md)                                                   | Sistema visual obligatorio.                                                          |
| [`PRODUCT.md`](PRODUCT.md)                                                 | Contexto de producto para la skill `impeccable`.                                     |

El código fuente del backend está en `../navby-platform` (OpenAPI en
`http://localhost:8000/docs` cuando corre en local). Si una decisión no está en `docs/`,
pregunta en vez de suponer.

## 3. Principio: coherencia antes que parches

[`DESIGN.md`](DESIGN.md) es obligatorio. Antes de aplicar un pedido de diseño, entiende la
intención, evalúalo frente a `DESIGN.md`, adáptalo a sus tokens y componentes, y si rompe
la coherencia dilo con claridad y ofrece una alternativa. **La última palabra es del
usuario.**

### Skills instaladas (`.agents/skills`, enlazadas en `.claude/skills`)

Se instalaron con `pnpm dlx skills add <repo> --skill <nombre> -a claude-code -a antigravity`
y están fijadas en `skills-lock.json` (restaurar: `pnpm dlx skills experimental_install`).
`DESIGN.md` manda sobre todas ellas.

| Skill                                                                     | Para qué en Navby                                                                                                                          |
| :------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------- |
| `impeccable`                                                              | Dirección y revisión de interfaces (`critique`, `audit`, `polish`, `layout`, `clarify`). Modo **Operate**. Lee `PRODUCT.md` y `DESIGN.md`. |
| `emil-design-eng`, `animate`, `review-animations`                         | Criterio de movimiento: solo funcional, ≤ 300 ms, `ease-out` (DESIGN.md §Motion).                                                          |
| `apple-design`                                                            | Respuesta inmediata, interrupción y origen espacial, dentro de DESIGN.md §Motion.                                                          |
| `design-taste-frontend`                                                   | Revisar que una pantalla no se vea genérica; sus direcciones de portada no aplican.                                                        |
| `ui-ux-pro-max`, `accessibility`, `web-design-guidelines`                 | Accesibilidad (WCAG 2.1 AA) e interacción.                                                                                                 |
| `vercel-react-best-practices`                                             | Rendimiento y patrones de React.                                                                                                           |
| `vite`, `vitest`, `playwright-best-practices`                             | Build y pruebas.                                                                                                                           |
| `maplibre-v6-migration`, `maplibre-cartography`, `maplibre-source-wiring` | MapLibre GL v6 (ESM, `setWorkerUrl`, estilos y fuentes de datos).                                                                          |

No se instaló `mobile-native`: Navby es web responsive, no app móvil. No hay skill confiable
para deck.gl: usa Context7. El modo «lazy senior» (`ponytail`) está activo como plugin
(`.claude/settings.json`).

## 4. Stack y comandos

React 19 · TypeScript 6 · Vite 8 · Tailwind CSS v4 · React Router 8 · TanStack Query 5 ·
Zustand 5 · MapLibre GL 6 + react-map-gl 8 (`react-map-gl/maplibre`) · deck.gl 9 ·
react-hook-form + Zod 4 · react-day-picker · boneyard-js · sileo · i18next · lucide-react.
Versiones exactas en `package.json`. Usa **pnpm** (nunca npm/yarn) y Context7 para APIs de
librerías.

| Comando                             | Qué hace                                                                                                                  |
| :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev`                          | Servidor en `http://localhost:5173/app/` con proxy `/api`.                                                                |
| `pnpm build` / `pnpm preview`       | Compila a `dist/app` y lo sirve.                                                                                          |
| `pnpm check`                        | Tipos (`tsc -b`).                                                                                                         |
| `pnpm lint` / `pnpm lint:fix`       | ESLint (typescript-eslint, react-hooks, jsx-a11y).                                                                        |
| `pnpm format` / `pnpm format:check` | Prettier + orden de clases Tailwind.                                                                                      |
| `pnpm test` / `pnpm test:watch`     | Vitest + Testing Library (jsdom).                                                                                         |
| `pnpm test:e2e`                     | Playwright (1440 y 390 px) + axe. Levanta `pnpm dev` solo.                                                                |
| `pnpm bones`                        | Regenera los skeletons de boneyard-js (con `pnpm dev` corriendo; captura `/app/__bones/podium`, ruta solo de desarrollo). |

Backend local: en `../navby-platform`, `docker compose -f docker-compose.dev.yml up -d` y
la API en el puerto 8000 (ver su README). Sin backend, la webapp carga pero las llamadas
`/api` fallan.

### Variables de entorno

Copia `.env.example` a `.env.local`. **Toda variable `VITE_*` es pública** (se incrusta en
el bundle): aquí nunca van secretos.

| Variable                  | Uso                                                                               |
| :------------------------ | :-------------------------------------------------------------------------------- |
| `VITE_GOOGLE_CLIENT_ID`   | Client ID de Google Identity Services (mismo que `GOOGLE_CLIENT_ID` del backend). |
| `VITE_WEBSITE_URL`        | Enlaces a Términos y Privacidad del website (cuando existan esas páginas).        |
| `VITE_TURNSTILE_SITE_KEY` | Site Key pública de Cloudflare Turnstile (vacía = clave de prueba).               |
| `VITE_API_PROXY_TARGET`   | Solo `pnpm dev`: destino del proxy `/api`.                                        |

## 5. Arquitectura

```text
src/
├── app/              # App, router, providers (QueryClient, i18n, toaster)
├── features/
│   ├── search/       # Formulario, autocompletado y estado en la URL
│   ├── map/          # MapLibre + deck.gl
│   ├── podium/       # Tarjetas y selector de perfil
│   ├── auth/         # Login, registro, verificación, recuperación, Google
│   ├── itineraries/  # Guardados
│   ├── billing/      # Saldo, paquetes y resultado del pago
│   └── account/      # Perfil y eliminación de cuenta
├── shared/
│   ├── api/          # Cliente fetch tipado y schemas Zod de respuestas
│   └── ui/           # Componentes de DESIGN.md
├── assets/           # Fuentes y logos (Vite los versiona)
├── locales/          # es.json, en.json
├── styles/global.css # Tokens (fuente de verdad de los valores)
└── bones/            # Generado por `pnpm bones`; no editar
```

Crea cada carpeta cuando tenga código. Una feature no importa de otra feature: lo
compartido sube a `shared/`.

- **Estado del servidor:** TanStack Query (el `search_id` y el perfil forman la query key
  del podio).
- **Estado de la búsqueda:** en la URL (`useSearchParams`), para compartir y recargar.
- **Estado de UI:** Zustand (tarjeta resaltada, panel abierto).
- **Rutas pesadas** (mapa con MapLibre/deck.gl) con `lazy` en el router para no inflar el
  bundle inicial.

## 6. API, sesión y seguridad

La autenticación es **del backend** (FastAPI). No se usa Better Auth ni ninguna librería de
auth del lado del cliente.

- `POST /auth/login`, `/auth/verify-email` y `/auth/google` devuelven un `access_token` JWT
  (15 min) y fijan la cookie `navby_refresh` (`HttpOnly`, `SameSite=Strict`,
  `path=/api/v1/auth`).
- El access token vive **solo en memoria** (nunca en `localStorage`, `sessionStorage` ni
  cookies legibles). Al cargar la app y ante un `401`, el cliente llama
  `POST /api/v1/auth/refresh` con `credentials: 'include'` y reintenta **una sola vez**;
  las peticiones concurrentes comparten el mismo refresh.
- Google: script oficial de Google Identity Services con `VITE_GOOGLE_CLIENT_ID`; el ID
  token se envía a `POST /auth/google`. El registro (local o Google) exige aceptar Términos
  y Privacidad (RL-01).
- **Captcha (Cloudflare Turnstile):** `POST /auth/register`, `/auth/login` y
  `/auth/forgot-password` llevan el token en la cabecera `X-Captcha-Response`, obtenido con
  `<TurnstileField>` (`src/shared/ui`). Sin token no se envía el formulario; si el backend
  responde `400 CAPTCHA_INVALID`, se reinicia el widget. Sin `VITE_TURNSTILE_SITE_KEY` se usa la clave de
  prueba de Cloudflare (local y e2e). La verificación real (`siteverify` con el Secret Key)
  la hace navby-platform: el widget solo no protege nada.
- Errores RFC 7807: decide por el campo `code` (`INSUFFICIENT_CREDITS`,
  `EMAIL_NOT_VERIFIED`, `ROUTE_NOT_REACHABLE`, …), nunca por el texto. La reacción de la
  interfaz a cada uno está en la tabla §2 de `docs/navby-webapp-documentation.md`.
- Valida con Zod el formulario (RN-02, RN-04, origen ≠ destino) **y** las respuestas de la
  API antes de usarlas.
- **Comprar** abre el `deep_link` con `target="_blank" rel="noopener noreferrer"`.
- Mercado Pago opera siempre en sandbox (RL-04). Nunca llames a FlightAPI, Mercado Pago o
  Resend reales desde pruebas.

## 7. Idiomas y contenido

- `es` (por defecto) y `en` con i18next. Detección: `?lang=` → `localStorage`
  (`navby-lang`) → navegador. **Ningún texto de interfaz en el componente**: todo en
  `src/locales/*.json`, con las dos traducciones a la vez.
- Precios con `Intl.NumberFormat` (billing en soles; USD solo como referencia) y horas con
  `Intl.DateTimeFormat` en la zona horaria de cada aeropuerto.
- Toda tarifa lleva el aviso RL-03. Los enlaces a Términos y Privacidad del website llegan
  cuando navby-website publique esas páginas.
- Nunca jerga interna en la interfaz (nodos, grafo, BFS, A\*, FlightAPI, OpenFlights).

## 8. Calidad antes de terminar

1. `pnpm format`, `pnpm check` y `pnpm lint` sin errores.
2. `pnpm test` y `pnpm test:e2e` en verde (axe en tema claro y oscuro).
3. Cada criterio de aceptación de las historias trabajadas tiene su prueba.
4. Revisión visual en 390 px y 1440 px, en ambos temas, con la lista de `DESIGN.md`.
5. Si cambió una pantalla con skeleton, `pnpm bones` y revisa `src/bones/`.

## 9. Git y despliegue

- **Commits:** Conventional Commits en inglés (`feat(search): add city combobox`).
  Menciona las historias en el cuerpo (`Refs: US05`).
- **Ramas:** git-flow. `main` es producción y `develop` integración; el trabajo va en
  `feature/<nombre>`. Versiones SemVer sin prefijo `v`.
- **Despliegue:** proyecto Vercel `navby-webapp` (SPA estática, `vercel.json`). El website
  reenvía `navby.andeva.tech/app/*` a este proyecto.
