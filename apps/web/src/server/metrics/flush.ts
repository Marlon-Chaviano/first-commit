import "server-only";

import { sql } from "drizzle-orm";

import { db } from "../db";
import { installEvents, kitStatsDaily } from "../db/schema";
import { redis } from "../redis";
import type { QueuedEvent } from "./ingest";
import { keys } from "./keys";

const BATCH = 500;

/**
 * Drains the Redis event queue into Postgres in batches. At-least-once: the
 * batch is read, inserted (duplicates ignored by id), and only then trimmed,
 * so a crash mid-way re-delivers instead of losing events.
 */
export async function flushEvents(maxBatches = 20): Promise<{ flushed: number }> {
  if (!redis || !db) return { flushed: 0 };
  let flushed = 0;

  for (let i = 0; i < maxBatches; i++) {
    // LPUSH adds to the head, so the oldest events are at the tail.
    const raw = await redis.lrange<QueuedEvent | string>(keys.queue, -BATCH, -1);
    if (!raw.length) break;
    const events = raw.map((r) => (typeof r === "string" ? (JSON.parse(r) as QueuedEvent) : r));

    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(installEvents)
        .values(
          events.map((e) => ({
            id: e.id,
            kit: e.kit,
            eventType: e.type ?? "install",
            kitVersion: e.kitVersion ?? null,
            official: e.official,
            options: e.options,
            skills: e.skills,
            agents: e.agents,
            pm: e.pm,
            cliVersion: e.cliVersion,
            os: e.os ?? null,
            anonId: e.anonId,
            country: e.country,
            createdAt: new Date(e.receivedAt),
          })),
        )
        .onConflictDoNothing()
        .returning({ kit: installEvents.kit, createdAt: installEvents.createdAt, eventType: installEvents.eventType });

      // Roll up only rows that were actually new, so re-deliveries don't double count.
      const rollup = new Map<string, number>();
      for (const row of inserted.filter((r) => r.eventType === "install")) {
        const key = `${row.kit}|${row.createdAt.toISOString().slice(0, 10)}`;
        rollup.set(key, (rollup.get(key) ?? 0) + 1);
      }
      if (rollup.size) {
        await tx
          .insert(kitStatsDaily)
          .values([...rollup].map(([key, installs]) => {
            const [kit, day] = key.split("|") as [string, string];
            return { kit, day, installs };
          }))
          .onConflictDoUpdate({
            target: [kitStatsDaily.kit, kitStatsDaily.day],
            set: { installs: sql`${kitStatsDaily.installs} + excluded.installs` },
          });
      }
    });

    await redis.ltrim(keys.queue, 0, -(raw.length + 1));
    flushed += raw.length;
    if (raw.length < BATCH) break;
  }
  return { flushed };
}
