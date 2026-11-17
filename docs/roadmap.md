# Navby Webapp — Roadmap de construcción

Orden en que se construye `navby-webapp` (`https://navby.andeva.tech/app`). Cada **plan** es
una rebanada vertical: cliente de API → estado → pantalla → textos es/en → pruebas. Al
terminar se puede probar y mostrar contra `navby-platform` en local.

El backend ya expone todos los módulos (`iam`, `routing`, `quotes`, `billing`,
`itineraries`), así que la webapp no espera a nadie: cada plan consume endpoints que ya
existen ([navby-endpoints.md](navby-endpoints.md)). Las historias y sus escenarios Gherkin
están en [user-stories.md](user-stories.md); las reglas `RN-xx`/`RL-xx`, en
[navby-documentation.md](navby-documentation.md).

---

## Orden de lectura para un agente

1. `AGENTS.md` y `DESIGN.md`.
2. `docs/navby-webapp-documentation.md` (pantallas, flujo, mapa, arquitectura).
3. `docs/navby-endpoints.md` (solo los endpoints del plan en curso).
4. `docs/user-stories.md` (solo las historias del plan en curso).
5. `docs/navby-documentation.md` cuando una regla de negocio lo requiera.

---

## Mapa de planes

| Plan | Qué construye | Historias | Estado |
| :---: | :--- | :--- | :---: |
| 0 | **Fundaciones:** Vite con `base: '/app/'`, tokens, DESIGN.md, AGENTS.md, i18n, sileo, boneyard, Vitest, Playwright + axe, skills. | — | ✅ |
| 1 | **Armazón y cliente de API:** layout, componentes base, cliente fetch con sesión, despliegue. | US-06, US-31 (aviso), US-33 (enlaces) | ✅ |
| 2 | **Buscador y ruta en el mapa** (autenticado). | US-11, US-12, US-14, US-34 | ✅ |
| 3 | **Cuenta y acceso.** | US-01 a US-05, US-07 a US-10 | ⬜ |
| 4 | **Podio:** cotizar y recomendar. | US-13, US-15 a US-19, US-26, US-31 | ⬜ |
| 5 | **Preferencias:** reordenar el podio. | US-20, US-21 | ⬜ |
| 6 | **Itinerarios guardados.** | US-22, US-23, US-24 | ⬜ |
| 7 | **Créditos y pagos** (Mercado Pago sandbox). | US-25, US-27 a US-30 | ⬜ |
| 8 | **Cierre de calidad y lanzamiento.** | Transversal | ⬜ |

US-32 y US-33 (contenido) son del website; aquí solo se enlazan.

```text
0 ─► 1 ─┬─► 2 ─────────┐
        └─► 3 ─────────┴─► 4 ─┬─► 5
                              ├─► 6
                              └─► 7 ─► 8
```

Los planes 2 y 3 son independientes entre sí (el buscador es público). 5, 6 y 7 dependen
del podio, pero no entre ellos.

---

## Plan 1 · Armazón y cliente de API

**Objetivo:** que cada pantalla futura solo tenga que pedir datos y pintar.

- `shared/api`: cliente `fetch` tipado con rutas relativas `/api/v1`, `credentials:
  'include'`, access token en memoria, refresh único compartido ante `401` y un solo
  reintento, errores RFC 7807 como `ApiError` con `code`, respuestas validadas con Zod.
- Sesión: al cargar la app, `POST /auth/refresh` silencioso; contexto/hook `useSession`
  (TanStack Query) y guardas de ruta (`RequireAuth`, `RequireVerified` →
  `/verify-email`).
- Layout: barra superior (isologo, saldo placeholder, menú de cuenta, tema, idioma) y pie
  con Términos y Privacidad (`VITE_WEBSITE_URL`).
- `shared/ui` mínimo de DESIGN.md: `Button`, `Field`/`Input`, `Card`, `Badge`,
  `PriceDisclaimer` (RL-03), estado vacío/error. Solo lo que usarán los planes 2–3.
- Despliegue: proyecto Vercel `navby-webapp` y rewrites `/app` en el `vercel.json` del
  website (ver `navby-environments-and-deployment.md`).
