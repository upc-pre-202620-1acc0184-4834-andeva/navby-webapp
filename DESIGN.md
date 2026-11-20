---
name: Navby Webapp
description: Buscador de vuelos map-first que entrega un podio de 3 recomendaciones (navby.andeva.tech/app).
colors:
  primary: '#604AFF'
  primary-dark: '#4B37FB'
  primary-soft: '#DFDBFF'
  accent: '#FF6B35'
  accent-dark: '#E8551E'
  accent-soft: '#FFE8DF'
  bg-light: '#F8F8FA'
  bg-dark: '#262626'
  surface-light: '#FFFFFF'
  surface-dark: '#303030'
  fg-light: '#262626'
  fg-dark: '#FFFFFF'
  fg-muted-light: '#66666E'
  fg-muted-dark: '#C6C6C6'
  line-light: '#E4E4E8'
  line-dark: '#3D3D3D'
  line-strong-light: '#8A8A93'
  line-strong-dark: '#85858F'
  brand-ink-dark: '#9D90FF'
  accent-ink-light: '#B8400F'
  accent-ink-dark: '#FF8A5C'
  success: '#3AC530'
  success-ink-light: '#1E7B18'
  error: '#FB2C36'
  error-ink-light: '#D1121C'
  error-ink-dark: '#FF7A7E'
  warning: '#F0B100'
  warning-ink-light: '#8A6100'
typography:
  isologo:
    fontFamily: 'Raptor V3, Albert Sans, sans-serif'
    fontWeight: 700
  title:
    fontFamily: 'Albert Sans, -apple-system, Segoe UI, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 700
    lineHeight: 1.2
  price:
    fontFamily: 'Albert Sans, -apple-system, Segoe UI, sans-serif'
    fontSize: '1.875rem'
    fontWeight: 800
    lineHeight: 1
  body:
    fontFamily: 'Albert Sans, -apple-system, Segoe UI, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: 'Albert Sans, -apple-system, Segoe UI, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: '6px'
  md: '8px'
  lg: '12px'
  xl: '16px'
  full: '9999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '24px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface-light}'
    rounded: '{rounded.md}'
    height: '40px'
    padding: '0 16px'
  button-primary-hover:
    backgroundColor: '{colors.primary-dark}'
  button-buy:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.fg-light}'
    rounded: '{rounded.md}'
    height: '40px'
    padding: '0 16px'
  input:
    backgroundColor: '{colors.surface-light}'
    textColor: '{colors.fg-light}'
    rounded: '{rounded.md}'
    height: '44px'
    padding: '0 12px'
  podium-card:
    backgroundColor: '{colors.surface-light}'
    rounded: '{rounded.xl}'
    padding: '16px'
  badge-affinity:
    backgroundColor: '{colors.primary-soft}'
    textColor: '{colors.primary-dark}'
    rounded: '{rounded.full}'
    padding: '2px 8px'
---

# Design System: Navby Webapp

Guía visual de `https://navby.andeva.tech/app`. Léela antes de crear o cambiar cualquier
pantalla o componente. Los valores exactos viven en
[`src/styles/global.css`](src/styles/global.css); este documento dice **cuándo** y **cómo**
usarlos. Reemplaza al antiguo `docs/design-system.md` y corrige sus problemas de contraste.

Las skills de diseño del repositorio (ver [AGENTS.md](AGENTS.md) §3) sirven para crear y
revisar pantallas, pero **este documento manda sobre ellas**: si una skill sugiere otra
tipografía, paleta o efecto, se adapta a estos tokens o no se aplica.

## Overview

**Navby recomienda; no lista.** La pantalla principal responde una sola pregunta —«¿cuál de
estos 3 vuelos tomo?»— con un mapa y un podio. Todo lo demás (filtros, cuentas, créditos)
es secundario y se nota menos.

