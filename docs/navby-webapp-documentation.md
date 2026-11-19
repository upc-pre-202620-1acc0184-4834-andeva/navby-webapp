# Navby Webapp

> SPA donde el usuario busca vuelos, ve la ruta en un mapa 2D y recibe el podio de 3 recomendaciones. Las reglas de producto están en [navby-documentation.md](../navby-documentation.md) y los contratos de la API, en [navby-endpoints.md](../backend-documentation/navby-endpoints.md).

## 1. Pantallas

Todas las rutas cuelgan de `https://navby.andeva.tech/app` (Vite con `base: "/app/"` y React Router con `basename="/app"`). La API se llama siempre con rutas relativas `/api/v1/...`: en producción las atiende el proxy de Vercel y en local el proxy de Vite (`server.proxy["/api"] = "http://localhost:8000"`). Ver [entornos y dominios](../backend-documentation/navby-environments-and-deployment.md).

| Ruta | Pantalla | Acceso |
| :--- | :--- | :---: |
| `/` | Buscador + mapa + panel lateral con el podio | Sesión |
| `/login`, `/register`, `/verify-email` | Autenticación (correo y contraseña, o botón de Google). El registro tiene la casilla obligatoria «Acepto los Términos y la Política de Privacidad» (RL-01). Registro, login y recuperación de contraseña llevan captcha de Cloudflare Turnstile. | Acceso (sin sesión) |
| `/forgot-password`, `/reset-password?token=` | Recuperación de contraseña | Acceso (sin sesión) |
| `/itineraries`, `/itineraries/:id` | Itinerarios guardados | Sesión |
| `/billing` | Saldo, historial y compra de paquetes. Precios en soles; el equivalente en USD aparece solo como referencia. | Sesión |
| `/billing/result` | Retorno desde Mercado Pago (consulta el estado de la orden; si sigue `PENDING`, reintenta cada 3 s durante 1 min) | Sesión |
| `/account` | Perfil, **Cerrar sesión** y **Eliminar mi cuenta** (escribe «ELIMINAR», o «DELETE» en inglés, para confirmar, RL-02) | Sesión |

Los enlaces a los Términos y la Política de Privacidad del website se añadirán cuando `navby-website` publique esas páginas; mientras tanto el pie solo muestra el copyright (ver Decisiones del Plan 3). Toda tarifa muestra el aviso `price_disclaimer` (RL-03).

La búsqueda vive en la URL (`/app/?trip=ROUND_TRIP&from=LIM&to=HND,NRT&dep=2026-11-01&ret=2026-11-15&ad=2&ch=1&in=0&cabin=ECONOMY&cur=USD&profile=BALANCED&sid=srch_01J9Z…`) para poder compartirla y recargarla. `sid` es el `search_id` vigente (US-19): al recargar se lee el podio con `POST /quotes/{sid}/rank` y el perfil de la URL, sin costo; nunca se cotiza solo por abrir una URL. `profile` se omite si es `BALANCED`; con `CUSTOM` va `w=40,40,20` (precio, duración, escalas en múltiplos de 5 que suman 100).

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
| `409 SEARCH_IN_PROGRESS` | **Buscar** está deshabilitado mientras se cotiza; si igual llega (otra pestaña), aviso en línea «Ya hay una búsqueda en curso» (US-18). |
| `402 INSUFFICIENT_CREDITS` | Toast con enlace a `/billing`. |
| `403 EMAIL_NOT_VERIFIED` | Redirección a `/verify-email`. |
| `400 CAPTCHA_INVALID` (registro, login, recuperación) | Se reinicia el widget de Turnstile y se pide repetir la verificación. Si es `503 PROVIDER_UNAVAILABLE` en esos formularios: «No pudimos comprobar la verificación. Inténtalo de nuevo». |
| `503 PROVIDER_UNAVAILABLE` | Toast «No pudimos consultar precios. No se te cobró». |
| `partial: true` | Aviso discreto «Algunos aeropuertos no respondieron». |
| `podium: []` | «No hay vuelos disponibles para esa fecha. No se te cobró». |
| `credits_charged: 0` | Indicador «Resultado reciente: sin costo» (solo en la respuesta de `POST /quotes/search` con podio; el `GET` siempre trae `0`). |
| `422 VALIDATION_ERROR` / `INVALID_WEIGHTS`, `404 AIRPORT_NOT_FOUND`, `429 RATE_LIMITED` (cotizar) | Aviso en línea en el panel del podio. |
| `404 SEARCH_NOT_FOUND` al recargar (`POST /quotes/{sid}/rank`) | «Estos resultados vencieron» con **Buscar otra vez** (cubre también una búsqueda ajena, US-19). |
| Cambiar de perfil con la búsqueda vencida (`expires_at` pasado o `404`) | Aviso en línea bajo el selector con **Buscar otra vez**; selector deshabilitado; las tarjetas siguen (US-20, US-21). |
| `422 INVALID_WEIGHTS` o error de red al reordenar | Aviso en línea bajo el selector; el podio y el perfil anteriores no cambian (con red: **Reintentar**). |
| Error de red o `5xx` al cotizar | Aviso en línea con **Reintentar**. |

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

