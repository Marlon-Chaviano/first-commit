import { z } from "zod";

import { LIBRARY_CATEGORIES, LIBRARY_KINDS, LIBRARY_OPTION_IDS } from "./categories";
import { contributionShape, requiresSchema, type Choice, type Kit, type KitOption } from "./schema";

export { LIBRARY_CATEGORIES, LIBRARY_OPTION_IDS } from "./categories";

/** UI frameworks plus the platforms that change how an SDK is set up (Sentry for Next.js ≠ Sentry for Node). */
export const FRAMEWORKS = [
  "react",
  "react-native",
  "vue",
  "svelte",
  "solid",
  "vanilla",
  "nextjs",
  "expo",
  "nodejs",
  "bun",
  "cloudflare-workers",
  "python",
  "go",
  "swiftui",
  "astro",
  "sveltekit",
  "nuxt",
  "django",
  "rails",
  "laravel",
  "spring",
  "elysia",
  /** Works in any kit (e.g. workflow skills). */
  "any",
] as const;

/**
 * One UI or animation library from registry/libraries.json. Picking it in any
 * kit installs its packages/skills and writes a usage rule into AGENTS.md.
 */
export const librarySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  description: z.string(),
  url: z.url(),
  /**
   * components: the project's single component system (shadcn, HeroUI, Mantine…)
   * addon:      extra shadcn registry on top of the system (Kokonut UI, Magic UI…)
   * animation:  animation library (Motion, GSAP, anime.js…)
   * observability: errors, analytics and performance (Sentry, PostHog…)
   */
  kind: z.enum(LIBRARY_KINDS),
  frameworks: z.array(z.enum(FRAMEWORKS)).min(1),
  /** How the agent adds a component or uses the library, shown in AGENTS.md. */
  usage: z.string(),
  /** Manual setup the agent still has to do (providers, CSS imports…). Becomes a setup task. */
  setup: z.string().optional(),
  requires: requiresSchema.optional(),
  ...contributionShape,
});

export const catalogSchema = z.array(librarySchema).superRefine((libs, ctx) => {
  const seen = new Set<string>();
  libs.forEach((lib, i) => {
    if (seen.has(lib.id)) ctx.addIssue({ code: "custom", path: [i, "id"], message: `Duplicate library "${lib.id}"` });
    seen.add(lib.id);
  });
});

export type Library = z.infer<typeof librarySchema>;
export type Catalog = z.infer<typeof catalogSchema>;

export const FRAMEWORK_LABELS: Record<string, string> = {
  react: "React",
  "react-native": "React Native",
  vue: "Vue",
  svelte: "Svelte",
  solid: "Solid",
  vanilla: "Vanilla",
  nextjs: "Next.js",
  expo: "Expo",
  nodejs: "Node.js",
  bun: "Bun",
  "cloudflare-workers": "Workers",
  python: "Python",
  go: "Go",
  swiftui: "SwiftUI",
  astro: "Astro",
  sveltekit: "SvelteKit",
  nuxt: "Nuxt",
  django: "Django",
  rails: "Rails",
  laravel: "Laravel",
  spring: "Spring",
  elysia: "Elysia",
  any: "Cualquiera",
};


/**
 * Turns the kit's `libraries` declaration into ordinary options, so resolving,
 * validation, flags (--components, --component-addons, --animation) and the
 * website configurator all work without special cases.
 */