- **Modo Operate (impeccable).** La webapp es una herramienta: el usuario viene a buscar,
  comparar y comprar. Escaneo rápido, controles conocidos y consistencia valen más que la
  expresión. La marca vive en los detalles precisos, no en decoración. Las pantallas de
  acceso (login, registro) pueden ser un poco más expresivas, nunca de marketing.
- **El website es la promesa; la webapp es el producto.** Comparte marca, tipografía, tema
  oscuro y voz con `navby.andeva.tech`, pero sin efectos de portada: nada de imán en
  botones, inclinación 3D, revelados por scroll, Lenis ni cursores personalizados.
- **Movimiento de sello: el arco.** El único gesto propio de Navby es la ruta ortodrómica
  que se dibuja sobre el mapa: punteada mientras se piensa, sólida cuando hay respuesta.
  Es la «signature move»; ningún otro elemento compite con ella.
- **Responsive web, no app móvil.** Se diseña para escritorio (1440 px) y se adapta a 390 px.
  No se imitan patrones nativos de iOS/Android.

Señales de que la webapp se está volviendo un «Frankenstein»:

- Dos estilos para el mismo componente (botones, tarjetas, campos).
- Hexadecimales dentro de componentes o clases `dark:` que repiten lo que un token de rol ya
  resuelve.
- Una segunda tipografía o un segundo set de íconos.
- Radios, sombras o duraciones que no están aquí.
- Textos de interfaz escritos en el componente en vez de en `src/locales/*.json`.

## Colors

Dos capas de tokens:

1. **Rol** (cambian solos con el tema; úsalos por defecto): `bg`, `surface`,
   `surface-sunken`, `fg`, `fg-muted`, `line`, `line-strong`, `brand-ink`, `accent-ink`,
   `success-ink`, `error-ink`, `warning-ink`, `ring`, `skeleton`, `route-1..3`,
   `route-preview`. Ejemplo: `bg-surface text-fg border-line`. **No** necesitan `dark:`.
2. **Marca** (fijos): `primary`, `primary-dark`, `primary-soft`, `accent`, `accent-dark`,
   `accent-soft`, `success`, `error`, `warning`. Solo para rellenos de marca y estado.

| Rol               | Claro     | Oscuro    | Uso                                                |
| :---------------- | :-------- | :-------- | :------------------------------------------------- |
| `bg`              | `#F8F8FA` | `#262626` | Fondo de la aplicación.                            |
| `surface`         | `#FFFFFF` | `#303030` | Paneles, tarjetas, campos, menús, toasts.          |
| `surface-sunken`  | `#F0F0F3` | `#1F1F1F` | Pistas de sliders, filas alternas, zonas hundidas. |
| `fg`              | `#262626` | `#FFFFFF` | Texto principal.                                   |
| `fg-muted`        | `#66666E` | `#C6C6C6` | Metadatos: horas, aerolíneas, ayudas.              |
| `line`            | `#E4E4E8` | `#3D3D3D` | Divisores y bordes decorativos de tarjetas.        |
| `line-strong`     | `#8A8A93` | `#85858F` | Bordes de campos y controles (≥ 3:1).              |
| `brand-ink`       | `#604AFF` | `#9D90FF` | Enlaces y texto púrpura.                           |
| `accent-ink`      | `#B8400F` | `#FF8A5C` | Texto naranja pequeño («Mejor balance»).           |
| `*-ink` de estado | ver CSS   | ver CSS   | Texto de éxito, error y advertencia.               |

### Primary

Púrpura `#604AFF`: botón primario (Buscar, Guardar en formularios), selección activa,
foco, ruta Top 1 y el isologo. Hover `primary-dark`. Fondo tenue `primary-soft` para la
insignia de afinidad y selecciones secundarias. Texto blanco sobre púrpura: 5.36:1.

### Secondary