- **Acceso autenticado en toda la webapp (`/`):** Toda la aplicación operativa (incluida `/`) exige sesión iniciada (`RequireAuth`), dejando disponibles sin sesión previa únicamente las pantallas de autenticación y recuperación (`/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`). Un usuario ya autenticado es redirigido desde `/login`, `/register`, `/verify-email` y `/forgot-password` mediante `RedirectIfAuthenticated`, conservando el parámetro `from` original al cambiar entre acceso y registro (`resolveAuthRedirectFrom`). La presentación informativa del producto vive en `navby-website`.
- **Guardas alineadas al IAM real:** `navby-platform` no emite sesiones ni cookies `navby_refresh` a correos sin verificar (`403 EMAIL_NOT_VERIFIED`). Por ello se omite una guarda `RequireVerified` en el cliente y las rutas privadas usan `RequireAuth`.
- **Captcha Cloudflare Turnstile en Step 1:** `<TurnstileField>` (`src/shared/ui/TurnstileField.tsx`) admite `resetSignal` para reiniciar el widget ante `400 CAPTCHA_INVALID` y sigue reactivamente `useTheme()` e idioma activo (`es`/`en`). Sin `VITE_TURNSTILE_SITE_KEY` evita cargar el script externo y emite `TURNSTILE_DUMMY_TOKEN`.
- **Sesión compartida en `src/shared/auth/`:** Para cumplir la regla de que ninguna feature importe de otra feature, `useSession`, `bindSessionSync` y `RequireAuth` viven en `src/shared/auth/`.
- **Preferencias de tema e idioma:** Los selectores de tema e idioma se ubican dentro del menú de cuenta (`AccountMenu`, disponible también en rutas de acceso) para mantener la barra superior limpia en 390 px y respetar las preferencias heredadas desde el website (`navby-theme`).
- **Términos y privacidad en pie de página:** Se renderizaban como etiquetas no navegables; el Plan 3 las retiró del pie (ver Decisiones del Plan 3).
- **Paridad `/app` en local:** `vite.config.ts` incluye una reescritura de `/app` (sin barra final) hacia `/app/` para replicar en local el rewrite de `vercel.json`.

## 9. Decisiones del Plan 2

Las decisiones adoptadas al cerrar el Plan 2 completan la integración autenticada con `navby-platform` (`routing`) y definen la conducta de diseño y mapa:

- **Buscador y rutas autenticadas (`/`):** `/` está protegido por `RequireAuth`, y tanto la webapp (`auth: 'required'`) como `navby-platform` (`GET /routing/cities`, `GET /routing/preview`, además de `GET /billing/packages`) exigen un token JWT válido (`Authorization: Bearer <access_token>`). Todo usuario debe registrarse, verificar su correo y tener sesión activa para usar el buscador y sus créditos.
- **Disparo de la vista previa y debounce de aeropuertos:** `GET /routing/preview` se consulta y reencuadra el mapa (`fitBounds`) al pulsar **Buscar** (sincronizando los parámetros en `URLSearchParams`) o al cargar/recargar una URL compartida con `from` y `to` válidos y disjuntos. Una vez activa la búsqueda, marcar o desmarcar casillas en «Aeropuertos de [Ciudad]» aplica un debounce de `400 ms` antes de actualizar la URL (`replace: true`) y recalcular. Mientras no exista el Plan 4 (`POST /quotes/search`), **Buscar** muestra la ruta preliminar y la nota discreta de cierre del Plan 2.
- **Cálculo de horas en `ROUND_TRIP`:** En `ONE_WAY` se toma `best_route.t_min_minutes`; en `ROUND_TRIP` se calcula el mínimo de `pairs[].t_min_minutes` (respaldado por `best_route.t_min_minutes` si `pairs` está vacío), redondeando con piso de `1 h` para evitar `~0 h`.
- **Localización de países en cliente:** Dado que `GET /routing/cities` entrega `country` en inglés, el cliente lo traduce al idioma activo (`es`/`en`) mediante `Intl.DisplayNames` y alias históricos en `src/features/search/countryLocalization.ts`.
- **Disposición adaptable y accesibilidad del mapa:** En `< 1024 px` la vista fluye en columna (`SearchPanel` → mapa `h-[40dvh] min-h-[260px]` → `RouteTextLegend` visible debajo); en `>= 1024 px` el formulario flota a la izquierda (`420 px`, superficie sólida `bg-surface`) y `RouteTextLegend` queda `lg:sr-only`, haciéndose visible automáticamente si WebGL no está disponible o falla.
- **MapLibre v6 + deck.gl 9 en módulo `lazy`:** `RouteMap` configura el worker ESM explícito (`?worker&url`), usa `MapboxOverlay` con `interleaved: false` (requerido en MapLibre v6 al no existir `map.transform._nearZ`), segmentos SLERP discontinuos divididos sobre `±180°`, cálculo de límites por mayor brecha circular longitudinal en `[0, 360)` para rutas transpacíficas y transatlánticas, `linear: true` sin animación cuando `prefers-reduced-motion: reduce` está activo, y estilo vectorial inline mínimo como respaldo ante fallos de CARTO.

## 10. Decisiones del Plan 3

Las decisiones adoptadas al cerrar el Plan 3 (cuenta y acceso, US-01 a US-05 y US-07 a US-10):

- **Captcha en las tres pantallas:** `/register`, `/login` y `/forgot-password` llevan `<TurnstileField>`. El token es de un solo uso (Cloudflare lo consume en `siteverify`), así que el widget se reinicia tras **cualquier** respuesta de error, no solo `400 CAPTCHA_INVALID`. Sin token el formulario no se envía y muestra un aviso en línea.
- **Errores en línea, nunca en toast:** `DISPOSABLE_EMAIL` (RN-17) y `EMAIL_ALREADY_REGISTERED` se marcan bajo el campo de correo en `/register`; con Google, los errores aparecen en un aviso dentro de la tarjeta. Los textos se eligen por `code` (`apiErrorMessage`, `errors.*` en los locales).
- **Google (US-05, RL-01):** el botón oficial de GIS se oculta si `VITE_GOOGLE_CLIENT_ID` está vacío. Bajo el botón se muestra «Al continuar con Google aceptas los Términos y condiciones y la Política de privacidad de Navby» y la webapp envía siempre `accept_terms: true` (mismo flujo que quina-webapp). No hay paso de consentimiento aparte.
- **Términos y privacidad sin enlaces por ahora:** la casilla de RL-01 y el aviso de Google son texto. El pie ya no muestra etiquetas legales; los enlaces llegan con las páginas finales de `navby-website`.
- **Correo pendiente en el estado del router:** `/register` y el `403 EMAIL_NOT_VERIFIED` de `/login` llevan a `/verify-email` con `{ email, reason, from }` en `location.state`, nunca en la URL. El reenvío espera 60 s solo tras registrarse o reenviar.
- **`RequireAuth` también exige correo verificado (RN-12):** aunque el backend no abre sesión sin verificar, una sesión con `email_verified: false` se redirige a `/verify-email`, la única ruta de acceso donde `RedirectIfAuthenticated` deja quedarse a ese usuario.
- **Cierre de sesión explícito sin `from`:** `logout`, `deleteMyAccount` y `resetPassword` llaman a `clearSession()`; tras eso `RequireAuth` manda a `/login` sin guardar la ruta. Al cerrar sesión se borran las queries inactivas; al entrar otro usuario, todas (salvo la sesión).
- **`/reset-password` con un solo campo** de contraseña con mostrar/ocultar; queda fuera de `RedirectIfAuthenticated` y al terminar quita `?token=` de la URL y cierra la sesión local.
- **Eliminar cuenta según idioma:** se escribe «ELIMINAR» en español y «DELETE» en inglés. La webapp valida la palabra del idioma activo y la envía tal cual; navby-platform acepta `"ELIMINAR"` o `"DELETE"`.
- **Cerrar sesión** está en el menú de la barra superior y en la tarjeta de perfil de `/account`.
- **`/account` sin skeleton de boneyard:** nombre, correo y verificación salen de la sesión al instante; métodos de acceso y fecha de alta muestran «Cargando…» en línea hasta que responde `GET /users/me`.
- **E2E con Google simulado:** Playwright levanta su propio `pnpm dev --port 5174` con un `VITE_GOOGLE_CLIENT_ID` falso y `e2e/fixtures.ts` sustituye `accounts.google.com/gsi/client` por un stub en todas las pruebas.

