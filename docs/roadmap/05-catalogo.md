# Fase 5 — Catálogo completo

## Objetivo

Que casi cualquier stack se pueda montar combinando piezas del catálogo, sin necesitar un kit nuevo para cada combinación, y que haya kits para más lenguajes que TypeScript.

## Por qué

Cada categoría nueva multiplica las combinaciones posibles. Las piezas técnicas ya existen (`libraries` + `writeFiles` + `setupTasks` + `requires`): ampliar el catálogo es sobre todo contenido bien probado.

## Diseño técnico

### Nuevas categorías (`kind` en `librarySchema`)

| Categoría | Opciones iniciales | Notas |
| --- | --- | --- |
| `auth` | Better Auth, Clerk, Supabase Auth, Auth.js | Requiere elegir base de datos en algunos casos (`requires`). |
| `database` | Drizzle + Postgres, Prisma, Neon, Turso, Supabase | Escribe el cliente y la config de migraciones. |
| `testing` | Vitest, Playwright, Testing Library, Jest Expo | Añade scripts a `package.json` (ver abajo). |
| `quality` | Biome, ESLint + Prettier, Husky + lint-staged | |
| `ci` | GitHub Actions (lint, typecheck, test, build) | Usa los scripts de `testing` y `quality` elegidos. |
| `deploy` | Vercel, Fly.io, Railway, Docker / devcontainer, EAS (Expo) | |
| `payments` | Stripe, Polar, Lemon Squeezy | Sale de las opciones propias de cada kit. |
| `email` | Resend, React Email | |
| `i18n` | next-intl, i18next, expo-localization | |
| `ai` | Vercel AI SDK, Claude API (con el skill `claude-api`) | |

`expandKit` pasa a generar una opción por categoría declarada en `libraries` (en vez de las cuatro fijas de hoy), con la etiqueta y el tipo (`select` o `multi`) definidos en una tabla de categorías.

### Nuevo modo de escritura: editar JSON

`writeFiles` gana `mode: "json-merge"` para añadir scripts a `package.json`, plugins a `app.json` o ajustes a `tsconfig.json` sin reescribir el archivo. Fusión profunda; los arrays se unen sin duplicados.

### Kits para otros lenguajes

- `api-fastapi` (Python, uv), `api-go` (Go + chi), `mobile-flutter`, `ios-swiftui`.
- Campo `packageManagers` ampliado (`uv`, `pip`, `go`, `flutter`, `swift`) y `addCommand` por gestor.
- El catálogo gana frameworks `python`, `go`, `flutter` y `swift`, con Sentry y PostHog en sus variantes.

### Contribuciones al catálogo

- Cada biblioteca nueva entra por PR (o desde el panel de admin de la fase 3) y debe pasar `create-first-commit test` con al menos un kit que la use.
- Plantilla de PR con: paquete verificado en el registro de su lenguaje, skill oficial (si existe), archivos y tareas, y prueba de build.

## Decisiones tomadas

- **Tabla de categorías** (`packages/schema/src/categories.ts`): clave en `libraries`, id de la opción, tipo (`select` con "Ninguna" o `multi`) y etiqueta. Añadir una categoría es añadir una fila; `expandKit` y la regla genérica de `AGENTS.md` no cambian.
- **Una entrada por variante** cuando la configuración cambia con la plataforma (Sentry para Next.js, Node, Go y Python; Vitest para Next.js y Node; GitHub Actions para JS, Go y Python). El configurador solo ofrece las del framework del kit.
- **Todo compila sin claves**: los clientes que fallan sin su API key (Resend) se crean al usarlos, para que `build` pase en un proyecto recién creado sin `.env`.
- **Descartados por ahora**: Prisma (la etiqueta `latest` apuntaba a una RC), Auth.js (v5 sin versión estable), Polar y Lemon Squeezy (sin skill oficial ni API verificada), Fly.io y Railway (requieren cuenta para probar el despliegue). Entran por PR cuando se puedan probar.
- **FastAPI con pip + venv** (`.venv/bin/pip`, `requirements.txt` con `pip freeze`): funciona con el Python del sistema. `uv` queda soportado en el CLI (`uv add`) pero sin kit probado.
- **SwiftUI con XcodeGen** (`brew install xcodegen`): el `.xcodeproj` se genera desde `project.yml` y no se versiona, así el agente edita YAML. El kit comprueba que XcodeGen está instalado antes de empezar. Skills de Paul Hudson y Antoine van der Lee (Apple no publica uno oficial).
- **Flutter** queda fuera hasta que haya espacio en disco para su SDK.

