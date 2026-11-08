import "server-only";

import { createHash } from "node:crypto";

import { AGENTS, isProjectName, pruneSelections, type Kit, type Selections } from "@kits/schema";
import { eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import { db } from "./db";
import { sharedConfigs } from "./db/schema";
import { fail } from "./errors";
import { getKitPage } from "./registry";

/** Query parameter of the kit page that opens a shared configuration: /kits/landing-next?c=8f3a2Xb. */
export const SHARE_PARAM = "c";

const ID_LENGTH = 7;
const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SKILL_REF = /^[\w.-]+\/[\w.-]+@[\w.:-]+$/;

/** What the configurator sends: the shape of Selections, bounded so nobody stores a novel. */
export const shareInput = z.object({
  kit: z.string().min(1).max(200),
  name: z.string().max(80).optional(),
  selections: z.object({
    options: z.record(z.string().max(64), z.array(z.string().max(64)).max(30)),
    addSkills: z.array(z.string().regex(SKILL_REF).max(200)).max(30).default([]),
    removeSkills: z.array(z.string().max(200)).max(100).default([]),
    agents: z.array(z.string().max(64)).min(1).max(AGENTS.length),
    pm: z.string().max(20),
    badge: z.boolean().optional(),
  }),
});

export interface SharedConfig {
  id: string;
  kit: string;
  kitVersion: string;
  selections: Selections;
  name: string | null;
}

/** Stable short id: same kit + same configuration → same link. */
export function configId(kit: string, sel: Selections, name: string | null): string {
  const canonical = JSON.stringify({
    kit,
    name,
    options: Object.fromEntries(Object.entries(sel.options).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, [...v].sort()])),
    addSkills: [...sel.addSkills].sort(),
    removeSkills: [...sel.removeSkills].sort(),
    agents: [...sel.agents].sort(),
    pm: sel.pm,
    badge: sel.badge !== false,
  });
  const digest = createHash("sha256").update(canonical).digest();
  let id = "";
  for (let i = 0; i < ID_LENGTH; i++) id += BASE62[digest[i]! % BASE62.length];
  return id;
}

/**
 * Saves a configuration of a public kit and returns its id. The selections are pruned against the
 * kit (unknown options and choices dropped, requirements respected), so a link always opens a valid
 * configuration. Private kits can't be shared: the link would reveal them.
 */
export async function shareConfig(input: z.infer<typeof shareInput>): Promise<string> {
  if (!db) fail("Sharing isn't available right now", 503);
  const page = await getKitPage(input.kit);
  if (!page || page.meta.visibility !== "public") fail("Only public kits can be shared", 404);
  const kit: Kit = page.kit;

  const agents = input.selections.agents.filter((a) => AGENTS.some((known) => known.id === a));
  const pm = kit.packageManagers.includes(input.selections.pm as Selections["pm"]) ? (input.selections.pm as Selections["pm"]) : (kit.packageManagers[0] ?? "npm");
  const options = Object.fromEntries(kit.options.map((o) => [o.id, (input.selections.options[o.id] ?? [o.default].flat()).filter((c) => o.choices.some((choice) => choice.id === c))]));
  const selections = pruneSelections(kit, {
    options,
    addSkills: input.selections.addSkills,
    removeSkills: input.selections.removeSkills,
    agents: agents.length ? agents : ["claude-code"],
    pm,
    ...(input.selections.badge === false ? { badge: false } : {}),
  });
  const name = input.name && isProjectName(input.name) ? input.name : null;

  const id = configId(page.meta.slug, selections, name);
  await db
    .insert(sharedConfigs)
    .values({ id, kit: page.meta.slug, kitVersion: page.meta.version, selections, name })
    .onConflictDoNothing();
  return id;
}

/** A shared configuration by id. Cached: a link's content never changes once created. */
export async function getSharedConfig(id: string): Promise<SharedConfig | null> {
  "use cache";
  cacheLife("days");
  cacheTag(`share:${id}`);
  if (!db || !/^[0-9a-zA-Z]{7}$/.test(id)) return null;
  try {
    const [row] = await db
      .select({ id: sharedConfigs.id, kit: sharedConfigs.kit, kitVersion: sharedConfigs.kitVersion, selections: sharedConfigs.selections, name: sharedConfigs.name })
      .from(sharedConfigs)
      .where(eq(sharedConfigs.id, id))
      .limit(1);
    return row ?? null;
  } catch (error) {
    console.error("[share] unavailable", error);
    return null;
  }
}

/** One more visit to the link. Fire-and-forget: a failed count never breaks the page. */
export async function countOpen(id: string): Promise<void> {
  if (!db) return;
  await db
    .update(sharedConfigs)
    .set({ opens: sql`${sharedConfigs.opens} + 1` })
    .where(eq(sharedConfigs.id, id))
    .catch(() => undefined);
}
