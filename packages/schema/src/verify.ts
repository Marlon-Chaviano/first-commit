import { z } from "zod";

import { BRAND } from "./brand";
import { allKitSkills, defaultSelections, pruneSelections, requirementsMet, validateSelections, type Selections } from "./resolve";
import type { Kit } from "./schema";

export const DEFAULT_VERIFY_COMMAND = "{{pm}} run build";

/** `aud` of the GitHub OIDC token that signs uploaded verification reports. */
export const VERIFICATION_AUDIENCE = BRAND.name;

export interface TestCombination {
  /** "defaults" or the flags that differ, e.g. "--styling nativewind". */
  label: string;
  sel: Selections;
}

/**
 * What `create-first-commit test` installs and builds. Skills are left out (they are checked
 * once, separately) and a single agent is used: they don't affect the build.
 */
export function testCombinations(kit: Kit): TestCombination[] {
  const base: Selections = { ...defaultSelections(kit), removeSkills: allKitSkills(kit), agents: ["claude-code"] };
  const combos: TestCombination[] = [{ label: "defaults", sel: base }];

  const variant = (overrides: Record<string, string[]>): TestCombination => {
    const sel = pruneSelections(kit, { ...base, options: { ...base.options, ...overrides } }, new Set(Object.keys(overrides)));
    validateSelections(kit, sel);
    const label = Object.entries(overrides)
      .map(([id, values]) => `--${id} ${values.join(",") || "none"}`)
      .join(" ");
    return { label, sel };
  };

  if (kit.verify?.matrix) {
    for (const overrides of kit.verify.matrix) combos.push(variant(overrides));
  } else {
    // One extra combination per option: its first allowed choice that isn't the default.
    for (const option of kit.options) {
      const current = base.options[option.id] ?? [];
      const next = option.choices.find((c) => !current.includes(c.id) && requirementsMet(c, base));
      if (!next) continue;
      combos.push(variant({ [option.id]: option.type === "multi" ? [...current, next.id] : [next.id] }));
    }
  }

  const seen = new Set<string>();
  return combos.filter((c) => {
    const key = JSON.stringify(c.sel.options);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const combinationResultSchema = z.object({
  label: z.string().max(500),
  options: z.record(z.string(), z.array(z.string())),
  pm: z.string(),
  ok: z.boolean(),
  durationMs: z.number().int().nonnegative(),
  /** Title of the step that failed, if any. */
  failedStep: z.string().max(300).optional(),
  /** Last lines of output, to debug without the full log. */
  error: z.string().max(4000).optional(),
});

/** Written by `create-first-commit test --report`, sent by the GitHub Action and stored by the API. */
export const verificationReportSchema = z.object({
  kit: z.string().max(200),
  version: z.string().max(32),
  cliVersion: z.string().max(32),
  platform: z.string().max(32),
  node: z.string().max(32),
  startedAt: z.iso.datetime(),
  durationMs: z.number().int().nonnegative(),
  skills: z.object({ checked: z.number().int(), missing: z.array(z.string()) }),
  combinations: z.array(combinationResultSchema).max(50),
  ok: z.boolean(),
});

export type CombinationResult = z.infer<typeof combinationResultSchema>;
export type VerificationReport = z.infer<typeof verificationReportSchema>;
