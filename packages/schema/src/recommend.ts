import { z } from "zod";

import { FLAGSHIP_KITS } from "./catalog";

import type { Selections } from "./resolve";
import type { Kit } from "./schema";
import { selectionsFrom } from "./selections";

/** What the recommender returns: a kit, the options to change and why. */
export const recommendationSchema = z.object({
  kit: z.string(),
  /** Option id → chosen choice ids (only the ones that differ from the kit's defaults are needed). */
  options: z.record(z.string(), z.array(z.string())),
  reasons: z.array(z.string()),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export interface ResolvedRecommendation extends Recommendation {
  /** Full, valid selections for the kit (defaults + recommendation, requirements added). */
  selections: Selections;
  source: "ai" | "heuristic";
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Words that point to a kit category, in Spanish and English. */
const CATEGORY_HINTS: Record<string, RegExp> = {
  mobile: /\b(movil|mobile|ios|android|app nativa|react native|expo|celular|telefono|phone|smartphone|mobile app)\b/,
  landing: /\b(landing|pagina de aterrizaje|web corporativa|portfolio|portafolio|marketing|lanzamiento|sitio web|website|una web|pagina web|landing page|homepage|home page|marketing site|launch|product site)\b/,
  saas: /\b(saas|suscripcion|subscription|dashboard|panel|usuarios|clientes|reservas|booking|plataforma|marketplace|tienda|pagos|users|customers|bookings|appointments|platform|store|shop|payments|billing|accounts)\b/,
  desktop: /\b(escritorio|desktop|electron|tauri|mac app|windows app)\b/,
  api: /\b(api|backend|rest|microservicio|servicio|endpoint|webhook|server|service|microservice)\b/,
  extension: /\b(extension|chrome|navegador|browser|firefox|addon|plugin|bot|mcp|extension|plugin|add-on)\b/,
  monorepo: /\b(monorepo|monorrepo|turborepo|varias apps|web y movil|movil y web|several apps|web and mobile|mobile and web)\b/,
};

/** Words that point to a catalog library or a kit choice (by choice id). */
const CHOICE_HINTS: Record<string, RegExp> = {
  // Languages and runtimes
  "api-fastapi": /\b(python|fastapi|django|flask)\b/,
  "api-go": /\b(go|golang)\b/,
  // Native iOS only when asked for; "iOS and Android" means a cross-platform app.
  "ios-swiftui": /\b(swift|swiftui|xcode|solo ios|solo para ios|iphone nativa|ios only|native iphone)\b/,
  "mobile-expo": /\b(android|expo|react native|multiplataforma|ios y android|android y ios|cross-platform|ios and android|android and ios)\b/,
  // Kits for a specific tool or framework: only when it's named.
  "monorepo-turbo": /\b(monorepo|monorrepo|turborepo|web y movil|movil y web|web and mobile|mobile and web)\b/,
  "mcp-server-ts": /\b(mcp|servidor mcp|mcp server)\b/,
  "mcp-server-python": /\b(mcp en python|servidor mcp en python)\b/,
  "discord-bot": /\bdiscord\b/,
  "slack-app": /\bslack\b/,
  "vscode-extension": /\b(vs ?code|visual studio code|cursor extension|extension de cursor)\b/,
  "cli-node": /\b(cli|linea de comandos|herramienta de terminal|command line|command-line|terminal tool)\b/,
  "desktop-electron": /\b(electron|escritorio|desktop|app de escritorio|desktop app|mac app|windows app)\b/,
  "desktop-tauri": /\btauri\b/,
  "api-express": /\bexpress\b/,
  "api-axum": /\b(rust|axum)\b/,
  "api-aspnet": /\b(c#|csharp|\.net|dotnet|asp\.?net)\b/,
  "ai-agent-python": /\b(agente de ia|agente ia|agentes|langgraph|langchain|ai agent|agents?)\b/,
  "github-action": /\b(github action|accion de github)\b/,
  "docs-starlight": /\b(documentacion|docs|starlight|documentation|docs site)\b/,
  "docs-fumadocs": /\bfumadocs\b/,
  "docs-vitepress": /\bvitepress\b/,
  "blog-astro": /\b(blog|articulos|posts|blog|articles|posts)\b/,
  "portfolio-astro": /\b(portfolio|portafolio|personal|portfolio|personal site)\b/,
  "landing-astro": /\b(landing en astro|astro)\b/,
  "saas-ai-next": /\b(app de ia|chat con ia|chatbot|asistente de ia|ai app|ai app|ai chat|chat app|chatbot|ai assistant)\b/,
  "saas-t3": /\b(t3|trpc)\b/,
  "web-angular": /\bangular\b/,
  "web-react-router": /\b(react router|remix)\b/,
  "web-tanstack-start": /\btanstack\b/,
  "api-nestjs": /\bnest(js)?\b/,
  "api-fastify": /\bfastify\b/,
  "api-rails": /\b(api en rails|rails api)\b/,
  "mobile-ionic-react": /\b(ionic|capacitor|pwa)\b/,
  "mobile-ignite": /\bignite\b/,
  bun: /\bbun\b/,
  "cloudflare-workers": /\b(cloudflare|workers|edge)\b/,
  vue: /\bvue\b/,
  svelte: /\bsvelte\b/,
  solid: /\bsolid\b/,
  // Categories
  "better-auth": /\b(login|auth|autenticacion|registro|usuarios|cuentas|sign ?in|iniciar sesion|accounts|sign ?up|log ?in|users|authentication)\b/,
  "drizzle-postgres": /\b(base de datos|database|postgres|sql|drizzle|db)\b/,
  stripe: /\b(pagos|pago|cobrar|suscripcion|stripe|payments|checkout|facturacion|payments|billing|subscriptions|charge|checkout|pay)\b/,
  resend: /\b(email|correo|emails|newsletter|notificaciones por correo|emails?|newsletter|mail)\b/,
  "next-intl": /\b(idiomas|multidioma|traduccion|i18n|internacional|translations?|multilingual|languages|international)\b/,
  "i18next-expo": /\b(idiomas|multidioma|traduccion|i18n|internacional|translations?|multilingual|languages|international)\b/,
  "vercel-ai-sdk": /\b(ia|ai|chat|chatbot|llm|asistente|claude|gpt|inteligencia artificial|ai|assistant|artificial intelligence)\b/,
  motion: /\b(animacion|animaciones|animado|animated|motion|transiciones|animations?|animated|transitions)\b/,
  "posthog-nextjs": /\b(analitica|analytics|metricas de producto|embudos|funnels|product analytics|funnels)\b/,
  "vercel-analytics": /\b(analitica|analytics|visitas|analytics|visits|page views)\b/,
  "sentry-nextjs": /\b(errores|sentry|monitoreo|monitorizacion|observabilidad|errors|error tracking|monitoring)\b/,
  "sentry-node": /\b(errores|sentry|monitoreo|monitorizacion|observabilidad|errors|error tracking|monitoring)\b/,
  "sentry-go": /\b(errores|sentry|monitoreo|monitorizacion|observabilidad|errors|error tracking|monitoring)\b/,
  "sentry-python": /\b(errores|sentry|monitoreo|monitorizacion|observabilidad|errors|error tracking|monitoring)\b/,
  vitest: /\b(tests|testing|pruebas|unit|unit tests)\b/,
  "vitest-node": /\b(tests|testing|pruebas|unit|unit tests)\b/,
  "jest-expo": /\b(tests|testing|pruebas|unit|unit tests)\b/,
  playwright: /\b(e2e|end to end|playwright|end-to-end)\b/,
  "github-actions": /\b(ci|integracion continua|github actions|continuous integration)\b/,
  docker: /\b(docker|contenedor|container|self.?host|self-host(ed)?)\b/,
  supabase: /\b(supabase|backend|login|usuarios|base de datos|auth|backend|login|users|database|auth)\b/,
  nativewind: /\b(tailwind|nativewind)\b/,
  seo: /\b(seo|google|open graph|posicionamiento|search engines|ranking)\b/,
};


/** Tags many kits share: they say nothing about which kit fits better. */
const GENERIC_TAGS = new Set(["landing", "saas", "api", "extension", "mobile", "monorepo", "plugin", "bot", "typescript", "tailwind", "node", "seo", "design", "personal", "agents", "auth"]);

function scoreKit(kit: Kit, text: string): number {
  let score = 0;
  if (CATEGORY_HINTS[kit.category]?.test(text)) score += 3;
  const words = [kit.name, ...kit.tags.filter((t) => !GENERIC_TAGS.has(t))].map(normalize);
  for (const word of words) if (word.length > 2 && new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text)) score += 2;
  if (CHOICE_HINTS[kit.name]?.test(text)) score += 6;
  return score;
}

/**
 * Keyword recommender: works offline and without an API key. It's the
 * fallback when the AI recommender isn't configured or fails.
 */
export function recommendHeuristic(description: string, kits: Kit[]): Recommendation {
  if (!kits.length) throw new Error("There are no kits to recommend");
  const text = normalize(description);
  const ranked = kits
    .map((kit) => ({ kit, score: scoreKit(kit, text) }))
    .sort((a, b) => b.score - a.score || Number(FLAGSHIP_KITS.has(b.kit.name)) - Number(FLAGSHIP_KITS.has(a.kit.name)));
  const { kit } = ranked[0]!;
  const reasons = [ranked[0]!.score > 0 ? `${kit.title}: the kit that best fits the description.` : `${kit.title}: no clear hints, so it's a general starting point.`];

  const options: Record<string, string[]> = {};
  for (const option of kit.options) {
    const matches = option.choices.filter((c) => c.id !== "none" && CHOICE_HINTS[c.id]?.test(text));
    if (!matches.length) continue;
    // A select takes the first match; a multi keeps one per library family (posthog OR vercel-analytics, not both).
    const picked = option.type === "select" ? [matches[0]!] : matches.filter((c, i) => !matches.slice(0, i).some((m) => CHOICE_HINTS[m.id]?.source === CHOICE_HINTS[c.id]?.source));
    options[option.id] = picked.map((c) => c.id);
    reasons.push(`${option.label}: ${picked.map((c) => c.label).join(", ")}.`);
  }
  return { kit: kit.name, options, reasons };
}

/**
 * Turns a recommendation into valid selections: unknown options and choices
 * are dropped, missing requirements are added (Better Auth → Drizzle) and the
 * result is checked with validateSelections. Throws if it still isn't valid.
 */
export function resolveRecommendation(kit: Kit, rec: Recommendation, source: ResolvedRecommendation["source"]): ResolvedRecommendation {
  const { selections } = selectionsFrom(kit, { options: rec.options }, { requirements: "autofill", unknown: "ignore" });
  return { ...rec, kit: kit.name, options: selections.options, selections, source };
}

export { FLAGSHIP_KITS } from "./catalog";
