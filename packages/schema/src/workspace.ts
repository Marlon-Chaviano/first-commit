import type { Kit, KitOption } from "./schema";
import { defaultSelections, pruneSelections, type Selections } from "./resolve";

/** Scoped option ids deliberately use the existing selection/URL/CLI protocol. */
export function servicePrefix(slot: string, variant: string): string { return `${slot}.${variant}.`; }
export function workspaceOptions(kit: Kit): KitOption[] {
  return Object.entries(kit.services ?? {}).flatMap(([slot, variants]) => {
    const definition = kit.workspace!.services[slot]!;
    const selector: KitOption = { id: slot, label: definition.label, type: "select", default: definition.default, choices: [
      { id: "none", label: "None", dependencies: [], devDependencies: [], skills: [], mcp: {}, env: {}, postInstall: [], writeFiles: [], setupTasks: [] },
      ...Object.entries(variants).map(([id, child]) => ({ id, label: child.title, description: child.description, dependencies: [], devDependencies: [], skills: child.skills, mcp: {}, env: {}, postInstall: [], writeFiles: [], setupTasks: [] })),
    ] };
    return [selector, ...Object.entries(variants).flatMap(([variant, child]) => child.options.map((option) => {
      const prefix = servicePrefix(slot, variant);
      return { ...option, id: prefix + option.id, choices: option.choices.map((choice) => ({
        id: choice.id, label: choice.label, description: choice.description,
        dependencies: [], devDependencies: [], skills: choice.skills, mcp: {}, env: {}, postInstall: [], writeFiles: [], setupTasks: [],
        requires: { [slot]: [variant], ...(option.id === "deploy" && choice.id !== "none" && kit.options.some((o) => o.id === "deployment") ? { deployment: ["independent"] } : {}), ...Object.fromEntries(Object.entries(choice.requires ?? {}).map(([id, values]) => [prefix + id, values])) },
      })) };
    }))];
  });
}

/** Embedded apps share the native preset's build context. Their standalone Docker recipe
 * becomes usable again when the selected composition scaffolds them independently. */
function workspaceApps(kit: Kit, sel: Selections) {
  const native = preservesWorkspaceBase(kit, sel);
  return Object.entries(kit.services ?? {}).flatMap(([id, variants]) => {
    const variant = sel.options[id]?.[0];
    const child = variant && variants[variant];
    if (!child || !variant) return [];
    const slot = kit.workspace!.services[id]!;
    const embedded = native && Boolean(slot.existing);
    const effectiveKit = embedded && child.service?.dockerfile
      ? { ...child, service: { ...child.service, dockerfile: undefined } }
      : child;
    return [{ id, variant, path: slot.path, kit: effectiveKit, embedded }];
  });
}

export const DOCKER_DESTINATIONS = ["docker", "railway", "render"];

/** Hosting choices depend on the selected topology as well as the individual framework. */
export function workspaceChoices(kit: Kit, sel: Selections, option: KitOption) {
  if (!kit.workspace) return option.choices;
  if (option.id === "deployment") {
    const servers = workspaceApps(kit, sel).filter((app) => app.id !== "mobile");
    if (servers.length && servers.every((app) => app.kit.service?.dockerfile)) return option.choices;
    return option.choices.filter((choice) => choice.id !== "compose");
  }
  if (option.id.endsWith(".deploy")) {
    const [slot, variant] = option.id.split(".");
    const app = workspaceApps(kit, sel).find((app) => app.id === slot && app.variant === variant);
    if (app?.embedded) return option.choices.filter((choice) => !DOCKER_DESTINATIONS.includes(choice.id));
  }
  return option.choices;
}

export function selectedServices(kit: Kit, sel: Selections) {
  return workspaceApps(kit, sel).map((app) => {
    const child = app.kit;
    const prefix = servicePrefix(app.id, app.variant);
    const options = Object.fromEntries(Object.entries(sel.options).filter(([key]) => key.startsWith(prefix)).map(([key, values]) => [key.slice(prefix.length), values]));
    const defaults = defaultSelections(child);
    return { ...app, sel: pruneSelections(child, {
      ...defaults, options: { ...defaults.options, ...options }, agents: sel.agents,
      pm: child.packageManagers.includes(sel.pm) ? sel.pm : child.packageManagers[0]!,
      addSkills: [], removeSkills: sel.removeSkills, badge: false,
    }) };
  });
}
export function serviceOptionVisible(kit: Kit, sel: Selections, option: KitOption): boolean {
  if (!kit.workspace || !option.id.includes(".")) return true;
  const [slot, variant] = option.id.split(".");
  return sel.options[slot!]?.[0] === variant;
}

/** A native preset remains intact only while its existing services retain their framework. */
export function preservesWorkspaceBase(kit: Kit, sel: Selections): boolean {
  return Boolean(kit.workspace?.preserveBase &&
    Object.entries(kit.workspace.services).every(([id, service]) => !service.existing || sel.options[id]?.[0] === service.default) &&
    Object.entries(kit.workspace.preserveWhen ?? {}).every(([id, allowed]) => (sel.options[id] ?? []).some((value) => allowed.includes(value))));
}

/** Translate historical preset flags before validating against the composed kit. */
export function workspaceSelectionOptions(kit: Kit, options: Record<string, string[]>): Record<string, string[]> {
  const migrated: Record<string, string[]> = {};
  const original = { ...options };
  for (const [id, rule] of Object.entries(kit.workspace?.migrations ?? {})) {
    const values = options[id];
    if (!values || (!rule.defaults && !values.some((value) => rule.choices[value]))) continue;
    Object.assign(migrated, rule.defaults);
    for (const value of values) Object.assign(migrated, rule.choices[value]);
    delete original[id];
  }
  return { ...migrated, ...original };
}
