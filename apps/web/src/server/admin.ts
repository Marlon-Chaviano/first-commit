import "server-only";

import { count, desc, eq, gte, inArray, sum } from "drizzle-orm";

import { db } from "./db";
import { account, user } from "./db/auth-schema";
import { kitReports, kitStatsDaily, kitVerifications, kits, newsletterIssues, newsletterSubscribers } from "./db/schema";
import { adminHandles } from "./env";

const DAY = 24 * 60 * 60 * 1000;
const since = (days: number) => new Date(Date.now() - days * DAY);
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** Headline numbers for the admin overview. Every count is one cheap aggregate. */
export async function getAdminOverview() {
  if (!db) return null;
  const [[users], [newUsers], kitRows, [installs], [installsWeek], [openReports], subscriberRows] = await Promise.all([
    db.select({ n: count() }).from(user),
    db.select({ n: count() }).from(user).where(gte(user.createdAt, since(7))),
    db.select({ official: kits.official, status: kits.status, n: count() }).from(kits).groupBy(kits.official, kits.status),
    db.select({ n: sum(kitStatsDaily.installs) }).from(kitStatsDaily),
    db.select({ n: sum(kitStatsDaily.installs) }).from(kitStatsDaily).where(gte(kitStatsDaily.day, isoDay(since(7)))),
    db.select({ n: count() }).from(kitReports).where(eq(kitReports.status, "open")),
    db.select({ status: newsletterSubscribers.status, n: count() }).from(newsletterSubscribers).groupBy(newsletterSubscribers.status),
  ]);
  const kitsBy = (pred: (r: (typeof kitRows)[number]) => boolean) => kitRows.filter(pred).reduce((total, r) => total + r.n, 0);
  const subscribers = Object.fromEntries(subscriberRows.map((r) => [r.status, r.n])) as Record<string, number>;
  return {
    users: users!.n,
    newUsers: newUsers!.n,
    officialKits: kitsBy((r) => r.official),
    communityKits: kitsBy((r) => !r.official),
    hiddenKits: kitsBy((r) => r.status === "hidden"),
    installs: Number(installs!.n ?? 0),
    installsWeek: Number(installsWeek!.n ?? 0),
    openReports: openReports!.n,
    subscribers: subscribers.confirmed ?? 0,
    pendingSubscribers: subscribers.pending ?? 0,
  };
}

export type AdminUser = Awaited<ReturnType<typeof listAdminUsers>>[number];

/** Newest accounts first, with how they sign in and how many kits they own. */
export async function listAdminUsers(limit = 500) {
  if (!db) return [];
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      handle: user.handle,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(limit);
  const ids = rows.map((r) => r.id);
  const [providers, owned] = ids.length
    ? await Promise.all([
        db.select({ userId: account.userId, providerId: account.providerId }).from(account).where(inArray(account.userId, ids)),
        db.select({ ownerId: kits.ownerId, n: count() }).from(kits).where(inArray(kits.ownerId, ids)).groupBy(kits.ownerId),
      ])
    : [[], []];
  const kitsBy = new Map(owned.map((o) => [o.ownerId, o.n]));
  return rows.map((r) => ({
    ...r,
    kits: kitsBy.get(r.id) ?? 0,
    providers: providers.filter((p) => p.userId === r.id).map((p) => p.providerId),
    // ADMIN_HANDLES grants the role on every request; those accounts can't be demoted from here.
    adminByConfig: Boolean(r.handle && adminHandles.has(r.handle.toLowerCase())),
  }));
}

export type AdminKit = Awaited<ReturnType<typeof listAdminKits>>[number];

/** Every kit (official and community) with its owner, installs and the verification of its latest version. */
export async function listAdminKits() {
  if (!db) return [];
  const [rows, installs, reports] = await Promise.all([
    db
      .select({ kit: kits, handle: user.handle })
      .from(kits)
      .leftJoin(user, eq(kits.ownerId, user.id))
      .orderBy(desc(kits.official), kits.slug),
    db.select({ kit: kitStatsDaily.kit, n: sum(kitStatsDaily.installs) }).from(kitStatsDaily).groupBy(kitStatsDaily.kit),
    db.select({ kit: kitReports.kit, n: count() }).from(kitReports).where(eq(kitReports.status, "open")).groupBy(kitReports.kit),
  ]);
  const verifications = rows.length
    ? await db
        .select({ kit: kitVerifications.kit, version: kitVerifications.version, platform: kitVerifications.platform, ok: kitVerifications.ok, createdAt: kitVerifications.createdAt })
        .from(kitVerifications)
        .where(inArray(kitVerifications.kit, rows.map((r) => r.kit.slug)))
        .orderBy(desc(kitVerifications.createdAt))
    : [];
  const installsBy = new Map(installs.map((i) => [i.kit, Number(i.n ?? 0)]));
  const reportsBy = new Map(reports.map((r) => [r.kit, r.n]));
  return rows.map(({ kit, handle }) => {
    // Same rule as the public badge: the latest report on every platform tested passed.
    const latest = new Map<string, { ok: boolean; at: Date }>();
    for (const v of verifications) {
      if (v.kit === kit.slug && v.version === kit.latestVersion && !latest.has(v.platform)) latest.set(v.platform, { ok: v.ok, at: v.createdAt });
    }
    const platforms = [...latest.entries()].map(([platform, v]) => ({ platform, ...v }));
    return {
      slug: kit.slug,
      title: kit.title,
      official: kit.official,
      status: kit.status,
      visibility: kit.visibility,
      version: kit.latestVersion,
      featured: Boolean(kit.featuredAt),
      owner: handle,
      repo: kit.repo,
      updatedAt: kit.updatedAt,
      installs: installsBy.get(kit.slug) ?? 0,
      openReports: reportsBy.get(kit.slug) ?? 0,
      platforms,
      verified: platforms.length > 0 && platforms.every((p) => p.ok),
    };
  });
}

export async function listAdminReports() {
  if (!db) return [];
  return db.select().from(kitReports).orderBy(desc(kitReports.createdAt)).limit(200);
}

export async function listAdminSubscribers(limit = 500) {
  if (!db) return { subscribers: [], issues: [] };
  const [subscribers, issues] = await Promise.all([
    db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt)).limit(limit),
    db.select().from(newsletterIssues).orderBy(desc(newsletterIssues.sentAt)).limit(20),
  ]);
  return { subscribers, issues };
}

/**
 * A manual verification is one more "platform" in kit_verifications: the badge rule (latest result
 * per platform, all passing) stays the same. Revoking records a failing manual result, so a kit
 * with passing CI reports can still be marked as not verified.
 */
export async function recordManualVerification(slug: string, ok: boolean, adminHandle: string) {
  if (!db) return;
  const [kit] = await db.select({ version: kits.latestVersion }).from(kits).where(eq(kits.slug, slug)).limit(1);
  if (!kit) return;
  const now = new Date();
  await db.insert(kitVerifications).values({
    kit: slug,
    version: kit.version,
    ok,
    platform: "manual",
    repository: `admin:${adminHandle}`,
    commitSha: "manual",
    report: {
      kit: slug,
      version: kit.version,
      cliVersion: "admin",
      platform: "manual",
      node: "-",
      startedAt: now.toISOString(),
      durationMs: 0,
      skills: { checked: 0, missing: [] },
      combinations: [],
      ok,
    },
  });
}

export async function setUserRole(userId: string, role: "admin" | "user") {
  if (!db) return;
  await db.update(user).set({ role }).where(eq(user.id, userId));
}
