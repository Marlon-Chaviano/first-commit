import "server-only";

import { setTimeout as delay } from "node:timers/promises";

import { BRAND } from "@kits/schema";
import { render } from "@react-email/render";
import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";

import { DigestEmail } from "@/emails/digest";

import { db } from "./db";
import { newsletterDeliveries as deliveries, newsletterReleases as releases, newsletterSubscribers as subscribers } from "./db/schema";
import { EmailDeliveryError, sendEmail } from "./email";
import { env } from "./env";
import { getChangelog, oneClickUnsubscribeUrl, unsubscribeUrl, type ChangelogEntry } from "./newsletter";

const pending = and(isNull(deliveries.sentAt), isNull(deliveries.skippedAt));
const siteUrl = () => env.BETTER_AUTH_URL ?? BRAND.siteUrl;

/** Snapshot the audience and content together; a redeploy cannot add recipients or change retries. */
async function prepareRelease(entry: ChangelogEntry) {
  await db!.transaction(async (tx) => {
    const claimed = await tx.insert(releases).values({ id: entry.id, entry }).onConflictDoNothing().returning({ id: releases.id });
    if (!claimed.length) return;
    const audience = await tx.select({ id: subscribers.id, email: subscribers.email }).from(subscribers).where(eq(subscribers.status, "confirmed"));
    if (!audience.length) {
      await tx.update(releases).set({ completedAt: new Date() }).where(eq(releases.id, entry.id));
      return;
    }
    const rows = await Promise.all(audience.map(async (subscriber) => ({
      releaseId: entry.id,
      subscriberId: subscriber.id,
      email: {
        from: env.EMAIL_FROM ?? `${BRAND.name} <onboarding@resend.dev>`,
        to: subscriber.email,
        subject: entry.title,
        html: await render(DigestEmail({ brand: BRAND.name, siteUrl: siteUrl(), unsubscribeUrl: unsubscribeUrl(subscriber.id), news: [entry], featured: [], newKits: [] })),
        headers: { "List-Unsubscribe": `<${oneClickUnsubscribeUrl(subscriber.id)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      },
    })));
    // Stay below Postgres's bind-parameter limit for larger audiences.
    for (let i = 0; i < rows.length; i += 500) await tx.insert(deliveries).values(rows.slice(i, i + 500));
  });
}

export interface NewsletterResult {
  status: "sent" | "pending" | "skipped";
  recipients: number;
  reason?: string;
}

/** Called after a successful production deployment; scheduled/manual calls are safe retries. */
export async function sendChangelogNotifications(): Promise<NewsletterResult> {
  if (!db) return { status: "skipped", reason: "no database", recipients: 0 };
  if (!env.RESEND_API_KEY) return { status: "skipped", reason: "no email provider", recipients: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const entries = (await getChangelog()).filter((entry) => entry.notify && entry.date <= today).reverse();
  for (const entry of entries) await prepareRelease(entry);

  // Bound each invocation. The deployment workflow calls again while work remains.
  const batch = await db.select().from(deliveries).where(pending).orderBy(asc(deliveries.releaseId), asc(deliveries.subscriberId)).limit(50);
  let recipients = 0;
  for (const candidate of batch) {
    const now = new Date();
    const identity = and(eq(deliveries.releaseId, candidate.releaseId), eq(deliveries.subscriberId, candidate.subscriberId));
    const [delivery] = await db.update(deliveries).set({
      firstAttemptAt: sql`coalesce(${deliveries.firstAttemptAt}, ${now.toISOString()}::timestamptz)`,
      leaseUntil: new Date(now.getTime() + 60_000),
    }).where(and(identity, pending, or(isNull(deliveries.leaseUntil), lt(deliveries.leaseUntil, now)))).returning();
    if (!delivery) continue;

    try {
      const [subscriber] = await db.select({ status: subscribers.status }).from(subscribers).where(eq(subscribers.id, delivery.subscriberId));
      if (subscriber?.status !== "confirmed") {
        await db.update(deliveries).set({ skippedAt: new Date(), leaseUntil: null }).where(identity);
        continue;
      }
      // Resend remembers idempotency keys for 24h. An uncertain older attempt needs
      // provider reconciliation, not a blind retry that could send a duplicate.
      if (now.getTime() - delivery.firstAttemptAt!.getTime() >= 23 * 60 * 60 * 1000) {
        throw new Error(`Newsletter delivery needs reconciliation: ${delivery.releaseId}/${delivery.subscriberId}`);
      }
      const accepted = await sendEmail(delivery.email, `newsletter/${delivery.releaseId}/${delivery.subscriberId}`);
      if (!accepted) throw new Error("Newsletter email was not accepted by the provider");
      await db.update(deliveries).set({ sentAt: new Date(), leaseUntil: null }).where(identity);
      recipients++;
      // Resend's default request limit is two per second; leave room between sends.
      await delay(600);
    } catch (error) {
      // A definite rejection (including quota/rate limits) is safe to retry later.
      // Timeouts, server errors and idempotency conflicts remain uncertain.
      const rejected = error instanceof EmailDeliveryError && error.status >= 400 && error.status < 500 && error.status !== 409;
      await db.update(deliveries).set({ leaseUntil: null, ...(rejected ? { firstAttemptAt: null } : {}) }).where(identity);
      throw error;
    }
  }

  await db.update(releases).set({ completedAt: new Date() }).where(and(isNull(releases.completedAt), sql`not exists (
    select 1 from ${deliveries} where ${deliveries.releaseId} = ${releases.id}
    and ${deliveries.sentAt} is null and ${deliveries.skippedAt} is null
  )`));
  const remaining = await db.select({ releaseId: deliveries.releaseId }).from(deliveries).where(pending).limit(1);
  return { status: remaining.length ? "pending" : recipients ? "sent" : "skipped", recipients, ...(!remaining.length && !recipients ? { reason: "nothing new" } : {}) };
}
