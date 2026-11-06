# Glossary

The words this codebase uses for its own concepts. When a module is named after one of them, it means exactly this.

## Catalog

- **Kit**: a project template: a base command, options, dependencies, skills, MCP servers, files and agent rules, described by a `kit.json`. Official kits live in `registry/kits/`; community kits are published from GitHub.
- **Option / choice**: a question a kit asks (framework, auth, database…) and one of its answers. A choice brings its own dependencies, skills, files and rules.
- **Library**: an entry of `registry/libraries.json` (Sentry, Stripe, shadcn/ui…) that becomes a choice of every kit whose framework it supports.
- **Pack**: a library that is only skills, offered as one switch (the design pack, essentials).
- **Stack**: a curated kit plus a fixed set of choices, with its own page (`/stacks`).
- **Selections**: everything a person picked for one install: choices per option, skills added or removed, agents, package manager. Built only through `selectionsFrom`.

## Installing

- **Plan**: the ordered list of steps that creates a project, computed by `buildPlan` from a kit and its selections. The CLI runs it, `--dry-run` prints it and the website's "What will run" draws it; they are the same plan.
- **Step**: one entry of a plan: `run` a command, `copy` files, `write` a file, apply a `brand`, make the `git` commit.
- **Lockfile** (`kits.lock`): what a project records about the kit it came from, so `update`, `add` and `doctor` can work later.

## Brands

- **Brand profile**: a company's identity (colors, fonts, radius, logo and images, links, voice, rules, docs) applied to a project with `--brand`.
- **Detection**: what was read from a website, a file or a project, with ranked candidates; never saved as is.
- **Brand draft**: a profile while it's being made. `brand-draft.ts` owns its defaults, how a detection merges into it, and how it becomes a valid profile.
- **Brand step**: the plan step that downloads a profile's images and writes its files into a project.

## People and access

- **Viewer**: the person making a request, as the app sees them (`getViewer` / `getRequestUser`).
- **Organization**: a team with members (owner, admin, member), private kits, brand profiles and a library policy.
- **Organization capabilities**: what a role may do in an organization (`orgCapabilities`): the server checks them and pages draw their buttons from them.
- **Kit access**: every access question about one kit for one viewer: read, manage, moderate, install (`kitAccess`).
- **Action**: a server action; every one goes through the `action` seam, which resolves the viewer, maps domain errors and refreshes caches.
