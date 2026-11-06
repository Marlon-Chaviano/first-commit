import { z } from "zod";

import { defaultSelections, type Selections } from "./resolve";
import type { Kit } from "./schema";
import { selectionsFrom } from "./selections";

/**
 * A stack is a kit plus a set of options with its own indexable page
 * (/stacks/nextjs-supabase-stripe). Curated ones live in registry/stacks.json;
 * popular ones come from the most installed combinations.
 */
export const stackSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  kit: z.string(),
  /** Only the options that differ from the kit's defaults. */
  options: z.record(z.string(), z.array(z.string())).default({}),
  title: z.string(),
  description: z.string(),
});
export const stacksSchema = z.array(stackSchema).superRefine((stacks, ctx) => {
  const seen = new Set<string>();
  stacks.forEach((s, i) => {
    if (seen.has(s.slug)) ctx.addIssue({ code: "custom", path: [i, "slug"], message: `Duplicate stack "${s.slug}"` });
    seen.add(s.slug);
  });
});
export type Stack = z.infer<typeof stackSchema>;

/** Full selections for a stack; throws if the combination isn't valid for the kit. */
export function stackSelections(kit: Kit, options: Record<string, string[]>): Selections {
  return selectionsFrom(kit, { options }, { requirements: "throw" }).selections;
}

/** Options that differ from the kit's defaults, e.g. { payments: ["stripe"] }. */
export function changedOptions(kit: Kit, sel: Selections): Record<string, string[]> {
  const defaults = defaultSelections(kit).options;
  const same = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every((x) => b.includes(x));
  return Object.fromEntries(Object.entries(sel.options).filter(([id, v]) => !same(v, defaults[id])));
}

/** Deterministic slug for a popular combination: kit + the chosen choice ids, in option order. */
export function stackSlug(kit: Kit, options: Record<string, string[]>): string {
  const parts = kit.options.flatMap((o) => (options[o.id] ?? []).filter((v) => v !== "none").sort());
  return [kit.name, ...parts].join("-").replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 120).replace(/-$/, "");
}
