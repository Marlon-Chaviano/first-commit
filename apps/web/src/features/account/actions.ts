"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";

import { db } from "@/server/db";
import { kitReports, kits, newsletterSubscribers, orgMembers, orgs, user } from "@/server/db/schema";
import { publishKit, PublishError, type PublishSource } from "@/server/publish";
import { REGISTRY_TAG } from "@/server/registry";
import { getViewer, isAdmin } from "@/server/session";
import { createApiToken, revokeApiToken } from "@/server/tokens";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function createTokenAction(name: string): Promise<Result<string>> {
  const viewer = await getViewer();
  if (!viewer || !db) return { ok: false, error: "Log in first" };
  const token = await createApiToken(viewer.id, name.trim() || "CLI");
  revalidatePath("/account", "layout");
  return { ok: true, data: token };
}

export async function revokeTokenAction(id: string): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer || !db) return { ok: false, error: "Log in first" };
  await revokeApiToken(viewer.id, id);
  revalidatePath("/account", "layout");
  return { ok: true, data: undefined };
}

export async function publishAction(source: PublishSource): Promise<Result<{ slug: string; version: string }>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Log in first" };
  try {
    const { slug, version } = await publishKit(viewer, source);
    revalidatePath("/account", "layout");
    return { ok: true, data: { slug, version } };
  } catch (error) {
    if (error instanceof PublishError) return { ok: false, error: error.message };
    console.error("[publish]", error);
    return { ok: false, error: "Couldn't publish the kit" };
  }
}

/** Owner retires (or brings back) their kit; admins can also hide it. */
export async function setKitStatusAction(slug: string, status: "active" | "retired" | "hidden"): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer || !db) return { ok: false, error: "Log in first" };
  const kit = (await db.select().from(kits).where(eq(kits.slug, slug)).limit(1))[0];
  if (!kit || kit.official) return { ok: false, error: "Kit not found" };
  // Hiding (and un-hiding) is moderation: admins only. Retiring/reactivating: the owner or an admin.
  const moderation = status === "hidden" || kit.status === "hidden";
  const allowed = isAdmin(viewer) || (!moderation && kit.ownerId === viewer.id);
  if (!allowed) return { ok: false, error: "You don't have permission" };
  await db.update(kits).set({ status, updatedAt: new Date() }).where(eq(kits.id, kit.id));
  revalidateTag(REGISTRY_TAG, { expire: 0 });
  revalidateTag(`kit:${slug}`, { expire: 0 });
  revalidatePath("/account", "layout");
  revalidatePath("/admin");
  return { ok: true, data: undefined };
}

export async function setReportStatusAction(id: string, status: "resolved" | "dismissed" | "open"): Promise<Result> {
  const viewer = await getViewer();
  if (!isAdmin(viewer) || !db) return { ok: false, error: "You don't have permission" };
  await db.update(kitReports).set({ status }).where(and(eq(kitReports.id, id)));
  revalidatePath("/admin");
  return { ok: true, data: undefined };
}

/** Admin: feature a community kit on the home page and in the next newsletter (or stop featuring it). */
export async function setKitFeaturedAction(slug: string, featured: boolean): Promise<Result> {
  const viewer = await getViewer();
  if (!isAdmin(viewer) || !db) return { ok: false, error: "You don't have permission" };
  await db.update(kits).set({ featuredAt: featured ? new Date() : null }).where(and(eq(kits.slug, slug), eq(kits.official, false)));
  revalidateTag(REGISTRY_TAG, { expire: 0 });
  revalidatePath("/admin");
  return { ok: true, data: undefined };
}

/** Permanently deletes a kit and its versions. The owner or an admin; official kits can't be deleted. */
export async function deleteKitAction(slug: string, confirm: string): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer || !db) return { ok: false, error: "Log in first" };
  const kit = (await db.select().from(kits).where(eq(kits.slug, slug)).limit(1))[0];
  if (!kit || kit.official) return { ok: false, error: "Kit not found" };
  if (kit.ownerId !== viewer.id && !isAdmin(viewer)) return { ok: false, error: "You don't have permission" };
  if (confirm.trim() !== slug) return { ok: false, error: `Type ${slug} to confirm` };
  await db.delete(kits).where(eq(kits.id, kit.id));
  revalidateTag(REGISTRY_TAG, { expire: 0 });
  revalidateTag(`kit:${slug}`, { expire: 0 });
  revalidatePath("/account", "layout");
  return { ok: true, data: undefined };
}

/**
 * Deletes the account: personal kits, brand profiles, tokens, sessions, linked GitHub/Google
 * accounts and the newsletter subscription. Blocked while the user is the only owner of an org,
 * so an org (and its members' kits) is never left without an owner.
 */
export async function deleteAccountAction(confirm: string): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer || !db) return { ok: false, error: "Log in first" };
  const expected = viewer.handle ?? viewer.email ?? "";
  if (!expected || confirm.trim() !== expected) return { ok: false, error: `Type ${expected} to confirm` };

  const owned = await db
    .select({ orgId: orgMembers.orgId, slug: orgs.slug })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgMembers.orgId, orgs.id))
    .where(and(eq(orgMembers.userId, viewer.id), eq(orgMembers.role, "owner")));
  const soleOwner: string[] = [];
  for (const { orgId, slug } of owned) {
    const owners = await db.select({ userId: orgMembers.userId }).from(orgMembers).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, "owner")));
    if (owners.length === 1) soleOwner.push(slug);
  }
  if (soleOwner.length) {
    return { ok: false, error: `You're the only owner of ${soleOwner.join(", ")}: add another owner or delete the organization first` };
  }

  await db.transaction(async (tx) => {
    // Org kits stay with the org (their owner becomes empty); personal kits go with the account.
    await tx.delete(kits).where(and(eq(kits.ownerId, viewer.id), isNull(kits.orgId)));
    if (viewer.email) await tx.delete(newsletterSubscribers).where(eq(newsletterSubscribers.email, viewer.email.toLowerCase()));
    // Sessions, linked accounts, tokens, memberships and brand profiles cascade from the user row.
    await tx.delete(user).where(eq(user.id, viewer.id));
  });
  revalidateTag(REGISTRY_TAG, { expire: 0 });
  return { ok: true, data: undefined };
}
