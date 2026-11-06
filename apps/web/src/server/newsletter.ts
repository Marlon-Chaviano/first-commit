import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { BRAND } from "@kits/schema";
import { render } from "@react-email/render";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { z } from "zod";

import { ConfirmEmail } from "@/emails/confirm";
import { DigestEmail, type DigestKit } from "@/emails/digest";

import { db } from "./db";
import { kits, newsletterIssues, newsletterSubscribers } from "./db/schema";
import { sendEmail, sendEmails } from "./email";
import { env } from "./env";
import { REGISTRY } from "./registry";

const changelogSchema = z.array(z.object({ date: z.iso.date(), title: z.string(), items: z.array(z.string()) }));
export type ChangelogEntry = z.infer<typeof changelogSchema>[number];

/** registry/changelog.json, newest first. Feeds /changelog and the weekly digest. */
export async function getChangelog(): Promise<ChangelogEntry[]> {
  "use cache";
  cacheLife("max");
  const entries = changelogSchema.parse(JSON.parse(await readFile(join(REGISTRY, "changelog.json"), "utf8")));
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const siteUrl = () => env.BETTER_AUTH_URL ?? BRAND.siteUrl;

/** Unsubscribe links are signed: they work forever without storing a second secret per subscriber. */
function signature(id: string): string {
  const secret = env.BETTER_AUTH_SECRET ?? env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET is missing to sign unsubscribe links");
  return createHmac("sha256", secret ?? "dev-only").update(`unsubscribe:${id}`).digest("base64url");
}

/** The page behind the email's "Unsubscribe" link: it asks before doing anything, so link scanners can't unsubscribe anyone. */
export function unsubscribeUrl(id: string): string {
  return `${siteUrl()}/changelog/unsubscribe?id=${id}&sig=${signature(id)}`;
}

/** RFC 8058 one-click endpoint (List-Unsubscribe-Post): mail clients POST to it. */
export function oneClickUnsubscribeUrl(id: string): string {
  return `${siteUrl()}/api/newsletter/unsubscribe?id=${id}&sig=${signature(id)}`;
}

/** A confirm link is valid for a week after the last subscribe attempt. */
const CONFIRM_TTL_MS = 7 * 86_400_000;

export type SubscribeResult = "sent" | "already" | "unavailable";

/** Double opt-in: stores a pending subscriber and emails the confirm link. */
export async function subscribe(rawEmail: string): Promise<SubscribeResult> {
  if (!db) return "unavailable";
  const email = rawEmail.trim().toLowerCase();
  const existing = (await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email)).limit(1))[0];
  if (existing?.status === "confirmed") return "already";
  const token = randomBytes(24).toString("base64url");
  await db
    .insert(newsletterSubscribers)
    .values({ email, tokenHash: sha(token), status: "pending" })
    .onConflictDoUpdate({ target: newsletterSubscribers.email, set: { tokenHash: sha(token), status: "pending", createdAt: new Date() } });
  const confirmUrl = `${siteUrl()}/changelog/confirm?token=${token}`;
  const sent = await sendEmail({
    to: email,
    subject: `Confirm your subscription to ${BRAND.name}`,
    html: await render(ConfirmEmail({ brand: BRAND.name, confirmUrl })),
    text: `Confirm your subscription: ${confirmUrl}`,
  });
  // Without an email provider nobody could ever confirm; in development the email is logged instead.
  if (!sent && process.env.NODE_ENV === "production") return "unavailable";
  return "sent";
}

export async function confirmSubscription(token: string): Promise<boolean> {
  if (!db || !token) return false;
  const rows = await db
    .update(newsletterSubscribers)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(
      and(
        eq(newsletterSubscribers.tokenHash, sha(token)),
        eq(newsletterSubscribers.status, "pending"),
        gte(newsletterSubscribers.createdAt, new Date(Date.now() - CONFIRM_TTL_MS)),
      ),
    )
    .returning({ id: newsletterSubscribers.id });
  return rows.length > 0;
}

export async function unsubscribe(id: string, sig: string): Promise<boolean> {
  if (!db || !z.uuid().safeParse(id).success) return false;
  const expected = Buffer.from(signature(id));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  await db.update(newsletterSubscribers).set({ status: "unsubscribed" }).where(eq(newsletterSubscribers.id, id));
  return true;
}

/** "2026-W45" (ISO 8601 week). */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export interface DigestResult {
  week: string;
  status: "sent" | "skipped";
  reason?: string;
  recipients: number;
}

/**
 * Weekly digest (QStash job): changelog entries since the last issue, featured
 * kits and new community kits of the week. One issue per ISO week at most.
 */
export async function sendWeeklyDigest(now = new Date()): Promise<DigestResult> {
  const week = isoWeek(now);
  if (!db) return { week, status: "skipped", reason: "no database", recipients: 0 };
  const last = (await db.select().from(newsletterIssues).orderBy(desc(newsletterIssues.sentAt)).limit(1))[0];
  if (last?.week === week) return { week, status: "skipped", reason: "already sent this week", recipients: 0 };

  const since = last?.sentAt ?? new Date(now.getTime() - 7 * 86_400_000);
  const news = (await getChangelog()).filter((e) => new Date(`${e.date}T23:59:59Z`) > since).slice(0, 3);
  const toDigest = (k: typeof kits.$inferSelect): DigestKit => ({ name: k.slug, title: k.title, description: k.description, url: `${siteUrl()}/kits/${k.slug}` });
  const active = and(eq(kits.status, "active"), eq(kits.official, false), eq(kits.visibility, "public"));
  const featured = (await db.select().from(kits).where(and(active, isNotNull(kits.featuredAt), gte(kits.featuredAt, since))).orderBy(desc(kits.featuredAt)).limit(3)).map(toDigest);
  const newKits = (await db.select().from(kits).where(and(active, gte(kits.createdAt, since))).orderBy(desc(kits.createdAt)).limit(5)).map(toDigest);
  if (!news.length && !featured.length && !newKits.length) return { week, status: "skipped", reason: "nothing new", recipients: 0 };

  const subscribers = await db.select({ id: newsletterSubscribers.id, email: newsletterSubscribers.email }).from(newsletterSubscribers).where(eq(newsletterSubscribers.status, "confirmed"));
  const subject = news[0]?.title ?? featured[0]?.title ?? `New kits on ${BRAND.name}`;
  // Claim the week first: a retried or concurrent run hits the unique index and stops here.
  const claimed = await db.insert(newsletterIssues).values({ week, subject, recipients: 0 }).onConflictDoNothing().returning({ id: newsletterIssues.id });
  if (!claimed.length) return { week, status: "skipped", reason: "already sent this week", recipients: 0 };

  const emails = await Promise.all(
    subscribers.map(async (s) => {
      const unsub = unsubscribeUrl(s.id);
      return {
        to: s.email,
        subject,
        html: await render(DigestEmail({ brand: BRAND.name, siteUrl: siteUrl(), unsubscribeUrl: unsub, news, featured, newKits })),
        headers: { "List-Unsubscribe": `<${oneClickUnsubscribeUrl(s.id)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      };
    }),
  );
  const recipients = await sendEmails(emails);
  await db.update(newsletterIssues).set({ recipients }).where(eq(newsletterIssues.id, claimed[0]!.id));
  return { week, status: "sent", recipients };
}
