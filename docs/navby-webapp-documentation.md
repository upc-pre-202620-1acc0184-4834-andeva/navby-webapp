# Navby Webapp

> SPA donde el usuario busca vuelos, ve la ruta en un mapa 2D y recibe el podio de 3 recomendaciones. Las reglas de producto están en [navby-documentation.md](../navby-documentation.md) y los contratos de la API, en [navby-endpoints.md](../backend-documentation/navby-endpoints.md).

## 1. Pantallas

Todas las rutas cuelgan de `https://navby.andeva.tech/app` (Vite con `base: "/app/"` y React Router con `basename="/app"`). La API se llama siempre con rutas relativas `/api/v1/...`: en producción las atiende el proxy de Vercel y en local el proxy de Vite (`server.proxy["/api"] = "http://localhost:8000"`). Ver [entornos y dominios](../backend-documentation/navby-environments-and-deployment.md).

| Ruta | Pantalla | Acceso |
| :--- | :--- | :---: |
| `/` | Buscador + mapa + panel lateral con el podio | Público (cotizar exige sesión) |
| `/login`, `/register`, `/verify-email` | Autenticación (correo y contraseña, o botón de Google). El registro tiene la casilla obligatoria «Acepto los Términos y la Política de Privacidad» (RL-01). Registro y login llevan captcha de Cloudflare Turnstile. | Público |
| `/forgot-password`, `/reset-password?token=` | Recuperación de contraseña | Público |
| `/itineraries`, `/itineraries/:id` | Itinerarios guardados | Sesión |
| `/billing` | Saldo, historial y compra de paquetes. Precios en soles; el equivalente en USD aparece solo como referencia. | Sesión |
| `/billing/result` | Retorno desde Mercado Pago (consulta el estado de la orden; si sigue `PENDING`, reintenta cada 3 s durante 1 min) | Sesión |
| `/account` | Perfil y **Eliminar mi cuenta** (escribe «ELIMINAR» para confirmar, RL-02) | Sesión |

El pie de página de todas las pantallas enlaza a los Términos y la Política de Privacidad del website. Toda tarifa muestra el aviso `price_disclaimer` (RL-03).

La búsqueda vive en la URL (`/app/?trip=ROUND_TRIP&from=LIM&to=HND,NRT&dep=2026-11-01&ret=2026-11-15&ad=2&ch=1&in=0&cabin=ECONOMY&cur=USD&profile=BALANCED`) para poder compartirla y recargarla.

## 2. Flujo de búsqueda

1. **Ciudades.** El usuario escribe una ciudad y el autocompletado consulta `GET /routing/cities`. Elige la **ciudad**, no un aeropuerto: la webapp guarda internamente sus códigos IATA (Tokio → `HND`, `NRT`) y nunca obliga a verlos. Un desplegable opcional «Aeropuertos de Tokio» permite desmarcar alguno. El servidor decide qué combinaciones cotizar (RN-06 y RN-14).
2. **Encuadre.** Al enviar, el mapa ejecuta `fitBounds([origen, destino])`.
3. **Dos peticiones en paralelo:**
   - `GET /routing/preview` → en milisegundos se dibuja la **ruta preliminar de A\*** como arco punteado animado, con el texto «Ruta física más rápida: ~X h».
   - `POST /quotes/search` → mientras responde (normalmente entre 2 y 15 s) el panel muestra *skeletons*.
4. **Podio.** Llega la respuesta: la ruta preliminar se desvanece y se dibujan las 3 rutas reales. Cada tarjeta muestra el puesto, la **afinidad** (`match_pct` %), el precio, la duración, las escalas, «+X h sobre el mínimo físico», las aerolíneas y el botón **Comprar** (abre el `deep_link` en otra pestaña).
5. **Preferencias.** El selector *Equilibrado / Ahorro / Rapidez / Personalizado* llama a `POST /quotes/{search_id}/rank` y reordena el podio sin costo. *Personalizado* abre tres controles deslizantes que siempre suman 100 %.
6. **Guardar.** Cada tarjeta tiene **Guardar** (`POST /itineraries`).

Casos especiales:

