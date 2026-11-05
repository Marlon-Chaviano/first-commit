# Fase 8 — Despliegue y lanzamiento

## Objetivo

Poner en producción todo lo construido en las fases 1–7: cualquiera puede ejecutar `npx create-first-commit mobile-expo`, la web está online, las instalaciones se cuentan de verdad y el producto está operado (alertas, backups, soporte).

## Por qué al final

Por decisión del proyecto, toda la creación de cuentas y servicios externos (GitHub, npm, Vercel, Upstash, Neon, Sentry, dominio) se hace en esta fase. Las fases 1–7 se desarrollan y prueban en local con `docker compose` (Postgres y Redis), con el registro local (`KITS_REGISTRY=./registry`) y con `KITS_API_URL=http://localhost:3200`. Mientras tanto, el CLI apunta a un repo y a un dominio que todavía no existen: es lo esperado.

## Decisiones

| Decisión | Estado | Consecuencia |
| --- | --- | --- |
| **Nombre y dominio** | **Cerrada (2026-11-05): first-commit.** Dominio `first-commit.dev` (libre en el registro de .dev ese día; falta comprarlo), paquete de npm `create-first-commit` (el nombre `first-commit` está ocupado), comando global `first-commit`. | Todo vive en `packages/schema/src/brand.ts`. Las plantillas se siguen llamando "kits". |
| **Repo** | **Cerrada: público.** Monorepo con `registry/` dentro. | `giget` descarga los kits oficiales del repo y la web lee `registry/` en el build. `BRAND.repo` debe coincidir con el repo final. |
| **Plan de Vercel** | **Cerrada: Hobby (gratis) + QStash.** El proyecto es personal y el objetivo es coste cero. | No hay `vercel.json` con crons: el vaciado de la cola lo dispara un schedule de QStash (cada 10 min, 144 mensajes/día, plan gratuito). Si la fase 7 activa cobros, Hobby deja de servir (no admite uso comercial) y habrá que revisarlo. |

### Checklist para cerrar el nombre

- [ ] Comprobar que el nombre del paquete está libre en npm (`npm view <nombre>` → 404).
- [ ] Comprobar dominio disponible y comprarlo.
- [ ] Comprobar que no choca con una marca conocida del sector.
- [ ] Actualizar `BRAND` y `packages/cli/package.json`, regenerar el registro y revisar la web.

## Diseño técnico

**Repositorio y CI** (`.github/workflows/`)
- `ci.yml` en cada PR: `pnpm install`, `pnpm typecheck`, `pnpm --filter web lint`, `pnpm build`, `pnpm registry:index` y comprobar que `registry/index.json` no cambia (si cambia, falta regenerarlo).
- `registry-check.yml` semanal y en PRs que toquen `registry/`: `pnpm registry:check`. Es lento (clona repos), así que va en su propio workflow.
- `e2e.yml`: tests de Playwright contra la web (ver Tareas).

**Publicación del CLI**
- Changesets para versionar `packages/cli` y generar el CHANGELOG.
- Workflow `release.yml`: al fusionar el PR de versión, `pnpm --filter create-first-commit build` y `npm publish --provenance` (procedencia firmada por GitHub OIDC).
- `VERSION` en `packages/cli/src/index.ts` debe leerse de `package.json` en el build (hoy está fija en `0.1.0`).

