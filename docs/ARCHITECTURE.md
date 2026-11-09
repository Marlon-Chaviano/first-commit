# Arquitectura

## Visión general

```
 create-first-commit (CLI)            apps/web (Next.js 16, Vercel Hobby)
 ─────────────────────────            ───────────────────────────────────
 crea ── plan ── ejecuta              /                 ranking (Postgres, caché 5 min)
   │                                  /kits/[name]      configurador + stats
   └─ POST /api/v1/events ──────────▶ /api/v1/events    valida (zod) → rate limit → LPUSH
        (anónimo, 1.5 s, no bloquea)         │  1 comando de Redis por evento
                                             ▼
                                      Upstash Redis: lista kits:queue:events
                                             │
                                             │ cada 10 min (schedule de QStash)
                                             ▼
                                      /api/cron/flush-events → lotes de 500 → Postgres
                                        install_events (crudo) · kit_stats_daily (rollup)
                                             │
                                             ▼
                                      ranking, tendencia, sparklines, únicos, desglose
                                      (consultas SQL cacheadas con "use cache")
```

## Decisiones

| Pieza | Elección | Por qué |
| --- | --- | --- |
| Búfer de eventos | **Upstash Redis** (REST), una lista | Funciona en serverless sin pool de conexiones y absorbe picos. **Un solo `LPUSH` por evento**: es lo que cabe en el plan gratuito (ver presupuesto). |
| Contadores | **Postgres** (Neon) + Drizzle | Ranking, tendencia de 24 h, sparklines, únicos (`count(distinct anon_id)`), desglose de opciones (`jsonb_each`) y retención se calculan en SQL sobre `install_events` y `kit_stats_daily`. Las páginas no leen Redis. |
| Cola | Lista de Redis + schedule de **QStash** cada 10 min | Desacopla la escritura a Postgres del request del CLI y agrupa inserts. Entrega al-menos-una-vez; los duplicados se ignoran por `id`. |
| Caché de lectura | `"use cache"` + perfil `cacheLife("metrics")` (5 min) + `cacheTag("metrics")` | Una consulta a Postgres por página cada 5 minutos como máximo. Los números van hasta ~15 min por detrás del CLI. |
| Disparo de trabajos | **QStash** (no Vercel Cron) | El cron de Vercel necesita Pro para ejecutarse más de una vez al día. La ruta acepta la firma de QStash (`POST`) o `Bearer CRON_SECRET` (`GET`). |
| Rate limit | `@upstash/ratelimit` | Falla abierto. No funciona contra el Redis local (sus scripts usan un flag exclusivo de Upstash), así que en local está desactivado. |
| Telemetría | Anónima, opt-out `DO_NOT_TRACK=1` | ID aleatorio por máquina. Sin nombres de proyecto, rutas ni IP. |

### Claves de Redis (`apps/web/src/server/metrics/keys.ts`)

| Clave | Tipo | Uso |
| --- | --- | --- |
| `kits:queue:events` | list | búfer hacia Postgres (se vacía cada 10 min) |
| `kits:rl:*` | (ratelimit) | límites por IP o usuario |

### Presupuesto de Upstash (plan gratuito)

Límites comprobados el 2026-11-05: **Redis** 500.000 comandos/mes, 250 MB, 10 GB de transferencia; **QStash** 1.000 mensajes/día y 10 schedules (cada reintento cuenta como un mensaje). Revísalos antes de desplegar: cambian.

| Consumo | Comandos | Al mes |
| --- | --- | --- |
| Cada evento del CLI (`init`, `update`, `add`) | `LPUSH` + rate limit ≈ 2 | ≈ 2 × eventos |
| Vaciado (QStash cada 10 min) | `LRANGE` (+ `LTRIM` si había eventos) | ≤ 8.700 |
| Rate limit de publicar, denunciar, recomendar y newsletter | 1–2 por petición | bajo |
| Páginas de la web | 0 | 0 |

**Capacidad: unos 240.000 eventos al mes gratis** (antes eran ~30 comandos por instalación, ~16.000). QStash: 2 schedules (vaciado: 144 mensajes/día; newsletter: 4 al mes) de 10 y de 1.000 diarios. La cola ocupa unos KB porque se vacía cada 10 minutos.

Si algún día se pasa del gratuito: Redis pay-as-you-go cuesta 0,20 $ por 100.000 comandos (1 millón de eventos ≈ 4 $/mes). El siguiente límite es el de Neon (0,5 GB): `install_events` ocupa ~0,7 KB por evento, unos 700.000 eventos; a partir de ahí, resumir y borrar eventos crudos antiguos.

## Confianza: verificaciones, integridad y auditorías