| Respuesta | Interfaz |
| :--- | :--- |
| `preview.reachable = false` o `422 ROUTE_NOT_REACHABLE` | Aviso «No hay rutas con 2 escalas o menos entre estas ciudades». No se cobra. |
| `409 SEARCH_IN_PROGRESS` | Se ignora: ya hay una búsqueda en curso y el botón **Buscar** está deshabilitado mientras tanto. |
| `402 INSUFFICIENT_CREDITS` | Toast con enlace a `/billing`. |
| `403 EMAIL_NOT_VERIFIED` | Redirección a `/verify-email`. |
| `400 CAPTCHA_INVALID` (registro, login, recuperación) | Se reinicia el widget de Turnstile y se pide repetir la verificación. Si es `503 PROVIDER_UNAVAILABLE` en esos formularios: «No pudimos comprobar la verificación. Inténtalo de nuevo». |
| `503 PROVIDER_UNAVAILABLE` | Toast «No pudimos consultar precios. No se te cobró». |
| `partial: true` | Aviso discreto «Algunos aeropuertos no respondieron». |
| `podium: []` | «No hay vuelos disponibles para esa fecha. No se te cobró». |
| `credits_charged: 0` | Indicador «Resultado reciente: sin costo». |

## 3. Mapa

| Elemento | Implementación |
| :--- | :--- |
| Mapa base | MapLibre GL con el estilo CARTO Positron (o Dark Matter en modo oscuro). No requiere clave. |
| Arcos | deck.gl `ArcLayer` con `greatCircle: true` (arcos ortodrómicos reales), un arco por tramo entre aeropuertos consecutivos. |
| Ruta preliminar | Arco punteado gris con pulso animado. |
| Rutas del podio | Top 1 en `#604AFF`, Top 2 y Top 3 en tonos de la paleta. Al pasar el cursor sobre una tarjeta se resalta su ruta (y al revés). |
| Marcadores | Origen, destino y escalas con IATA y tiempo de conexión. |

El mapa **no** dibuja el grafo completo ni permite elegir aeropuertos con clics: la selección se hace solo desde el buscador.

## 4. Arquitectura

```text
src/
├── app/              # Router, providers (QueryClient, i18n) y layout
├── features/
│   ├── search/       # Formulario, autocompletado y estado de la URL
│   ├── map/          # MapLibre + deck.gl
│   ├── podium/       # Tarjetas y selector de preferencias
│   ├── auth/         # Login, registro, verificación y recuperación
│   ├── itineraries/  # Guardados
│   ├── billing/      # Saldo, paquetes y resultado del pago
│   └── account/      # Perfil y eliminación de cuenta
└── shared/
    ├── api/          # Cliente fetch tipado y schemas Zod de respuestas
    └── ui/           # Componentes del design system
```

| Responsabilidad | Herramienta |
| :--- | :--- |
| Estado del servidor (preview, podio, saldo, guardados) | TanStack Query. El `search_id` y el perfil forman la query key del podio. |
| Estado de la URL (criterios de búsqueda) | React Router (`useSearchParams`). |
| Estado de UI (tarjeta resaltada, panel abierto) | Zustand. |
| Sesión | El access token vive solo en memoria. El refresh token lo maneja el navegador en una cookie `HttpOnly` que JavaScript no puede leer. Al cargar la app y ante un `401`, el cliente llama a `POST /auth/refresh` (con `credentials: "include"`) y reintenta una vez. |
| Validación | Zod: formulario (fechas, pasajeros RN-02, origen ≠ destino) y respuestas de la API. |

## 5. Internacionalización y accesibilidad

- **i18n**: `i18next` + `react-i18next`, idiomas `es` y `en`, detección por `?lang=`, `localStorage` y navegador. Precios con `Intl.NumberFormat` y horas con `Intl.DateTimeFormat` en la zona horaria de cada aeropuerto.
- **Accesibilidad (WCAG 2.1 AA)**:
  - El autocompletado usa `role="combobox"`.
  - El panel de resultados es una región `aria-live="polite"` («Buscando vuelos…», «3 recomendaciones listas»).
  - Hay una **lista textual** equivalente al mapa con cada tramo y escala, para lectores de pantalla.
  - Foco visible con `:focus-visible`.
  - Se respeta `prefers-reduced-motion`: sin vuelo de cámara ni pulsos.