- **Endpoints:** `POST /auth/refresh`, `GET /users/me`, `GET /health`.
- **Hecho cuando:** pruebas unitarias del cliente (refresh concurrente, reintento único,
  mapeo de errores) y e2e de layout en ambos temas e idiomas; preview en Vercel bajo
  `/app` sirviendo assets y rutas profundas.
- **Decidir antes:** ¿selector de tema/idioma en la barra o solo en el menú de cuenta?

## Plan 2 · Buscador y ruta en el mapa

**Objetivo:** la pantalla principal funcionando para un visitante: elegir ciudades y ver
la ruta preliminar en milisegundos.

- `features/search`: combobox de ciudades (`GET /routing/cities`, ES/EN, debounce corto,
  `role="combobox"`), desplegable de aeropuertos de la ciudad (US-14), tipo de viaje,
  fechas (react-day-picker), pasajeros (RN-02), cabina y moneda (US-34). Validación Zod
  (RN-01 a RN-04, origen ≠ destino).
- Estado de la búsqueda en la URL (`?trip=…&from=LIM&to=HND,NRT…`): compartir y recargar.
- `features/map`: MapLibre v6 (`react-map-gl/maplibre`, Positron/Dark Matter según tema),
  `fitBounds`, deck.gl `ArcLayer` con `greatCircle`, arco preliminar punteado y texto
  «Ruta física más rápida: ~X h» (`GET /routing/preview`). Ruta cargada con `lazy`.
- `preview.reachable = false` → aviso «No hay rutas con 2 escalas o menos…».
- Lista textual equivalente al mapa (accesibilidad).
- **Hecho cuando:** cada escenario de US-11, 12, 14 y 34 tiene prueba; e2e del flujo
  público con la API real en local; `prefers-reduced-motion` sin vuelo de cámara.
- **Decidir antes:** layout exacto en < 1024 px (mapa arriba o abajo del formulario);
  qué pasa al pulsar **Buscar** sin sesión (abrir login con retorno a la búsqueda).

## Plan 3 · Cuenta y acceso

**Objetivo:** registrar, verificar y gestionar la cuenta.

- Rutas `/login`, `/register`, `/verify-email`, `/forgot-password`,
  `/reset-password?token=`, `/account`.
- Registro con casilla obligatoria de Términos y Privacidad (RL-01); verificación con OTP
  y reenvío con cuenta regresiva (US-02, US-03); login (US-04); Google con Google Identity
  Services y `VITE_GOOGLE_CLIENT_ID` (US-05); cerrar sesión (US-07); recuperar contraseña
  (US-08); perfil (US-09); eliminar cuenta escribiendo «ELIMINAR» (US-10, RL-02).
- Cloudflare Turnstile (`<TurnstileField>`, ya creado) en registro, login y recuperación
  de contraseña; token en la cabecera `X-Captcha-Response`. navby-platform lo verifica
  (`siteverify`) y responde `400 CAPTCHA_INVALID` (reiniciar el widget) o
  `503 PROVIDER_UNAVAILABLE` si no pudo consultar a Cloudflare.
- Retorno a la ruta original después de entrar (incluida una búsqueda en la URL).
- **Endpoints:** `/auth/*`, `GET /users/me`, `DELETE /users/me`.
- **Hecho cuando:** escenarios de US-01 a US-10 probados; e2e registro → OTP (leído del
  log del backend en local) → login → logout; mensajes de error por `code`.
- **Decidir antes:** si el correo desechable (RN-17) se muestra en línea o en toast; cómo
  probar Google en e2e (mock del script de GIS).

## Plan 4 · Podio

**Objetivo:** la promesa del producto: 3 recomendaciones reales.

- `POST /quotes/search` en paralelo con el preview; skeletons boneyard (2–15 s);
  `aria-live` («Buscando vuelos…», «3 recomendaciones listas»).
- `features/podium`: tarjetas con puesto, afinidad `match_pct`, precio (`Intl`), duración,
  escalas, «+X h sobre el mínimo físico», aerolíneas, **Comprar** (`deep_link` en pestaña
  nueva) y aviso RL-03 (US-31).
- Mapa: la ruta preliminar se desvanece y aparecen 3 arcos (`route-1..3`); resaltado
  tarjeta ↔ ruta (estado en Zustand); marcadores de escalas con tiempo de conexión.