export function expandKit(kit: Kit, catalog: Catalog): Kit {
  const libs = kit.libraries;
  if (!libs) return kit;

  // Fixed framework(s), or every framework the framework option can produce.
  const frameworkOption = typeof libs.framework === "object" && !Array.isArray(libs.framework) ? libs.framework.option : null;
  const frameworks = frameworkOption
    ? (kit.options.find((o) => o.id === frameworkOption)?.choices.map((c) => c.id) ?? [])
    : ([] as string[]).concat(libs.framework as string | string[]);
  const available = (kind: Library["kind"]) =>
    catalog.filter((l) => l.kind === kind && (l.frameworks.includes("any") || l.frameworks.some((f) => frameworks.includes(f))));

  // Same name in one category (Sentry for Node, Bun, Workers…): add the platform to tell them apart.
  const sameName = (lib: Library) => catalog.filter((l) => l.kind === lib.kind && l.name === lib.name && l.frameworks.some((f) => frameworks.includes(f))).length > 1;
  const label = (lib: Library) =>
    sameName(lib)
      ? `${lib.name} (${lib.frameworks.filter((f) => frameworks.includes(f)).map((f) => FRAMEWORK_LABELS[f] ?? f).join(", ")})`
      : lib.name;

  const toChoice = (lib: Library): Choice => {
    const requires = { ...lib.requires };
    if (frameworkOption) requires[frameworkOption] = lib.frameworks.filter((f) => frameworks.includes(f));
    return {
      id: lib.id,
      label: label(lib),
      description: lib.description,
      requires: Object.keys(requires).length ? requires : undefined,
      dependencies: lib.dependencies,
      devDependencies: lib.devDependencies,
      skills: lib.skills,
      mcp: lib.mcp,
      env: lib.env,
      files: lib.files,
      postInstall: lib.postInstall,
      writeFiles: lib.writeFiles,
      setupTasks: [...(lib.setup ? [`${lib.name}: ${lib.setup}`] : []), ...lib.setupTasks],
      instructions: libraryRule(lib),
    };
  };
  const none: Choice = {
    id: "none",
    label: "Ninguna",
    dependencies: [],
    devDependencies: [],
    skills: [],
    mcp: {},
    env: {},
    postInstall: [],
    writeFiles: [],
    setupTasks: [],
  };

  const declared = libs as Record<string, unknown>;
  const options: KitOption[] = [];
  for (const category of LIBRARY_CATEGORIES) {
    const value = declared[category.key];
    if (value === undefined) continue;
    if (kit.options.some((o) => o.id === category.optionId)) {
      throw new Error(`La opción "${category.optionId}" del kit choca con la categoría de bibliotecas "${category.key}"`);
    }
    const libraries = available(category.kind).map(toChoice);
    if (category.type === "select") {
      options.push({ id: category.optionId, label: category.label, description: "description" in category ? category.description : undefined, type: "select", default: value as string, choices: [none, ...libraries] });
    } else if (libraries.length) {
      options.push({ id: category.optionId, label: category.label, description: "description" in category ? category.description : undefined, type: "multi", default: value as string[], choices: libraries });
    }
  }
  return { ...kit, options: [...kit.options, ...options] };
}

/** The AGENTS.md rule that pins the agent to the chosen library. */
export function libraryRule(lib: Library): string {
  switch (lib.kind) {
    case "components":
      return `## Componentes de UI: ${lib.name}

Toda la interfaz se construye con **${lib.name}** (${lib.url}) y, si las hay, con las bibliotecas complementarias de abajo. Es la única fuente de componentes del proyecto.

- Antes de escribir un componente, busca si ya existe en ${lib.name}. Añádelo con: \`${lib.usage}\`.
- No instales otras bibliotecas de componentes ni recrees a mano un componente que ${lib.name} ya ofrece.
- Personaliza con el sistema de temas de ${lib.name}, no con estilos sueltos.`;
    case "addon":
      return `## Biblioteca complementaria: ${lib.name}

Para secciones vistosas o casos que la biblioteca base no cubre, usa **${lib.name}** (${lib.url}): \`${lib.usage}\`. Revisa su catálogo antes de construir algo similar desde cero.`;
    case "animation":
      return `## Animaciones: ${lib.name}

Usa **${lib.name}** (${lib.url}) para animar. ${lib.usage} No añadas bibliotecas de animación distintas de las elegidas en este proyecto y respeta \`prefers-reduced-motion\`.`;
    case "observability":
      return `## Observabilidad: ${lib.name}

**${lib.name}** (${lib.url}) ya está configurado. ${lib.usage}`;
    default: {
      const category = LIBRARY_CATEGORIES.find((c) => c.kind === lib.kind)!;
      const only =
        category.type === "select"
          ? ` Es la única solución de ${category.label.toLowerCase()} del proyecto: no añadas otra.`
          : "";
      return `## ${category.label}: ${lib.name}

**${lib.name}** (${lib.url}) ya está configurado. ${lib.usage}${only}`;
    }
  }
}