## 6. Pruebas y despliegue

- **Pruebas**: Vitest + Testing Library (componentes), Playwright (buscar → ver podio → cambiar perfil → guardar) y `@axe-core/playwright` (accesibilidad).
- **Calidad**: ESLint 9 (`typescript-eslint`, `jsx-a11y`, `react-hooks`) y Prettier con `prettier-plugin-tailwindcss`.
- **Despliegue**: proyecto Vercel `navby-webapp` como SPA estática. Vite compila a `dist/app` (así los assets quedan en `/app/assets/*`) y su `vercel.json` sirve `dist` y reescribe `/app/(.*)` a `/app/index.html` (Vercel sirve primero los archivos que existen, como `/app/assets/*`). El website publica la webapp bajo `navby.andeva.tech/app` mediante un rewrite.
- **Gestor de paquetes**: `pnpm`.

## 7. Dependencias

| Paquete | Versión | Uso |
| :--- | :--- | :--- |
| `react`, `react-dom` | `^19.3.1` | UI. |
| `react-router` | `^8.5.1` | Rutas y parámetros de URL (`RouterProvider` desde `react-router/dom`). |
| `@tanstack/react-query` | `^5.107.1` | Estado del servidor. |
| `zustand` | `^5.1.0` | Estado de UI. |
| `maplibre-gl` | `^6.18.0` | Mapa 2D (v6: solo ESM). |
| `react-map-gl` | `^8.1.3` | Integración de MapLibre con React (`react-map-gl/maplibre`). |
| `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/mapbox` | `^9.4.1` | `ArcLayer` sobre MapLibre. |
| `react-hook-form`, `zod`, `@hookform/resolvers` | `^7.92.0`, `^4.6.7`, `^7.0.6` | Formularios y validación. |
| `@marsidev/react-turnstile` | `^1.6.3` | Captcha Cloudflare Turnstile en registro, login y recuperación (token en `X-Captcha-Response`; lo verifica navby-platform). |
| `react-day-picker` | `^10.0.2` | Selector de fechas. |
| `boneyard-js` | `^1.10.0` | Skeletons de carga (`boneyard.config.json`, `pnpm bones`). |
| `sileo` | `^0.1.6` | Notificaciones toast. |
| `i18next`, `react-i18next`, `i18next-browser-languagedetector` | `^27.1.2`, `^18.0.1`, `^8.3.0` | Internacionalización. |
| `lucide-react` | `^1.73.0` | Iconos. |
| `tailwindcss`, `@tailwindcss/vite` | `^4.3.5` | Estilos (tokens en `src/styles/global.css`, guía en `DESIGN.md`). |
| `typescript`, `vite`, `@vitejs/plugin-react` | `~6.0.3`, `^8.3.8`, `^6.3.0` | Compilación (dev). TypeScript se fija en 6.0 hasta que `typescript-eslint` soporte la 7. |
| `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` | `^5.1.0`, `^31.0.1`, `^16.3.3`, `^14.6.10`, `^7.0.1` | Pruebas (dev). |
| `@playwright/test`, `@axe-core/playwright` | `^1.65.1`, `^4.14.0` | E2E y accesibilidad (dev). |
| `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-jsx-a11y`, `eslint-config-prettier`, `prettier`, `prettier-plugin-tailwindcss` | `^10.15.0`, `^8.72.2`, `^7.1.1`, `^0.5.8`, `^6.10.2`, `^10.1.8`, `^3.10.1`, `^0.8.1` | Calidad (dev). |

No se usa Better Auth ni otra librería de auth en el cliente: la sesión la maneja `navby-platform` (ver `AGENTS.md` §6).

## 8. Decisiones del Plan 1

Las decisiones adoptadas al cerrar el Plan 1 ajustan y precisan la configuración anterior de este documento:

