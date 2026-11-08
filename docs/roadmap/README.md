# Roadmap de first-commit

Cada archivo es una fase. Se hacen en orden. Las fases 1–7 se desarrollan y prueban en local (sin cuentas externas); la fase 8 crea las cuentas, despliega todo y lo opera. Al cerrar la fase 8, first-commit es un producto completo y operativo, con creadores, usuarios recurrentes, agentes que lo usan solos e ingresos.

| Fase | Archivo | Resultado al terminarla |
| --- | --- | --- |
| 1 🟡 | [01-creadores.md](01-creadores.md) | Cualquier dev convierte su repo en un kit con `create-first-commit create` y hace variantes con `extends`. Los kits tienen versiones. |
| 2 🟡 | [02-confianza.md](02-confianza.md) | `create-first-commit test`, GitHub Action e insignia **Verificado**. Seguridad visible en cada kit. |
| 3 🟡 | [03-cuentas-y-publicacion.md](03-cuentas-y-publicacion.md) | Login con GitHub, publicar desde la web, registro respaldado por base de datos, perfiles de creador con estadísticas. |
| 4 ✅ | [04-retencion.md](04-retencion.md) | Los proyectos siguen conectados al kit: `kits.lock`, `create-first-commit update`, `create-first-commit add` y `create-first-commit doctor`. |
| 5 🟡 | [05-catalogo.md](05-catalogo.md) | Catálogo con auth, ORM, testing, CI/CD, i18n, IA y kits para otros lenguajes. |
| 6 🟡 | [06-agentes.md](06-agentes.md) | MCP de kits, skill `kits` en skills.sh y recomendador con Claude. |
| 7 🟡 | [07-crecimiento-y-negocio.md](07-crecimiento-y-negocio.md) | SEO programático, equipos con registro privado, kits premium y facturación (Stripe en modo test). |
| 8 | [08-despliegue.md](08-despliegue.md) | Cuentas creadas (GitHub, npm, Vercel Hobby, Upstash, Neon, Sentry, dominio; Anthropic opcional), todo en producción y operado: alertas, backups, soporte. |
| 9 | [09-compartir.md](09-compartir.md) | Cada proyecto, configuración y creador trae visitas: insignia en el README, enlaces cortos con tarjeta, ⌘K, vista previa, remix, comparador de kits y extensión de VS Code / Cursor. |

## Cómo usar estos archivos

- Cada fase tiene **Tareas** (checklist) y **Criterios de aceptación**. Una fase está cerrada cuando se cumplen todos los criterios, no cuando se marcan todas las tareas.
- Los nombres de archivos y módulos se refieren a la estructura descrita en `AGENTS.md` y `docs/ARCHITECTURE.md`. Si el código cambia, actualiza la fase pendiente antes de empezarla.
- Las decisiones abiertas están marcadas con **Decisión:**. Resuélvelas al empezar la fase y anota la elección en el propio archivo.

## Desarrollo local de las fases 1–7

`docker compose up -d` (Postgres y Redis), `KITS_REGISTRY=$PWD/registry` para el CLI y `KITS_API_URL=http://localhost:3200` para la telemetría. Nada requiere cuentas externas hasta la fase 8.

## Estado

- **Fase 4** ✅ completa en local: `kits.lock`, `update`, `add`, `doctor`, aviso de versión y telemetría de retención, con todos sus criterios comprobados.
- **Fase 3** 🟡 desarrollada: cuentas (Better Auth), publicación desde la web y el CLI, registro en Postgres, perfiles, estadísticas del dueño, filtros y moderación. Falta lo que necesita la app OAuth de GitHub y un repo real (fase 8).
- **Fase 2** 🟡 desarrollada: `create-first-commit test`, verificaciones firmadas con OIDC, insignia, integridad, auditorías, denuncias y avisos del CLI. Falta ejecutar `create-first-commit test` en los 4 kits restantes y todo lo que necesita GitHub y la API desplegada (fase 8).
- **Fase 1** 🟡 desarrollada: `create-first-commit create`, `extends`, versiones, docs para creadores y tests. Falta probar `create` con 3 de los 5 kits y la descarga por etiqueta (necesita el repo publicado, fase 8). Detalle en su archivo.

## Punto de partida (antes de la fase 1)

Funciona en local: web en el puerto 3200 (ranking, configurador, docs), CLI `create-first-commit` (`init`, `list`, `info`, `--dry-run`), 5 kits oficiales, un catálogo de 46 bibliotecas (componentes, complementos de shadcn, animación, observabilidad), telemetría anónima → Redis → cola → Postgres, y 39 skills instalados en el repo para Claude Code, Codex y Cursor. Nada está publicado todavía.
