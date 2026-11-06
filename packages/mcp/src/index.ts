import {
  BRAND,
  buildInitCommand,
  buildPlan,
  defaultSelections,
  initArgs,
  MCP_TARGETS,
  PACKAGE_MANAGER_IDS,
  selectionsFrom,
  type Catalog,
  type Kit,
  type RegistryEntry,
  type ResolvedRecommendation,
  type Selections,
  type Step,
} from "@kits/schema";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

/** Where the server reads kits from: the CLI (registry over HTTP) or the website (its own data). */
export interface KitsSource {
  entries(): Promise<RegistryEntry[]>;
  /** The kit with catalog libraries expanded and `extends` resolved. */
  kit(ref: string): Promise<Kit>;
  catalog(): Promise<Catalog>;
  recommend(description: string): Promise<ResolvedRecommendation>;
}

/** Commands that change the user's disk. Only the local server (`create-first-commit mcp`) has them. */
export interface LocalActions {
  /** Runs `init` with these arguments in `dir` and returns its output. */
  init(args: string[], dir: string): Promise<string>;
  /** Runs `add <piece>` in `dir` and returns its output. */
  add(piece: string, dir: string): Promise<string>;
}

export interface KitsServerOptions {
  source: KitsSource;
  version: string;
  local?: LocalActions;
  /** Working directory of the local server (where init creates the project). */
  cwd?: string;
}

const selectionInput = {
  kit: z.string().describe(`Kit: an official name (landing-next) or a community kit (user/kit).`),
  options: z
    .record(z.string(), z.array(z.string()))
    .optional()
    .describe("Option id → choice ids, only the ones that change the defaults. Get the ids from get_kit."),
  agents: z.array(z.string()).optional().describe(`Agents to configure: ${Object.keys(MCP_TARGETS).join(", ")}. Default: the kit's.`),
  pm: z.enum(PACKAGE_MANAGER_IDS).optional().describe("Package manager. Default: the kit's first one."),
};
const projectName = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._-]*$/, "lowercase letters, digits, dots, dashes")
  .describe("Folder for the new project (created inside the working directory).");

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});
const fail = (error: unknown) => ({ ...text(`Error: ${error instanceof Error ? error.message : String(error)}`), isError: true });

/** Defaults of the kit + what the agent asked for, checked like the CLI does. */
export function selectionsFor(kit: Kit, input: { options?: Record<string, string[]>; agents?: string[]; pm?: Selections["pm"] }): Selections {
  // Strict: the agent hears about a missing requirement instead of it being dropped silently.
  return selectionsFrom(kit, input, { requirements: "throw" }).selections;
}