Naranja «Aviation Sunset» `#FF6B35`: **solo** para lo que lleva a comprar o resalta la
mejor oferta (botón **Comprar**, insignia del Top 1, ruta Top 2). Máximo un relleno naranja
por tarjeta. **Sobre naranja el texto es `text-on-accent` `#262626`** (5.34:1); el blanco no cumple
(2.84:1). Para hover, `bg-accent/90`, no `accent-dark` (con texto oscuro baja a 4.14:1).

### Neutral

Los grises del sistema anterior se corrigieron: `#C6C6C6` solo se usa como texto en tema
oscuro (en claro daba 1.7:1); en claro el texto secundario es `fg-muted` `#66666E`.
Los nombres `border-card-dark/light` ya no existen: usa `line` y `line-strong`.

### Estados

Verde, rojo y ámbar como relleno solo en indicadores pequeños (punto de estado, barra).
Para texto, siempre el `*-ink` del tema. Nunca el color como única señal: acompáñalo de
ícono y texto (errores de la tabla §2 de `docs/navby-webapp-documentation.md`).

## Tema oscuro

- Clase `.dark` en `<html>`, decidida antes del primer pintado en `index.html` con la clave
  `navby-theme` de `localStorage` (la misma del website: mismo origen) o, si no hay, con
  `prefers-color-scheme`. Cambiar el tema = alternar la clase y guardar la clave.
- Los tokens de rol hacen el trabajo. `dark:` solo para casos que no tienen token (p. ej.
  elegir el isologo blanco).
- En oscuro la elevación se expresa con superficies más claras (`surface` sobre `bg`), no
  con sombras más fuertes.
- Mapa: CARTO **Positron** en claro y **Dark Matter** en oscuro; cambia junto con la clase.
- Toasts (sileo) y skeletons (boneyard-js) ya siguen el tema (`AppToaster`,
  `configureBoneyard`).

## Typography

- **Albert Sans** (variable, 100–900) para el 100 % de la interfaz: `font-sans`.
- **Raptor V3** solo en el texto «avby» del isologo (`font-isologo`). En la práctica se usa
  el SVG del isologo; nunca para títulos.
- Escala nativa de Tailwind. Usos fijos:

| Uso                                       | Clases                                                                 |
| :---------------------------------------- | :--------------------------------------------------------------------- |
| Título de pantalla                        | `text-2xl font-bold`                                                   |
| Título de sección / ruta («Lima → Tokio») | `text-lg font-semibold`                                                |
| Precio en tarjeta                         | `text-3xl font-extrabold tabular-nums`                                 |
| Texto de interfaz                         | `text-sm`                                                              |
| Etiquetas, metadatos                      | `text-xs font-semibold` (`uppercase tracking-wider` solo en insignias) |

- Cifras (precios, horas, duraciones, porcentajes, créditos) siempre con `tabular-nums`.
- Pesos: 400, 500, 600, 700 y 800. Nada por debajo de 400 en texto pequeño.
- Mínimo `text-xs` (12 px) y solo para metadatos; los campos usan `text-base` en pantallas
  angostas para que el navegador no haga zoom.

## Layout

**Escritorio (≥ 1024 px): mapa + panel.**

```text
┌──────────── barra superior: isologo · créditos · cuenta ────────────┐
│ ┌─ panel (400–440 px) ─┐                                            │
│ │ buscador             │            mapa a sangre                   │
│ │ selector de perfil   │      (arcos, marcadores, fitBounds)        │
│ │ podio (3 tarjetas)   │                                            │
│ └──────────────────────┘                                            │
└─────────────────────────────────────────────────────────────────────┘
```

- El panel es una superficie flotante sobre el mapa (`surface`, `rounded-xl`, borde `line`)
  con su propio scroll; el mapa ocupa todo el fondo. `fitBounds` deja libre el ancho del
  panel (padding izquierdo).
