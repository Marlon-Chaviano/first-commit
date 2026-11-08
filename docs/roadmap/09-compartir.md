# Fase 9 — Que se comparta solo

## Objetivo

Que cada proyecto creado, cada configuración y cada creador traigan visitas nuevas sin coste: insignias en los READMEs, enlaces cortos que se ven bien en X y Slack, páginas que posicionan en Google y herramientas que hacen volver (⌘K, vista previa, extensión del editor).

## Restricciones (de `AGENTS.md`)

- **Coste cero**: nada nuevo en Redis (solo cola y rate limits). Los contadores salen de Postgres con `"use cache"` (perfil `metrics`, 5 min). Las tablas nuevas caben de sobra en Neon Free.
- **Visibilidad**: todo lo público (enlaces cortos, comparador, perfiles, contador, feed) filtra `visibility = 'public'`; un kit privado nunca aparece.
- **Diseño**: componentes de shadcn, solo blanco y negro, `label-mono` en títulos.
- **Medición**: Vercel Analytics en Hobby no admite eventos personalizados. Cada feature mide con su propia columna en Postgres (por ejemplo `opens` de un enlace corto) o con `?ref=` en los enlaces.

## Orden

| Ola | Feature | Esfuerzo | Por qué en este orden |
| --- | --- | --- | --- |
| 1 | Insignia «Started with first-commit» | S | Cada proyecto creado desde ahora es un enlace entrante. Cuanto antes, más repos la llevan. |
| 1 | Compartir configuración (`/k/<id>` + X) | M | Convierte el configurador en contenido compartible, con su tarjeta OG. |
| 1 | Contador en vivo y feed | S | Prueba social; reutiliza `install_events`. Solo se muestra cuando los números ayudan. |
| 1 | Kit de la semana | S | Reutiliza `featuredAt` y la newsletter que ya existe. |
| 2 | Paleta de comandos (⌘K) | M | Navegación rápida en todo el sitio; base para la extensión. |
| 2 | Vista previa del proyecto | M | Quita el miedo a instalar: muestra qué archivos aparecen y el AGENTS.md exacto. |
| 2 | Perfiles de creador compartibles | S | El perfil ya existe; falta la tarjeta, las insignias y el botón. |
| 2 | Remix | M | Depende de cómo se publica sin repo (decisión abajo). |
| 3 | Comparador de kits | M | SEO programático; necesita datos de instalaciones para ordenar bien. |
| 3 | Extensión de VS Code / Cursor | L | Paquete y publicación nuevos (Marketplace + Open VSX). |

S: 1-2 días · M: 3-5 días · L: 1-2 semanas.

## Diseño técnico

### 1. Insignia «Started with first-commit»

- **SVG**: `/badge/started.svg?kit=<kit>`, en el mismo estilo que `/badge/<kit>.svg`: izquierda negra con «started with», derecha blanca con `first-commit · <kit>`. Cache larga, porque no cambia.
- **En el proyecto**: un paso nuevo del plan en `packages/schema/src/plan.ts` añade al `README.md` un bloque gestionado `<!-- first-commit:badge -->…<!-- /first-commit:badge -->` con `[![Started with first-commit](…/badge/started.svg?kit=<kit>)](https://first-commit.dev/kits/<kit>?ref=badge)`. Crea el README si la plantilla base no trae uno.
- **Opt-out**: `--no-badge` en el CLI y un interruptor en el configurador («Add the badge to README.md»). El plan lo muestra como un paso más, así que nunca es una sorpresa. `update` respeta el bloque si el usuario lo borró: lo registra en `kits.lock` y no lo vuelve a poner.
- **Medición**: las visitas con `?ref=badge` cuentan en una columna diaria de Postgres (`referral_daily(ref, day, visits)`), que se suma desde la página del kit con `after()`.
- **Tests**: el bloque se inserta una vez, se respeta si ya existe y no se duplica con `update`.

### 2. Compartir configuración

