/**
 * Browser login for the CLI against real Postgres (`docker compose up -d`). Skipped unless KITS_INTEGRATION=1:
 *
 *   KITS_INTEGRATION=1 pnpm vitest run apps/web/src/server/cli-login.integration.test.ts
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), cacheLife: vi.fn(), cacheTag: vi.fn() }));

const run = process.env.KITS_INTEGRATION === "1";

describe.skipIf(!run)("CLI browser login (Postgres)", () => {
  Object.assign(process.env, { DATABASE_URL: process.env.DATABASE_URL ?? "postgres://kits:kits@localhost:5433/kits" });
  const tag = randomUUID().slice(0, 8);
  const userId = `it-cli-${tag}`;
  let m: { login: typeof import("./cli-login"); tokens: typeof import("./tokens"); db: typeof import("./db"); schema: typeof import("./db/schema"); orm: typeof import("drizzle-orm") };

  beforeAll(async () => {
    m = { login: await import("./cli-login"), tokens: await import("./tokens"), db: await import("./db"), schema: await import("./db/schema"), orm: await import("drizzle-orm") };
    await m.db.db!.insert(m.schema.user).values({ id: userId, name: "It", email: `${userId}@example.test`, emailVerified: false, handle: `it-${tag}` });
  });
  afterAll(async () => {
    await m.db.db!.delete(m.schema.user).where(m.orm.eq(m.schema.user.id, userId));
  });

  it("hands over a token once, after the code is approved", async () => {
    const started = (await m.login.startCliLogin("it-host (darwin)"))!;
    expect(started.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(await m.login.pollCliLogin(started.id, started.secret)).toEqual({ status: "pending" });
    expect(await m.login.pollCliLogin(started.id, "wrong-secret")).toEqual({ status: "expired" });
    // Codes are typed loosely in the browser: lowercase, no dash.
    expect(await m.login.decideCliLogin(started.code.toLowerCase().replace("-", ""), userId, true)).toBe(true);
    expect(await m.login.decideCliLogin(started.code, userId, true)).toBe(false);
    const done = await m.login.pollCliLogin(started.id, started.secret);
    expect(done).toMatchObject({ status: "approved", handle: `it-${tag}` });
    expect(await m.login.pollCliLogin(started.id, started.secret)).toEqual({ status: "expired" });
    const token = (done as { token: string }).token;
    expect((await m.tokens.userFromToken(token))?.id).toBe(userId);
    expect(await m.tokens.revokeTokenByValue(token)).toBe(true);
    expect(await m.tokens.userFromToken(token)).toBeNull();
  });

  it("denies and expires", async () => {
    const denied = (await m.login.startCliLogin("x"))!;
    await m.login.decideCliLogin(denied.code, userId, false);
    expect(await m.login.pollCliLogin(denied.id, denied.secret)).toEqual({ status: "denied" });
    const old = (await m.login.startCliLogin("x"))!;
    await m.db.db!.update(m.schema.cliLoginRequests).set({ expiresAt: new Date(Date.now() - 1000) }).where(m.orm.eq(m.schema.cliLoginRequests.id, old.id));
    expect(await m.login.decideCliLogin(old.code, userId, true)).toBe(false);
    expect(await m.login.pollCliLogin(old.id, old.secret)).toEqual({ status: "expired" });
  });
});