## Tareas

- [x] Tabla de categorías y `expandKit` genérico (choque de ids detectado al expandir).
- [x] Modo `json-merge` en `writeFiles`: solo añade claves, une arrays sin duplicados y nunca reescribe un JSON inválido.
- [x] Categorías auth (Better Auth, Clerk), database (Drizzle + Postgres), payments (Stripe), email (Resend, React Email), i18n (next-intl, i18next para Expo), ia (Vercel AI SDK, Claude API), testing (Vitest, Playwright, Jest Expo), quality (Biome, Husky + lint-staged), ci (GitHub Actions para JS, Go y Python) y deploy (Vercel, Docker, EAS).
- [x] Migrar las opciones propias del kit SaaS (pagos, email) al catálogo (`saas-next-supabase` 1.1.0).
- [x] Kits `api-fastapi` y `api-go`, con Sentry y GitHub Actions en su variante.
- [x] Kit `ios-swiftui` (XcodeGen + Swift Testing; gestor `swift`, framework `swiftui`).
- [ ] Kit `mobile-flutter`: no cabe el SDK de Flutter (el disco tiene ~5 GB libres y el SDK con su caché ocupa varios).
- [x] Gestores de paquetes no JavaScript en el CLI: `uv`, `pip` (venv) y `go`, con `addCommand` y `{{pmx}}` por gestor; los skills se instalan siempre con `npx`.
- [x] Plantilla de PR (`.github/pull_request_template.md`) y guía de contribución (`CONTRIBUTING.md`).
- [x] Filtro por categoría y búsqueda por biblioteca en el ranking (`libraries` en `index.json`: "drizzle", "stripe", "sentry"…).
- [x] `/docs/bibliotecas` lista todas las categorías desde la tabla.

## Ampliación (2026-11-05)

- **Más lenguajes y frameworks**, todos verificados con `create-first-commit test`: `web-astro`, `web-sveltekit`, `web-nuxt` (3 combinaciones), `spa-vite-react` (con Tailwind y alias `@/`, 3 combinaciones con shadcn/ui), `api-elysia` (Bun), `api-django`, `web-rails`, `web-laravel` y `api-spring-boot`. En total 17 kits oficiales en TypeScript, Python, Go, Ruby, PHP, Java y Swift.
- Gestores nuevos: `deno`, `bundler`, `composer`, `maven` y `cargo`. Campo `language` en `kit.json` (o deducido del gestor).
- **Skills de trabajo** en todos los kits (categoría `workflow`, activada por defecto y desactivable): Superpowers (brainstorming, planes, TDD, depuración sistemática, verificación, revisión) y `grill-me` e `improve-codebase-architecture` de Matt Pocock.
- Pendientes por herramientas en esta máquina: Rust (el Rust de Homebrew no enlaza con su LLVM: `brew reinstall rust`), Kotlin, Dart/Flutter (espacio en disco), Elixir y C#. Sus páginas de lenguaje existen e invitan a publicar el primer kit.

## Estado de los criterios

- ✅ `saas-next-supabase` con Better Auth + Drizzle + Stripe + Resend + Vitest + Playwright + GitHub Actions + Sentry compila y pasa sus tests (`create-first-commit test`, 221 s). Una segunda combinación (Clerk, React Email, next-intl, Vercel AI SDK, Claude API, Biome, Docker, PostHog) también pasa. Los tests de Playwright no se ejecutan en la verificación (necesitan el navegador); solo Vitest.
- ✅ `create-first-commit test` pasa para cada biblioteca nueva en al menos un kit: `landing-next` (Husky + lint-staged, Vercel, next-intl, Vitest), `mobile-expo` (i18next, Jest Expo, EAS), `api-hono` (Resend, Claude API, Vitest, Biome, GitHub Actions, Docker) y `chrome-extension` (Biome, GitHub Actions), 3 combinaciones cada uno, además de las del SaaS, Go y Python.
- 🟡 Kits de otros lenguajes: `api-go`, `api-fastapi` (2 combinaciones cada uno) e `ios-swiftui` (genera el proyecto y compila app y tests para el simulador: `TEST BUILD SUCCEEDED`) verificados. `mobile-flutter` pendiente de espacio en disco.
- Encontrado aquí: `create-first-commit test` no borraba los proyectos de cada combinación (12 GB acumulados en el directorio temporal). Ahora los borra al terminar cada una; `--keep` los conserva.

## Fuera de alcance

Generar código de negocio (pantallas, endpoints) más allá de la configuración.