- **Pantallas angostas (< 1024 px):** el buscador arriba, el mapa a ancho completo con
  alto fijo (~40 dvh) y el podio debajo (con el selector de perfil sobre las tarjetas), en
  flujo normal de la página. Sin hojas
  arrastrables ni gestos nativos.
- Pantallas de cuenta, itinerarios y billing: columna centrada `max-w-3xl`, sin mapa.
- **Acceso (login, registro, verificación, recuperación):** pantalla dividida (`AuthLayout`,
  sin `TopBar` ni pie global).
  - **Escritorio (≥ 1024 px):** dos columnas `min-h-dvh`. A la izquierda, tarjeta redondeada
    (`rounded-3xl`, estilo Quina) con margen exterior:
    - En `/login`, `/forgot-password` y `/reset-password`: globo interactivo `RouteGlobe`
      (tema claro papel / tema oscuro nocturno) con rutas ortodrómicas desde Lima, destello
      en píxeles y tarjeta flotante de vista previa del podio.
    - En `/register` y `/verify-email`: fondo atmosférico oscuro (`#12101B`) con bloque
      superior de beneficios y escenario inferior despejado para los elementos 3D con
      animación suave de ondeo.
      A la derecha, columna limpia (`max-w-[400px]` centrado) con controles compactos de
      tema/idioma, enlace de cambio de ruta, acceso con Google arriba del divisor, formulario y
      fila legal discreta al pie.
  - **Pantallas angostas (< 1024 px):** sin panel lateral; cabecera compacta con isologo y
    controles de tema/idioma, seguida directamente del formulario por encima del pliegue y
    enlaces legales al pie.
- Espaciado con la escala de Tailwind: `gap-2` dentro de un control, `gap-3` entre
  controles, `gap-4`/`p-4` en tarjetas, `gap-6` entre secciones. Gutter lateral 16 px en
  móvil.
- Usa `min-h-dvh`, nunca `100vh`.
- **Sin `Footer` global:** los enlaces a Términos y Política de Privacidad (`VITE_WEBSITE_URL`)
  y el copyright viven en tres lugares: en el consentimiento y pie discreto de las pantallas de
  acceso, en el menú desplegable de cuenta de `TopBar` y al pie de `/account`.

## Elevation & Depth

- Tres niveles: plano (`bg`), superficie (`surface` + borde `line`), flotante (paneles
  sobre el mapa, menús, popovers: `surface` + `shadow-lg` suave).
- Sombras solo en lo que flota sobre el mapa o sobre otro contenido. Las tarjetas del podio
  dentro del panel van con borde, sin sombra; la resaltada gana borde `primary`.
- Nada de glassmorphism, gradientes decorativos ni brillos.

## Shapes

| Elemento                            | Radio                   |
| :---------------------------------- | :---------------------- |
| Insignias, chips, avatar            | `rounded-full`          |
| Botones, campos, menús              | `rounded-lg` (8 px)     |
| Tarjetas del podio, panel, diálogos | `rounded-xl` (12–16 px) |

Bordes de 1 px. Radios anidados: el interior es el exterior menos el padding.

## Components

### Botón

| Variante   | Uso                             | Estilo                                                                                                    |
| :--------- | :------------------------------ | :-------------------------------------------------------------------------------------------------------- |
| Primario   | Buscar, Guardar, Continuar      | `bg-primary text-white hover:bg-primary-dark`                                                             |
| Comprar    | Solo el deep link de una oferta | `bg-accent text-on-accent hover:bg-accent/90`, ícono `ExternalLink`                                       |
| Secundario | Acciones de apoyo               | `bg-surface border border-line-strong text-fg`                                                            |
| Fantasma   | Acciones terciarias, íconos     | sin fondo, `hover:bg-surface-sunken`                                                                      |
| Peligro    | Eliminar cuenta o itinerario    | `bg-surface border border-error-ink text-error-ink` (contorno: el rojo de relleno no da 4.5:1 con blanco) |

