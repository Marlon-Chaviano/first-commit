import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "./db";
import { kits, orgMembers, orgs, user } from "./db/schema";
import type { TokenUser } from "./tokens";

export type OrgRole = "owner" | "admin" | "member";
export type Org = typeof orgs.$inferSelect;

export class OrgError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const orgSlugSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/, "Usa minúsculas, números y guiones (máx. 39), como un usuario de GitHub");

export const policySchema = z.object({
  required: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(50),
  forbidden: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(50),
});
export type OrgPolicy = z.infer<typeof policySchema>;

const RANK: Record<OrgRole, number> = { member: 0, admin: 1, owner: 2 };

/** The org namespace is shared with user handles ("acme/kit" vs "ana/kit"): a slug can't be both. */
export async function createOrg(creator: TokenUser, input: { slug: string; name: string }): Promise<Org> {
  if (!db) throw new OrgError(503, "Organizaciones no disponibles (sin base de datos)");
  const slug = orgSlugSchema.parse(input.slug.trim().toLowerCase());
  const name = input.name.trim().slice(0, 80) || slug;
  const [takenByUser] = await db.select({ id: user.id }).from(user).where(eq(user.handle, slug)).limit(1);
  if (takenByUser) throw new OrgError(409, `"${slug}" es un usuario: elige otro nombre`);
  return db.transaction(async (tx) => {
    const [org] = await tx.insert(orgs).values({ slug, name }).onConflictDoNothing().returning();
    if (!org) throw new OrgError(409, `Ya existe la organización "${slug}"`);
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
  const role = await roleIn(org.id, viewer?.id);
  if (!role || RANK[role] < RANK[min]) throw new OrgError(403, "No tienes permiso en esta organización");
  return role;
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
  const mine = await requireRole(org, viewer, "admin");
  if (role === "owner" && mine !== "owner") throw new OrgError(403, "Solo un owner puede añadir owners");
  const [target] = await db!.select({ id: user.id }).from(user).where(eq(user.handle, handle.trim().replace(/^@/, ""))).limit(1);
  if (!target) throw new OrgError(404, `No hay ninguna cuenta con el usuario "${handle}": tiene que entrar una vez en la web`);
  await db!
    .insert(orgMembers)
    .values({ orgId: org.id, userId: target.id, role })
    .onConflictDoUpdate({ target: [orgMembers.orgId, orgMembers.userId], set: { role } });
}

/** Admins remove members (not owners); anyone can leave. The last owner can't. */
export async function removeMember(org: Org, viewer: TokenUser, userId: string): Promise<void> {
  const mine = await requireRole(org, viewer, "member");
  const theirs = await roleIn(org.id, userId);
  if (!theirs) return;
  const self = userId === viewer.id;
  if (!self && (RANK[mine] < RANK.admin || (theirs === "owner" && mine !== "owner"))) throw new OrgError(403, "No tienes permiso para quitar a este miembro");
  if (theirs === "owner") {
    const owners = (await listMembers(org.id)).filter((m) => m.role === "owner");
    if (owners.length <= 1) throw new OrgError(400, "La organización necesita al menos un owner");
  }
  await db!.delete(orgMembers).where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, userId)));
}

export async function setPolicy(org: Org, viewer: TokenUser, policy: OrgPolicy): Promise<void> {
  await requireRole(org, viewer, "admin");
  const clean = policySchema.parse({ required: [...new Set(policy.required)], forbidden: [...new Set(policy.forbidden)] });
  const both = clean.required.filter((id) => clean.forbidden.includes(id));
  if (both.length) throw new OrgError(400, `Una biblioteca no puede ser obligatoria y prohibida a la vez: ${both.join(", ")}`);
  await db!.update(orgs).set({ policy: clean }).where(eq(orgs.id, org.id));
}

/** Can this user see and install the kit? Public kits: everyone. Org kits: members. */
export async function canReadKit(kit: { visibility: string; orgId: string | null }, viewer: TokenUser | null): Promise<boolean> {
  if (kit.visibility === "public") return true;
  return Boolean(kit.orgId && (await roleIn(kit.orgId, viewer?.id)));
}
