# Fase 4 — Retención: el proyecto sigue conectado al kit

## Objetivo

Que el valor de kits no termine en `init`. El proyecto recuerda de qué kit viene, recibe sus mejoras, puede añadir piezas del catálogo más tarde y comprueba que sigue las reglas.

## Por qué

Hoy un usuario usa kits una vez por proyecto. Con `update`, `add` y `doctor`, lo usa cada semana, y cada mejora de un creador llega a todos sus usuarios.

## Diseño técnico

### `kits.lock` (en la raíz del proyecto, se commitea)

```json
{
  "kit": "landing-next",
  "version": "1.3.0",
  "registry": "https://first-commit.dev",
  "options": { "components": ["shadcn"], "animation": ["motion"] },
  "skills": ["anthropics/skills@frontend-design"],
  "agents": ["claude-code", "cursor"],
  "pm": "pnpm",
  "added": ["sentry-nextjs"],
  "managedFiles": { "src/instrumentation.ts": "sha256…" }
}
```

`init` lo escribe al terminar. `managedFiles` guarda el hash de cada archivo escrito por `writeFiles`, para saber después si el usuario lo ha modificado.

### `create-first-commit update`

- Compara la versión de `kits.lock` con la última del kit y muestra un resumen: skills nuevos o retirados, reglas de `AGENTS.md` cambiadas, MCP nuevos, dependencias nuevas.
- Aplica: reescribe solo el bloque `<!-- kits:start/end -->` de `AGENTS.md` (`upsertKitSection` ya lo hace), sincroniza skills con el CLI de skills, fusiona MCP y añade dependencias.
- Nunca toca archivos que el usuario modificó (hash distinto en `managedFiles`): los lista para revisión manual.
- `--dry-run` y confirmación como en `init`.

### `create-first-commit add <pieza>`

- Añade a un proyecto existente una biblioteca del catálogo (`create-first-commit add sentry`, `create-first-commit add kokonutui`) o un skill.
- Detecta el framework con los detectores de la fase 1 y elige la variante (Sentry para Next.js, Expo o Node).
- Comprueba `requires` (por ejemplo, Kokonut necesita shadcn) y ofrece añadir la dependencia.
- Reutiliza `writeFiles`, `setupTasks` y la regla de `AGENTS.md`. Funciona aunque el proyecto no venga de un kit (crea `kits.lock`).

### `create-first-commit doctor`

Comprueba y explica cómo arreglar:
- Bibliotecas de componentes o animación instaladas que no son las elegidas (rompen la regla de `AGENTS.md`).
- Variables de `.env.example` que faltan en `.env` o `.env.local`.
- Skills de `kits.lock` que no están instalados para algún agente.
- Archivos gestionados que se han borrado.
- Versiones del kit con avisos de seguridad.

Salida legible y `--json` para CI. Código de salida distinto de 0 si hay errores, para usarlo en pre-commit o en CI.

### Avisos de actualización

- El CLI, al ejecutarse dentro de un proyecto con `kits.lock`, avisa una vez al día si hay una versión nueva del kit.
- Telemetría: nuevo tipo de evento `update` y `add` en `installEventSchema` (discriminated union), para medir retención.

## Tareas

- [x] `kits.lock` (`packages/schema/src/lock.ts`): lo escribe `init` antes del commit inicial; rutas de kits locales guardadas como absolutas.
- [x] `create-first-commit update [versión]`: resumen, `--dry-run`, protección de archivos modificados o borrados (`fileAction`), opciones nuevas con su valor por defecto y sin re-ejecutar comandos de configuración.
- [x] `create-first-commit add <biblioteca|skill>`: variante por framework, requisitos, aviso si ya hay otra biblioteca de componentes, idempotente, bloque propio en `AGENTS.md` y `kits.lock` aunque el proyecto no venga de un kit.
- [x] `create-first-commit doctor` con salida legible, `--json` y código de salida 1 si hay errores.
- [x] Aviso de versión nueva una vez al día por kit (`notice.ts`).
- [x] Eventos `update` y `add` en la telemetría: contador de retención aparte (nunca suman instalaciones), columna `event_type` en Postgres (migración `0004`) y panel del dueño con actualizaciones y bibliotecas añadidas.
- [x] Docs: `/docs/mantener`.
- [x] (Fase 2, encontrado aquí) `create-first-commit test --timeout <min>` (20 por defecto): un comando colgado, por ejemplo una instalación con la red caída, hace fallar su combinación en vez de bloquear la prueba (y el CI) indefinidamente.

## Estado de los criterios

- ✅ Publicar una versión de un kit que añade un skill hace que `create-first-commit update` lo instale sin tocar el código (probado con un kit local 1.0.0 → 1.1.0: añadió dependencia, skill, variable y reglas nuevas).
- ✅ Un archivo gestionado y modificado por el usuario no se sobrescribe y aparece listado (y el no modificado sí se actualiza).
- ✅ `create-first-commit add sentry` deja Sentry funcionando y crea `kits.lock`: probado en un proyecto Next.js sin kit (variante Next.js, `build` correcto) y en una API Hono (variante Node, `tsc` correcto).
- ✅ `create-first-commit doctor` detecta otra biblioteca de componentes: con shadcn/ui instalado y HeroUI añadido (`add` pide `--force`), `doctor` da error y sale con código 1.

## Fuera de alcance

Migraciones de código entre versiones mayores de un framework.