/** One line per step, without colors: what the agent shows the user before running init. */
export function describeSteps(steps: Step[], root: string): string[] {
  const rel = (p: string) => (p.startsWith(root) ? p.slice(root.length).replace(/^\//, "") || "." : p);
  return steps.map((s) => {
    switch (s.kind) {
      case "run":
        return `${s.title}: $ ${s.command}`;
      case "copy":
        return `${s.title} → ${rel(s.to)}`;
      case "write":
        return `${s.title} ${rel(s.path)}`;
      case "git":
        return s.title;
    }
  });
}

function kitSummary(ref: string, kit: Kit) {
  return {
    kit: ref,
    version: kit.version,
    title: kit.title,
    description: kit.description,
    packageManagers: kit.packageManagers,
    skills: kit.skills,
    options: kit.options.map((o) => ({
      id: o.id,
      label: o.label,
      type: o.type,
      default: o.default,
      choices: o.choices.map((c) => ({
        id: c.id,
        label: c.label,
        ...(c.description ? { description: c.description } : {}),
        ...(c.requires ? { requires: c.requires } : {}),
      })),
    })),
    command: buildInitCommand(ref, kit, defaultSelections(kit)),
  };
}

/**
 * The kits MCP server. Read-only tools work everywhere; `init_kit` and
 * `add_library` exist only when `local` is given (never on the remote server).
 */
export function createKitsServer({ source, version, local, cwd = "." }: KitsServerOptions): McpServer {
  const server = new McpServer(
    { name: BRAND.name, version },
    {
      instructions: `${BRAND.name} creates projects from workspace kits: base project, dependencies, agent skills, MCP servers and AGENTS.md rules in one command. To start a project: recommend_kit (or search_kits) → get_kit → plan_init, show the plan to the user and only then ${local ? "init_kit" : `run the command it returns (\`${BRAND.cli}\`)`}.`,
    },
  );

  server.registerTool(
    "search_kits",
    {
      title: "Search kits",
      description: "Search the kit registry by text (name, description, tags or a library such as stripe, sentry, motion) and category.",
      inputSchema: z.object({
        query: z.string().optional().describe("Free text: 'expo', 'drizzle', 'landing'…"),
        category: z.string().optional().describe("mobile, landing, saas, api, extension…"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, category }) => {
      try {
        const q = query?.trim().toLowerCase();
        const words = q ? q.split(/\s+/) : [];
        const results = (await source.entries())
          .filter((e) => !category || e.category === category)
          .filter((e) => {
            const hay = [e.name, e.title, e.description, ...e.tags, ...(e.libraries ?? [])].join(" ").toLowerCase();
            return words.every((w) => hay.includes(w));
          })
          .map((e) => ({ kit: e.name, title: e.title, description: e.description, category: e.category, official: e.official ?? !e.name.includes("/"), libraries: e.libraries ?? [] }));
        return text(results.length ? results : "No kits match. Try another word or recommend_kit.");
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "get_kit",
    {
      title: "Get a kit",
      description: "A kit's options (with choice ids and requirements), skills, package managers and default install command.",
      inputSchema: z.object({ kit: selectionInput.kit }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ kit }) => {
      try {
        return text(kitSummary(kit, await source.kit(kit)));
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "recommend_kit",
    {
      title: "Recommend a kit",
      description: "Given a description of the project ('booking app for hair salons with payments'), returns the kit, the options and why. The combination is always valid.",
      inputSchema: z.object({ description: z.string().min(3).max(1000) }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ description }) => {
      try {
        const rec = await source.recommend(description);
        const kit = await source.kit(rec.kit);
        return text({ kit: rec.kit, options: rec.options, reasons: rec.reasons, source: rec.source, command: buildInitCommand(rec.kit, kit, rec.selections) });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.registerTool(
    "plan_init",
    {
      title: "Plan a project",
      description: "Everything init would do for these options (commands, files, skills), without running anything. Show it to the user before creating the project.",
      inputSchema: z.object({ ...selectionInput, name: projectName }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ kit: ref, name, ...input }) => {
      try {
        const kit = await source.kit(ref);
        const sel = selectionsFor(kit, input);
        const steps = buildPlan({ kit, kitDir: "", sel, parentDir: cwd, name, git: true });
        return text({ command: buildInitCommand(ref, kit, sel, name), steps: describeSteps(steps, cwd) });
      } catch (error) {
        return fail(error);
      }
    },
  );

  if (local) {
    server.registerTool(
      "init_kit",
      {
        title: "Create a project from a kit",
        description:
          "Creates the project in the working directory: runs the kit's commands, installs dependencies and skills, writes AGENTS.md. It runs commands on the user's machine: call plan_init first, show the plan and get the user's explicit approval. Takes several minutes.",
        inputSchema: z.object({
          ...selectionInput,
          name: projectName,
          brand: z
            .string()
            .optional()
            .describe("Brand profile to apply (owner/name in the registry, or a local ./brand.json): the company's colors, fonts, UI rules and docs."),
          approved: z.literal(true).describe("Set only after the user approved the plan from plan_init."),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      },
      async ({ kit: ref, name, brand, approved: _approved, ...input }) => {
        try {
          const kit = await source.kit(ref);
          const sel = selectionsFor(kit, input);
          const output = await local.init([...initArgs(ref, kit, sel, name), ...(brand ? ["--brand", brand] : []), "--yes"], cwd);
          return text(`${output}\n\nProject created in ./${name}. Read ${name}/AGENTS.md: it has the rules and the first steps.`);
        } catch (error) {
          return fail(error);
        }
      },
    );

    server.registerTool(
      "add_library",
      {
        title: "Add a library or skill",
        description:
          "Adds a catalog library (sentry, posthog, kokonutui, stripe…) or a skill (owner/repo@skill) to the project in the working directory, with its config and AGENTS.md rule. Changes files: tell the user what you're adding first.",
        inputSchema: z.object({
          piece: z.string().describe("Library id from the catalog, or owner/repo@skill"),
          dir: z.string().optional().describe("Project folder, relative to the working directory. Default: the working directory."),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      },
      async ({ piece, dir }) => {
        try {
          return text(await local.add(piece, dir ? `${cwd}/${dir}` : cwd));
        } catch (error) {
          return fail(error);
        }
      },
    );
  }

  return server;
}
