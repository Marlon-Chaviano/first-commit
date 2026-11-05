import "server-only";

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  catalogSchema,
  expandKit,
  parseKit,
  resolveExtends,
  splitKitRef,
  type Catalog,
  type Kit,
  type LoadedRawKit,
  type RegistryEntry,
} from "@kits/schema";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "./db";
import { kits, kitVersions, user } from "./db/schema";

/** The official registry lives at the monorepo root; it changes only on deploy. */
export const REGISTRY = join(process.cwd(), "..", "..", "registry");
/** Community kits change when someone publishes: invalidate with revalidateTag(REGISTRY_TAG). */
export const REGISTRY_TAG = "registry";

const OFFICIAL_NAME = /^[a-z0-9-]+$/;
const COMMUNITY_SLUG = /^[a-z0-9-]+\/[a-z0-9-]+$/;

export interface KitMeta {
  slug: string;
  version: string;
  official: boolean;
  /** Community kits: owner's handle and where the files live. */
  owner?: { handle: string; name: string; image: string | null };
  repo?: string;
  path?: string;
  publishedAt?: string;
  /** Premium kits: one-time price in cents; downloading needs a license. */
  priceCents?: number | null;
  /** "org" kits are only for members of `orgId`: check with canReadKit before showing them. */
  visibility: "public" | "org";
  orgId?: string | null;
}

/** Official kits (registry/index.json). */
export async function getIndex(): Promise<RegistryEntry[]> {
  "use cache";
  cacheLife("max");
  const entries = JSON.parse(await readFile(join(REGISTRY, "index.json"), "utf8")) as RegistryEntry[];
  return entries.map((e) => ({ ...e, official: true }));
}

export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheLife("max");
  return catalogSchema.parse(JSON.parse(await readFile(join(REGISTRY, "libraries.json"), "utf8")));
}

/** Active community kits, newest first. */
export async function getCommunityEntries(): Promise<RegistryEntry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(REGISTRY_TAG);
  if (!db) return [];
  try {
    const rows = await db
      .select({ kit: kits, handle: user.handle })
      .from(kits)
      .leftJoin(user, eq(kits.ownerId, user.id))
      .where(and(eq(kits.official, false), eq(kits.status, "active"), eq(kits.visibility, "public")))
      .orderBy(desc(kits.updatedAt));
    return rows.map(({ kit, handle }) => ({
      name: kit.slug,
      version: kit.latestVersion,
      title: kit.title,
      description: kit.description,
      category: kit.category,
      tags: kit.tags,
      language: kit.language,
      author: handle ?? "?",
      skills: 0,
      options: [],
      official: false,
      owner: handle ?? undefined,
    }));
  } catch (error) {
    console.error("[registry] kits de la comunidad no disponibles", error);
    return [];
  }
}

/** Community kits an admin featured, newest first (home page "Destacados"). */
export async function getFeaturedEntries(limit = 3): Promise<RegistryEntry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(REGISTRY_TAG);
  if (!db) return [];
  try {
    const rows = await db
      .select({ slug: kits.slug })
      .from(kits)
      .where(and(eq(kits.official, false), eq(kits.status, "active"), eq(kits.visibility, "public"), isNotNull(kits.featuredAt)))
      .orderBy(desc(kits.featuredAt))
      .limit(limit);
    const all = await getCommunityEntries();
    return rows.flatMap((r) => all.filter((e) => e.name === r.slug));
  } catch (error) {
    console.error("[registry] destacados no disponibles", error);
    return [];
  }
}

/** Official + community, for the leaderboard and the API. */
export async function getAllEntries(): Promise<RegistryEntry[]> {
  const [official, community] = await Promise.all([getIndex(), getCommunityEntries()]);
  return [...official, ...community];
}

/** Kits that rank: official ones and published community ones. Unpublished GitHub refs only count in totals. */
export async function getRankedSlugs(): Promise<Set<string>> {
  return new Set((await getAllEntries()).map((e) => e.name));
}