| Pieza | Cómo funciona |
| --- | --- |
| `create-first-commit test` | Instala el kit con cada combinación de `testCombinations()` (valores por defecto + `verify.matrix` o una variante por opción) en carpetas temporales, ejecuta `verify.command` y escribe un informe (`verificationReportSchema`). Los skills se comprueban una vez, aparte. |
| Verificaciones | `create-first-commit test --upload` en GitHub Actions envía el informe con un token **OIDC de GitHub** (`aud` = `VERIFICATION_AUDIENCE`). `POST /api/v1/verifications` valida la firma con las claves públicas de GitHub y solo acepta kits del repositorio del token (`canVerify`). Tabla `kit_verifications`; la insignia sale de la última prueba por plataforma (`getVerification`). |
| Integridad | `registry/integrity.json` guarda el SHA-256 de cada kit oficial por versión. Una versión publicada (con etiqueta de git) no puede cambiar sin subir `version`. El CLI comprueba el hash al descargar. |
| Avisos en el CLI | `kitTrust()`: local y oficial son de confianza; un kit de la comunidad sin verificar pide confirmación aparte y, con `-y`, exige `--allow-commands`. |
| Auditorías | `getSkillAudits()` consulta el endpoint que usa el CLI de skills (`skills.sh/tele/audit`), sin documentar: si falla, no se muestra nada. Caché de un día. |
| Denuncias | `POST /api/v1/reports` → `kit_reports` (IP solo como hash con sal). Email al equipo con Resend si `RESEND_API_KEY` y `REPORTS_EMAIL` existen. |

## Cuentas y registro de la comunidad

| Pieza | Cómo funciona |
| --- | --- |
| Cuentas | Better Auth (Drizzle). GitHub en producción; `handle` = login de GitHub, obtenido de su API al vincular la cuenta. `handle` y `role` son solo de servidor. Admins: `ADMIN_HANDLES`. |
| Registro | Oficiales: `registry/` (archivos). Comunidad: `kits` + `kit_versions` en Postgres, con el `kit.json` original, el commit y el hash de integridad de cada versión. `getKitPage()` resuelve `extends` contra padres oficiales o publicados. |
| Publicar | `publishKit()`: el usuario debe poder hacer push al repo (API de GitHub con su token), el ref se fija a un commit, el kit se valida como lo leerá el CLI y el slug es `<handle>/<nombre>`. Versiones inmutables. |
| CLI | `create-first-commit login` guarda un token (`kits_…`, solo su hash en la base). Para `usuario/kit`, el CLI pregunta a `/api/v1/kits/<slug>`, descarga el repo en el commit publicado y comprueba la integridad; si no está publicado, lo trata como ruta de GitHub. |
| Caché | Listados y páginas de kits: `cacheTag("registry")` y `kit:<slug>`. Publicar o moderar invalida con `{ expire: 0 }` (la siguiente visita ya ve el cambio). |

## Trabajos programados con QStash

QStash ya dispara el vaciado de la cola. Los trabajos nuevos (validar kits de la
comunidad, recalcular rankings pesados, enviar webhooks) siguen el mismo patrón:
una ruta en `app/api/cron/` que llama a `isAuthorizedJob` (`src/server/jobs/auth.ts`)
y un schedule o un `publishJSON` de QStash. El skill `upstash-qstash-js` está
instalado en el proyecto.

- Crear o actualizar el schedule: `SITE_URL=… QSTASH_TOKEN=… pnpm --filter web qstash:schedule` (idempotente, `scheduleId` fijo).
- En local: `npx @upstash/qstash-cli dev` en otra terminal, `QSTASH_DEV=1` en `.env.local` y la web con `pnpm dev:web` (el modo dev de QStash no funciona con `next start`).

## Coste: todo en planes gratuitos

Es un proyecto personal, así que la arquitectura está pensada para no pagar nada mientras el tráfico sea moderado. Comprueba los límites actuales de cada proveedor antes del despliegue (cambian con el tiempo).

| Servicio | Uso de kits | Notas |
| --- | --- | --- |
| Vercel Hobby | Web y API | Sin crons frecuentes (los hace QStash). **Hobby no permite uso comercial**: los planes de pago de la fase 7 obligarían a pasar a Pro o a otro proveedor. |
| Upstash QStash | 144 mensajes/día (vaciado) + 4/mes (newsletter) | Límite gratuito: 1.000/día y 10 schedules. |
| Upstash Redis | ~2 comandos por evento del CLI + ≤ 8.700/mes del vaciado | Unos 240.000 eventos al mes en el plan gratuito (500.000 comandos). Ver «Presupuesto de Upstash». |
| Neon Postgres | Eventos crudos y resumen diario | Inserts por lotes cada 10 min; la web no lee Postgres en cada visita. |
| Sentry | Errores de la web | Plan Developer. |
| Stripe (opcional) | Planes Pro y Equipos, kits de pago (Connect) | Sin cuota fija: comisión por cobro. **Cobrar exige salir de Vercel Hobby** (no admite uso comercial): Vercel Pro u otro proveedor. Desactivado sin `STRIPE_SECRET_KEY`. |
| Resend | Confirmaciones y newsletter semanal | Plan gratuito con límite diario: con muchos suscriptores, enviar por tandas o pasar de plan. |
| xAI API (opcional) | "Describe tu proyecto" y `recommend_kit` | **Lo único que puede costar dinero.** Sin `XAI_API_KEY` responde el recomendador por palabras clave (gratis). Con clave: Grok (`RECOMMEND_MODEL`), temperatura 0, `max_tokens` 600, timeout de 15 s, el catálogo primero y siempre igual para que lo sirva la caché de prompts de xAI, respuesta cacheada por descripción normalizada (`"use cache"`, días) y 24 peticiones al día por IP, compartidas entre la web y `recommend_kit` del MCP remoto. |

