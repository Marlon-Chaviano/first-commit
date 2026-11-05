import { z } from "zod";

import { defaultSelections, pruneSelections, validateSelections, type Selections } from "./resolve";
import type { Kit } from "./schema";

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
  source: "claude" | "heuristic";
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Words that point to a kit category, in Spanish and English. */
const CATEGORY_HINTS: Record<string, RegExp> = {
  mobile: /\b(movil|mobile|ios|android|app nativa|react native|expo|celular|telefono)\b/,
  landing: /\b(landing|pagina de aterrizaje|web corporativa|portfolio|portafolio|marketing|lanzamiento|sitio web|website|una web|pagina web)\b/,
  saas: /\b(saas|suscripcion|subscription|dashboard|panel|usuarios|clientes|reservas|booking|plataforma|marketplace|tienda|pagos)\b/,
  api: /\b(api|backend|rest|microservicio|servicio|endpoint|webhook)\b/,
  extension: /\b(extension|chrome|navegador|browser|firefox|addon)\b/,
};

/** Words that point to a catalog library or a kit choice (by choice id). */
const CHOICE_HINTS: Record<string, RegExp> = {
  // Languages and runtimes
  "api-fastapi": /\b(python|fastapi|django|flask)\b/,
  "api-go": /\b(go|golang)\b/,
  // Native iOS only when asked for; "iOS and Android" means a cross-platform app.
  "ios-swiftui": /\b(swift|swiftui|xcode|solo ios|solo para ios|iphone nativa)\b/,
  "mobile-expo": /\b(android|expo|react native|multiplataforma|ios y android|android y ios)\b/,
  bun: /\bbun\b/,
  "cloudflare-workers": /\b(cloudflare|workers|edge)\b/,
  vue: /\bvue\b/,
  svelte: /\bsvelte\b/,
  solid: /\bsolid\b/,
  // Categories
  "better-auth": /\b(login|auth|autenticacion|registro|usuarios|cuentas|sign ?in|iniciar sesion)\b/,
  "drizzle-postgres": /\b(base de datos|database|postgres|sql|drizzle)\b/,
  stripe: /\b(pagos|pago|cobrar|suscripcion|stripe|payments|checkout|facturacion)\b/,
  resend: /\b(email|correo|emails|newsletter|notificaciones por correo)\b/,
  "next-intl": /\b(idiomas|multidioma|traduccion|i18n|internacional)\b/,
  "i18next-expo": /\b(idiomas|multidioma|traduccion|i18n|internacional)\b/,
  "vercel-ai-sdk": /\b(ia|ai|chat|chatbot|llm|asistente|claude|gpt|inteligencia artificial)\b/,
  motion: /\b(animacion|animaciones|animado|animated|motion|transiciones)\b/,
  "posthog-nextjs": /\b(analitica|analytics|metricas de producto|embudos|funnels)\b/,
  "vercel-analytics": /\b(analitica|analytics|visitas)\b/,
  "sentry-nextjs": /\b(errores|sentry|monitoreo|monitorizacion|observabilidad)\b/,
  "sentry-node": /\b(errores|sentry|monitoreo|monitorizacion|observabilidad)\b/,
  "sentry-go": /\b(errores|sentry|monitoreo|monitorizacion|observabilidad)\b/,
  "sentry-python": /\b(errores|sentry|monitoreo|monitorizacion|observabilidad)\b/,
  vitest: /\b(tests|testing|pruebas|unit)\b/,
  "vitest-node": /\b(tests|testing|pruebas|unit)\b/,
  "jest-expo": /\b(tests|testing|pruebas|unit)\b/,
  playwright: /\b(e2e|end to end|playwright)\b/,
  "github-actions": /\b(ci|integracion continua|github actions)\b/,
  docker: /\b(docker|contenedor|container|self.?host)\b/,
  supabase: /\b(supabase|backend|login|usuarios|base de datos|auth)\b/,
  nativewind: /\b(tailwind|nativewind)\b/,
  seo: /\b(seo|google|open graph|posicionamiento)\b/,
};

/**
 * On a tie, the general-purpose kit wins; kits for another language or platform
 * (Python, Go, native iOS) only when the description asks for them.
 */
const NICHE = new Set(["api-fastapi", "api-go", "ios-swiftui"]);

function scoreKit(kit: Kit, text: string): number {
  let score = 0;
  if (CATEGORY_HINTS[kit.category]?.test(text)) score += 3;
  const words = [kit.name, ...kit.tags].map(normalize);
  for (const word of words) if (word.length > 2 && new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text)) score += 2;
  if (CHOICE_HINTS[kit.name]?.test(text)) score += 6;
  return score;
}

/**
 * Keyword recommender: works offline and without an API key. It's the
 * fallback when Claude isn't configured or fails.
 */
export function recommendHeuristic(description: string, kits: Kit[]): Recommendation {
  if (!kits.length) throw new Error("No hay kits para recomendar");
  const text = normalize(description);
  const ranked = kits
    .map((kit) => ({ kit, score: scoreKit(kit, text) }))
    .sort((a, b) => b.score - a.score || Number(NICHE.has(a.kit.name)) - Number(NICHE.has(b.kit.name)));
  const { kit } = ranked[0]!;
  const reasons = [ranked[0]!.score > 0 ? `${kit.title}: es el kit que mejor encaja con la descripción.` : `${kit.title}: no hay pistas claras, así que es un punto de partida general.`];

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
  const defaults = defaultSelections(kit);
  const options: Record<string, string[]> = { ...defaults.options };
  for (const [id, values] of Object.entries(rec.options)) {
    const option = kit.options.find((o) => o.id === id);
    if (!option) continue;
    const valid = values.filter((v) => option.choices.some((c) => c.id === v));
    if (!valid.length) continue;
    options[id] = option.type === "select" ? valid.slice(0, 1) : [...new Set(valid)];
  }
  // Add what the chosen choices require, when the requirement is a single choice.
  for (let pass = 0; pass < 3; pass++) {
    for (const option of kit.options) {
      for (const id of options[option.id] ?? []) {
        const choice = option.choices.find((c) => c.id === id);
        for (const [reqOption, allowed] of Object.entries(choice?.requires ?? {})) {
          const current = options[reqOption] ?? [];
          if (!current.some((v) => allowed.includes(v)) && allowed.length) {
            const target = kit.options.find((o) => o.id === reqOption);
            options[reqOption] = target?.type === "multi" ? [...current.filter((v) => v !== "none"), allowed[0]!] : [allowed[0]!];
          }
        }
      }
    }
  }
  const selections = pruneSelections(kit, { ...defaults, options });
  validateSelections(kit, selections);
  return { ...rec, kit: kit.name, options: selections.options, selections, source };
}
