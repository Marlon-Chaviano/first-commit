import { defaultSelections, pruneSelections, requirementsMet, validateSelections, type Selections } from "./resolve";
import type { Choice, Kit } from "./schema";

/**
 * What to do when a requested choice needs another one (Better Auth → Drizzle):
 * - "throw":    report it (an agent or a stack asked for something exact).
 * - "autofill": select the first allowed choice of the required option (the website, the recommender).
 * - "prune":    drop the requested choice (a saved project after an update, a hand-edited URL).
 */
export type RequirementPolicy = "throw" | "autofill" | "prune";

export interface SelectionRequest {
  /** Selections to start from; the kit's defaults when omitted. */
  base?: Selections;
  /** option id → choice ids. Only these options follow the requirement policy; the rest are pruned. */
  options?: Record<string, string[]>;
  agents?: string[];
  pm?: Selections["pm"];
}

export interface SelectionOptions {
  requirements?: RequirementPolicy;
  /** Unknown options or choices: an error ("throw") or skipped ("ignore", for model output and URLs). */
  unknown?: "throw" | "ignore";
}

export interface SelectionResult {
  selections: Selections;
  /** Choices selected to satisfy a requirement ("autofill"), with labels for a notice. */
  added: { optionId: string; choiceId: string; label: string }[];
  /** Requested choices that were removed because their requirements weren't met ("prune"). */
  dropped: { optionId: string; choiceId: string }[];
}

/**
 * The one way to turn a partial request into valid selections for a kit:
 * kit defaults (or `base`) ⊕ request → requirements per policy → prune → validate.
 * Throws a readable error when the result isn't a valid combination.
 */
export function selectionsFrom(kit: Kit, request: SelectionRequest, { requirements = "prune", unknown = "throw" }: SelectionOptions = {}): SelectionResult {
  const base = request.base ?? defaultSelections(kit);
  const sel: Selections = {
    ...base,
    options: { ...base.options },
    agents: request.agents?.length ? request.agents : base.agents,
    pm: request.pm ?? base.pm,
  };
  const requested = new Set<string>();

  for (const [id, values] of Object.entries(request.options ?? {})) {
    const option = kit.options.find((o) => o.id === id);
    if (!option) {
      if (unknown === "throw") throw new Error(`"${kit.name}" has no "${id}" option. Options: ${kit.options.map((o) => o.id).join(", ") || "none"}`);
      continue;
    }
    const known = [...new Set(values)].filter((v) => {
      if (option.choices.some((c) => c.id === v)) return true;
      if (unknown === "throw") throw new Error(`"${v}" isn't a value of ${id}. Values: ${option.choices.map((c) => c.id).join(", ")}`);
      return false;
    });
    if (!known.length && values.length) continue;
    // A select keeps the first value when the input may be sloppy (model output); otherwise validation reports it.
    sel.options[id] = option.type === "select" && unknown === "ignore" ? known.slice(0, 1) : known;
    requested.add(id);
  }

  const added: SelectionResult["added"] = [];
  if (requirements === "autofill") added.push(...autofill(kit, sel, requested));
  if (requirements === "throw") {
    for (const id of requested) {
      const option = kit.options.find((o) => o.id === id)!;
      for (const value of sel.options[id] ?? []) {
        const choice = option.choices.find((c) => c.id === value)!;
        if (!requirementsMet(choice, sel)) {
          const needs = Object.entries(choice.requires ?? {}).map(([o, ids]) => `${o}=${ids.join("|")}`).join(", ");
          throw new Error(`"${value}" (${id}) needs ${needs}: add it too.`);
        }
      }
    }
  }

  // Requested options are kept as asked under "throw" (validation reports them); everything else is pruned.
  const pruned = pruneSelections(kit, sel, requirements === "throw" ? requested : new Set());
  const dropped = [...requested].flatMap((id) =>
    (sel.options[id] ?? []).filter((v) => !(pruned.options[id] ?? []).includes(v)).map((choiceId) => ({ optionId: id, choiceId })),
  );
  validateSelections(kit, pruned);
  return { selections: pruned, added, dropped };
}

/** "Requiere shadcn/ui" — names the choices a choice is waiting for. */
export function requirementText(kit: Kit, choice: Choice): string {
  const needs = Object.entries(choice.requires ?? {}).map(([optionId, ids]) => {
    const option = kit.options.find((o) => o.id === optionId);
    return ids.map((id) => option?.choices.find((c) => c.id === id)?.label ?? id).join(" or ");
  });
  return `Requires ${needs.join(" and ")}`;
}

/**
 * Selects what the requested choices require (first allowed choice of each
 * required option), and what those additions require in turn. Only requested
 * options are followed: deselecting Drizzle must not bring it back for Better
 * Auth (pruning drops Better Auth instead).
 */
function autofill(kit: Kit, sel: Selections, requested: ReadonlySet<string>): SelectionResult["added"] {
  const added: SelectionResult["added"] = [];
  const follow = new Set(requested);
  for (let changed = true, passes = 0; changed && passes <= kit.options.length; passes++) {
    changed = false;
    for (const option of kit.options.filter((o) => follow.has(o.id))) {
      for (const id of sel.options[option.id] ?? []) {
        const choice = option.choices.find((c) => c.id === id);
        for (const [reqId, allowed] of Object.entries(choice?.requires ?? {})) {
          const target = kit.options.find((o) => o.id === reqId);
          const current = sel.options[reqId] ?? [];
          if (!target || current.some((v) => allowed.includes(v))) continue;
          const pick = target.choices.find((c) => allowed.includes(c.id));
          if (!pick) continue;
          sel.options[reqId] = target.type === "multi" ? [...current.filter((v) => v !== "none"), pick.id] : [pick.id];
          added.push({ optionId: reqId, choiceId: pick.id, label: pick.label });
          follow.add(reqId);
          changed = true;
        }
      }
    }
  }
  return added;
}
