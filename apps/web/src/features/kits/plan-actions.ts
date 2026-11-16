"use server";

import { buildPlan, isProjectName, PACKAGE_MANAGER_IDS, selectionsFrom, type Step } from "@kits/schema";
import { z } from "zod";

import { canReadKit } from "@/server/kit-access";
import { getKitPage } from "@/server/registry";
import { getViewer } from "@/server/session";
import { shareInput } from "@/server/share";

export type PreviewStep = Exclude<Step, { kind: "write" }> | Omit<Extract<Step, { kind: "write" }>, "merge">;

const inputSchema = shareInput.extend({
  selections: shareInput.shape.selections.extend({ pm: z.enum(PACKAGE_MANAGER_IDS) }),
  brand: z.object({
    ref: z.string().max(200), title: z.string().max(200).optional(),
    images: z.array(z.enum(["logo", "logoDark", "icon", "appleTouchIcon", "ogImage"])).max(5).optional(),
  }).nullable().optional(),
});

/** Read-only preview. Re-load and authorize the kit; never execute the generated steps. */
export async function previewPlan(input: unknown): Promise<{ steps: PreviewStep[] } | { error: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid configuration" };
  const { kit: ref, selections, name, brand } = parsed.data;
  const page = await getKitPage(ref);
  if (!page || (page.meta.visibility !== "public" && !(await canReadKit({ visibility: page.meta.visibility, orgId: page.meta.orgId ?? null }, await getViewer())))) {
    return { error: "Kit not found" };
  }
  try {
    const sel = {
      ...selectionsFrom(page.kit, { options: selections.options, agents: selections.agents, pm: selections.pm }, { requirements: "throw" }).selections,
      addSkills: selections.addSkills, removeSkills: selections.removeSkills, badge: selections.badge,
    };
    const steps = buildPlan({ kit: page.kit, kitRef: ref, kitDir: "kit", sel, parentDir: ".", name: name && isProjectName(name) ? name : page.kit.name, git: true, brand });
    return { steps: steps.map((step) => {
      if (step.kind !== "write") return step;
      return { kind: step.kind, title: step.title, path: step.path, ...(step.optional ? { optional: true } : {}) };
    }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't load the plan" };
  }
}