## 11. Decisiones del Plan 4

Las decisiones adoptadas al cerrar el Plan 4 (podio, US-13, US-15 a US-19, US-26 y US-31):

- **`search_id` en la URL (`?sid=`):** se escribe tras el `200` de `POST /quotes/search` (con `replace`) y se quita al pulsar **Buscar** o al cambiar aeropuertos. Si el usuario cambia la búsqueda mientras se cotiza, el resultado se descarta.
- **Cotizar solo con Buscar:** cargar o compartir una URL corre el preview, nunca `POST /quotes/search` (cuesta 5 créditos). Cambiar aeropuertos con la búsqueda activa deja el aviso «Los criterios cambiaron. Pulsa Buscar para ver precios».
- **TanStack Query:** cotizar es una mutación (`useQuoteSearch`) que siembra la query del podio `['quotes', search_id, 'BALANCED']`; `usePodium(sid)` la lee sin otra petición o, al recargar, desde la API (desde el Plan 5, con `POST /quotes/{sid}/rank`).
- **Saldo en la barra (US-26):** `GET /billing/wallet` (`features/billing/hooks/useWallet.ts`) muestra el total; el `aria-label`/`title` añade las búsquedas disponibles y la hora de recarga (00:00, hora de Lima). Se invalida solo cuando `credits_charged > 0` o ante un `402`.
- **402:** toast con la hora de recarga y la acción «Ver créditos» (`/billing`, placeholder hasta el Plan 7). **503:** toast «No pudimos consultar precios. No se te cobró» con su propia clave (`errors.PROVIDER_UNAVAILABLE` es la del captcha). **403:** se marca la sesión como no verificada y `RequireAuth` lleva a `/verify-email`.
- **Aviso RL-03 desde los locales** (`legal.priceDisclaimer`, es/en), no el `price_disclaimer` en español de la API.
- **Horas:** el backend entrega la hora de pared de cada aeropuerto sin offset; se formatea tal cual (24 h, `Intl` con `timeZone: 'UTC'`) y la conexión de una escala es la resta directa (mismo aeropuerto, misma zona).
- **Layout:** en escritorio el podio vive en el panel flotante bajo el buscador y el panel se desplaza hasta él al llegar resultados; en < 1024 px va bajo el mapa. Una sola instancia montada (`useMediaQuery`), con el orden del DOM igual al visual.
- **Mapa:** un `ArcLayer` por puesto (`route-1..3`), un arco por segmento (la vuelta no repite el trazo); la preliminar se desvanece en 200 ms y las rutas entran escalonadas 60 ms (sin animación con `prefers-reduced-motion`). El resaltado vive en Zustand (`shared/state/podiumHighlight.ts`): la ruta activa pasa a 5 px y las demás a 30 % de opacidad, en ambos sentidos tarjeta ↔ ruta. Las escalas muestran su tiempo de conexión. Si falta un aeropuerto en `airports[]`, se omite ese arco y la leyenda textual conserva la ruta.
- **Skeleton:** `<Skeleton name="podium-panel">` con huesos de `src/bones`. `pnpm bones` captura la ruta solo de desarrollo `/__bones/podium` (el CLI no tiene sesión).
- **Pruebas:** Vitest cubre cada fila de la tabla §2 y los escenarios del plan (`src/app/podiumFlow.test.tsx`); Playwright (`e2e/podium.spec.ts`) simula la API con `page.route` en 1440 y 390 px, con axe en claro y oscuro. El smoke en vivo se hizo contra navby-platform local con el mock de FlightAPI. No se usa MSW.

