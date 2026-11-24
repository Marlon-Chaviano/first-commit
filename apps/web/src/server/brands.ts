import "server-only";

import { BRAND_ASSETS, brandProfileSchema, type BrandAssetKind } from "@kits/schema";
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "./db";
import { brandProfiles, orgMembers } from "./db/schema";
import { capabilitiesFor, getOrg, OrgError, orgCapabilities, roleIn } from "./orgs";
import type { TokenUser } from "./tokens";
import { DomainError } from "./errors";

/** Brand errors for the person; see DomainError. */
export class BrandError extends DomainError {}

export type BrandRow = typeof brandProfiles.$inferSelect;

function ownedBrandScope(viewer: TokenUser) {
  return or(
    and(isNull(brandProfiles.orgId), eq(brandProfiles.ownerId, viewer.id)),
    inArray(brandProfiles.orgId, db!.select({ id: orgMembers.orgId }).from(orgMembers).where(eq(orgMembers.userId, viewer.id))),
  );
}

/** The account tab includes personal and organization profiles. */
export async function listBrands(viewer: TokenUser): Promise<BrandRow[]> {
  if (!db) return [];
  return db.select().from(brandProfiles).where(ownedBrandScope(viewer)).orderBy(asc(brandProfiles.slug));
}

/** The configurator needs asset names for the plan, without loading every profile's files and documentation. */
export async function availableBrandChoices(viewer: TokenUser | null) {
  if (!db) return [];
  const p = brandProfiles.profile;
  const icon = sql`coalesce(${p}->'assets'->>'icon', ${p}->'assets'->>'logo', ${p}->>'logo')`;
  const rows = await db.select({
    slug: brandProfiles.slug, title: brandProfiles.title,
    primary: sql<string>`${p}->'colors'->>'primary'`,
    logo: sql<string | null>`case when length(${icon}) <= 4096 then ${icon} end`,
    assetKeys: sql<string[]>`array(select jsonb_object_keys(${p}->'assets'))`,
    legacyLogo: sql<boolean>`${p}->>'logo' is not null`,
  }).from(brandProfiles)
    .where(or(eq(brandProfiles.isPrivate, false), viewer ? ownedBrandScope(viewer) : undefined))
    .orderBy(asc(brandProfiles.slug));
  return rows.map(({ assetKeys, legacyLogo, logo, ...choice }) => ({
    ...choice, logo: logo ?? undefined,
    images: (Object.keys(BRAND_ASSETS) as BrandAssetKind[]).filter((k) => assetKeys.includes(k) || (k === "logo" && legacyLogo)),
  }));
}

export async function getBrand(slug: string, viewer: TokenUser | null) {
  if (!db) return null;
  const [row] = await db.select().from(brandProfiles).where(eq(brandProfiles.slug, slug)).limit(1);
  if (!row) return null;
  const role = row.orgId ? await roleIn(row.orgId, viewer?.id) : null;
  const owns = Boolean(viewer && !row.orgId && row.ownerId === viewer.id);
  if (row.isPrivate && !owns && !role) return null;
  const parsed = brandProfileSchema.safeParse(row.profile);
  const canEdit = owns || capabilitiesFor(role).canEditBrands;
  return parsed.success ? { row, profile: parsed.data, canEdit } : null;
}

/**
 * Creates or updates a profile under the user's handle or an org slug. Org
 * profiles need admin (they define the company's identity for everyone).
 */
export async function saveBrand(viewer: TokenUser, owner: string, input: unknown, mode: "create" | "update", isPrivate?: boolean): Promise<string> {
  if (!db) throw new BrandError(503, "No database");
  if (isPrivate !== undefined && typeof isPrivate !== "boolean") throw new BrandError(400, "Invalid visibility");
  const parsed = brandProfileSchema.safeParse(input);
  if (!parsed.success) throw new BrandError(400, parsed.error.issues[0]?.message ?? "Invalid profile");
  const profile = parsed.data;
  let orgId: string | null = null;
  if (owner !== viewer.handle) {
    const org = await getOrg(owner);
    if (!org) throw new BrandError(404, `The "${owner}" organization doesn't exist`);
    if (!(await orgCapabilities(org, viewer)).canEditBrands) throw new OrgError(403, "Only the organization's owners and admins edit its brand profiles");
    orgId = org.id;
  }
  const slug = `${owner}/${profile.name}`;
  if (mode === "update") {
    const scope = orgId ? eq(brandProfiles.orgId, orgId) : and(isNull(brandProfiles.orgId), eq(brandProfiles.ownerId, viewer.id));
    const [updated] = await db.update(brandProfiles)
      .set({ title: profile.title, profile, isPrivate, updatedAt: new Date() })
      .where(and(eq(brandProfiles.slug, slug), scope))
      .returning({ id: brandProfiles.id });
    if (!updated) throw new BrandError(404, "Profile not found");
  } else {
    const [created] = await db.insert(brandProfiles)
      .values({ slug, ownerId: viewer.id, orgId, title: profile.title, profile, isPrivate: isPrivate ?? false })
      .onConflictDoNothing({ target: brandProfiles.slug })
      .returning({ id: brandProfiles.id });
    if (!created) throw new BrandError(409, "That identifier is already in use. Choose another for this copy.");
  }
  return slug;
}

export async function deleteBrand(viewer: TokenUser, slug: string): Promise<void> {
  const found = await getBrand(slug, viewer);
  if (!found) throw new BrandError(404, "Profile not found");
  if (!found.canEdit) throw new BrandError(403, "You don't have permission to delete this profile");
  await db!.delete(brandProfiles).where(eq(brandProfiles.id, found.row.id));
}
