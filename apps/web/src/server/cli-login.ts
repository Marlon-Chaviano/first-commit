import "server-only";

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { BRAND } from "@kits/schema";
import { and, eq, gt, lt } from "drizzle-orm";

import { db } from "./db";
import { cliLoginRequests, user } from "./db/schema";
import { env } from "./env";
import { createApiToken } from "./tokens";

/** How long a code can be approved, and how often the CLI may ask. */
export const CLI_LOGIN_TTL_S = 600;
export const CLI_LOGIN_INTERVAL_S = 2;

/** No 0/O, 1/I/L, vowels: codes read aloud and never spell words. */
const ALPHABET = "BCDFGHJKMNPQRSTVWXZ23456789";
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const siteUrl = () => env.BETTER_AUTH_URL ?? BRAND.siteUrl;

function userCode(): string {
  const chars = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** "BCDF2345", "bcdf-2345 " → "BCDF-2345". */
export const normalizeCode = (raw: string) => {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : null;
};

export interface StartedLogin {
  id: string;
  code: string;
  secret: string;
  url: string;
  interval: number;
  expiresIn: number;
}

/** Step 1 (CLI): a code to show, a secret to keep, and the page to open. */
export async function startCliLogin(device: string): Promise<StartedLogin | null> {
  if (!db) return null;
  // Expired requests are cleared on the way, so the table never grows.
  await db.delete(cliLoginRequests).where(lt(cliLoginRequests.expiresAt, new Date()));
  const secret = randomBytes(32).toString("base64url");
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = userCode();
    const [row] = await db
      .insert(cliLoginRequests)
      .values({ userCode: code, secretHash: sha(secret), device: device.slice(0, 80) || "a terminal", expiresAt: new Date(Date.now() + CLI_LOGIN_TTL_S * 1000) })
      .onConflictDoNothing()
      .returning({ id: cliLoginRequests.id });
    if (row) return { id: row.id, code, secret, url: `${siteUrl()}/cli/login?code=${code}`, interval: CLI_LOGIN_INTERVAL_S, expiresIn: CLI_LOGIN_TTL_S };
  }
  return null;
}

/** For the approval page: the pending request behind a code, if it's still valid. */
export async function findCliLogin(rawCode: string) {
  const code = normalizeCode(rawCode);
  if (!db || !code) return null;
  const [row] = await db
    .select({ code: cliLoginRequests.userCode, device: cliLoginRequests.device, status: cliLoginRequests.status, expiresAt: cliLoginRequests.expiresAt })
    .from(cliLoginRequests)
    .where(and(eq(cliLoginRequests.userCode, code), gt(cliLoginRequests.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

/** Step 2 (website, signed in): approve or deny. Only a pending, unexpired request changes. */
export async function decideCliLogin(rawCode: string, userId: string, approve: boolean): Promise<boolean> {
  const code = normalizeCode(rawCode);
  if (!db || !code) return false;
  const rows = await db
    .update(cliLoginRequests)
    .set({ status: approve ? "approved" : "denied", userId })
    .where(and(eq(cliLoginRequests.userCode, code), eq(cliLoginRequests.status, "pending"), gt(cliLoginRequests.expiresAt, new Date())))
    .returning({ id: cliLoginRequests.id });
  return rows.length > 0;
}

export type PollResult = { status: "pending" } | { status: "denied" } | { status: "expired" } | { status: "approved"; token: string; handle: string | null };

/**
 * Step 3 (CLI, every few seconds): once approved, the token is created and handed over once;
 * the request is deleted in the same step, so a second poll can't collect another token.
 */
export async function pollCliLogin(id: string, secret: string): Promise<PollResult> {
  if (!db || !/^[0-9a-f-]{36}$/.test(id)) return { status: "expired" };
  const [row] = await db.select().from(cliLoginRequests).where(eq(cliLoginRequests.id, id)).limit(1);
  if (!row) return { status: "expired" };
  const given = Buffer.from(sha(secret));
  if (given.length !== row.secretHash.length || !timingSafeEqual(given, Buffer.from(row.secretHash))) return { status: "expired" };
  if (row.expiresAt < new Date()) {
    await db.delete(cliLoginRequests).where(eq(cliLoginRequests.id, id));
    return { status: "expired" };
  }
  if (row.status === "pending") return { status: "pending" };
  const [claimed] = await db.delete(cliLoginRequests).where(eq(cliLoginRequests.id, id)).returning();
  if (!claimed) return { status: "expired" };
  if (claimed.status === "denied" || !claimed.userId) return { status: "denied" };
  const token = await createApiToken(claimed.userId, `CLI · ${claimed.device}`);
  const [owner] = await db.select({ handle: user.handle }).from(user).where(eq(user.id, claimed.userId)).limit(1);
  return { status: "approved", token, handle: owner?.handle ?? null };
}
