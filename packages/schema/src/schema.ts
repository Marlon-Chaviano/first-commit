import { z } from "zod";

import { LANGUAGE_IDS } from "./languages";

import { LIBRARY_CATEGORIES } from "./categories";

/** One default per catalog category: a choice id for "select" categories, a list for "multi". Omit a key to not offer it. */
const categoryDefaults = Object.fromEntries(
  LIBRARY_CATEGORIES.map((c) => [c.key, c.type === "select" ? z.string().optional() : z.array(z.string()).optional()]),
) as { [C in (typeof LIBRARY_CATEGORIES)[number] as C["key"]]: C["type"] extends "select" ? z.ZodOptional<z.ZodString> : z.ZodOptional<z.ZodArray<z.ZodString>> };

/** JavaScript managers plus the ones used by kits in other languages. */
export const PACKAGE_MANAGER_IDS = ["npm", "pnpm", "bun", "deno", "uv", "pip", "go", "swift", "bundler", "composer", "maven", "cargo"] as const;

export const SEMVER = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;

/** "owner/repo@skill" — the same reference format skills.sh uses. */
export const skillRefSchema = z
  .string()
  .regex(/^[\w.-]+\/[\w.-]+@[\w.:-]+$/, 'Skill reference must look like "owner/repo@skill"');

/** A stdio server (command + args) or a remote one (url). */
export const mcpServerSchema = z.union([
  z.object({
    command: z.string(),
    args: z.array(z.string()).default([]),
    env: z.record(z.string(), z.string()).optional(),
  }),
  z.object({
    url: z.url(),
    headers: z.record(z.string(), z.string()).optional(),
  }),
]);

/**
 * create:        write only if the file doesn't exist
 * append:        add to the end unless the content is already there
 * prepend:       add to the start unless the content is already there
 * insert-before: add right before the first `anchor` (e.g. "</body>"); fails if the anchor is missing
 * json-merge:    deep-merge JSON content (package.json scripts, app.json plugins…); only adds what's
 *                missing — existing values win, arrays get the new items appended
 */
export const writeFileSchema = z.object({
  path: z.string().regex(/^(?!\/)(?!(?:.*\/)?\.\.(?:\/|$))[\w./@()[\]-]+$/, "Relative path inside the project"),
  content: z.string(),
  mode: z.enum(["create", "append", "prepend", "insert-before", "json-merge"]).default("create"),
  anchor: z.string().optional(),
});

/**
 * Everything a kit or a single option choice can contribute to a project.
 * Choices reuse the same shape so "pick Supabase" can add deps, skills, MCP
 * servers, files and agent instructions in one place.
 */
export const contributionShape = {
  dependencies: z.array(z.string()).default([]),
  devDependencies: z.array(z.string()).default([]),
  skills: z.array(skillRefSchema).default([]),
  mcp: z.record(z.string(), mcpServerSchema).default({}),
  env: z.record(z.string(), z.string()).default({}),
  /** Directory (relative to the kit root) copied over the generated project. A list when inherited via `extends`. */
  files: z.union([z.string(), z.array(z.string())]).optional(),
  /** Markdown appended to AGENTS.md. */
  instructions: z.string().optional(),
  /** Shell commands run inside the project after dependencies are installed. */
  postInstall: z.array(z.string()).default([]),
  /** Small files written inline (no download needed), or patches to existing ones. */
  writeFiles: z.array(writeFileSchema).default([]),
  /** Steps that can't be automated (create a Sentry project, paste a DSN…): a checklist in AGENTS.md. */
  setupTasks: z.array(z.string()).default([]),
};


/** option id → choice ids, at least one of which must be selected. */
export const requiresSchema = z.record(z.string(), z.array(z.string()).min(1));

export const choiceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string(),
  description: z.string().optional(),
  /** Only selectable when every listed option has one of these choices (e.g. { "styling": ["nativewind"] }). */
  requires: requiresSchema.optional(),
  ...contributionShape,
});