Alto 40 px (44 px en táctil), `font-semibold text-sm`, ícono de 16 px a la izquierda.
Estado de carga: el botón conserva su ancho y muestra un spinner; se deshabilita mientras
corre la búsqueda (`409 SEARCH_IN_PROGRESS` nunca debería verse). Feedback al presionar:
`active:scale-[0.97]` con `transition-transform duration-150 ease-out`.

### Campos y formularios

- Etiqueta visible siempre encima (no placeholders como etiqueta). Borde `line-strong`, foco
  con anillo `ring`. Error: borde y mensaje en `error-ink`, con `aria-describedby`.
- Validación con Zod al enviar y al salir del campo, no en cada tecla.
- **Combobox de ciudades** (`role="combobox"`): muestra ciudad y país; los códigos IATA
  aparecen pequeños en `fg-muted`, nunca obligatorios. Desplegable opcional «Aeropuertos de
  Tokio» con casillas.
- **Fechas** con `react-day-picker` estilado con tokens; ida y vuelta como rango.
- **Pasajeros** con steppers (− / +) que respetan RN-02 deshabilitando, no con errores.

### Tarjeta del podio

Orden de lectura: puesto y afinidad → precio → duración y escalas → aerolíneas → acciones.

- Encabezado: puesto («1», «2», «3») con el color de su ruta, insignia de afinidad
  `match_pct %` (`bg-primary-soft text-primary-dark`).
- Precio `text-3xl font-extrabold tabular-nums` formateado con `Intl.NumberFormat`.
- Línea de metadatos `fg-muted`: duración · escalas · «+X h sobre el mínimo físico».
- Aviso RL-03 siempre visible en `text-xs fg-muted`: «Precio referencial obtenido de
  terceros; se confirma en el sitio del vendedor».
- Acciones: **Comprar** (acento) y **Guardar** (secundario con ícono `Bookmark`); si ya está
  guardada pasa a un enlace **Guardado** (`variant="secondary"`, ícono `BookmarkCheck` en
  `success-ink`) que lleva a `/itineraries/:id`. Al límite de 50 o ante un fallo muestra un
  aviso en línea bajo las acciones (`role="status"`): enlace a `/itineraries` o botón
  `ghost` **Reintentar** alineado junto al mensaje.
- Hover/foco de la tarjeta = resalta su ruta en el mapa, y viceversa.

### Itinerarios guardados

- **Fila (`/itineraries`):** `Card` `relative flex items-center gap-3` con enlace extendido
  (`after:absolute after:inset-0 after:rounded-xl`) sobre toda la fila hacia el detalle,
  borde `hover:border-line-strong` (150 ms `ease-out`). Orden de lectura: nombre truncado →
  fechas → precio `font-semibold` + duración y escalas → «Guardado el …». A la derecha,
  botón `ghost` `size="icon"` (`Trash2`, `z-10 shrink-0`) para eliminar sin activar el enlace.
- **Detalle (`/itineraries/:id`):** columna `max-w-3xl` con enlace **Volver a mis itinerarios**,
  título, mapa del detalle, `PodiumCard` sin puesto ni afinidad (encabezado «Cotizado con
  el perfil …» y aviso con la fecha de `quoted_at` + RL-03) y botón **Eliminar** (`danger`).

### Diálogo de confirmación

`<dialog>` nativo con `showModal()` (`max-w-md rounded-xl border border-line bg-surface p-6
shadow-lg`), backdrop `rgb(0 0 0 / 0.5)` y animación `.navby-dialog` de 200 ms `ease-out`
(opacidad + escala `0.97 → 1`, `@starting-style` y `allow-discrete`).

- El foco inicial va a **Cancelar** (`secondary`); al confirmar muestra spinner en el botón
  **Eliminar** (`danger`), impide cerrar con `Esc` o **Cancelar** mientras espera respuesta
  del servidor y mantiene el diálogo abierto con el error en `error-ink` si falla.

