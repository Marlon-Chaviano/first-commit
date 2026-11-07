<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/first-commit-logo-white.svg">
    <img src="apps/web/public/brand/first-commit-logo-black.svg" alt="first-commit" height="40">
  </picture>

  <p><strong>Your agent's first commit, already made.</strong></p>
  <p>One command creates the project, installs the dependencies, the agent skills and the MCP servers,<br>and writes the <code>AGENTS.md</code> your agent reads before touching a line.</p>

  <p>
    <a href="https://www.npmjs.com/package/create-first-commit"><img src="https://img.shields.io/npm/v/create-first-commit?color=black&label=npm" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/create-first-commit"><img src="https://img.shields.io/npm/dm/create-first-commit?color=black" alt="npm downloads"></a>
    <a href="https://first-commit.dev/kits"><img src="https://img.shields.io/badge/kits-70-black" alt="70 kits"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-black" alt="MIT license"></a>
  </p>

  <p>
    <a href="https://first-commit.dev">Website</a> ·
    <a href="#quick-start">Quick start</a> ·
    <a href="#the-kits">Kits</a> ·
    <a href="#make-your-own-kit">Make a kit</a> ·
    <a href="#development">Development</a> ·
    <a href="CONTRIBUTING.md">Contributing</a>
  </p>
</div>

---

```bash
npx create-first-commit landing-next my-site
```

That's it. You get a Next.js project that builds, a git history with one clean commit, the skills an agent needs to work on it well, and the rules of the project written down where every agent looks for them.

## Why

Starting a project with an agent usually goes like this: scaffold it, install a UI library, hunt for the right skills, wire up an MCP server, then explain the conventions again in every new session. **A kit does all of that once, the same way, every time.** Pick a stack, run one command, open your agent.

## Highlights

