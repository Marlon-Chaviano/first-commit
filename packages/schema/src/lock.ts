import { z } from "zod";

import { PACKAGE_MANAGER_IDS } from "./schema";

export const LOCK_FILE = "kits.lock";

/**
 * kits.lock — committed with the project. Records where it came from so
 * `create-first-commit update`, `add` and `doctor` know what the kit manages.
 */
export const kitsLockSchema = z.object({
  lockVersion: z.literal(1),
  /** Kit reference without version ("landing-next", "ana/web", "./kit"); null if the project wasn't created from a kit. */
  kit: z.string().nullable(),
  version: z.string().nullable(),
  /** API the kit was resolved against. */
  registry: z.string().optional(),
  options: z.record(z.string(), z.array(z.string())).default({}),
  skills: z.array(z.string()).default([]),
  agents: z.array(z.string()).default([]),
  pm: z.enum(PACKAGE_MANAGER_IDS),
  dependencies: z.array(z.string()).default([]),
  devDependencies: z.array(z.string()).default([]),
  /** Catalog libraries added later with `create-first-commit add`. */
  added: z.array(z.object({ id: z.string(), at: z.iso.datetime() })).default([]),
  addedSkills: z.array(z.string()).default([]),
  /** Files written by the kit → sha256 of what was written. A different hash means the user edited it. */
  managedFiles: z.record(z.string(), z.string()).default({}),
  /** Brand profile applied with --brand / `create-first-commit brand` ("acme/web" or a local file). */
  brand: z.object({ ref: z.string(), title: z.string() }).nullable().default(null),
  updatedAt: z.iso.datetime(),
});

export type KitsLock = z.infer<typeof kitsLockSchema>;

/** Items in `next` that aren't in `prev`, and the other way round. */
export function listDiff(prev: string[], next: string[]): { added: string[]; removed: string[] } {
  return { added: next.filter((x) => !prev.includes(x)), removed: prev.filter((x) => !next.includes(x)) };
}