/** The kit (catalog libraries expanded, `extends` resolved) and where it comes from. */
export async function getKitPage(slug: string, version?: string): Promise<{ kit: Kit; meta: KitMeta } | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(REGISTRY_TAG, `kit:${slug}`);
  try {
    if (OFFICIAL_NAME.test(slug)) {
      const top = await readRawKit(slug);
      const kit = expandKit(parseKit(await resolveExtends(top, readRawKit, resolve)), await getCatalog());
      return { kit, meta: { slug, version: kit.version, official: true, visibility: "public" } };
    }
    if (!COMMUNITY_SLUG.test(slug) || !db) return null;
    const row = await findCommunityVersion(slug, version);
    if (!row) return null;
    const merged = await resolveExtends({ raw: row.manifest, dir: "" }, readRawKit, resolve);
    const kit = expandKit(parseKit(merged), await getCatalog());
    return {
      kit,
      meta: {
        slug,
        version: row.version,
        official: false,
        owner: row.handle ? { handle: row.handle, name: row.ownerName ?? row.handle, image: row.ownerImage } : undefined,
        repo: row.repo,
        path: row.path,
        publishedAt: row.publishedAt.toISOString(),
        visibility: row.visibility === "org" ? "org" : "public",
        orgId: row.orgId,
        priceCents: row.priceCents,
      },
    };
  } catch (error) {
    console.error(`[registry] kit "${slug}" no válido`, error);
    return null;
  }
}

/** Public kits only (official or community): for MCP, stacks, the recommender… Private ones need getKitPage + canReadKit. */
export async function getKit(slug: string): Promise<Kit | null> {
  const page = await getKitPage(slug);
  return page && page.meta.visibility === "public" ? page.kit : null;
}

/** Published version of a community kit (latest when `version` is omitted). */
export async function findCommunityVersion(slug: string, version?: string) {
  if (!db) return null;
  const rows = await db
    .select({
      kitId: kits.id,
      slug: kits.slug,
      status: kits.status,
      repo: kits.repo,
      path: kits.path,
      ownerId: kits.ownerId,
      latestVersion: kits.latestVersion,
      visibility: kits.visibility,
      orgId: kits.orgId,
      priceCents: kits.priceCents,
      hasArchive: sql<boolean>`${kitVersions.archive} is not null`,
      version: kitVersions.version,
      commitSha: kitVersions.commitSha,
      manifest: kitVersions.manifest,
      integrity: kitVersions.integrity,
      publishedAt: kitVersions.publishedAt,
      handle: user.handle,
      ownerName: user.name,
      ownerImage: user.image,
    })
    .from(kits)
    .innerJoin(kitVersions, eq(kitVersions.kitId, kits.id))
    .leftJoin(user, eq(kits.ownerId, user.id))
    .where(and(eq(kits.slug, slug), version ? eq(kitVersions.version, version) : eq(kitVersions.version, kits.latestVersion)))
    .limit(1);
  const row = rows[0];
  return row && row.status !== "hidden" ? row : null;
}

/**
 * Loads one raw kit.json for `extends`: official kits from registry/, community
 * kits from their published manifest. Community parents have no local folder;
 * their files are fetched by the CLI at install time.
 */
export async function readRawKit(ref: string): Promise<LoadedRawKit> {
  const { base, version } = splitKitRef(ref);
  if (OFFICIAL_NAME.test(base)) {
    const dir = join(REGISTRY, "kits", base);
    return { raw: JSON.parse(await readFile(join(dir, "kit.json"), "utf8")), dir };
  }
  if (COMMUNITY_SLUG.test(base)) {
    const row = await findCommunityVersion(base, version);
    // A public kit can't extend a private one: its parent would leak to everyone.
    if (row && row.visibility === "public") return { raw: row.manifest, dir: `published:${base}` };
  }
  throw new Error(`"${ref}" no es un kit oficial ni un kit publicado`);
}

/** A private kit's files (packDir). Never cached: callers check membership first. */
export async function getArchive(kitId: string, version: string): Promise<Buffer | null> {
  if (!db) return null;
  const [row] = await db
    .select({ archive: kitVersions.archive })
    .from(kitVersions)
    .where(and(eq(kitVersions.kitId, kitId), eq(kitVersions.version, version)))
    .limit(1);
  return row?.archive ?? null;
}
