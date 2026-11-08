import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "./db";
import { installEvents, kits, kitStatsDaily, user, account } from "./db/schema";

export async function getUserKits(userId: string) {
  if (!db) return [];
  return db.select().from(kits).where(eq(kits.ownerId, userId)).orderBy(desc(kits.updatedAt));
}

/** Public profile: only active kits. */
export async function getProfile(handle: string) {
  if (!db) return null;
  const owner = (await db.select().from(user).where(eq(user.handle, handle)).limit(1))[0];
  if (!owner) return null;
  const owned = await db
    .select()
    .from(kits)
    // A public profile: an org's private kits never show here, even if this user published them.
    .where(and(eq(kits.ownerId, owner.id), eq(kits.status, "active"), eq(kits.visibility, "public")))
    .orderBy(desc(kits.updatedAt));
  return { user: { handle: owner.handle!, name: owner.name, image: owner.image, createdAt: owner.createdAt }, kits: owned };
}

/** History for the owner's dashboard, from Postgres (Redis has the live totals). */
export async function getKitHistory(slug: string, days = 30) {
  if (!db) return { daily: [], versions: [], countries: [] };
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const [daily, versions, countries] = await Promise.all([
    db
      .select({ day: kitStatsDaily.day, installs: kitStatsDaily.installs })
      .from(kitStatsDaily)
      .where(and(eq(kitStatsDaily.kit, slug), gte(kitStatsDaily.day, since)))
      .orderBy(kitStatsDaily.day),
    db
      .select({ version: installEvents.kitVersion, installs: sql<number>`count(*)::int` })
      .from(installEvents)
      .where(and(eq(installEvents.kit, slug), eq(installEvents.eventType, "install")))
      .groupBy(installEvents.kitVersion)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({ country: installEvents.country, installs: sql<number>`count(*)::int` })
      .from(installEvents)
      .where(and(eq(installEvents.kit, slug), eq(installEvents.eventType, "install")))
      .groupBy(installEvents.country)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
  ]);
  return { daily, versions, countries };
}

/** Sign-in methods linked to the account ("github", "google", "credential" for dev login), with the id Better Auth unlinks by. */
export async function linkedAccounts(userId: string): Promise<{ providerId: string; id: string }[]> {
  if (!db) return [];
  return db.select({ providerId: account.providerId, id: account.id }).from(account).where(eq(account.userId, userId));
}

/** Has the user linked GitHub? Publishing needs its token to check repo permissions. */
export async function hasGithubAccount(userId: string): Promise<boolean> {
  if (!db) return false;
  const [row] = await db.select({ id: account.id }).from(account).where(and(eq(account.userId, userId), eq(account.providerId, "github"))).limit(1);
  return Boolean(row);
}