- **Acceso autenticado en toda la webapp (`/`):** A diferencia de la tabla inicial de §1, toda la aplicación (incluida `/`) exige sesión iniciada (`RequireAuth`), dejando públicas únicamente las pantallas de acceso (`/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`). La presentación pública del producto vive en `navby-website`.
- **Guardas alineadas al IAM real:** `navby-platform` no emite sesiones ni cookies `navby_refresh` a correos sin verificar (`403 EMAIL_NOT_VERIFIED`). Por ello se omite una guarda `RequireVerified` en el cliente y las rutas privadas usan `RequireAuth`.
- **Sesión compartida en `src/shared/auth/`:** Para cumplir la regla de que ninguna feature importe de otra feature, `useSession`, `bindSessionSync` y `RequireAuth` viven en `src/shared/auth/`.
- **Preferencias de tema e idioma:** Los selectores de tema e idioma se ubican dentro del menú de cuenta (`AccountMenu`, disponible también en rutas públicas) para mantener la barra superior limpia en 390 px y respetar las preferencias heredadas desde el website (`navby-theme`).
- **Términos y privacidad en pie de página:** Se renderizan como etiquetas no navegables (`Términos y condiciones`, `Política de privacidad`) hasta que se definan sus rutas en `navby-website`.
- **Paridad `/app` en local:** `vite.config.ts` incluye una reescritura de `/app` (sin barra final) hacia `/app/` para replicar en local el rewrite de `vercel.json`.

## 9. Decisiones del Plan 2

Las decisiones adoptadas al cerrar el Plan 2 completan la integración real con `navby-platform` (`routing`) y definen la conducta de diseño y mapa:

- **Sin vistas públicas en el buscador (`/`):** `/` permanece protegido por `RequireAuth`, y tanto `searchCities` (`GET /routing/cities`) como `getRoutePreview` (`GET /routing/preview`) usan `auth: 'required'`. El usuario debe registrarse, verificar su correo y tener sesión activa para usar el buscador (si `navby-platform` mantiene `/routing/*` sin guardia JWT, la restricción de producto vigente exige igualmente el acceso autenticado desde la webapp).
- **Disparo de la vista previa y debounce de aeropuertos:** `GET /routing/preview` se consulta y reencuadra el mapa (`fitBounds`) al pulsar **Buscar** (sincronizando los parámetros en `URLSearchParams`) o al cargar/recargar una URL compartida con `from` y `to` válidos y disjuntos. Una vez activa la búsqueda, marcar o desmarcar casillas en «Aeropuertos de [Ciudad]» aplica un debounce de `400 ms` antes de actualizar la URL (`replace: true`) y recalcular. Mientras no exista el Plan 4 (`POST /quotes/search`), **Buscar** muestra la ruta preliminar y la nota discreta de cierre del Plan 2.
- **Cálculo de horas en `ROUND_TRIP`:** En `ONE_WAY` se toma `best_route.t_min_minutes`; en `ROUND_TRIP` se calcula el mínimo de `pairs[].t_min_minutes` (respaldado por `best_route.t_min_minutes` si `pairs` está vacío), redondeando con piso de `1 h` para evitar `~0 h`.
- **Localización de países en cliente:** Dado que `GET /routing/cities` entrega `country` en inglés, el cliente lo traduce al idioma activo (`es`/`en`) mediante `Intl.DisplayNames` y alias históricos en `src/features/search/countryLocalization.ts`.
- **Disposición adaptable y accesibilidad del mapa:** En `< 1024 px` la vista fluye en columna (`SearchPanel` → mapa `h-[40dvh] min-h-[260px]` → `RouteTextLegend` visible debajo); en `>= 1024 px` el formulario flota a la izquierda (`420 px`, superficie sólida `bg-surface`) y `RouteTextLegend` queda `lg:sr-only`, haciéndose visible automáticamente si WebGL no está disponible o falla.
- **MapLibre v6 + deck.gl 9 en módulo `lazy`:** `RouteMap` configura el worker ESM explícito (`?worker&url`), usa `MapboxOverlay` con `interleaved: false` (requerido en MapLibre v6 al no existir `map.transform._nearZ`), segmentos SLERP discontinuos divididos sobre `±180°`, cálculo de límites por mayor brecha circular longitudinal en `[0, 360)` para rutas transpacíficas y transatlánticas, `linear: true` sin animación cuando `prefers-reduced-motion: reduce` está activo, y estilo vectorial inline mínimo como respaldo ante fallos de CARTO.