- Casos especiales de la tabla §2 de `navby-webapp-documentation.md`: `402`
  (US-17, toast con enlace a `/billing`), `403 EMAIL_NOT_VERIFIED`, `409` (US-18, botón
  deshabilitado), `422`, `503` y podio vacío (US-15), `partial`, `credits_charged: 0`
  (US-16).
- Volver a ver la última búsqueda: `GET /quotes/{search_id}` (US-19).
- Saldo en la barra (`GET /billing/wallet`, US-26) que se actualiza tras cotizar.
- **Hecho cuando:** cada código de error tiene prueba (MSW o `page.route`); e2e buscar →
  podio → comprar con el mock de FlightAPI del backend; `pnpm bones` generado para el
  panel de resultados.
- **Decidir antes:** dónde se guarda el `search_id` vigente (URL o memoria) para US-19.

## Plan 5 · Preferencias

- Selector *Equilibrado / Ahorro / Rapidez / Personalizado* (`POST /quotes/{id}/rank`,
  gratis, sin skeleton largo). Query key = `search_id` + perfil.
- *Personalizado*: 3 sliders que siempre suman 100 % (lógica pura con prueba unitaria:
  reparto proporcional y redondeo).
- Búsqueda vencida (> 30 min, RN-10/RN-11) → aviso y opción de buscar otra vez.
- **Hecho cuando:** escenarios de US-20 y US-21 probados; reordenar no cambia el saldo.

## Plan 6 · Itinerarios guardados

- **Guardar** en cada tarjeta (`POST /itineraries`), límite de 50 (RN-13) con mensaje.
- `/itineraries` (lista) y `/itineraries/:id` (detalle con mapa de la ruta guardada y
  aviso RL-03); eliminar con confirmación (US-24).
- **Hecho cuando:** escenarios de US-22 a US-24 probados; estados vacío y lleno.

## Plan 7 · Créditos y pagos

- `/billing`: saldo y hora de renovación 00:00 Lima (US-25, US-26), historial paginado
  (US-27), paquetes en soles con USD solo de referencia (US-28).
- Comprar (US-29): `POST /billing/orders` → redirección a Mercado Pago **sandbox**.
- `/billing/result` (US-30): consulta la orden y reintenta cada 3 s durante 1 min si sigue
  `PENDING`; luego invalida el saldo.
- **Hecho cuando:** escenarios de US-25 a US-30 probados; e2e con la orden simulada
  (nunca Mercado Pago real en pruebas, RL-04).

## Plan 8 · Cierre de calidad y lanzamiento

- Auditoría con `impeccable audit`, `accessibility` y `web-design-guidelines` en todas las
  pantallas (390/1440 px, claro/oscuro); `review-animations` sobre el movimiento.
- Rendimiento: división de código por ruta, peso del bundle de mapa, Lighthouse.
- `pnpm bones` final, revisión de textos es/en y de la lista de `DESIGN.md`.
- Release SemVer en `main` y verificación en `https://navby.andeva.tech/app`.

---

## Plantilla para pedir cada plan

> Lee `AGENTS.md`, `DESIGN.md` y `docs/roadmap.md`. Planifica el **Plan 4: Podio**, con
> las historias US-13, US-15 a US-19, US-26 y US-31.
> - **Alcance:** cliente de API y schemas Zod de los endpoints del plan, estado (Query,
>   URL, Zustand), pantallas y componentes de `DESIGN.md`, textos en es/en.
> - **Fuera de alcance:** preferencias (Plan 5) e itinerarios (Plan 6).
> - **Hecho cuando:** cada escenario Gherkin tiene su prueba (Vitest + Testing Library y
>   e2e con Playwright contra navby-platform local); pasan `pnpm check`, `pnpm lint`,
>   `pnpm test` y `pnpm test:e2e`; y la lista de revisión de `DESIGN.md` está hecha en
>   390 px y 1440 px, en ambos temas.
> - **Antes de escribir código:** dime qué decisiones necesitas que tome yo.

Al cerrar cada plan: marca su estado en la tabla de arriba y, si se tomaron decisiones que
no estaban en `docs/`, regístralas en `navby-webapp-documentation.md` (sección «Decisiones
del Plan N»), como en quina-webapp.
