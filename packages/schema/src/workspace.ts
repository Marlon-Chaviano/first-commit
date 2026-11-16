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
export function selectedServices(kit: Kit, sel: Selections): { id: string; variant: string; path: string; kit: Kit; sel: Selections }[] {
  return Object.entries(kit.services ?? {}).flatMap(([id, variants]) => {
    const variant = sel.options[id]?.[0];
    const child = variant ? variants[variant] : undefined;
    if (!child || !variant) return [];
    const prefix = servicePrefix(id, variant);
    const options = Object.fromEntries(Object.entries(sel.options).filter(([key]) => key.startsWith(prefix)).map(([key, values]) => [key.slice(prefix.length), values]));
    return [{ id, variant, path: kit.workspace!.services[id]!.path, kit: child, sel: pruneSelections(child, {
      ...defaultSelections(child), options: { ...defaultSelections(child).options, ...options }, agents: sel.agents,
      pm: child.packageManagers.includes(sel.pm) ? sel.pm : child.packageManagers[0]!,
      addSkills: [], removeSkills: sel.removeSkills, badge: false,
    }) }];
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
