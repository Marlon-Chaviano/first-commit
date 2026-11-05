# first-commit

Workspaces listos para programar con tu agente. Un kit crea el proyecto, instala dependencias,
skills (de [skills.sh](https://skills.sh)) y servidores MCP, y escribe `AGENTS.md` para
Claude Code, Cursor, Codex, Gemini CLI, Copilot u OpenCode.

```bash
npx create-first-commit mobile-expo mi-app --styling nativewind --backend supabase --agent claude-code,cursor
```

## Estructura

| Ruta | Qué es |
| --- | --- |
| `packages/schema` | Esquema de `kit.json` (zod) y lógica compartida: resolver selecciones y generar el comando |
| `packages/cli` | CLI `create-first-commit` (npm). `init`, `list`, `info`, `--dry-run` |
| `apps/web` | Web (Next.js 16 + shadcn): ranking, configurador, docs, API de métricas |
| `docs/ARCHITECTURE.md` | Métricas: Redis, cola, Postgres, caché, rate limit |
| `registry/kits/*` | Kits oficiales (`kit.json` + archivos) |
| `scripts/build-registry.ts` | Valida los kits y genera `registry/index.json` y `registry/kit.schema.json` |

## Desarrollo

```bash
pnpm install
docker compose up -d         # Postgres, Redis (opcional: sin ellos los contadores muestran 0)
cp apps/web/.env.example apps/web/.env.local && pnpm --filter web db:migrate
pnpm registry:index          # tras editar un kit
pnpm registry:check          # además comprueba que cada skill existe
pnpm build                   # compila el CLI
pnpm dev:web                 # web en localhost:3200

# Probar el CLI contra el registro local
KITS_REGISTRY=$PWD/registry node packages/cli/dist/index.js init mobile-expo demo --dry-run
```

Sin `KITS_REGISTRY`, el CLI descarga los kits de `github.com/Marlon-Chaviano/first-commit/registry`
(ver `packages/cli/src/registry.ts`).
