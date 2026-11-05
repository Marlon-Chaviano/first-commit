import "server-only";

import type { InstallEvent } from "@kits/schema";

import { redis } from "../redis";
import { keys } from "./keys";

/** What the queue stores: the validated event plus server-side fields. */
export interface QueuedEvent extends InstallEvent {
  id: string;
  official: boolean;
  country: string | null;
  receivedAt: string;
}

/**
 * Queues an install / update / add event: one LPUSH, nothing else. The flush
 * job (QStash, every 10 min) moves the queue into Postgres, where every
 * counter is computed. Keeping Redis to one command per event is what lets
 * ~150K installs a month fit in Upstash's free tier (500K commands).
 * Returns false when Redis isn't configured (event dropped).
 */
export async function recordInstall(event: InstallEvent, meta: { official: boolean; country: string | null }): Promise<boolean> {
  if (!redis) return false;
  const queued: QueuedEvent = {
    ...event,
    id: crypto.randomUUID(),
    official: meta.official,
    country: meta.country,
    receivedAt: new Date().toISOString(),
  };
  await redis.lpush(keys.queue, JSON.stringify(queued));
  return true;
}
