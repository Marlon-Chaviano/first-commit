# Fase 1 — Herramientas para creadores

## Objetivo

Que crear un kit cueste un minuto. Un dev con un proyecto que le gusta ejecuta `create-first-commit create` y obtiene un kit válido. Quien quiere una variante de un kit existente solo declara lo que cambia.

## Por qué

Sin creadores no hay catálogo, y hoy escribir un `kit.json` a mano exige conocer todo el esquema. La palanca es "tu repo ya es un kit".

## Diseño técnico

### `create-first-commit create [dir]` (`packages/cli/src/create/`)

Analiza un proyecto existente y genera `kit.json` y una carpeta `files/`:

| Detecta | De dónde | Se convierte en |
| --- | --- | --- |
| Framework y scaffolder | `package.json` (`next`, `expo`, `hono`, `wxt`, `vite`…) | `base.command` del creador oficial correspondiente y `libraries.framework` |
| Bibliotecas del catálogo | Dependencias que coinciden con `registry/libraries.json` | Valores por defecto de `libraries` (components, addons, animation, observability) |
| Resto de dependencias | `dependencies` / `devDependencies` no cubiertas | `dependencies` / `devDependencies` (sin versiones de la base) |
| Skills | `skills-lock.json` o las carpetas de `.claude/skills` y `.agents/skills` | `skills` |
| MCP | `.mcp.json`, `.cursor/mcp.json`, `.codex/config.toml` | `mcp` |
| Instrucciones propias | `AGENTS.md` sin el bloque `<!-- kits:start -->` ni lo que generó el scaffolder | `instructions` |
| Variables | `.env.example` | `env` (nunca lee `.env`) |
| Archivos propios | Archivos que no están en una instalación limpia del scaffolder | `files/` (pregunta antes de incluir cada carpeta) |

Flujo interactivo con `@clack/prompts`: muestra lo detectado, permite quitar elementos, pide nombre, título, descripción y categoría, valida con `parseKit` y termina con un `--dry-run` del kit generado.

### `extends` (`packages/schema/src/schema.ts`, `resolve.ts`)

```json
{ "name": "landing-dark", "extends": "landing-next", "libraries": { "components": "shadcn", "addons": ["magicui"] } }
```

- Se resuelve en el registro (`loadKit` en el CLI y `getKit` en la web) antes de `expandKit`.
- Fusión: los escalares del hijo sustituyen; `dependencies`, `skills`, `setupTasks` y `writeFiles` se concatenan sin duplicados; `options` se fusionan por `id` (el hijo puede añadir opciones o sustituir una entera); `instructions` se concatenan.
- Máximo 3 niveles y detección de ciclos.

### Versiones de kits

- Campo `version` (semver) obligatorio en `kit.json`.
- `create-first-commit kit@1.2.0` instala una versión concreta. En el registro oficial las versiones son tags de git `<kit>@<versión>`; `giget` descarga ese ref.
- `registry/index.json` incluye la última versión de cada kit.

### Documentación

- La página `/docs` pasa a ser una sección con: empezar (`create-first-commit create`), referencia de `kit.json` (generada desde `registry/kit.schema.json`), `extends`, catálogo de bibliotecas, buenas prácticas para `AGENTS.md`.
- Plantilla `npx create-first-commit create --blank <nombre>` para empezar un kit desde cero.

## Tareas

- [x] Detectores de framework, bibliotecas, skills, MCP, instrucciones, variables y archivos propios (`packages/cli/src/create/detect.ts`, `frameworks.ts`).
- [x] Flujo interactivo de `create-first-commit create` y modo no interactivo (`-y`, `--name`, `--title`, `--description`, `--category`, `--include`, `--out`, `--base`).
- [x] `create-first-commit create --blank <nombre>`: kit vacío con `$schema`.
- [x] Campo `extends` en el esquema, fusión en `packages/schema/src/extends.ts`, carga recursiva en CLI y web, detección de ciclos por carpeta y límite de 3 niveles.
- [x] Campo `version` (semver, obligatorio), instalación por versión (`kit@1.2.0`) y `pnpm registry:tag` para crear las etiquetas `<kit>@<versión>`.
- [x] `version` en los 5 kits oficiales y en `registry/index.json`.
- [x] La telemetría envía `kitVersion` y Postgres la guarda (`install_events.kit_version`, migración `0001`).
- [x] Sección de docs para creadores: `/docs` (crear), `/docs/referencia` y `/docs/bibliotecas` (generada desde el catálogo).
- [x] Tests unitarios con Vitest (`pnpm test`): fusión de `extends`, requisitos y poda de opciones, comando generado, modos de `writeFiles` y detectores.

## Estado de los criterios

- 🟡 `create-first-commit create` sobre proyectos generados por los kits `landing-next` (con shadcn, Kokonut, Magic UI, Motion, GSAP) y `api-hono` (con Sentry y PostHog) produce kits que, reinstalados, compilan. Pendiente repetirlo con `mobile-expo`, `saas-next-supabase` y `chrome-extension`.
- ✅ Un kit con `extends: "landing-next"` y tres líneas propias instala lo de `landing-next` más su cambio (comprobado con `--dry-run`).
- ⏳ `create-first-commit landing-next@<versión anterior>`: la descarga por etiqueta necesita el repo publicado (fase 8). En local se comprueba la versión pedida contra la disponible.
- ✅ Los tests pasan en local (30 tests). Ejecutarlos en CI es parte de la fase 8.

## Fuera de alcance

Publicar desde la web (fase 3). Probar kits automáticamente (fase 2).
