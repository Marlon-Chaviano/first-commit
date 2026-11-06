import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "./db";
import { kits, orgMembers, orgs, user } from "./db/schema";
import type { TokenUser } from "./tokens";
import { DomainError } from "./errors";

export type OrgRole = "owner" | "admin" | "member";
export type Org = typeof orgs.$inferSelect;

/** Org errors for the person; see DomainError. */
export class OrgError extends DomainError {}

export const orgSlugSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/, "Use lowercase letters, numbers and hyphens (max 39), like a GitHub username");

export const policySchema = z.object({
  required: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(50),
  forbidden: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(50),
});
export type OrgPolicy = z.infer<typeof policySchema>;

const RANK: Record<OrgRole, number> = { member: 0, admin: 1, owner: 2 };

/**
 * What a role may do in an organization: the only place these rules live. The server checks
 * them before acting, and pages draw their buttons from the same answer, so they never disagree.
 */
export interface OrgCapabilities {
  role: OrgRole | null;
  isMember: boolean;
  canAddMembers: boolean;
  canAddOwners: boolean;
  /** Anyone can leave; admins remove members and admins; only owners remove owners. */
  canRemove: (member: { userId: string; role: OrgRole }) => boolean;
  canEditPolicy: boolean;
  canEditBrands: boolean;
  canManageKits: boolean;
  canManageBilling: boolean;
  canDelete: boolean;
}

/** Pure: the capabilities of `role` (null = not a member), for the person `viewerId`. */
export function capabilitiesFor(role: OrgRole | null, viewerId?: string | null): OrgCapabilities {
  const at = (min: OrgRole) => role !== null && RANK[role] >= RANK[min];
  return {
    role,
    isMember: role !== null,
    canAddMembers: at("admin"),
    canAddOwners: at("owner"),
    canRemove: (member) => (member.userId === viewerId && role !== null) || (at("admin") && (member.role !== "owner" || at("owner"))),
    canEditPolicy: at("admin"),
    canEditBrands: at("admin"),
    canManageKits: at("admin"),
    canManageBilling: at("owner"),
    canDelete: at("owner"),
  };
}

export async function orgCapabilities(org: Pick<Org, "id">, viewer: TokenUser | null): Promise<OrgCapabilities> {
  return capabilitiesFor(await roleIn(org.id, viewer?.id), viewer?.id);
}

/** Throws the same 403 everywhere when a capability is missing. */
function allow(allowed: boolean, message = "You don't have permission in this organization"): void {
  if (!allowed) throw new OrgError(403, message);
}

/** The org namespace is shared with user handles ("acme/kit" vs "ana/kit"): a slug can't be both. */
/** Throws if the slug is malformed, a user's handle or an existing org. Run before sending a verification code. */
export async function assertOrgSlugFree(rawSlug: string): Promise<string> {
  if (!db) throw new OrgError(503, "Organizations unavailable (no database)");
  const slug = orgSlugSchema.parse(rawSlug.trim().toLowerCase());
  const [takenByUser] = await db.select({ id: user.id }).from(user).where(eq(user.handle, slug)).limit(1);
  if (takenByUser) throw new OrgError(409, `"${slug}" is a user: pick another name`);
  const [takenByOrg] = await db.select({ id: orgs.id }).from(orgs).where(eq(orgs.slug, slug)).limit(1);
  if (takenByOrg) throw new OrgError(409, `The "${slug}" organization already exists`);
  return slug;
}

export async function createOrg(creator: TokenUser, input: { slug: string; name: string; verified: { email: string; domain: string } }): Promise<Org> {
  const slug = await assertOrgSlugFree(input.slug);
  const name = input.name.trim().slice(0, 80) || slug;
  const { email: verifiedEmail, domain: verifiedDomain } = input.verified;
  return db!.transaction(async (tx) => {
    const [org] = await tx.insert(orgs).values({ slug, name, verifiedEmail, verifiedDomain, verifiedAt: new Date() }).onConflictDoNothing().returning();
    if (!org) throw new OrgError(409, `The "${slug}" organization already exists`);
    await tx.insert(orgMembers).values({ orgId: org.id, userId: creator.id, role: "owner" });
    return org;
  });
}

