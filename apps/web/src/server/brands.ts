import "server-only";

import { brandProfileSchema, type BrandProfile } from "@kits/schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "./db";
import { brandProfiles, orgMembers, orgs } from "./db/schema";
import { getOrg, requireRole } from "./orgs";
import type { TokenUser } from "./tokens";

export class BrandError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type BrandRow = typeof brandProfiles.$inferSelect;

/** Profiles the user can use: their own plus those of every org they belong to. */
export async function listBrands(viewer: TokenUser): Promise<BrandRow[]> {
  if (!db) return [];
  const orgIds = (await db.select({ id: orgMembers.orgId }).from(orgMembers).where(eq(orgMembers.userId, viewer.id))).map((r) => r.id);
  const mine = await db.select().from(brandProfiles).where(and(eq(brandProfiles.ownerId, viewer.id), isNull(brandProfiles.orgId))).orderBy(asc(brandProfiles.slug));
  const shared = orgIds.length ? await db.select().from(brandProfiles).where(inArray(brandProfiles.orgId, orgIds)).orderBy(asc(brandProfiles.slug)) : [];
  return [...mine, ...shared];
}

/** A profile if the user may read it (owner, or member of its org); null otherwise, like a missing one. */
export async function getBrand(slug: string, viewer: TokenUser | null): Promise<{ row: BrandRow; profile: BrandProfile } | null> {
  if (!db || !viewer) return null;
  const [row] = await db.select().from(brandProfiles).where(eq(brandProfiles.slug, slug)).limit(1);
  if (!row) return null;
  if (row.orgId) {
    const [member] = await db.select({ r: orgMembers.role }).from(orgMembers).where(and(eq(orgMembers.orgId, row.orgId), eq(orgMembers.userId, viewer.id))).limit(1);
    if (!member) return null;
  } else if (row.ownerId !== viewer.id) return null;
  const parsed = brandProfileSchema.safeParse(row.profile);
  return parsed.success ? { row, profile: parsed.data } : null;
}

/**
 * Creates or updates a profile under the user's handle or an org slug. Org
 * profiles need admin (they define the company's identity for everyone).
 */
export async function saveBrand(viewer: TokenUser, owner: string, input: unknown): Promise<string> {
  if (!db) throw new BrandError(503, "Sin base de datos");
  const parsed = brandProfileSchema.safeParse(input);
  if (!parsed.success) throw new BrandError(400, parsed.error.issues[0]?.message ?? "Perfil no válido");
  const profile = parsed.data;
  let orgId: string | null = null;
  if (owner !== viewer.handle) {
    const org = await getOrg(owner);
    if (!org) throw new BrandError(404, `No existe la organización "${owner}"`);
    await requireRole(org, viewer, "admin");
    orgId = org.id;
  }
  const slug = `${owner}/${profile.name}`;
  const [existing] = await db.select().from(brandProfiles).where(eq(brandProfiles.slug, slug)).limit(1);
  if (existing) {
    const allowed = existing.orgId ? existing.orgId === orgId : existing.ownerId === viewer.id;
    if (!allowed) throw new BrandError(403, `${slug} pertenece a otra cuenta`);
    await db.update(brandProfiles).set({ title: profile.title, profile, updatedAt: new Date() }).where(eq(brandProfiles.id, existing.id));
  } else {
    await db.insert(brandProfiles).values({ slug, ownerId: viewer.id, orgId, title: profile.title, profile });
  }
  return slug;
}

export async function deleteBrand(viewer: TokenUser, slug: string): Promise<void> {
  const found = await getBrand(slug, viewer);
  if (!found) throw new BrandError(404, "Perfil no encontrado");
  if (found.row.orgId) {
    const [org] = await db!.select().from(orgs).where(eq(orgs.id, found.row.orgId)).limit(1);
    await requireRole(org!, viewer, "admin");
  }
  await db!.delete(brandProfiles).where(eq(brandProfiles.id, found.row.id));
}