## Agentes (fase 6)

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| Servidor MCP | `packages/mcp` (`createKitsServer`) | Herramientas `search_kits`, `get_kit`, `recommend_kit`, `plan_init`; con acciones locales también `init_kit` (pide `approved: true`) y `add_library`. |
| MCP local | `create-first-commit mcp` (stdio, SDK v2 `serveStdio`) | Lee el registro como el resto del CLI y ejecuta `init`/`add` lanzándose a sí mismo sin TTY. stdout es el protocolo: no se imprime nada más. |
| MCP remoto | `apps/web/src/app/mcp/route.ts` (`createMcpHandler`, sin estado) | Solo lectura: oficiales y comunidad desde la base de datos; nunca ejecuta comandos. |
| Recomendador | `packages/schema/src/recommend.ts` + `apps/web/src/server/recommend/` | Grok con salida estructurada (JSON Schema estricto desde zod), validación con `resolveRecommendation` (añade requisitos, descarta ids desconocidos) y un reintento con el error; si falla o no hay clave, el recomendador por palabras clave. Siempre devuelve una combinación válida de un kit oficial. |
| Skill | `skills/kits/SKILL.md` (generado desde `scripts/skill-template.md` con `BRAND`) | Enseña al agente a crear y mantener proyectos. Los kits lo instalan cuando `KITS_SKILL_PUBLISHED` es `true` (fase 8). |

## Crecimiento y negocio (fase 7)

| Pieza | Dónde | Notas |
| --- | --- | --- |
| Stacks | `registry/stacks.json` (curados, validados en `registry:index`) + combinaciones con ≥ 10 instalaciones de Postgres | `/stacks/<slug>` con JSON-LD `SoftwareSourceCode`; el número es de instalaciones que incluyen esas opciones (`options @> …`). |
| Comparativas | `/comparar/<a>-vs-<b>` | Pares de la misma categoría que comparten framework; datos del catálogo y del desglose de opciones (Postgres). |
| SEO | `sitemap.ts`, `robots.ts`, `/llms.txt`, RSS en `/novedades/rss.xml` | Solo contenido público. |
| Insignia | `/badge/<kit>.svg` | 404 para kits privados. |
| Newsletter | `newsletter_subscribers` (doble opt-in), `newsletter_issues` (una por semana ISO), job `/api/cron/newsletter` (QStash, lunes) | Bajas firmadas con HMAC (`List-Unsubscribe` de un clic). |
| Organizaciones | `orgs`, `org_members`; `kits.visibility`/`org_id` | El slug de la org es su espacio de nombres (comparte espacio con los usuarios). Política de bibliotecas en `orgs.policy`, comprobada por `create-first-commit doctor` vía `/api/v1/orgs/<org>/policy`. |
| Archivos de kits | `kit_versions.archive` (`packDir`: JSON comprimido, máx. 5 MB) | Todos los kits de la comunidad publicados se sirven desde aquí (`?archive=1`), con la misma integridad. Así un kit privado o de pago no depende de GitHub. |
| Planes | `subscriptions`, `stripe_events`, `server/plans.ts` | Checkout + Customer Portal; asientos de Equipos sincronizados al cambiar miembros. |
| Kits de pago | `kits.price_cents`, `creator_accounts` (Connect Express), `licenses` | Cargo con destino al creador menos `PLATFORM_FEE_PERCENT`; reembolso desde `/admin` (revierte la transferencia y la comisión); disputas revocan la licencia. |

## Escalar

- **Mucho tráfico de lectura**: las páginas leen Postgres con caché de 5 min; subir `cacheLife("metrics")` si Neon se queda corto. Redis no se toca.
- **Mucho tráfico de escritura**: un evento = un `LPUSH`. Si el vaciado se queda corto, aumentar `maxBatches` o la frecuencia del schedule (sin pasar de 1.000 mensajes de QStash al día).
- **Más eventos que el plan gratuito de Redis** (~240.000/mes): pasar a pay-as-you-go (0,20 $ por 100.000 comandos) o agrupar eventos en el CLI.
