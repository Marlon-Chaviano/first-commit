import "server-only";

import { Receiver } from "@upstash/qstash";

import { env, qstashDev } from "../env";

/**
 * Scheduled jobs are triggered by QStash (free tier) instead of Vercel Cron
 * (Pro only for sub-daily schedules). A request is accepted when:
 *   - it carries a valid `upstash-signature` from QStash, or
 *   - it's a manual run with `Authorization: Bearer <CRON_SECRET>`.
 */
export async function isAuthorizedJob(request: Request, body: string): Promise<boolean> {
  const signature = request.headers.get("upstash-signature");
  if (signature) {
    const receiver = qstashDev
      ? new Receiver({ devMode: true })
      : env.QSTASH_CURRENT_SIGNING_KEY && env.QSTASH_NEXT_SIGNING_KEY
        ? new Receiver({ currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY, nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY })
        : null;
    if (!receiver) return false;
    try {
      return await receiver.verify({ signature, body });
    } catch {
      return false;
    }
  }
  return Boolean(env.CRON_SECRET) && request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}
