import { DOCKER_DESTINATIONS, workspaceOptions } from "./workspace";
import { resolveExtends, splitKitRef, type LoadedRawKit, type PathResolver, type RawKitLoader } from "./extends";
import { expandKit, type Catalog } from "./libraries";
import { defaultSelections, validateSelections } from "./resolve";
import { parseKit, type Kit } from "./schema";
import { testCombinations } from "./verify";

/**
 * Where kits come from: the CLI (a download, a local path), the website (the
 * registry folder and published manifests) or a test (the registry folder).
 */
export interface KitSource {
  /** Raw kit.json and its folder for a reference (the parents in `extends`). */
  read: RawKitLoader;
  /** The library catalog every kit expands against. */
  catalog: () => Promise<Catalog>;
  /** Joins a kit folder and one of its relative paths. */
  resolvePath: PathResolver;
}

/**
 * A kit exactly as the CLI and the website use it: `extends` resolved, parsed,
 * catalog libraries expanded. With `admit`, it must also be installable as
 * published (see admitKit). Throws a readable error otherwise.
 */
export async function loadKitFrom(top: LoadedRawKit, source: KitSource, { admit = false }: { admit?: boolean } = {}): Promise<Kit> {
  const kit = expandKit(parseKit(await resolveExtends(top, source.read, source.resolvePath)), await source.catalog());
  if (kit.workspace) {
    if (Object.keys(kit.workspace.services).some((id) => kit.options.some((o) => o.id === id))) throw new Error("Service id conflicts with a root option");
    const paths = Object.values(kit.workspace.services).map((service) => service.path);
    if (paths.some((path, i) => paths.some((other, j) => i !== j && (path === other || path.startsWith(other + "/"))))) throw new Error("Workspace service paths overlap");
    kit.services = {};
    const catalog = await source.catalog();
    for (const [slot, service] of Object.entries(kit.workspace.services)) {
      if (service.default !== "none" && !service.variants[service.default]) throw new Error(`Unknown default service: ${slot}`);
      kit.services[slot] = {};
      for (const [id, ref] of Object.entries(service.variants)) {
        const raw = await source.read(ref);
        const parsed = parseKit(await resolveExtends(raw, source.read, source.resolvePath));
        if (parsed.workspace || parsed.category === "monorepo") throw new Error("Nested workspaces are not supported");
        if (parsed.version !== splitKitRef(ref).version) throw new Error(`Service version mismatch: ${ref}`);
        const child = expandKit(parsed, catalog);
        for (const [optionId, allowed] of Object.entries(parsed.service?.options ?? {})) {
          const option = child.options.find((option) => option.id === optionId);
          if (!option) throw new Error(`Unknown service option: ${optionId}`);
          option.choices = option.choices.filter((choice) => allowed.includes(choice.id));
          if (!option.choices.length) throw new Error(`No compatible choices for service option: ${optionId}`);
          option.default = option.type === "select" ? option.choices[0]!.id : [];
        }
        const nativeDeploy = child.options.find((option) => option.id === "deploy");
        if (kit.workspace.preserveBase && service.existing && id === service.default) {
          // The native scaffold already owns its UI and integrations. Offer additions without
          // automatically applying a standalone kit's installers over the preset's shared packages.
          for (const option of child.options) {
            const defaults = ([] as string[]).concat(option.default);
            const installs = option.choices.some((choice) => defaults.includes(choice.id) &&
              (choice.dependencies.length || choice.devDependencies.length || choice.postInstall.length || choice.writeFiles.length || choice.files));
            if (installs && option.type === "multi") option.default = [];
            else if (installs && option.choices.some((choice) => choice.id === "none")) option.default = "none";
          }
        }
        // CI is composed at workspace level. Hosting is constrained by runtime capabilities.
        child.options = child.options.filter((option) => option.id !== "ci" && option.id !== "deploy");
        const destinations = ["none", ...(child.service?.dockerfile ? DOCKER_DESTINATIONS : []), ...(["web", "docs"].includes(slot) && parsed.packageManagers.some((pm) => ["npm", "pnpm", "bun"].includes(pm)) ? ["vercel"] : [])];
        child.options.push({ id: "deploy", label: "Deployment", type: "select", default: "none", choices: destinations.map((id) => ({ id, label: id === "none" ? "Configure later" : id, dependencies: [], devDependencies: [], skills: [], mcp: {}, env: {}, postInstall: [], writeFiles: [], setupTasks: [] })) });
        if (slot === "mobile" && nativeDeploy) child.options[child.options.length - 1] = nativeDeploy;
        kit.services[slot]![id] = child;
      }
    }
    kit.options.push(...workspaceOptions(kit));
  }
  if (admit) admitKit(kit);
  return kit;
}

/** What publishing and the registry require: the defaults and every `verify.matrix` entry are valid combinations. */
export function admitKit(kit: Kit): void {
  validateSelections(kit, defaultSelections(kit));
  testCombinations(kit);
}

/** Official kits are named by a bare slug ("landing-next"); community ones are "owner/kit". */
export function isOfficialKitName(ref: string): boolean {
  return /^[a-z0-9-]+$/.test(splitKitRef(ref).base);
}
