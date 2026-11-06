import "server-only";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import { BRAND } from "@kits/schema";
import { render } from "@react-email/render";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { OrgCodeEmail } from "@/emails/org-code";

import { db } from "./db";
import { orgEmailVerifications } from "./db/schema";
import { sendEmail } from "./email";
import { OrgError } from "./orgs";
import type { TokenUser } from "./tokens";

const CODE_TTL_MS = 10 * 60_000;
const RESEND_AFTER_MS = 60_000;
const MAX_ATTEMPTS = 5;

/** Personal and disposable mailboxes: they prove nothing about a company. */
const PERSONAL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "ymail.com", "rocketmail.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "pm.me", "gmx.com", "gmx.net", "gmx.de", "mail.com",
  "yandex.com", "yandex.ru", "zoho.com", "tutanota.com", "tuta.io", "hey.com", "fastmail.com", "qq.com", "163.com", "126.com",
  "mail.ru", "inbox.ru", "web.de", "hushmail.com", "mailinator.com", "guerrillamail.com", "10minutemail.com", "temp-mail.org", "yopmail.com",
]);
const PERSONAL_PREFIXES = ["yahoo.", "hotmail.", "outlook.", "live.", "gmail."];

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

/** The domain of a work email, or an OrgError explaining why the address doesn't qualify. */
export function workEmailDomain(raw: string): { email: string; domain: string } {
  const parsed = z.email().safeParse(raw.trim().toLowerCase());
  if (!parsed.success) throw new OrgError(400, "Enter a valid email address");
  const email = parsed.data;
  const domain = email.split("@")[1]!;
  if (PERSONAL_DOMAINS.has(domain) || PERSONAL_PREFIXES.some((p) => domain.startsWith(p))) {
    throw new OrgError(400, "Use your work email: personal addresses like Gmail or Outlook can't verify a company");
  }
  return { email, domain };
}

/** Emails a 6-digit code to the work address. One pending code per user; a new one replaces it. */
export async function sendOrgCode(viewer: TokenUser, rawEmail: string, orgLabel: string): Promise<{ email: string }> {
  if (!db) throw new OrgError(503, "Organizations unavailable (no database)");
  const { email } = workEmailDomain(rawEmail);
  const [pending] = await db.select().from(orgEmailVerifications).where(eq(orgEmailVerifications.userId, viewer.id)).limit(1);
  if (pending && Date.now() - pending.createdAt.getTime() < RESEND_AFTER_MS) throw new OrgError(429, "Wait a minute before asking for another code");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const row = { email, codeHash: sha(code), attempts: 0, expiresAt: new Date(Date.now() + CODE_TTL_MS), createdAt: new Date() };
  await db.insert(orgEmailVerifications).values({ userId: viewer.id, ...row }).onConflictDoUpdate({ target: orgEmailVerifications.userId, set: row });
  const sent = await sendEmail({
    to: email,
    subject: `${code} is your ${BRAND.name} verification code`,
    html: await render(OrgCodeEmail({ brand: BRAND.name, code, org: orgLabel })),
    text: `Your ${BRAND.name} verification code: ${code}. It expires in 10 minutes.`,
  });
  // Locally without Resend the email (and its code) is printed in the server log instead.
  if (!sent && process.env.NODE_ENV === "production") throw new OrgError(503, "Couldn't send the code right now, try again later");
  return { email };
}

/** Checks the code (5 tries, 10 minutes) and consumes it. Returns the verified address and its domain. */
export async function consumeOrgCode(viewer: TokenUser, code: string): Promise<{ email: string; domain: string }> {
  if (!db) throw new OrgError(503, "Organizations unavailable (no database)");
  const [pending] = await db.select().from(orgEmailVerifications).where(eq(orgEmailVerifications.userId, viewer.id)).limit(1);
  if (!pending) throw new OrgError(400, "Ask for a code first");
  if (pending.expiresAt.getTime() < Date.now()) throw new OrgError(400, "The code expired: ask for a new one");
  if (pending.attempts >= MAX_ATTEMPTS) throw new OrgError(429, "Too many wrong codes: ask for a new one");
  const expected = Buffer.from(pending.codeHash);
  const given = Buffer.from(sha(code.trim()));
  if (!timingSafeEqual(expected, given)) {
    await db.update(orgEmailVerifications).set({ attempts: pending.attempts + 1 }).where(eq(orgEmailVerifications.userId, viewer.id));
    const left = MAX_ATTEMPTS - pending.attempts - 1;
    throw new OrgError(400, left > 0 ? `Wrong code, ${left} ${left === 1 ? "try" : "tries"} left` : "Too many wrong codes: ask for a new one");
  }
  await db.delete(orgEmailVerifications).where(eq(orgEmailVerifications.userId, viewer.id));
  return { email: pending.email, domain: pending.email.split("@")[1]! };
}