## 12. Decisiones del Plan 5

Las decisiones adoptadas al cerrar el Plan 5 (preferencias, US-20 y US-21). El plan pasó por revisión Goldfish (Elephant-Goldfish):

- **Perfil en la URL:** `profile` (`SAVER`, `FAST`, `CUSTOM`; ausente = `BALANCED`) y, con `CUSTOM`, `w=40,40,20`. Un `w` que no sean tres múltiplos de 5 que sumen 100 se lee como 50/30/20. **Buscar** conserva el perfil y lo envía en `preferences` de `POST /quotes/search`.
- **Query key `['quotes', sid, preferenceKey]`** (`SAVER` o `CUSTOM:40-40-20`). Cotizar siembra la clave del perfil cotizado; volver a un perfil ya visto sale de caché sin red.
- **Leer siempre con `POST /quotes/{sid}/rank`:** también al recargar (gratis, una petición con el perfil de la URL). La webapp dejó de usar `GET /quotes/{sid}`. El servidor guarda los últimos pesos, lo que no afecta a la webapp porque la URL manda.
- **La URL cambia solo cuando `/rank` responde bien** (`fetchQuery` de la clave nueva y luego `setSearchParams` funcional con `replace`). Mientras tanto el selector ya muestra el perfil pedido, las tarjetas actuales siguen al 60 % de opacidad con `aria-busy`, y un error deja todo como estaba: `422 INVALID_WEIGHTS` con aviso en línea; red/5xx con **Reintentar**. Las respuestas de pedidos superados se descartan.
- **Vencimiento:** al cambiar de perfil se compara `expires_at` con el reloj (orientativo) y el `404 SEARCH_NOT_FOUND` del servidor es la verdad. Vencida: aviso en línea con **Buscar otra vez** (cotiza de nuevo), selector deshabilitado y las tarjetas siguen a la vista. Al recargar con `404` no hay datos que mostrar: se mantiene el aviso del Plan 4 sin tarjetas.
- **Selector:** `<fieldset>` con cuatro radios nativos en rejilla 2 × 2 (en el panel de 371 px «Personalizado» no cabe en una fila), dentro del panel del podio, entre el título y las tarjetas. *Personalizado* arranca con los pesos del perfil activo y reordena al instante; los sliders (`<input type="range">`, paso 5 %, `aria-valuetext`, pista con tokens `navby-range` en `global.css`) se ven en cada movimiento y reordenan 300 ms después del último. El reparto (`redistributeWeights`) es proporcional con redondeo por mayor resto; un peso en 0 se queda en 0 mientras el otro tenga valor.
- **Anuncios:** la región `aria-live` calla mientras se reordena y luego dice «Recomendaciones ordenadas por Ahorro. Sin costo.». Cambiar de perfil borra la ruta resaltada.
- **Saldo:** reordenar nunca invalida `GET /billing/wallet` (prueba explícita).
- **Pruebas:** `src/features/podium/preferences.test.ts` (reparto, URL y conversión con la API) y el bloque «Preferencias» de `src/app/podiumFlow.test.tsx` (un caso por escenario de US-20 y US-21, más caché, recarga y error de red); e2e en `e2e/podium.spec.ts` con axe en claro y oscuro. Smoke en vivo contra navby-platform local (mock de FlightAPI) en 1440 y 390 px.

## 13. Decisiones del Plan 6

Las decisiones adoptadas al cerrar el Plan 6 (itinerarios guardados, US-22 a US-24):

