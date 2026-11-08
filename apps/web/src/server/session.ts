import "server-only";

import { headers } from "next/headers";
import { connection } from "next/server";

import { auth } from "./auth";
import { effectiveRole } from "./env";
import { userFromToken, type TokenUser } from "./tokens";

type SessionUser = NonNullable<Awaited<ReturnType<NonNullable<typeof auth>["api"]["getSession"]>>>["user"];

/** The one mapping from a Better Auth session to the user the app works with. */
function toUser(sessionUser: SessionUser): TokenUser {
  const u = sessionUser as SessionUser & { handle?: string | null; role?: string | null };
  return { id: u.id, handle: u.handle ?? null, role: effectiveRole(u.handle ?? null, u.role ?? null), name: u.name, email: u.email, image: u.image ?? null };
}

/**
 * Reads the session, treating an unreachable auth database as "logged out": pages keep rendering
 * (as for any optional service) and the failure goes to the server log instead of the screen.
 */
async function readSession(headers: Headers) {
  try {
    return await auth!.api.getSession({ headers });
  } catch (error) {
    console.error("[session] couldn't read the session (is the database up?)", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Signed-in user in a Server Component or Server Action (cookie session). */
export async function getViewer(): Promise<TokenUser | null> {
  if (!auth) return null;
  const requestHeaders = await headers();
  // Checking a session reads the clock (is it expired?). In a runtime prefetch the headers are known
  // but the time isn't allowed: wait for the real request before checking it.
  await connection();
  const session = await readSession(requestHeaders);
  return session ? toUser(session.user) : null;
}

/** Route handlers: a CLI token (Authorization: Bearer kits_…) or the browser session. */
export async function getRequestUser(request: Request): Promise<TokenUser | null> {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(kits_\S+)$/i)?.[1];
  if (bearer) return userFromToken(bearer);
  if (!auth) return null;
  const session = await readSession(request.headers);
  return session ? toUser(session.user) : null;
}

export const isAdmin = (u: TokenUser | null) => u?.role === "admin";
