# Composable workspaces

The `monorepo` kit and the eight monorepo presets use the same configurator. Select
web, API, docs and mobile independently, then open a service's panel to choose its
libraries. Framework changes clear incompatible choices. Apps have fixed slots;
shared packages and native integrations remain part of specialized presets.

## Authoring and resolution

`kit.json.workspace.services` maps a slot to its label, relative directory,
default variant, and versioned official kit references. `loadKitFrom` resolves
these references through the same source used by standalone kits. Nested
workspaces, overlapping directories and option-id collisions are rejected.

`service` on a standalone kit describes development, build, production start,
port, CI setup, optional Docker recipe, health URL and connection patches. A web
profile also supplies its public URL variable and API-client files; these use
`{{apiUrl}}` and `{{healthPath}}`. Package-script arguments use `{{scriptArgs}}`
so npm, pnpm and Bun forward them correctly.
Connection patches fail if a scaffolder changes a required anchor. The `replace`
file mode replaces one explicit anchor, is idempotent and never creates a missing
file. Service references currently require official versions; arbitrary private
or community dependencies are not exposed by a public composition.

Selections reuse the existing options protocol with qualified keys, for example
`web.nextjs.components`. `selectedServices` projects these into standalone
selections. The resolver retains separate service contributions; the planner
installs them in their directories and creates git only at the root. MCP names
are scoped by service, and skills are deduplicated at the root.

## Development and hosting

The general constructor defaults to Next + FastAPI with simple scripts. Turbo
and Nx generate task adapters; non-JavaScript services keep their native tools.
The Go, T3 and npm-package presets retain their native structure. Changing an
existing native service switches to a custom composition; changing T3 to an
external API also switches to a custom composition.

The workspace runner requires Node.js 22 or newer. Use `node scripts/workspace.mjs dev`, `build`, or `verify`, optionally followed by
a service id. With web and API, `scripts/check-connection.mjs` checks health and the
allowed browser origin after starting the API. Public API variables, a basic
HTTP client and framework-specific CORS configuration connect the applications.

Hosting destinations depend on each service's declared capabilities. Vercel is
available for web/docs; Docker, Railway and Render require a Docker recipe.
Compose is enabled only if every selected server has a recipe. Native shared
workspaces do not inherit an isolated service's Docker recipe. Expo retains its
EAS integration. No external resource is provisioned.

Root `DEPLOYMENT.md` lists service directories, build/start commands and remaining
provider configuration. Set production URLs and allowed origins explicitly;
local defaults are not production hostnames. Docker ignores local secrets and
installed dependencies. CI jobs verify each service with its own toolchain.

## CLI and persistence

CLI 1.1.0 introduces workspace support. Example arguments:

```
monorepo my-product --web nextjs --api django --docs starlight
monorepo my-product --web.nextjs.components mantine --api.fastapi.database sqlmodel
monorepo my-product --deployment independent --web.nextjs.deploy vercel
```

`kits.lock` v2 stores child versions, package managers, options and managed-file
hashes. There is one lock at the root. `add --service <id>`, `update` and `doctor`
operate on the recorded service directories. Updates preserve topology. Native services are marked as embedded: standalone template updates are skipped
because their files and shared dependencies belong to the preset. The CLI explains
this when updating; those native dependencies remain a manual update.
Legacy v1 projects stay on their original layout; switching to the new major preset
requires creating a new workspace rather than silently moving existing files.

## Verification

Unit tests cover scoped resolution, framework changes, command serialization,
invalid workspace graphs, patch idempotence and root-lock persistence. The web
E2E test changes Next libraries, switches the API and enables docs independently.
Run the kit verification matrix before publishing changes to service profiles;
static schema validation alone does not establish scaffold or hosting support.

Provider configuration follows the [Vercel monorepo guide](https://vercel.com/docs/monorepos), [Railway monorepo guide](https://docs.railway.com/deployments/monorepo), and [Render Blueprint reference](https://render.com/docs/blueprint-spec). Provider resources and production credentials are configured by the project owner.
