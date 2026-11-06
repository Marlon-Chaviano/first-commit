import { BRAND } from "./brand";

/**
 * Library categories of the shared catalog. Each one becomes an option of any
 * kit that declares it in `libraries` (key → default). Order = order in the UI.
 */
export const LIBRARY_CATEGORIES = [
  { kind: "components", key: "components", optionId: "components", type: "select", label: "UI components", description: "The library your agent will use for the whole interface." },
  { kind: "addon", key: "addons", optionId: "component-addons", type: "multi", label: "Add-on libraries", description: "shadcn registries with flashier components. They require shadcn/ui." },
  { kind: "animation", key: "animation", optionId: "animation", type: "multi", label: "Animation" },
  { kind: "styling", key: "styling", optionId: "styling-lib", type: "select", label: "Styling", description: "The project's styling system." },
  { kind: "state", key: "state", optionId: "state", type: "select", label: "Global state", description: "Where state shared between components lives." },
  { kind: "data", key: "data", optionId: "data", type: "select", label: "Server data", description: "Caching, retries and refetching for requests." },
  { kind: "forms", key: "forms", optionId: "forms", type: "multi", label: "Forms and validation" },
  { kind: "auth", key: "auth", optionId: "auth", type: "select", label: "Authentication", description: "Login and sessions." },
  { kind: "database", key: "database", optionId: "database", type: "select", label: "Database", description: "ORM, client and migrations." },
  { kind: "payments", key: "payments", optionId: "payments", type: "select", label: "Payments" },
  { kind: "email", key: "email", optionId: "email", type: "select", label: "Transactional email" },
  { kind: "i18n", key: "i18n", optionId: "i18n", type: "select", label: "Languages (i18n)" },
  { kind: "ai", key: "ai", optionId: "ai", type: "multi", label: "AI", description: "SDKs to call models from your app." },
  { kind: "observability", key: "observability", optionId: "observability", type: "multi", label: "Observability", description: "Errors, product analytics and performance, already set up." },
  { kind: "testing", key: "testing", optionId: "testing", type: "multi", label: "Tests" },
  { kind: "quality", key: "quality", optionId: "quality", type: "multi", label: "Code quality", description: "Formatting, linting and git hooks." },
  { kind: "ci", key: "ci", optionId: "ci", type: "multi", label: "Continuous integration" },
  { kind: "deploy", key: "deploy", optionId: "deploy", type: "select", label: "Deployment" },
  { kind: "design", key: "design", optionId: "design", type: "multi", label: "Design pack", description: "Design skills so your agent builds polished, non-generic interfaces." },
  { kind: "workflow", key: "workflow", optionId: "workflow", type: "multi", label: `Pack ${BRAND.name}`, description: "General-purpose skills we picked that work in any project." },
] as const;

export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];
export type LibraryKind = LibraryCategory["kind"];
export const LIBRARY_KINDS = LIBRARY_CATEGORIES.map((c) => c.kind) as [LibraryKind, ...LibraryKind[]];

/** key in `libraries` → option id, e.g. addons → "component-addons". */
export const LIBRARY_OPTION_IDS = Object.fromEntries(LIBRARY_CATEGORIES.map((c) => [c.key, c.optionId])) as {
  [C in LibraryCategory as C["key"]]: C["optionId"];
};
