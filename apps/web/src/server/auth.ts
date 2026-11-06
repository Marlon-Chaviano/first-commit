import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { BRAND } from "@kits/schema";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "./db";
import * as schema from "./db/schema";
import { adminHandles, devLogin, env, githubLogin, googleLogin } from "./env";

/** "Ana García" / "ana@x.com" → "ana-garcia", "ana" */
export function toHandle(value: string): string {
  return (
    value
      .split("@")[0]!
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 39) || "user"
  );
}

async function uniqueHandle(base: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const candidate = i ? `${base}-${i + 1}` : base;
    const taken = await db!.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.handle, candidate)).limit(1);
    if (!taken.length) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

/**
 * Sign in with GitHub or Google. A creator's handle is their GitHub login
 * ("ana/kit" means the kit of github.com/ana); Google-only accounts get one
 * from their email until they link GitHub. `handle` and `role` are
 * server-only fields (input: false): users can't edit them to impersonate.
 */
export const auth = db
  ? betterAuth({
      appName: BRAND.name,
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      database: drizzleAdapter(db, { provider: "pg", schema }),
      emailAndPassword: { enabled: devLogin },
      socialProviders: {
        ...(githubLogin ? { github: { clientId: env.GITHUB_CLIENT_ID!, clientSecret: env.GITHUB_CLIENT_SECRET!, scope: ["read:user", "user:email"] } } : {}),
        ...(googleLogin ? { google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET!, prompt: "select_account" as const } } : {}),
      },
      // Sign in with Google, then link GitHub from the account page to publish (publishing checks repo permissions on GitHub).
      account: {
        accountLinking: { enabled: true, trustedProviders: ["github", "google"], allowDifferentEmails: true },
      },
      user: {
        additionalFields: {
          handle: { type: "string", required: false, input: false },
          role: { type: ["user", "admin"], required: false, defaultValue: "user", input: false },
        },
      },
      databaseHooks: {
        user: {
          create: {
            before: async (user) => {
              const handle = await uniqueHandle(toHandle(user.email ?? user.name ?? "user"));
              return { data: { ...user, handle, role: adminHandles.has(handle) ? "admin" : "user" } };
            },
          },
        },
        account: {
          create: {
            // The real GitHub login, asked to GitHub with the user's own token.
            after: async (account) => {
              if (account.providerId !== "github" || !account.accessToken) return;
              const res = await fetch("https://api.github.com/user", {
                headers: { authorization: `Bearer ${account.accessToken}`, "user-agent": BRAND.name },
              });
              if (!res.ok) return;
              const { login, avatar_url: avatar } = (await res.json()) as { login?: string; avatar_url?: string };
              // Linked after signing in with email or Google without a picture: take the GitHub one.
              if (avatar) await db!.update(schema.user).set({ image: avatar }).where(and(eq(schema.user.id, account.userId), isNull(schema.user.image)));
              if (!login) return;
              const handle = login.toLowerCase();
              const owner = await db!.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.handle, handle)).limit(1);
              if (owner.length && owner[0]!.id !== account.userId) return;
              await db!
                .update(schema.user)
                .set({ handle, ...(adminHandles.has(handle) ? { role: "admin" } : {}) })
                .where(eq(schema.user.id, account.userId));
            },
          },
        },
      },
      plugins: [nextCookies()],
    })
  : null;

export type Session = NonNullable<typeof auth>["$Infer"]["Session"];
