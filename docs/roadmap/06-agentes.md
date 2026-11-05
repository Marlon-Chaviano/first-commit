# Fase 6 — Nativo para agentes

## Objetivo

Que un agente pueda crear un proyecto desde una carpeta vacía usando kits por su cuenta ("hazme una app de recetas con Expo y Supabase"), y que cualquiera reciba una recomendación de kit describiendo su idea.

## Por qué

Los usuarios de kits trabajan con agentes. Si el agente conoce kits y lo usa solo, la adquisición deja de depender de que el humano visite la web. skills.sh es además un canal de distribución.

## Diseño técnico

### MCP de kits (`packages/mcp`)

Servidor MCP publicado en npm (`npx create-first-commit mcp`, stdio) y como endpoint remoto (`https://first-commit.dev/mcp`, HTTP streamable, sin estado).

| Herramienta | Qué hace |
| --- | --- |
| `search_kits` | Busca por texto, categoría, framework o biblioteca. Devuelve kits con sus opciones. |
| `get_kit` | Detalle de un kit: opciones, requisitos, skills, qué se instala. |
| `recommend_kit` | Recibe una descripción del proyecto y devuelve kit + opciones (ver recomendador). |
| `plan_init` | Devuelve el plan (`--dry-run`) para unas opciones, para que el agente lo enseñe al usuario. |
| `init_kit` | Ejecuta `init` en el directorio de trabajo. Solo en el servidor local; el remoto no ejecuta comandos. |
| `add_library` | Equivalente a `create-first-commit add`. Solo local. |

Las herramientas que ejecutan comandos piden confirmación al usuario (el agente debe mostrar el plan primero), y la descripción de la herramienta lo exige.

### Skill `kits`

- En el repo `kits/skills`, publicado en skills.sh.
- Enseña al agente cuándo usar kits (proyecto nuevo, añadir Sentry, ponerse al día), cómo elegir opciones y cómo seguir los "Primeros pasos" de `AGENTS.md`.
- Incluido por defecto en todos los kits oficiales, para que el agente sepa usar `create-first-commit update` y `create-first-commit add` en el futuro.

### Recomendador (`apps/web/src/server/recommend/`)

- Entrada: descripción en lenguaje natural ("app de reservas para peluquerías con pagos").
- Contexto: catálogo de kits y bibliotecas, y las combinaciones más instaladas por categoría (de Postgres).
- Modelo: Claude con salida estructurada validada con zod (`{ kit, options, reasons }`), y validación final con `validateSelections`. Si no valida, se reintenta una vez con el error.
- UI: cuadro "Describe tu proyecto" en la home → abre el configurador con las opciones ya elegidas y una explicación de por qué.
- Coste controlado: rate limit por IP, caché por descripción normalizada y límite de tokens.
- Usar el skill `claude-api` del repo al implementarlo (modelos y SDK actuales).

### Prompt en vez de comando

Como el botón "Prompt" de skills.sh: en la página del kit, además del comando, un texto para pegar en el agente ("Crea un proyecto con kits usando landing-next con…").

## Decisiones tomadas

- **SDK de MCP v2** (`@modelcontextprotocol/server` 2.4, especificación 2026-07-28, que acepta también clientes 2025). Un solo servidor (`packages/mcp`) para los dos transportes: `serveStdio` en el CLI y `createMcpHandler(...).fetch` en un route handler de Next.
- **`init_kit` lanza el propio CLI** sin TTY y con `--yes`, en vez de reimplementar `init`: mismas comprobaciones de confianza (un kit de la comunidad sin verificar falla sin `--allow-commands`, y el MCP no lo añade), mismo `kits.lock` y misma telemetría.
- **Aprobación explícita**: `init_kit` exige `approved: true` (validado por el esquema) y su descripción obliga a enseñar antes `plan_init`.
- **Recomendador en dos niveles**: por palabras clave (`recommendHeuristic`, gratis y sin red) y Claude cuando hay `ANTHROPIC_API_KEY`. Toda respuesta pasa por `resolveRecommendation`, que descarta lo que no existe y añade lo requerido (Better Auth → Drizzle), así que siempre devuelve una combinación válida. Solo recomienda kits oficiales.
- **Modelo: Claude Haiku 4.5** por defecto (`RECOMMEND_MODEL`): es el más barato y la tarea es corta. Salida estructurada con `zodOutputFormat` (las opciones van como lista: los esquemas estrictos no admiten `record`). Si responde con un rechazo o con algo que no valida tras un reintento, contesta el de palabras clave.
- **La recomendación viaja en la URL** del kit (`/kits/landing-next?animation=motion&why=…`): el configurador estático se muestra al instante y la versión con las opciones elegidas llega en streaming (Suspense).
- **El skill `kits` se genera** desde `scripts/skill-template.md` con `BRAND` (el nombre es provisional). Los kits lo incluyen cuando `KITS_SKILL_PUBLISHED` pase a `true` en la fase 8, después de publicar el repo; instalarlo antes fallaría.

## Tareas

- [x] `packages/mcp` con las 6 herramientas y tests (servidor en memoria: lista de herramientas local/remota, búsqueda por biblioteca, recomendación, plan, aprobación de `init_kit`).
- [x] `create-first-commit mcp` (stdio). Probado con mensajes JSON-RPC reales: `init_kit` creó una landing con Motion, Vercel Analytics y PostHog que compila.
- [x] Endpoint MCP remoto de solo lectura (`/mcp`).
- [x] Skill `kits` (`skills/kits/SKILL.md`), reconocido por el CLI de skills. 🟡 Publicarlo en skills.sh e incluirlo en los kits: fase 8.
- [x] Recomendador con Claude, validación, reintento, caché por descripción y rate limit (`POST /api/v1/recommend`).
- [x] "Describe tu proyecto" en la home → configurador con las opciones elegidas y los motivos.
- [x] Pestaña Prompt en la página del kit.
- [x] Docs: `/docs/agentes` (Claude Code, Cursor, Codex, remoto, skill y prompt).

## Estado de los criterios

- 🟡 Claude Code + MCP local en una carpeta vacía: el flujo completo está probado con un cliente MCP propio (recomendar → planear → `init_kit` → `pnpm build` correcto) para "landing con animaciones y analítica". Falta la prueba con Claude Code de verdad: `claude mcp add kits -- node <repo>/packages/cli/dist/index.js mcp` con `KITS_REGISTRY` apuntando al registro local.
- 🟡 Recomendador: 30 descripciones de prueba en `packages/schema/src/recommend.eval.json`; el de palabras clave acierta el kit en 30/30 y nunca devuelve una combinación inválida. Ojo: las descripciones y las pistas las escribí a la vez, así que el número es optimista. La revisión con Claude necesita una `ANTHROPIC_API_KEY` (de pago).
- ⏳ El skill aparece en skills.sh: requiere el repo público (fase 8).

## Fuera de alcance

Agentes que escriben el producto completo después del arranque.
