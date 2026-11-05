import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { db } from "./db";
import { apiTokens, user } from "./db/schema";

const PREFIX = "kits_";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a CLI/CI token. The plain value is returned once and never stored. */
export async function createApiToken(userId: string, name: string): Promise<string> {
  const token = `${PREFIX}${randomBytes(24).toString("base64url")}`;
  await db!.insert(apiTokens).values({ userId, name: name.slice(0, 60), prefix: token.slice(0, PREFIX.length + 4), tokenHash: hash(token) });
  return token;
}

export async function listApiTokens(userId: string) {
  return db!
    .select({ id: apiTokens.id, name: apiTokens.name, prefix: apiTokens.prefix, lastUsedAt: apiTokens.lastUsedAt, createdAt: apiTokens.createdAt })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt));
}

export async function revokeApiToken(userId: string, id: string): Promise<void> {
  await db!.delete(apiTokens).where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)));
}

export interface TokenUser {
  id: string;
  handle: string | null;
  role: string | null;
  name: string;
}

/** The user behind a "kits_…" token, or null. Updates last use. */
export async function userFromToken(token: string): Promise<TokenUser | null> {
  if (!db || !token.startsWith(PREFIX)) return null;
  const rows = await db
    .select({ tokenId: apiTokens.id, id: user.id, handle: user.handle, role: user.role, name: user.name })
    .from(apiTokens)
    .innerJoin(user, eq(apiTokens.userId, user.id))
    .where(eq(apiTokens.tokenHash, hash(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.tokenId));
  return { id: row.id, handle: row.handle, role: row.role, name: row.name };
}
