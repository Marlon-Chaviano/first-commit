"use server";

import { and, eq, isNull } from "drizzle-orm";

import { action, type Result } from "@/server/action";
import { db as database } from "@/server/db";
import { kitReports, kits, newsletterSubscribers, orgMembers, orgs, user } from "@/server/db/schema";
import { fail } from "@/server/errors";
import { kitAccess } from "@/server/kit-access";
import { publishKit, type PublishSource } from "@/server/publish";
import { REGISTRY_TAG } from "@/server/registry";
import { createApiToken, revokeApiToken } from "@/server/tokens";

const ACCOUNT = { paths: [["/account", "layout"] as [string, "layout"]] };
const db = () => database ?? fail("This server has no database", 503);

export async function createTokenAction(name: string): Promise<Result<string>> {
  return action({ revalidate: ACCOUNT }, async (viewer) => {
    db();
    return createApiToken(viewer.id, name.trim() || "CLI");
  });
}

export async function revokeTokenAction(id: string): Promise<Result> {
  return action({ revalidate: ACCOUNT }, async (viewer) => {
    db();
    await revokeApiToken(viewer.id, id);
  });
}

export async function publishAction(source: PublishSource): Promise<Result<{ slug: string; version: string }>> {
  return action({ revalidate: ACCOUNT, failure: "Couldn't publish the kit" }, async (viewer) => {
    const { slug, version } = await publishKit(viewer, source);
    return { slug, version };
  });
}

/** A community kit by slug, with what kitAccess needs. Official kits can't be managed from here. */
async function communityKit(slug: string) {
  const kit = (await db().select().from(kits).where(eq(kits.slug, slug)).limit(1))[0];
  if (!kit || kit.official) fail("Kit not found", 404);
  return { ...kit, kitId: kit.id };
}

/** Whoever manages a kit retires (or brings it back); hiding it is moderation, for admins. */
export async function setKitStatusAction(slug: string, status: "active" | "retired" | "hidden"): Promise<Result> {
  return action({ revalidate: { paths: [["/account", "layout"], "/admin"], tags: [REGISTRY_TAG, `kit:${slug}`] } }, async (viewer) => {
    const kit = await communityKit(slug);
    const access = await kitAccess(kit, viewer);
    const moderation = status === "hidden" || kit.status === "hidden";
    if (!(moderation ? access.moderate : access.manage)) fail("You don't have permission", 403);
    await db().update(kits).set({ status, updatedAt: new Date() }).where(eq(kits.id, kit.id));
  });
}

export async function setReportStatusAction(id: string, status: "resolved" | "dismissed" | "open"): Promise<Result> {
  return action({ auth: "admin", revalidate: { paths: ["/admin"] } }, async () => {
    await db().update(kitReports).set({ status }).where(eq(kitReports.id, id));
  });
}

/** Admin: feature a community kit on the home page and in the next newsletter (or stop featuring it). */
export async function setKitFeaturedAction(slug: string, featured: boolean): Promise<Result> {
  return action({ auth: "admin", revalidate: { paths: ["/admin"], tags: [REGISTRY_TAG] } }, async () => {
    await db().update(kits).set({ featuredAt: featured ? new Date() : null }).where(and(eq(kits.slug, slug), eq(kits.official, false)));
  });
}

/** Permanently deletes a kit and its versions, for whoever manages it; official kits can't be deleted. */
export async function deleteKitAction(slug: string, confirm: string): Promise<Result> {
  return action({ revalidate: { paths: [["/account", "layout"]], tags: [REGISTRY_TAG, `kit:${slug}`] } }, async (viewer) => {
    const kit = await communityKit(slug);
    if (!(await kitAccess(kit, viewer)).manage) fail("You don't have permission", 403);
    if (confirm.trim() !== slug) fail(`Type ${slug} to confirm`);
    await db().delete(kits).where(eq(kits.id, kit.id));
  });
}

/**
 * Deletes the account: personal kits, brand profiles, tokens, sessions, linked GitHub/Google
 * accounts and the newsletter subscription. Blocked while the user is the only owner of an org,
 * so an org (and its members' kits) is never left without an owner.
 */
export async function deleteAccountAction(confirm: string): Promise<Result> {
  return action({ revalidate: { tags: [REGISTRY_TAG] } }, async (viewer) => {
    const expected = viewer.handle ?? viewer.email ?? "";
    if (!expected || confirm.trim() !== expected) fail(`Type ${expected} to confirm`);

    const owned = await db()
      .select({ orgId: orgMembers.orgId, slug: orgs.slug })
      .from(orgMembers)
      .innerJoin(orgs, eq(orgMembers.orgId, orgs.id))
      .where(and(eq(orgMembers.userId, viewer.id), eq(orgMembers.role, "owner")));
    const soleOwner: string[] = [];
    for (const { orgId, slug } of owned) {
      const owners = await db().select({ userId: orgMembers.userId }).from(orgMembers).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, "owner")));
      if (owners.length === 1) soleOwner.push(slug);
    }
    if (soleOwner.length) fail(`You're the only owner of ${soleOwner.join(", ")}: add another owner or delete the organization first`);

    await db().transaction(async (tx) => {
      // Org kits stay with the org (their owner becomes empty); personal kits go with the account.
      await tx.delete(kits).where(and(eq(kits.ownerId, viewer.id), isNull(kits.orgId)));
      if (viewer.email) await tx.delete(newsletterSubscribers).where(eq(newsletterSubscribers.email, viewer.email.toLowerCase()));
      // Sessions, linked accounts, tokens, memberships and brand profiles cascade from the user row.
      await tx.delete(user).where(eq(user.id, viewer.id));
    });
  });
}
