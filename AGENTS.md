# first-commit — guía para agentes

Registro de *workspace kits*: una web (catálogo + configurador) y un CLI (`create-first-commit`) que crean un proyecto con dependencias, skills y MCP ya configurados. Arquitectura y métricas: `docs/ARCHITECTURE.md`. Plan por fases: `docs/roadmap/` (empieza por su README).

## Estructura

```
packages/schema/        Fuente única del formato kit.json, resolución de opciones, planificador
                        (buildPlan), generador del comando, verify y eventos. Lo usan web y CLI.
  src/load.ts           loadKitFrom(top, source): extends → parse → catálogo (→ admitir). Toda carga de kits pasa por aquí
  src/selections.ts     selectionsFrom(kit, petición, política): la única forma de construir Selections
  src/package-managers.ts  Una fila por gestor de paquetes (lenguaje, exec, add, lockfiles, CI)
  src/node/registry.ts  registrySource(dir) y loadRegistryKits(dir): la carpeta registry/ como fuente (tests, scripts)
packages/cli/           CLI create-first-commit: args → registry (descarga + extends) → plan → exec → telemetry
  src/create/           `create-first-commit create`: detecta framework, bibliotecas, skills, MCP… y escribe un kit
  src/kit-location.ts   locateKit: decide de dónde viene un kit y cómo se verifica (puro, con tests)
  src/test.ts           `create-first-commit test`: instala combinaciones, ejecuta verify y sube el informe (OIDC)
  src/update.ts, add.ts, doctor.ts, lockfile.ts, notice.ts
                        Retención: kits.lock, actualizar sin pisar cambios, añadir del catálogo, diagnosticar
  src/mcp.ts            `create-first-commit mcp`: servidor MCP por stdio (stdout es el protocolo: no imprimas nada)
packages/mcp/           Servidor MCP compartido (createKitsServer): lo usan `create-first-commit mcp` y la web (/mcp, solo lectura)
skills/kits/            Skill para agentes. Generado desde scripts/skill-template.md: no lo edites a mano
actions/verify/         GitHub Action para que los creadores verifiquen su kit
registry/kits/<kit>/    Kits oficiales: kit.json + carpetas de archivos
registry/libraries.json Catálogo común de bibliotecas por categoría (UI, animación, auth, base de datos,
                        pagos, email, i18n, IA, observabilidad, tests, calidad, CI, despliegue) y framework.
                        Las categorías están en packages/schema/src/categories.ts; expandKit() las
                        convierte en opciones del kit.
apps/web/src/
  app/                  Solo rutas (páginas y route handlers). Sin lógica de negocio.
    api/v1/             API pública versionada (events, skills)
    api/cron/           Trabajos programados: los dispara QStash (firma verificada) o un GET con CRON_SECRET
  features/<dominio>/   UI con estado de un dominio (kits: ranking, configurador)
  components/ui/        Componentes shadcn (generados; edítalos solo para el sistema de diseño)
  components/layout/    Cabecera, pie, logo
  components/shared/    Piezas reutilizables (Command, CopyButton, Sparkline)
  server/               Código solo de servidor ("server-only"): env, redis, db, registry (oficial +
                        comunidad), auth (Better Auth), session, tokens, publish, accounts,
                        metrics, verifications (OIDC), audits, reports, jobs
  features/account/     Acciones de servidor y UI de cuenta, publicación y moderación
  features/orgs, billing, newsletter, recommend
                        Organizaciones, planes y kits de pago (Stripe), newsletter y "Describe tu proyecto"
  emails/               Plantillas de React Email (blanco y negro, estilos en línea)
  lib/                  Utilidades puras compartidas cliente/servidor (kit-query: búsqueda y facetas de kits)
docs/                   Arquitectura (ARCHITECTURE.md) y roadmap por fases (roadmap/)
```

## Reglas

