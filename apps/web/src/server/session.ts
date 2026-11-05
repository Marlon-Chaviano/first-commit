import "server-only";

import { headers } from "next/headers";

import { auth } from "./auth";
import { userFromToken, type TokenUser } from "./tokens";

/** Signed-in user in a Server Component or Server Action (cookie session). */
export async function getViewer(): Promise<TokenUser | null> {
  if (!auth) return null;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & { handle?: string | null; role?: string | null };
  return { id: u.id, handle: u.handle ?? null, role: u.role ?? null, name: u.name };
}

/** Route handlers: a CLI token (Authorization: Bearer kits_…) or the browser session. */
export async function getRequestUser(request: Request): Promise<TokenUser | null> {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(kits_\S+)$/i)?.[1];
  if (bearer) return userFromToken(bearer);
  if (!auth) return null;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const u = session.user as typeof session.user & { handle?: string | null; role?: string | null };
  return { id: u.id, handle: u.handle ?? null, role: u.role ?? null, name: u.name };
}

export const isAdmin = (u: TokenUser | null) => u?.role === "admin";