- **70 official kits** across 9 languages: Next.js, Astro, SvelteKit, Expo, Flutter, SwiftUI, FastAPI, Django, Rails, Laravel, Go, Spring Boot and more.
- **Agent-ready from the first minute.** Skills from [skills.sh](https://skills.sh), MCP servers and an `AGENTS.md` for Claude Code, Cursor, Codex, Gemini CLI, GitHub Copilot, Windsurf and OpenCode.
- **Options, not forks.** One kit, many stacks: `--components shadcn`, `--backend supabase`, `--pm bun`. Incompatible options are ruled out before anything runs.
- **See before it runs.** Every command is shown in a plan first; `--dry-run` runs nothing. Official kits are integrity-checked and verified by building real option combinations.
- **Stays connected.** `kits.lock` remembers where the project came from: `update` brings in the kit's improvements without touching files you changed, `add` pulls more libraries in, `doctor` checks the project still follows its rules.
- **Built for agents too.** An MCP server (`create-first-commit mcp`) lets an agent find, plan and install kits on its own, always asking before it executes anything.

## Quick start

```bash
# Pick a kit interactively
npx create-first-commit

# Or go straight to it, with options
npx create-first-commit mobile-expo my-app --styling nativewind --backend supabase --agent claude-code,cursor

# Look before you leap
npx create-first-commit info landing-next
npx create-first-commit landing-next my-site --dry-run
```

Prefer clicking? Build the command in the configurator at **[first-commit.dev](https://first-commit.dev)**.

### Inside a project

| Command | What it does |
| :--- | :--- |
| `update [version]` | Brings in the kit's improvements. Never overwrites files you changed. |
| `add <library\|skill>` | Adds a library from the catalog (`sentry`, `posthog`…) or any `owner/repo@skill`. |
| `doctor [--json]` | Checks that the project still follows its rules: skills, MCP, managed files. |
| `brand <owner/name>` | Applies a brand profile: colors, fonts, logo and writing rules. |

Run `npx create-first-commit --help` for every command and option.

## The kits

| Category | Kits |
| :--- | :--- |
| **Landing & docs** | `landing-next` `landing-astro` `landing-nuxt` `landing-sveltekit` `waitlist-next` `portfolio-astro` `blog-astro` `docs-fumadocs` `docs-starlight` `docs-vitepress` |
| **Web apps** | `spa-vite-react` `web-react-router` `web-tanstack-start` `web-sveltekit` `web-nuxt` `web-vue-vite` `web-astro` `web-angular` `web-rails` `web-laravel` |
| **SaaS** | `saas-next-supabase` `saas-next-better-auth` `saas-ai-next` `saas-t3` `saas-tanstack-start` `saas-sveltekit` `saas-nuxt` `saas-django` `saas-rails` `saas-laravel` |
| **APIs** | `api-hono` `api-fastify` `api-nestjs` `api-elysia` `api-fastapi` `api-django` `api-go` `api-rails` `api-laravel` `api-spring-boot` |
| **Mobile** | `mobile-expo` `mobile-expo-supabase` `mobile-ignite` `mobile-flutter` `mobile-kmp` `mobile-lynx` `mobile-ionic-react` `mobile-ionic-angular` `ios-swiftui` `android-compose` |
| **Monorepos** | `monorepo-turbo` `monorepo-t3-turbo` `monorepo-nx` `monorepo-bun` `monorepo-packages` `monorepo-go` `monorepo-uv` `monorepo-django-react` `monorepo-rails-react` `monorepo-spring-react` |
| **Extensions & bots** | `chrome-extension` `vscode-extension` `raycast-extension` `obsidian-plugin` `figma-plugin` `github-action` `discord-bot` `slack-app` `mcp-server-ts` `mcp-server-python` |

Every kit can pull from a shared catalog of 100+ libraries (UI, animation, auth, databases, payments, email, i18n, AI, observability, testing, CI and deployment), each with its official skill when it has one.

## Make your own kit

Turn any repo into a kit. `create` detects the framework, libraries, skills and MCP servers and writes the `kit.json` for you:

```bash
npx create-first-commit create            # from the current project
npx create-first-commit ./kit demo --dry-run
npx create-first-commit test              # install and build several option combinations
npx create-first-commit publish           # share it on first-commit.dev
```

Kits can `extend` other kits, have versions, and earn a **Verified** badge by passing `test` in CI with the [`actions/verify`](actions/verify) GitHub Action. The format is documented at [first-commit.dev/docs](https://first-commit.dev/docs).

## How it's built

| Path | What it is |
| :--- | :--- |
| [`packages/schema`](packages/schema) | The `kit.json` format (zod), option resolution, the install planner and the command generator. Shared by the web and the CLI. |
| [`packages/cli`](packages/cli) | `create-first-commit` on npm. |
| [`packages/mcp`](packages/mcp) | The MCP server, local (`create-first-commit mcp`) and remote (read-only, at `/mcp`). |
| [`apps/web`](apps/web) | The website: Next.js 16 with Cache Components and shadcn/ui. Ranking, configurator, docs, accounts and publishing. |
| [`registry`](registry) | Official kits (`kits/<kit>/kit.json` plus files) and the library catalog (`libraries.json`). |
| [`skills/first-commit`](skills/first-commit) | The skill that teaches agents to use first-commit. |

Architecture, metrics and the free-tier budget are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Development

```bash
pnpm install
docker compose up -d          # Postgres and Redis (optional: without them counters show 0)
cp apps/web/.env.example apps/web/.env.local
pnpm --filter web db:migrate
pnpm dev:web                  # http://localhost:3200

pnpm build && pnpm test       # build the CLI, run the tests
pnpm registry:check           # after editing a kit: validate it and check every skill exists

# Try the CLI against the local registry
KITS_REGISTRY=$PWD/registry node packages/cli/dist/index.js landing-next demo --dry-run
```

Without `KITS_REGISTRY`, the CLI downloads official kits from this repo's [`registry`](registry) folder.

## Privacy

The CLI sends one anonymous event per install so the ranking reflects real use: the kit and its version, the options, skills, agents and package manager you picked, your OS and a random anonymous ID. Never paths, project names or code, and nothing for local kits or in CI. Turn it off with `DO_NOT_TRACK=1`. Details in the [privacy policy](https://first-commit.dev/privacy).

## Contributing

New kits, libraries and fixes are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first: every library must be verified on its registry, use official skills only, and pass `create-first-commit test` before it goes in.

## License

[MIT](LICENSE) © [Marlon Chaviano](https://github.com/Marlon-Chaviano)
