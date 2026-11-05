import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "../db";
import { installEvents, kitStatsDaily } from "../db/schema";
import { dayBucket } from "./keys";

export interface KitStats {
  installs: number;
  unique: number;
  /** Installs per week, oldest first (8 weeks). */
  weekly: number[];
  /** "option=choice" → count */
  breakdown: Record<string, number>;
  /** "update" / "add" / "add:<library>" → count */
  retention: Record<string, number>;
}

export interface Leaderboard {
  total: number;
  allTime: Record<string, number>;
  trending: Record<string, number>;
  /** kit → 8 weekly install counts, for the activity column */
  weekly: Record<string, number[]>;
}

export const METRICS_TAG = "metrics";

const EMPTY_LEADERBOARD: Leaderboard = { total: 0, allTime: {}, trending: {}, weekly: {} };
const emptyStats = (): KitStats => ({ installs: 0, unique: 0, weekly: Array(8).fill(0), breakdown: {}, retention: {} });

/**
 * Counters come from Postgres (kit_stats_daily + install_events), written by
 * the flush job, so page views cost nothing in Redis. Cached with the "metrics"
 * profile (5 min): numbers lag the CLI by up to ~15 minutes.
 */
export async function getLeaderboard(kits: string[]): Promise<Leaderboard> {
  "use cache";
  cacheLife("metrics");
  cacheTag(METRICS_TAG);
  if (!db) return EMPTY_LEADERBOARD;
  try {
    const since = dayBucket(new Date(Date.now() - 55 * 86_400_000));
    const ranked = kits.length ? inArray(kitStatsDaily.kit, kits) : sql`false`;
    const [[totalRow], allTimeRows, trendingRows, dailyRows] = await Promise.all([
      db.select({ n: sql<number>`coalesce(sum(${kitStatsDaily.installs}), 0)::int` }).from(kitStatsDaily),
      db.select({ kit: kitStatsDaily.kit, n: sql<number>`sum(${kitStatsDaily.installs})::int` }).from(kitStatsDaily).where(ranked).groupBy(kitStatsDaily.kit),
      db
        .select({ kit: installEvents.kit, n: sql<number>`count(*)::int` })
        .from(installEvents)
        .where(
          and(
            eq(installEvents.eventType, "install"),
            gte(installEvents.createdAt, new Date(Date.now() - 86_400_000)),
            kits.length ? inArray(installEvents.kit, kits) : sql`false`,
          ),
        )
        .groupBy(installEvents.kit),
      db.select({ kit: kitStatsDaily.kit, day: kitStatsDaily.day, n: kitStatsDaily.installs }).from(kitStatsDaily).where(and(ranked, gte(kitStatsDaily.day, since))),
    ]);
    const byKit = (rows: { kit: string; n: number }[]) => Object.fromEntries(rows.map((r) => [r.kit, Number(r.n)]));
    const daily = new Map<string, Record<string, number>>();
    for (const r of dailyRows) daily.set(r.kit, { ...daily.get(r.kit), [r.day]: Number(r.n) });
    return {
      total: Number(totalRow?.n ?? 0),
      allTime: byKit(allTimeRows),
      trending: byKit(trendingRows),
      weekly: Object.fromEntries(kits.map((kit) => [kit, toWeekly(daily.get(kit) ?? null, Date.now())])),
    };
  } catch (error) {
    console.error("[metrics] leaderboard unavailable", error);
    return EMPTY_LEADERBOARD;
  }
}

export async function getKitStats(kit: string): Promise<KitStats> {
  "use cache";
  cacheLife("metrics");
  cacheTag(METRICS_TAG, `metrics:${kit}`);
  if (!db) return emptyStats();
  try {
    const installsOf = and(eq(installEvents.kit, kit), eq(installEvents.eventType, "install"));
    const since = dayBucket(new Date(Date.now() - 55 * 86_400_000));
    const [[totals], dailyRows, optionRows, agentRows, pmRows, retentionRows, addedRows] = await Promise.all([
      db
        .select({ installs: sql<number>`count(*)::int`, unique: sql<number>`count(distinct ${installEvents.anonId})::int` })
        .from(installEvents)
        .where(installsOf),
      db.select({ day: kitStatsDaily.day, n: kitStatsDaily.installs }).from(kitStatsDaily).where(and(eq(kitStatsDaily.kit, kit), gte(kitStatsDaily.day, since))),
      // "option=choice" counts straight from the jsonb of each install.
      db.execute<{ field: string; n: number }>(sql`
        select o.key || '=' || c.value as field, count(*)::int as n
        from ${installEvents}, jsonb_each(${installEvents.options}) as o(key, vals), jsonb_array_elements_text(o.vals) as c(value)
        where ${installsOf} and jsonb_typeof(o.vals) = 'array'
        group by 1`),
      db.execute<{ field: string; n: number }>(sql`
        select 'agent=' || a as field, count(*)::int as n from ${installEvents}, unnest(${installEvents.agents}) as a
        where ${installsOf} group by 1`),
      db.select({ pm: installEvents.pm, n: sql<number>`count(*)::int` }).from(installEvents).where(installsOf).groupBy(installEvents.pm),
      db
        .select({ type: installEvents.eventType, n: sql<number>`count(*)::int` })
        .from(installEvents)
        .where(and(eq(installEvents.kit, kit), inArray(installEvents.eventType, ["update", "add"])))
        .groupBy(installEvents.eventType),
      db.execute<{ field: string; n: number }>(sql`
        select 'add:' || l as field, count(*)::int as n
        from ${installEvents}, jsonb_array_elements_text(coalesce(${installEvents.options} -> 'added', '[]'::jsonb)) as l
        where ${installEvents.kit} = ${kit} and ${installEvents.eventType} = 'add' group by 1`),
    ]);
    const rows = (r: { rows?: unknown[] } | unknown[]) => (Array.isArray(r) ? r : (r.rows ?? [])) as { field: string; n: number }[];
    const fields = (list: { field: string; n: number }[]) => Object.fromEntries(list.map((x) => [x.field, Number(x.n)]));
    return {
      installs: Number(totals?.installs ?? 0),
      unique: Number(totals?.unique ?? 0),
      weekly: toWeekly(Object.fromEntries(dailyRows.map((d) => [d.day, Number(d.n)])), Date.now()),
      breakdown: {
        ...fields(rows(optionRows)),
        ...fields(rows(agentRows)),
        ...Object.fromEntries(pmRows.map((r) => [`pm=${r.pm}`, Number(r.n)])),
      },
      retention: { ...Object.fromEntries(retentionRows.map((r) => [r.type, Number(r.n)])), ...fields(rows(addedRows)) },
    };
  } catch (error) {
    console.error("[metrics] kit stats unavailable", error);
    return emptyStats();
  }
}

function toWeekly(daily: Record<string, number> | null, now: number): number[] {
  const weeks = Array<number>(8).fill(0);
  if (!daily) return weeks;
  for (let d = 0; d < 56; d++) {
    const n = Number(daily[dayBucket(new Date(now - d * 86_400_000))] ?? 0);
    weeks[7 - Math.floor(d / 7)]! += n;
  }
  return weeks;
}