**Infraestructura de producción**
- Upstash Redis, **plan Free** (una base de datos, la región más cercana a la de Vercel) → `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. Solo guarda la cola de eventos y los rate limits; los contadores están en Postgres (ver «Presupuesto de Upstash» en `docs/ARCHITECTURE.md`).
- En la consola de Upstash, activar los avisos por email de uso y revisar el consumo el primer mes: lo esperado es ~2 comandos por evento del CLI y ≤ 8.700 al mes del vaciado.
- Neon Postgres (rama `main` para producción, ramas por PR) → `DATABASE_URL`. Ejecutar `pnpm --filter web db:migrate` en el deploy.
- `CRON_SECRET` en Vercel (para lanzar el vaciado a mano) y las claves de firma de QStash.
- El rate limit de `/api/v1/events` solo funciona contra Upstash real: verificarlo en producción.

**La web observándose a sí misma**: Sentry y Vercel Analytics en `apps/web`, con las mismas piezas del catálogo.

**Legal mínimo**: página `/privacidad` que explique la telemetría del CLI (qué se envía, que es anónima y cómo desactivarla con `DO_NOT_TRACK=1`), enlazada desde el pie y desde `create-first-commit --help`.

## Operación

- **Monitorización**: Sentry (errores y rendimiento) en web y API; alertas sobre la tasa de errores de `/api/v1/events`, la longitud de la cola `kits:queue:events` y fallos del cron.
- **Página de estado** (por ejemplo, Better Stack o Instatus) con el estado de la API, el registro y la descarga de kits.
- **Copias de seguridad**: PITR de Neon activado; prueba trimestral de restauración. Redis no guarda contadores (solo la cola, que se vacía cada 10 min), así que no hay nada que reconstruir: basta con Postgres.
- **Límites y abuso**: rate limits por usuario y por IP en todas las rutas de escritura; protección de bots en registro y publicación.
- **Legal**: términos de uso (incluidas las responsabilidades del creador sobre lo que ejecuta su kit), política de privacidad actualizada (cuentas, pagos, telemetría), aviso de cookies si se añade analítica con cookies, y política de retirada de contenido.
- **Soporte**: email de soporte, formulario en la web y documentación de problemas frecuentes.
- **Rendimiento**: presupuestos de Core Web Vitals en CI (skills `core-web-vitals` y `performance`).

## Tareas

- [ ] Crear el repo en GitHub y subir el monorepo (incluye `.agents/`, `.claude/skills` y `skills-lock.json`).
- [ ] Workflows `ci.yml`, `registry-check.yml`, `e2e.yml` y `release.yml`.
- [ ] Configurar Changesets y la versión del CLI desde `package.json`.
- [ ] Publicar `create-first-commit@0.1.0` en npm (cuenta y 2FA del usuario).
- [ ] Crear el cliente OAuth de Google (Google Cloud Console → Credenciales; callback `https://first-commit.dev/api/auth/callback/google`) y poner `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` en Vercel.
- [ ] Crear Upstash Redis (Free) y Neon Postgres; variables en Vercel; migración aplicada.
- [ ] Comprar `first-commit.dev` y publicar el CLI en npm como `create-first-commit`; crear el repo `Marlon-Chaviano/first-commit`.
- [ ] Desplegar `apps/web` en Vercel (Root Directory `apps/web`, con acceso a archivos fuera del root para leer `registry/`).
- [ ] Crear QStash en Upstash, poner `QSTASH_CURRENT_SIGNING_KEY` y `QSTASH_NEXT_SIGNING_KEY` en Vercel y ejecutar `SITE_URL=https://<dominio> QSTASH_TOKEN=… pnpm --filter web qstash:schedule`. Comprobar en el panel de QStash que las llamadas responden 200.
- [ ] Nombre y dominio definitivos en `BRAND` (ver checklist de arriba) antes de publicar en npm.
- [ ] Sentry y Vercel Analytics en la web.
- [ ] Página `/privacidad` y enlace en `--help`.
- [ ] Tests e2e de Playwright: la home lista los kits; la búsqueda filtra; en el configurador, cambiar opciones cambia el comando; las opciones incompatibles quedan desactivadas; `POST /api/v1/events` responde 202 con un evento válido y 400 con uno inválido.
- [ ] Probar en una máquina limpia `npx create-first-commit@latest init` de los 5 kits.
- [ ] Alertas (incluido el uso de Upstash), página de estado y backups probados.
- [ ] Email y formulario de soporte.
- [ ] Desplegar lo construido en las fases 1–7 (tablas, cuentas de Stripe en modo live, GitHub OAuth app, MCP remoto) y repetir sus criterios de aceptación en producción.

## Criterios de aceptación

- `npx create-first-commit@latest init landing-next demo -y` funciona en una máquina sin el repo y el proyecto compila.
- La instalación aparece en el ranking de la web en menos de 6 minutos (caché `metrics` de 5 min) y en Postgres tras la siguiente ejecución del schedule (≤ 10 min).
- `pnpm registry:check` pasa en CI.
- El rate limit devuelve 429 en producción tras 30 eventos por minuto desde una IP.
- Un error forzado en la web aparece en Sentry.
- Restaurar Postgres desde un backup devuelve el ranking al estado anterior (los contadores viven solo en Postgres).
- Si el schedule de QStash falla (respuesta distinta de 200 o cola creciendo), se recibe una alerta en menos de 30 minutos.
- Todo el stack funciona en planes gratuitos (Vercel Hobby, Upstash Redis y QStash, Neon, Sentry Developer).
- **Todas las fases 1–7 cumplen sus criterios de aceptación en producción: el producto está completo.**