### Selector de perfil

Control segmentado _Equilibrado / Ahorro / Rapidez / Personalizado_. _Personalizado_
despliega tres sliders que siempre suman 100 % (al mover uno, los otros dos se reparten la
diferencia proporcionalmente) con el valor en `tabular-nums` al lado.

- Radios nativos en un `<fieldset>` con leyenda «¿Qué te importa más?», rejilla 2 × 2 sobre
  `surface-sunken` (como el selector de tipo de viaje); el activo con `bg-surface` y borde
  `primary`. Alto 44 px en táctil, 36 px desde `sm`.
- Sliders con paso de 5 % y la clase `navby-range`: pista `line-strong`, relleno `primary`,
  pulgar `primary` con borde `surface` y anillo `ring` al foco (no `accent-color`, que deja la
  pista blanca en oscuro).
- Mientras reordena, las tarjetas quedan al 60 % de opacidad (150 ms `ease-out`); no se
  mueven ni escalan.

### Skeletons, toasts y estados

- **Skeletons:** `boneyard-js` (`<Skeleton name="…" loading>`), mismos bloques que el
  contenido final, color `skeleton`, animación `pulse`. Se regeneran con `pnpm bones`.
- **Toasts:** `sileo` (`sileo.success/error/warning`), arriba al centro, 4 s. Solo para
  resultados de acciones (créditos insuficientes con enlace a `/billing`, proveedor caído).
  Lo que el usuario debe leer en contexto va en línea, no en toast.
- **Vacíos y avisos:** texto en el panel con ícono, sin ilustraciones. Los textos exactos
  están en la tabla §2 de `docs/navby-webapp-documentation.md`.
- Región `aria-live="polite"` en el panel de resultados.

## Map

| Elemento              | Estilo                                                                                                        |
| :-------------------- | :------------------------------------------------------------------------------------------------------------ |
| Ruta preliminar (A\*) | Arco `route-preview`, punteado, pulso de opacidad lento; texto «Ruta física más rápida: ~X h».                |
| Top 1 / 2 / 3         | `route-1` (púrpura), `route-2` (naranja), `route-3` (gris neutro). Ancho 3 px; la resaltada 5 px.             |
| Resaltado             | Al resaltar una ruta las demás bajan a 30 % de opacidad.                                                      |
| Marcadores            | Punto de 10 px con borde `surface`; etiqueta IATA en `text-xs font-semibold`; en escalas, tiempo de conexión. |
| Leyenda textual       | Lista equivalente al mapa (tramos y escalas) para lectores de pantalla.                                       |

- Arcos con deck.gl `ArcLayer` y `greatCircle: true`, un arco por tramo.
- Los colores de deck.gl son arrays RGB: léelos de las variables CSS al montar y al cambiar
  de tema; nunca dupliques los hex en el código del mapa.
- El mapa no es interactivo para elegir aeropuertos ni dibuja el grafo completo.
- **Mapa del detalle (`/itineraries/:id`):** contenedor encuadrado dentro de `max-w-3xl`
  (`h-60 lg:h-80 rounded-xl border border-line bg-surface-sunken`) sin panel flotante, con una
  sola ruta en `route-1`, etiqueta accesible propia (`regionLabel`) y la leyenda textual
  inmediatamente debajo (visible en `< 1024 px` o si WebGL falla, `lg:sr-only` en
  escritorio).

## Motion

Basado en `emil-design-eng`, `apple-design` y `animate`. El movimiento en la webapp es
**solo funcional**: confirmar, orientar o evitar saltos.

- **Responder ya.** Feedback en `pointerdown`/`:active`; sin retrasos artificiales.
- **Duraciones:** presión 100–160 ms; tooltips y popovers 125–200 ms; menús y selects
  150–250 ms; diálogos 200–300 ms. Nada de interfaz pasa de 300 ms (los toasts los maneja
  sileo).