- **Tabla** `shared_configs(id text pk, kit, kit_version, options jsonb, agents text[], pm, created_at, opens int)`. El `id` son 6 caracteres base62 del SHA-256 de la configuración normalizada: la misma configuración da el mismo enlace y no se duplica.
- **API**: `POST /api/v1/share` (rate limit por IP, solo kits públicos) devuelve `{ url }`. `GET /k/<id>` hace un 307 a `/kits/<kit>?…` con las opciones (el mecanismo de `recommendationHref` ya existe) y suma `opens`.
- **Tarjeta OG** propia (`/og/k/<id>`): el título del kit, los logos de las opciones elegidas y el comando exacto, reutilizando `ogCard`.
- **Configurador**: botón «Share» junto al comando, que copia el enlace corto, y «Share on X», que abre el intent con `«<comando>» — <título>` y el enlace.

### 3. Contador en vivo y feed

- `getLiveStats()` en `server/metrics`: el total de instalaciones y las 8 últimas (kit, agente, «hace 3 min»), sin `anonId` ni país. `"use cache"` con perfil `metrics`.
- **Home**: «12,430 projects created» y un feed compacto bajo el hero. Se oculta mientras el total sea menor que `RANKING_MIN_INSTALLS`, igual que el ranking.
- «En vivo» significa que el cliente consulta cada 60 s una ruta cacheada. No hay WebSockets ni lecturas en Redis.

### 4. Kit de la semana

- **Columna** `kits.kit_of_week_at` (o una tabla `kit_of_week(week, slug, note)`) que fija el admin desde la pestaña Kits del panel, con una nota de 1-2 frases.
- **Sin elección manual**: el kit con más instalaciones nuevas de los últimos 7 días entre los actualizados o publicados esa semana.
- **Home**: un bloque «Kit of the week» con la nota, sus logos y el comando.
- **Newsletter**: `sendWeeklyDigest` lo pone primero.

### 5. Paleta de comandos (⌘K)

- **Componente**: `pnpm dlx shadcn@latest add command` (cmdk) dentro de un `Dialog`, abierto con ⌘K / Ctrl+K desde la cabecera en cualquier página. El botón de búsqueda de la cabecera también la abre.
- **Datos**: `/api/v1/search-index` (estático, cacheado) con kits, bibliotecas del catálogo, stacks y páginas de docs. Se carga la primera vez que se abre la paleta, no en cada página.
- **Acciones**: ir a un kit, stack, biblioteca o doc, copiar el comando de un kit sin abrirlo y «Describe your project…», que lleva al recomendador.

### 6. Vista previa del proyecto generado

- **Pestaña «Preview»** en la tarjeta de instalación del kit, calculada en el navegador con el mismo `buildPlan` que ya usa `PlanPreview`:
  - **Árbol de archivos**: una línea «Base project from `create-next-app`» (no se puede saber cada archivo de la plantilla externa), más todo lo que el kit escribe: archivos del kit, `writeFiles`, configuración de MCP por agente, `AGENTS.md`, `CLAUDE.md`, `kits.lock` y `.env.example`.
  - **AGENTS.md exacto**: aplica la mezcla del paso sobre un archivo vacío y lo muestra en un diálogo con scroll, con un botón para copiarlo.
- **Pruebas**: un test de que el árbol coincide con los pasos del plan para 3 kits.

### 7. Perfiles de creador compartibles

- **Tarjeta OG**: `/og/u/<handle>` con avatar, nombre, número de kits, instalaciones totales y los logos de sus stacks.
- **Insignias** calculadas (no se guardan): «Verified creator» (un kit verificado), «1k installs», «Top 10 this month».
- **Página**: botón «Share profile» (copia el enlace, y «Share on X»), JSON-LD `ProfilePage` + `Person` y entrada en el sitemap para quien tenga kits públicos.
- **Insignia de README** para el creador: `/badge/u/<handle>.svg` (kits · installs).

### 8. Remix

- **Botón «Remix»** en la página de cada kit: abre `/publish/remix?from=<kit>&…` con las opciones que tenga el configurador.
- **El remix genera un `kit.json`** con `extends: "<kit>"`, los defaults cambiados a lo elegido y un título y una descripción editables.
- **Decisión: dónde vive el kit remezclado.** El CLI y `publish` hoy leen el kit de un repo de GitHub.
  - **(a) Versión inicial sin infraestructura nueva**: descargar el `kit.json`, o «Create on GitHub» (enlace a crear archivo en un repo nuevo), y luego publicar como hoy.
  - **(b) Publicar desde la web sin repo**: guardar el `kit.json` como archivo, igual que los kits privados (`kit_versions.archive`), y servirlo con la misma integridad.
  - **Recomendación**: empezar por (a) y pasar a (b) si se usa.
