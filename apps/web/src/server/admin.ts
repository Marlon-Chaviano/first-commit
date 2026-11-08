import "server-only";

import { and, count, desc, eq, exists, gte, ilike, inArray, or, sql, sum, type SQL } from "drizzle-orm";

import { db } from "./db";
import { account, user } from "./db/auth-schema";
import { installEvents, kitReports, kitStatsDaily, kitVerifications, kits, newsletterIssues, newsletterSubscribers } from "./db/schema";
import { adminHandles } from "./env";
import { getIndex } from "./registry";

const DAY = 24 * 60 * 60 * 1000;
const since = (days: number) => new Date(Date.now() - days * DAY);
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** Headline numbers for the admin overview. Every count is one cheap aggregate. */
export async function getAdminOverview() {
  if (!db) return null;
  const [[users], [newUsers], kitRows, [installs], [installsWeek], [openReports], subscriberRows, [events]] = await Promise.all([
    db.select({ n: count() }).from(user),
    db.select({ n: count() }).from(user).where(gte(user.createdAt, since(7))),
    db.select({ official: kits.official, status: kits.status, n: count() }).from(kits).groupBy(kits.official, kits.status),
    db.select({ n: sum(kitStatsDaily.installs) }).from(kitStatsDaily),
    db.select({ n: sum(kitStatsDaily.installs) }).from(kitStatsDaily).where(gte(kitStatsDaily.day, isoDay(since(7)))),
    db.select({ n: count() }).from(kitReports).where(eq(kitReports.status, "open")),
    db.select({ status: newsletterSubscribers.status, n: count() }).from(newsletterSubscribers).groupBy(newsletterSubscribers.status),
    db.select({ n: count() }).from(installEvents),
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
    unsubscribed: subscribers.unsubscribed ?? 0,
    /** Raw CLI events (installs, updates and adds), the rows of the Installs tab. */
    events: events!.n,
  };
}

/** A page of a long admin list: the rows, the total that matches, and where we are. */
export interface AdminPage<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** `%term%` for ILIKE, with the user's own wildcards taken literally. */
const contains = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const offset = (page: number, pageSize: number) => (Math.max(1, page) - 1) * pageSize;

export const USER_FILTERS = ["all", "admins", "creators"] as const;
export type UserFilter = (typeof USER_FILTERS)[number];

/** Newest accounts first, a page at a time, with how they sign in and how many kits they own. */
export async function listAdminUsers({ page = 1, pageSize = 25, q = "", filter = "all" }: { page?: number; pageSize?: number; q?: string; filter?: UserFilter } = {}): Promise<AdminPage<AdminUser>> {
  if (!db) return { rows: [], total: 0, page, pageSize };
  const where: SQL[] = [];
  if (q.trim()) where.push(or(ilike(user.name, contains(q.trim())), ilike(user.email, contains(q.trim())), ilike(user.handle, contains(q.trim())))!);
  if (filter === "admins") {
    const handles = [...adminHandles];
    where.push(handles.length ? or(eq(user.role, "admin"), inArray(sql`lower(${user.handle})`, handles))! : eq(user.role, "admin"));
  }
  if (filter === "creators") where.push(exists(db.select({ one: sql`1` }).from(kits).where(eq(kits.ownerId, user.id))));
  const condition = where.length ? and(...where) : undefined;

  const [rows, [total]] = await Promise.all([
    db
      .select({ id: user.id, name: user.name, email: user.email, image: user.image, handle: user.handle, role: user.role, createdAt: user.createdAt })
      .from(user)
      .where(condition)
      .orderBy(desc(user.createdAt))
      .limit(pageSize)
      .offset(offset(page, pageSize)),
    db.select({ n: count() }).from(user).where(condition),
  ]);
  const ids = rows.map((r) => r.id);
  const [providers, owned] = ids.length
    ? await Promise.all([
        db.select({ userId: account.userId, providerId: account.providerId }).from(account).where(inArray(account.userId, ids)),
        db.select({ ownerId: kits.ownerId, n: count() }).from(kits).where(inArray(kits.ownerId, ids)).groupBy(kits.ownerId),
      ])
    : [[], []];
  const kitsBy = new Map(owned.map((o) => [o.ownerId, o.n]));
  return {
    rows: rows.map((r) => ({
      ...r,
      kits: kitsBy.get(r.id) ?? 0,
      providers: providers.filter((p) => p.userId === r.id).map((p) => p.providerId),
      // ADMIN_HANDLES grants the role on every request; those accounts can't be demoted from here.
      adminByConfig: Boolean(r.handle && adminHandles.has(r.handle.toLowerCase())),
    })),
    total: total!.n,
    page,
    pageSize,
  };
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  handle: string | null;
  role: string | null;
  createdAt: Date;
  kits: number;
  providers: string[];
  adminByConfig: boolean;
}

export const INSTALL_TYPES = ["all", "install", "update", "add"] as const;
export type InstallType = (typeof INSTALL_TYPES)[number];
export type AdminInstall = typeof installEvents.$inferSelect;

/** Raw CLI events, newest first, a page at a time. `q` matches the kit name. */
export async function listAdminInstalls({ page = 1, pageSize = 50, q = "", type = "all" }: { page?: number; pageSize?: number; q?: string; type?: InstallType } = {}): Promise<AdminPage<AdminInstall>> {
  if (!db) return { rows: [], total: 0, page, pageSize };
  const where: SQL[] = [];
  if (q.trim()) where.push(ilike(installEvents.kit, contains(q.trim())));
  if (type !== "all") where.push(eq(installEvents.eventType, type));
  const condition = where.length ? and(...where) : undefined;
  const [rows, [total]] = await Promise.all([
    db.select().from(installEvents).where(condition).orderBy(desc(installEvents.createdAt)).limit(pageSize).offset(offset(page, pageSize)),
    db.select({ n: count() }).from(installEvents).where(condition),
  ]);
  return { rows, total: total!.n, page, pageSize };
}

export type AdminKit = Awaited<ReturnType<typeof listAdminKits>>[number];

/**
 * Every kit with its owner, installs and the verification of its latest version. Official kits live
 * in the registry (registry/index.json), not in Postgres: they're merged in from there.
 */
export async function listAdminKits() {
  const [index, rows, installs, reports] = await Promise.all([
    getIndex(),
    db ? db.select({ kit: kits, handle: user.handle }).from(kits).leftJoin(user, eq(kits.ownerId, user.id)).orderBy(kits.slug) : [],
    db ? db.select({ kit: kitStatsDaily.kit, n: sum(kitStatsDaily.installs) }).from(kitStatsDaily).groupBy(kitStatsDaily.kit) : [],
    db ? db.select({ kit: kitReports.kit, n: count() }).from(kitReports).where(eq(kitReports.status, "open")).groupBy(kitReports.kit) : [],
  ]);
  const inDb = new Set(rows.map((r) => r.kit.slug));
  const all = [
    ...index
      .filter((e) => !inDb.has(e.name))
      .map((e) => ({ slug: e.name, title: e.title, official: true, status: "active", visibility: "public", version: e.version, featured: false, owner: e.author as string | null, repo: "", updatedAt: null as Date | null })),
    ...rows.map(({ kit, handle }) => ({
      slug: kit.slug,
      title: kit.title,
      official: kit.official,
      status: kit.status,
      visibility: kit.visibility,
      version: kit.latestVersion,
      featured: Boolean(kit.featuredAt),
      owner: handle,
      repo: kit.repo,
      updatedAt: kit.updatedAt as Date | null,
    })),
  ].sort((a, b) => Number(b.official) - Number(a.official) || a.slug.localeCompare(b.slug));

  const verifications =
    db && all.length
      ? await db
          .select({ kit: kitVerifications.kit, version: kitVerifications.version, platform: kitVerifications.platform, ok: kitVerifications.ok, createdAt: kitVerifications.createdAt })
          .from(kitVerifications)
          .where(inArray(kitVerifications.kit, all.map((k) => k.slug)))
          .orderBy(desc(kitVerifications.createdAt))
      : [];
  const installsBy = new Map(installs.map((i) => [i.kit, Number(i.n ?? 0)]));
  const reportsBy = new Map(reports.map((r) => [r.kit, r.n]));
  return all.map((kit) => {
    // Same rule as the public badge: the latest report on every platform tested passed.
    const latest = new Map<string, { ok: boolean; at: Date }>();
    for (const v of verifications) {
      if (v.kit === kit.slug && v.version === kit.version && !latest.has(v.platform)) latest.set(v.platform, { ok: v.ok, at: v.createdAt });
    }
    const platforms = [...latest.entries()].map(([platform, v]) => ({ platform, ...v }));
    return {
      ...kit,
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

export const SUBSCRIBER_FILTERS = ["all", "confirmed", "pending", "unsubscribed"] as const;
export type SubscriberFilter = (typeof SUBSCRIBER_FILTERS)[number];
export type AdminSubscriber = typeof newsletterSubscribers.$inferSelect;

/** Subscribers a page at a time (newest first), plus the last issues sent. */
export async function listAdminSubscribers({ page = 1, pageSize = 25, q = "", filter = "all" }: { page?: number; pageSize?: number; q?: string; filter?: SubscriberFilter } = {}) {
  const empty = { subscribers: { rows: [], total: 0, page, pageSize } as AdminPage<AdminSubscriber>, issues: [] as (typeof newsletterIssues.$inferSelect)[] };
  if (!db) return empty;
  const where: SQL[] = [];
  if (q.trim()) where.push(ilike(newsletterSubscribers.email, contains(q.trim())));
  if (filter !== "all") where.push(eq(newsletterSubscribers.status, filter));
  const condition = where.length ? and(...where) : undefined;
  const [rows, [total], issues] = await Promise.all([
    db.select().from(newsletterSubscribers).where(condition).orderBy(desc(newsletterSubscribers.createdAt)).limit(pageSize).offset(offset(page, pageSize)),
    db.select({ n: count() }).from(newsletterSubscribers).where(condition),
    db.select().from(newsletterIssues).orderBy(desc(newsletterIssues.sentAt)).limit(20),
  ]);
  return { subscribers: { rows, total: total!.n, page, pageSize }, issues };
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