- **UI**: siempre componentes de shadcn (`pnpm dlx shadcn@latest add <comp>` dentro de `apps/web`). Nada de colores crudos: solo tokens semánticos (`bg-background`, `text-muted-foreground`, `border-border`…). El diseño es **solo blanco y negro**, inspirado en skills.sh (única excepción: los colores de estado `--success`, `--info`, `--warning` y `--destructive`, solo para feedback: toasts y el nivel de riesgo de las auditorías): títulos de sección con la utilidad `label-mono`, Geist + Geist Mono.
- **Next.js 16** con Cache Components: lee `apps/web/node_modules/next/dist/docs/` antes de usar APIs de caché o de rutas. Los datos se cachean con `"use cache"` + `cacheLife` + `cacheTag`.
- **Servidor**: todo lo que toque Redis, Postgres o secretos va en `src/server/` con `import "server-only"`. Todo servicio es opcional: sin variables de entorno la web debe seguir funcionando.
- **Cuentas**: la sesión se lee con `getViewer()` (páginas y acciones) o `getRequestUser()` (route handlers: sesión o token `kits_…`), siempre dentro de `<Suspense>`. Toda acción comprueba permisos en el servidor (dueño o `isAdmin`). `handle` y `role` nunca se aceptan como entrada.
- **Desarrollo local**: `DEV_LOGIN=1` permite entrar con email y contraseña y publicar desde una carpeta (`create-first-commit publish --local`); nunca en producción.
- **Bibliotecas**: para añadir una biblioteca (de cualquier categoría), edita `registry/libraries.json` (no los kits) siguiendo `CONTRIBUTING.md`. Verifica el paquete en su registro (npm, PyPI, proxy de Go), usa solo skills oficiales de la organización de la biblioteca, que sus archivos compilen sin claves en `.env` y añádela a `verify.matrix` de un kit: entra solo si pasa `create-first-commit test`. Para probar contra el registro local: `KITS_REGISTRY="$PWD/registry"`.
- **Tests**: la lógica de `packages/schema` y `packages/cli` lleva tests junto al código (`*.test.ts`). Añádelos al cambiar resolución de opciones, `extends`, `writeFiles` o detectores.
- **Kits**: cada cambio en un kit oficial sube su `version`. Tras editar `registry/kits/*` o el catálogo, ejecuta `pnpm registry:check` (valida el esquema y que cada skill exista).
- **Marca**: el producto se llama **first-commit** (dominio `first-commit.dev`, paquete del CLI `create-first-commit`, comando global `first-commit`). Todo vive en `packages/schema/src/brand.ts`: nunca lo escribas a mano en el código, usa `BRAND`, `cliCommand()`, `REPO_URL` o `REGISTRY_RAW_BASE`. En texto visible de la web, el nombre va con `<BrandName />` (Geist Mono Medium, como el wordmark del logo); en títulos, metadatos y comandos, como texto plano. "Kit" sigue siendo el nombre de las plantillas (`kits.lock`, `KITS_TOKEN`, `registry/kits/`).
- **Coste cero**: el proyecto es personal y se despliega en planes gratuitos (Vercel Hobby, Upstash Redis y QStash, Neon). No uses crons de Vercel (usa QStash). **Redis es solo la cola de eventos y los rate limits**: cada evento del CLI es un `LPUSH`, y los contadores se calculan en Postgres con `"use cache"` (perfil `metrics`). No añadas lecturas ni contadores en Redis sin rehacer el presupuesto de `docs/ARCHITECTURE.md` (500.000 comandos/mes).
- **Iconos de marcas**: logos de agentes y lenguajes con `TechIcon` (Simple Icons, monocromo en `currentColor`); importa solo los que uses. Codex no tiene logo público: usa el icono de terminal.
- **Lenguajes**: cada kit declara `language` (o se deduce de su gestor de paquetes con `kitLanguage`). Un lenguaje nuevo va en `packages/schema/src/languages.ts` con su icono.
- **Perfiles de marca**: `brandProfileSchema` y los generadores (`BRAND.md`, tokens, CSS, bloque de AGENTS.md) están en `packages/schema/src/brand-profile.ts`; el CLI los aplica en `src/brand.ts` solo dentro de bloques gestionados (`kits-brand`). Son privados: dueño o miembros de la organización.
- **IA**: el recomendador (`src/server/recommend/`) es opcional y es lo único que puede costar dinero: usa Grok de xAI (`XAI_API_KEY`, modelo en `RECOMMEND_MODEL`) y sin clave responde el de palabras clave (`recommendHeuristic`). Toda respuesta de un modelo pasa por `resolveRecommendation` antes de usarse. Si cambias el catálogo o las pistas, `recommend.eval.json` debe seguir en ≥25/30 con el heurístico, y mide Grok con `XAI_API_KEY=… pnpm --filter web recommend:eval`.
- **Visibilidad**: un kit `visibility: "org"` solo lo ven sus miembros. Lo que liste o exponga kits sin sesión (ranking, sitemap, MCP remoto, stacks, recomendador, perfiles, newsletter, insignias) usa `getKit` o filtra `visibility = 'public'`; una página o API de un kit concreto comprueba `canReadKit`. Un kit privado nunca puede ser padre (`extends`) de uno público.
- **Gratis por ahora**: sin `STRIPE_SECRET_KEY` todo es gratis; usa `effectivePlan(plan, billingEnabled)` antes de `planAllows` y oculta lo de pago con `billingEnabled`. El único límite es el anti-spam (`MAX_KITS_PER_ACCOUNT`).
- **Pagos**: Stripe es opcional (`stripe` es null sin `STRIPE_SECRET_KEY`). Los webhooks son la única fuente de verdad del plan y de las licencias; cada evento se aplica una vez (`stripe_events`) y uno antiguo no pisa uno nuevo. Los límites del plan se comprueban en el servidor con `planAllows`. Pruebas: `docker compose up -d stripe-mock` y `KITS_INTEGRATION=1 pnpm vitest run apps/web/src/server/billing.integration.test.ts`.
- **MCP**: las herramientas que ejecutan comandos solo existen en el servidor local y piden aprobación (`approved: true`) tras enseñar `plan_init`. El remoto nunca ejecuta nada.
- **Puerto**: la web arranca en **3200** (`pnpm dev:web`).

## Comandos

```bash
docker compose up -d                     # Postgres :5433, Redis :6380, API REST de Redis :8079, stripe-mock :12111
cp apps/web/.env.example apps/web/.env.local
pnpm --filter web db:migrate             # tablas de métricas
pnpm dev:web                             # http://localhost:3200
npx @upstash/qstash-cli dev              # QStash local (con QSTASH_DEV=1 en apps/web/.env.local)
pnpm build && pnpm typecheck
pnpm test                                # Vitest (schema y CLI)
pnpm --filter web lint
pnpm --filter web audit                  # Lighthouse con presupuestos (≥ 90); CHROME_PATH si no hay Chrome
```