- **Normalización de la oferta congelada (`SavedSegmentSchema`, `SavedOfferSchema`):** el backend serializa los segmentos guardados con `from_iata` y `to_iata` (sin alias) y con el `rank` obtenido en la búsqueda (puede ser `> 3`). `SavedSegmentSchema` normaliza ambos campos a `from` / `to` y `SavedOfferSchema` admite `rank >= 1` (además de perfiles futuros vía `.catch('BALANCED')`) para reutilizar `PodiumCard` y `RouteMap` sin duplicar lógica.
- **Una sola página compartida (`listItineraries`):** como RN-13 limita la colección a 50 itinerarios y `GET /itineraries` admite `page_size=50`, se pide siempre `page=1&page_size=50` bajo `itineraryKeys.list()`. De esa misma caché sale `useSavedOfferIds` (`offer_id → itinerary.id`) para mostrar **Guardado** en las tarjetas del podio sin peticiones adicionales.
- **Guardar desde el podio (`SaveItineraryButton`, US-22):** gratis e idempotente (`201` nuevo, `200` ya existente); inserta en `itineraryKeys.list()` solo si el `id` no estaba e invalida la lista sin tocar el saldo (`GET /billing/wallet`). Si la búsqueda ya expiró en el reloj local o responde `404 SEARCH_NOT_FOUND`, avisa de vencimiento (`onExpired`); ante `409 ITINERARY_LIMIT_REACHED` invalida la lista y muestra aviso en línea con enlace a `/itineraries`; ante red/5xx ofrece **Reintentar** en línea.
- **Lista `/itineraries` (US-23, US-24):** columna centrada `max-w-3xl` sin mapa, del más reciente al más antiguo, contador `X de 50`, aviso al llegar a 50, un único `PriceDisclaimer` (RL-03) acompañado de la nota «Los precios son del momento en que guardaste cada itinerario», filas con enlace extendido (`after:inset-0`) y botón `ghost` `Trash2` por encima (`z-10`), y skeleton `itineraries-list` de `boneyard-js` (`pnpm bones` captura `/__bones/itineraries`).
- **Detalle `/itineraries/:id` (US-23):** pide siempre `GET /itineraries/{id}` sin `initialData` desde la lista; muestra el mapa encuadrado (`floatingPanel={false}`, `h-60 lg:h-80`, una sola ruta en `route-1` y `regionLabel` «Mapa de la ruta guardada»), `RouteTextLegend` debajo, `PodiumCard` con encabezado «Cotizado con el perfil …» (sin puesto ni afinidad) y aviso «Precio del <fecha de quoted_at>; puede haber cambiado.» + RL-03. Ante `404` o `422` (UUID inválido en FastAPI) muestra «Este itinerario no existe» sin revelar si es de otro usuario.
- **Confirmación de eliminar sin borrado optimista (`ConfirmDialog` / `DeleteItineraryDialog`, US-24):** `<dialog>` nativo con `showModal()`, foco inicial en **Cancelar** y bloqueo de cierre (`Esc`/Cancelar) mientras dura `DELETE /itineraries/{id}`. Un `404` al eliminar se trata como `gone` («Ese itinerario ya no existe») para limpiar la lista; un error de red/5xx mantiene el diálogo abierto para reintentar. Desde la lista devuelve el foco al `<h1>` con anuncio en `aria-live`; desde el detalle navega primero a `/itineraries` con el anuncio en `location.state` y luego elimina `itineraryKeys.detail(id)` de la caché para evitar un refetch `404`.
- **Contraste de `--error-ink` en tema oscuro:** la auditoría de axe sobre el diálogo abierto en tema oscuro detectó contraste 4.41:1 en el botón **Eliminar** (`variant="danger"`, borde y texto `error-ink` sobre `surface` `#303030`); se aclaró `--error-ink` oscuro a `#ff7a7e` en `src/styles/global.css` y `DESIGN.md` (superando 4.5:1).
- **Pruebas y revisión visual:** `src/shared/api/itinerarySchemas.test.ts`, `src/shared/ui/ConfirmDialog.test.tsx`, `src/app/itinerariesFlow.test.tsx` y `src/app/itinerariesPages.test.tsx` (Vitest + Testing Library), más `e2e/itineraries.spec.ts` en 1440 × 900 y 390 × 844 con `@axe-core/playwright` en claro y oscuro y recorrido visual con 0, 3 y 50 itinerarios, diálogo y avisos del botón **Guardar**.
