# Fase 5b — Base oficial: 10 kits por tipo

La base sólida del catálogo: **10 kits oficiales por tipo** (7 tipos, unos 70 kits), las mejores opciones de cada lenguaje para empezar un proyecto serio. Autor de todos: **Marlon Chaviano**.

Todos traen el **Pack first-commit** (skills generales). Los que tienen interfaz traen además el **Pack de diseño** (`frontend-design`, `impeccable`, `web-design-guidelines`, `ui-ux-pro-max`, `emil-design-eng`), o el móvil en apps nativas. Cada framework trae sus skills oficiales.

Un kit entra solo si pasa `create-first-commit test`. Los que necesitan un toolchain que no hay en local (Android, Flutter, .NET, Rust) se verifican en GitHub Actions (`actions/verify`).

## Kits

Leyenda: ✅ verificado · 🔨 en construcción · ☁️ se verifica en CI · ⬜ pendiente

### Monorepo (nuevo tipo)
| Kit | Qué es | Estado |
| --- | --- | --- |
| `monorepo-turbo` | Turborepo configurable: web (Next.js, Vite, Astro, SvelteKit), móvil (Expo), API (Hono) y paquetes compartidos | 🔨 |
| `monorepo-t3-turbo` | create-t3-turbo: Next.js + Expo + tRPC + Drizzle | ⬜ |
| `monorepo-nx` | Nx con React y librerías | ⬜ |
| `monorepo-bun` | Bun workspaces: Elysia + React con Eden (tipos de extremo a extremo) | ⬜ |
| `monorepo-uv` | Workspace de uv: FastAPI + paquetes Python | ⬜ |
| `monorepo-go` | `go.work`: API, worker y paquete compartido | ⬜ |
| `monorepo-django-react` | API Django + frontend Vite React | ⬜ |
| `monorepo-spring-react` | Maven multimódulo + frontend React | ⬜ |
| `monorepo-rails-react` | API Rails + frontend Vite React | ⬜ |
| `monorepo-packages` | Librerías npm con tsup y Changesets | ⬜ |

### API
`api-hono` ✅ · `api-elysia` ✅ · `api-fastapi` ✅ · `api-django` ✅ · `api-go` ✅ · `api-spring-boot` ✅ · `api-nestjs` ⬜ · `api-fastify` ⬜ · `api-rails` ⬜ · `api-dotnet` ☁️

### Web
`spa-vite-react` ✅ · `web-astro` ✅ · `web-sveltekit` ✅ · `web-nuxt` ✅ · `web-rails` ✅ · `web-laravel` ✅ · `web-react-router` ⬜ · `web-tanstack-start` ⬜ · `web-angular` ⬜ · `web-vue-vite` ⬜

### Landing y contenido
`landing-next` ✅ · `landing-astro` ⬜ · `landing-nuxt` ⬜ · `landing-sveltekit` ⬜ · `docs-starlight` ⬜ · `docs-fumadocs` ⬜ · `docs-vitepress` ⬜ · `blog-astro` ⬜ · `portfolio-next` ⬜ · `waitlist-next` ⬜

### SaaS
`saas-next-supabase` ✅ · `saas-next-better-auth` ⬜ · `saas-t3` ⬜ · `saas-ai-next` ⬜ · `saas-tanstack-start` ⬜ · `saas-sveltekit` ⬜ · `saas-nuxt` ⬜ · `saas-laravel` ⬜ · `saas-rails` ⬜ · `saas-django` ⬜

### Móvil
`mobile-expo` ✅ · `ios-swiftui` ✅ · `mobile-expo-supabase` ⬜ · `mobile-ignite` ⬜ · `mobile-ionic-react` ⬜ · `mobile-ionic-vue` ⬜ · `mobile-lynx` ⬜ · `android-compose` ☁️ · `mobile-flutter` ☁️ · `mobile-kmp` ☁️

### Extensiones y plugins
`chrome-extension` ✅ · `vscode-extension` ⬜ · `raycast-extension` ⬜ · `figma-plugin` ⬜ · `obsidian-plugin` ⬜ · `mcp-server-ts` ⬜ · `mcp-server-python` ⬜ · `github-action` ⬜ · `discord-bot` ⬜ · `slack-app` ⬜

## Criterios de aceptación

- [ ] 10 kits por tipo en `registry/kits/`, todos con autor "Marlon Chaviano".
- [ ] Cada kit pasa `create-first-commit test` (en local o en CI) con sus combinaciones.
- [ ] El recomendador sigue en ≥25/30 con el catálogo nuevo.
