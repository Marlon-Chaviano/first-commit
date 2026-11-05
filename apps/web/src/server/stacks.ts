import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { changedOptions, stackSelections, stackSlug, stacksSchema, type Kit, type Selections, type Stack } from "@kits/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { cacheLife } from "next/cache";

import { db } from "./db";
import { installEvents } from "./db/schema";
import { getIndex, getKit, REGISTRY } from "./registry";

/** A popular combination gets its own page once it has this many installs. */
const MIN_POPULAR_INSTALLS = 10;

export interface StackPage {
  stack: Stack;
  kit: Kit;
  selections: Selections;
  /** Installs that include every choice of the stack (0 without a database). */
  installs: number;
  popular: boolean;
}

async function getCuratedStacks(): Promise<Stack[]> {
  "use cache";
  cacheLife("max");
  return stacksSchema.parse(JSON.parse(await readFile(join(REGISTRY, "stacks.json"), "utf8")));
}

/** Most installed combinations of official kits, as stacks. Recomputed daily. */
async function getPopularStacks(): Promise<{ stack: Stack; installs: number }[]> {
  "use cache";
  cacheLife("days");
  if (!db) return [];
  try {
    const official = new Set((await getIndex()).map((e) => e.name));
    const rows = await db
      .select({ kit: installEvents.kit, options: installEvents.options, installs: sql<number>`count(*)::int` })
      .from(installEvents)
      .where(and(eq(installEvents.official, true), eq(installEvents.eventType, "install")))
      .groupBy(installEvents.kit, installEvents.options)
      .having(sql`count(*) >= ${MIN_POPULAR_INSTALLS}`)
      .orderBy(desc(sql`count(*)`))
      .limit(50);
    const stacks: { stack: Stack; installs: number }[] = [];
    for (const row of rows) {
      if (!official.has(row.kit)) continue;
      const kit = await getKit(row.kit);
      if (!kit) continue;
      try {
        const options = changedOptions(kit, stackSelections(kit, row.options));
        if (!Object.keys(options).length) continue; // The defaults are the kit page itself.
        const labels = kit.options.flatMap((o) => (options[o.id] ?? []).map((id) => o.choices.find((c) => c.id === id)?.label ?? id));
        stacks.push({
          stack: { slug: stackSlug(kit, options), kit: kit.name, options, title: `${kit.title}: ${labels.join(", ")}`, description: `${kit.description} Con ${labels.join(", ")}.` },
          installs: row.installs,
        });
      } catch {
        // A combination from an older kit version that's no longer valid.
      }
    }
    return stacks;
  } catch (error) {
    console.error("[stacks] combinaciones populares no disponibles", error);
    return [];
  }
}

/** Installs whose options include every choice of the stack (jsonb containment). */
async function countInstalls(kit: string, options: Record<string, string[]>): Promise<number> {
  "use cache";
  cacheLife("days");
  if (!db) return 0;
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(installEvents)
      .where(and(eq(installEvents.kit, kit), eq(installEvents.eventType, "install"), sql`${installEvents.options} @> ${JSON.stringify(options)}::jsonb`));
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

/** Curated stacks first, then popular ones that aren't the same combination. */
export async function getStacks(): Promise<StackPage[]> {
  const [curated, popular] = await Promise.all([getCuratedStacks(), getPopularStacks()]);
  const pages: StackPage[] = [];
  const seen = new Set<string>();
  const key = (kit: string, options: Record<string, string[]>) =>
    `${kit}:${JSON.stringify(Object.entries(options).map(([k, v]) => [k, [...v].sort()]).sort())}`;
  for (const stack of curated) {
    const kit = await getKit(stack.kit);
    if (!kit) continue;
    try {
      const selections = stackSelections(kit, stack.options);
      seen.add(key(kit.name, stack.options));
      pages.push({ stack, kit, selections, installs: await countInstalls(kit.name, stack.options), popular: false });
    } catch (error) {
      console.error(`[stacks] "${stack.slug}" no es válido`, error);
    }
  }
  for (const { stack, installs } of popular) {
    if (seen.has(key(stack.kit, stack.options)) || pages.some((p) => p.stack.slug === stack.slug)) continue;
    const kit = (await getKit(stack.kit))!;
    pages.push({ stack, kit, selections: stackSelections(kit, stack.options), installs, popular: true });
  }
  return pages;
}

export async function getStack(slug: string): Promise<StackPage | null> {
  return (await getStacks()).find((p) => p.stack.slug === slug) ?? null;
}