export async function getOrg(slug: string): Promise<Org | null> {
  if (!db) return null;
  return (await db.select().from(orgs).where(eq(orgs.slug, slug)).limit(1))[0] ?? null;
}

export async function getOrgById(id: string): Promise<Org | null> {
  if (!db) return null;
  return (await db.select().from(orgs).where(eq(orgs.id, id)).limit(1))[0] ?? null;
}

/** The user's role in the org, or null if they aren't a member. */
export async function roleIn(orgId: string, userId: string | undefined | null): Promise<OrgRole | null> {
  if (!db || !userId) return null;
  const [row] = await db.select({ role: orgMembers.role }).from(orgMembers).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId))).limit(1);
  return (row?.role as OrgRole | undefined) ?? null;
}

/** Throws unless the user has at least `min` in the org. */
export async function requireRole(org: Org, viewer: TokenUser | null, min: OrgRole): Promise<OrgRole> {
  const { role } = await orgCapabilities(org, viewer);
  allow(role !== null && RANK[role] >= RANK[min]);
  return role!;
}

export async function listUserOrgs(userId: string) {
  if (!db) return [];
  return db
    .select({ org: orgs, role: orgMembers.role })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgMembers.orgId, orgs.id))
    .where(eq(orgMembers.userId, userId))
    .orderBy(asc(orgs.slug));
}

export async function listMembers(orgId: string) {
  if (!db) return [];
  return db
    .select({ userId: user.id, handle: user.handle, name: user.name, image: user.image, role: orgMembers.role })
    .from(orgMembers)
    .innerJoin(user, eq(orgMembers.userId, user.id))
    .where(eq(orgMembers.orgId, orgId))
    .orderBy(asc(user.handle));
}

export async function listOrgKits(orgId: string) {
  if (!db) return [];
  return db.select().from(kits).where(eq(kits.orgId, orgId)).orderBy(asc(kits.slug));
}

/** Admins add existing users by GitHub handle. Only an owner can make someone owner. */
export async function addMember(org: Org, viewer: TokenUser, handle: string, role: OrgRole): Promise<void> {
  const can = await orgCapabilities(org, viewer);
  allow(can.canAddMembers);
  allow(role !== "owner" || can.canAddOwners, "Only an owner can add owners");
  const [target] = await db!.select({ id: user.id }).from(user).where(eq(user.handle, handle.trim().replace(/^@/, ""))).limit(1);
  if (!target) throw new OrgError(404, `There's no account with the username "${handle}": they need to log in to the website once`);
  await db!
    .insert(orgMembers)
    .values({ orgId: org.id, userId: target.id, role })
    .onConflictDoUpdate({ target: [orgMembers.orgId, orgMembers.userId], set: { role } });
}

/** Admins remove members (not owners); anyone can leave. The last owner can't. */
export async function removeMember(org: Org, viewer: TokenUser, userId: string): Promise<void> {
  const can = await orgCapabilities(org, viewer);
  allow(can.isMember);
  const theirs = await roleIn(org.id, userId);
  if (!theirs) return;
  allow(can.canRemove({ userId, role: theirs }), "You don't have permission to remove this member");
  if (theirs === "owner") {
    const owners = (await listMembers(org.id)).filter((m) => m.role === "owner");
    if (owners.length <= 1) throw new OrgError(400, "The organization needs at least one owner");
  }
  await db!.delete(orgMembers).where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, userId)));
}

/** Owners only. Deletes the org with its private kits, brand profiles and memberships. */
export async function deleteOrg(org: Org, viewer: TokenUser): Promise<void> {
  allow((await orgCapabilities(org, viewer)).canDelete);
  await db!.delete(orgs).where(eq(orgs.id, org.id));
}

export async function setPolicy(org: Org, viewer: TokenUser, policy: OrgPolicy): Promise<void> {
  allow((await orgCapabilities(org, viewer)).canEditPolicy);
  const clean = policySchema.parse({ required: [...new Set(policy.required)], forbidden: [...new Set(policy.forbidden)] });
  const both = clean.required.filter((id) => clean.forbidden.includes(id));
  if (both.length) throw new OrgError(400, `A library can't be both required and forbidden: ${both.join(", ")}`);
  await db!.update(orgs).set({ policy: clean }).where(eq(orgs.id, org.id));
}
