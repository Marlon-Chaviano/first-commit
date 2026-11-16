import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { BRAND } from "@kits/schema";
import { render } from "@react-email/render";
import { and, eq, gte } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { z } from "zod";

import { ConfirmEmail } from "@/emails/confirm";

import { db } from "./db";
import { newsletterSubscribers } from "./db/schema";
import { sendEmail } from "./email";
import { env } from "./env";
import { REGISTRY } from "./registry";

const changelogSchema = z.array(z.object({
  id: z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  date: z.iso.date(),
  title: z.string(),
  items: z.array(z.string()),
  notify: z.boolean().default(true),
})).refine((entries) => new Set(entries.map((entry) => entry.id)).size === entries.length, "Changelog ids must be unique");
export type ChangelogEntry = z.infer<typeof changelogSchema>[number];

/** registry/changelog.json, newest first. Feeds /changelog and publication emails. Keep each entry id stable after publication. */
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

/** Where an email stands: shown on the changelog so a subscriber isn't asked to subscribe again. */
export async function newsletterStatus(rawEmail: string): Promise<"confirmed" | "pending" | null> {
  if (!db) return null;
  const row = (
    await db
      .select({ status: newsletterSubscribers.status })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, rawEmail.trim().toLowerCase()))
      .limit(1)
  )[0];
  return row?.status === "confirmed" || row?.status === "pending" ? row.status : null;
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