- **CLI**: `create-first-commit remix <kit>` crea `./kit/kit.json` con el `extends`, para hacer lo mismo desde la terminal.

### 9. Comparador de kits

- **Páginas** `/compare/kits/<a>-vs-<b>` (las de bibliotecas siguen en `/compare/<a>-vs-<b>`). Comparan, lado a lado, lenguaje, framework, opciones, bibliotecas por defecto, skills, MCP, verificación, instalaciones y el comando de cada uno.
- **Qué pares se generan**: los kits de la misma categoría con más instalaciones (unos 5 pares por categoría) más una lista editorial (`landing-next-vs-landing-astro`, `saas-next-supabase-vs-saas-t3`…). Van con `generateStaticParams`, JSON-LD (`ItemList` de dos `SoftwareSourceCode`), tarjeta OG, sitemap y `llms-full.txt`.
- **Comparador libre**: `/compare/kits?k=a,b,c` (hasta 3), con `noindex`, y un enlace «Compare» en cada página de kit.

### 10. Extensión de VS Code / Cursor

- **Paquete** `packages/vscode`:
  - El comando «first-commit: New project» hace QuickPicks de kit y opciones con `/api/v1/kits`.
  - Enseña el plan con `--dry-run` en la terminal integrada y, al confirmar, ejecuta el mismo comando con `--yes` en la carpeta elegida, que luego se abre.
  - El comando «first-commit: Open configurator» abre un webview con el configurador en modo `?embed=1`: sin cabecera ni pie, y un `postMessage` que devuelve el comando a la extensión.
- **Web**: el modo `embed` solo cambia el layout. Hay que permitir el webview en `frame-ancestors` (CSP) solo para ese modo.
- **Publicación**: VS Code Marketplace (cuenta de publisher en Azure DevOps) y Open VSX (Cursor, Windsurf y VSCodium lo usan). Workflow `release-vscode.yml` con `vsce` y `ovsx` al subir una etiqueta `vscode-v*`.
- **Decisión**: el nombre del publisher y si la extensión usa el CLI global (`npx`) o lo empaqueta. Recomendación: `npx`, que siempre es la última versión.

## Tareas

- [x] Ola 1: insignia (SVG, paso del plan, `--no-badge`, interruptor, tests). CLI 1.0.2. Pendiente: `referral_daily` (de momento, `?ref=badge` en Vercel Analytics).
- [x] Ola 1: `shared_configs`, `POST /api/v1/share`, `/k/<id>`, tarjeta OG, botones Share y Post on X (migración `0012`).
- [ ] Ola 1: `getLiveStats`, contador y feed en la home (ocultos bajo el umbral).
- [ ] Ola 1: kit de la semana (columna, elección automática, panel de admin, home, newsletter).
- [ ] Ola 2: paleta ⌘K (`command` de shadcn, `/api/v1/search-index`, atajo global).
- [ ] Ola 2: pestaña Preview con árbol de archivos y AGENTS.md.
- [ ] Ola 2: tarjeta OG, insignias, botón de compartir y JSON-LD en perfiles; `/badge/u/<handle>.svg`.
- [ ] Ola 2: Remix (botón, `/publish/remix`, `create-first-commit remix`); decidir (a) o (b).
- [ ] Ola 3: comparador de kits (páginas, pares, JSON-LD, OG, sitemap, comparador libre).
- [ ] Ola 3: extensión (`packages/vscode`, modo embed, CSP, publicación en los dos mercados).
- [ ] Tests e2e: compartir abre la misma configuración, ⌘K encuentra un kit, la vista previa lista AGENTS.md y una página de comparación responde 200 con JSON-LD.

## Criterios de aceptación

- Un proyecto creado con los valores por defecto tiene la insignia en su README, y `--no-badge` no la pone.
- Un enlace `/k/<id>` abre el configurador con exactamente las mismas opciones y, pegado en X o Slack, muestra la tarjeta con ese stack.
- ⌘K abre la paleta en cualquier página y encuentra un kit, una biblioteca y un stack escribiendo parte de su nombre.
- La vista previa muestra el mismo AGENTS.md que escribe el CLI para esas opciones (comprobado con un test).
- Ninguna feature añade lecturas a Redis, y todo lo público excluye los kits privados.
- La extensión crea un proyecto desde VS Code y desde Cursor, instalada desde sus mercados.