- **Curvas:** `ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`) para entrar y responder;
  `ease-in-out` solo para cosas que ya están en pantalla y se mueven; **nunca `ease-in`**.
  Variables: `--ease-out`, `--ease-in-out`, `--ease-drawer`.
- **Interrumpible:** las transiciones parten del valor actual; nunca bloquean la entrada.
  Preferir `transition` a `@keyframes` para estados que cambian.
- **Solo `transform` y `opacity`.** Nunca `transition: all` ni animar `width/height/top`.
- **Origen espacial:** menús y popovers escalan desde su disparador; lo que entra por un
  lado sale por el mismo.
- **Mapa:** `fitBounds` con vuelo corto (≤ 800 ms) al enviar; la ruta preliminar se
  desvanece (200 ms) cuando llega el podio y los 3 arcos aparecen escalonados 60 ms.
- **Acciones frecuentes** (cambiar perfil, resaltar tarjeta) no animan más que color y
  opacidad.
- `prefers-reduced-motion`: sin vuelo de cámara, sin pulsos ni escalados; conserva
  transiciones breves de opacidad y color (≤ 150 ms) para preservar la claridad de estado
  (configurado en `global.css` y utilidades `motion-reduce:`).

## Iconos, marca y voz

- **Íconos:** solo `lucide-react`, 16 px en texto y botones, 20 px en navegación,
  `strokeWidth` por defecto. Siempre con texto o `aria-label`.
- **Marca:** isologo SVG de `src/assets/brand/` (púrpura en claro, blanco en oscuro) en la
  barra superior; favicon `public/navby-icon.svg`. No se recolorea ni se deforma.
- **Voz:** confiable, práctica y cercana; frases cortas, tuteo, en español e inglés
  (`src/locales`). Nunca jerga interna: nada de «nodos», «grafo», «BFS», «A\*»,
  «FlightAPI», «OpenFlights».
- **Formatos:** `Intl.NumberFormat` (S/ y USD; billing en soles con USD solo de
  referencia), `Intl.DateTimeFormat` en la zona horaria de cada aeropuerto.

## Accessibility

WCAG 2.1 AA:

- Contraste ≥ 4.5:1 en texto y ≥ 3:1 en bordes de controles (los tokens ya cumplen; las
  parejas prohibidas están arriba).
- Foco visible con `:focus-visible` (anillo `ring` de 2 px).
- Áreas táctiles ≥ 44 × 44 px en pantallas angostas.
- Combobox, región `aria-live`, lista textual del mapa y `lang` sincronizado con i18n.
- Pruebas con `@axe-core/playwright` en claro y oscuro (`e2e/`).

## Do's and Don'ts

**Sí**

- Usar tokens de rol y dejar que el tema cambie solo.
- Un solo CTA naranja por tarjeta y una sola acción primaria por vista.
- Mostrar el aviso de precio referencial junto a toda tarifa.
- Revisar cada pantalla en 390 y 1440 px, en claro y oscuro.

**No**

- Texto blanco sobre naranja, `#C6C6C6` como texto en tema claro, hex en componentes.
- Efectos de marketing del website (imán, parallax, scroll suave, revelados).
- Animaciones de más de 300 ms en interfaz, `ease-in` o `transition: all`.
- Mostrar códigos IATA como algo que el usuario deba entender o elegir.

### Lista de revisión antes de terminar una pantalla

1. ¿Usa solo tokens y componentes de este documento?
2. ¿Se ve bien en 390 px y 1440 px, en claro y oscuro?
3. ¿Textos en `src/locales` (es y en), cifras con `tabular-nums` e `Intl`?
4. ¿Estados de carga (boneyard), vacío y error definidos?
5. ¿Foco visible, etiquetas, contraste y axe sin violaciones?
6. ¿Movimiento ≤ 300 ms, interrumpible y desactivado con `prefers-reduced-motion`?