export const optionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  label: z.string(),
  description: z.string().optional(),
  /** "select": exactly one choice. "multi": any number of choices. */
  type: z.enum(["select", "multi"]).default("select"),
  /** Choice id for "select", list of choice ids for "multi". */
  default: z.union([z.string(), z.array(z.string())]),
  choices: z.array(choiceSchema).min(1),
});

export const kitSchema = z
  .object({
    $schema: z.string().optional(),
    name: z.string().regex(/^[a-z0-9-]+$/),
    /** Semver of this kit. Install a specific one with `init <kit>@<version>`. */
    version: z.string().regex(SEMVER, "version must be semver, e.g. 1.0.0"),
    /** Kit this one builds on ("landing-next", "user/repo/path", optionally @version). Resolved before parsing. */
    extends: z.string().optional(),
    title: z.string(),
    description: z.string(),
    category: z.enum(["mobile", "web", "landing", "saas", "api", "extension", "other"]),
    tags: z.array(z.string()).default([]),
    author: z.string(),
    /** Command that scaffolds the project. Must create the {{name}} directory. */
    base: z.object({
      command: z.string(),
      /** Command that installs the base project's dependencies, if the scaffolder skipped it. */
      install: z.string().optional(),
    }),
    /** Override how dependencies are added, e.g. "npx expo install {{packages}}". */
    addCommand: z
      .object({
        dependencies: z.string().optional(),
        devDependencies: z.string().optional(),
      })
      .optional(),
    packageManagers: z.array(z.enum(PACKAGE_MANAGER_IDS)).default(["npm", "pnpm", "bun"]),
    /** Main language (for the language pages); defaults to the one of the first package manager. */
    language: z.enum(LANGUAGE_IDS).optional(),
    /** How `create-first-commit test` checks that a generated project works. */
    verify: z
      .object({
        /** Run inside the generated project. Same variables as `base.command`. */
        command: z.string().default("{{pm}} run build"),
        /**
         * Combinations to test, each over the defaults (e.g. { "styling": ["nativewind"] }).
         * Without it: the defaults plus one combination per option.
         */
        matrix: z.array(z.record(z.string(), z.array(z.string()))).optional(),
      })
      .optional(),
    options: z.array(optionSchema).default([]),
    /**
     * Offer libraries from the shared catalog (registry/libraries.json). The kit's
     * framework decides which ones; values are the defaults ("none" / [] for none).
     */
    libraries: z
      .object({
        /** Fixed framework(s) (["react", "nextjs"]) or the option whose choice id is the framework. */
        framework: z.union([z.string(), z.array(z.string()).min(1), z.object({ option: z.string() })]),
        ...categoryDefaults,
      })
      .optional(),
    ...contributionShape,
  })
  .superRefine((kit, ctx) => {
    kit.options.forEach((option, i) => {
      const ids = new Set(option.choices.map((c) => c.id));
      const defaults = Array.isArray(option.default) ? option.default : [option.default];
      if (option.type === "select" && Array.isArray(option.default)) {
        ctx.addIssue({ code: "custom", path: ["options", i, "default"], message: "select options need a single default" });
      }
      for (const d of defaults) {
        if (!ids.has(d)) {
          ctx.addIssue({ code: "custom", path: ["options", i, "default"], message: `Unknown choice "${d}"` });
        }
      }
    });
  });

export type SkillRef = z.infer<typeof skillRefSchema>;
export type WriteFile = z.infer<typeof writeFileSchema>;
export type McpServer = z.infer<typeof mcpServerSchema>;
export type Choice = z.infer<typeof choiceSchema>;
export type KitOption = z.infer<typeof optionSchema>;
export type Kit = z.infer<typeof kitSchema>;
/** Raw kit.json as authored (defaults not yet applied). */
export type KitInput = z.input<typeof kitSchema>;

export function parseKit(data: unknown): Kit {
  const result = kitSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid kit.json:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
