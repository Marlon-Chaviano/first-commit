/**
 * Catalog constants with no dependencies (no zod): kit categories, agents and the general-purpose
 * kit of each type. Client components import them through "@kits/schema/light" so the browser
 * doesn't download the schemas.
 */

export const KIT_CATEGORIES = ["mobile", "web", "landing", "saas", "api", "desktop", "extension", "monorepo", "other"] as const;
export type KitCategory = (typeof KIT_CATEGORIES)[number];

/** How each kit type is shown (website and CLI). */
export const CATEGORY_LABELS: Record<KitCategory, string> = {
  mobile: "Mobile",
  landing: "Landing",
  saas: "SaaS",
  web: "Web",
  api: "API",
  desktop: "Desktop",
  extension: "Extensions",
  monorepo: "Monorepo",
  other: "Other",
};

export const AGENTS = [
  { id: "claude-code", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
  { id: "codex", label: "Codex" },
  { id: "gemini-cli", label: "Gemini CLI" },
  { id: "github-copilot", label: "GitHub Copilot" },
  { id: "windsurf", label: "Windsurf" },
  { id: "opencode", label: "OpenCode" },
] as const;

export type AgentId = (typeof AGENTS)[number]["id"];
export const DEFAULT_AGENTS: AgentId[] = ["claude-code"];

/**
 * On a tie, the general-purpose kit of each type wins; the rest (another language,
 * framework or tool) only when the description asks for them.
 */
export const FLAGSHIP_KITS: ReadonlySet<string> = new Set(["landing-next", "saas-next-supabase", "mobile-expo", "api-hono", "chrome-extension", "spa-vite-react", "monorepo-turbo"]);
