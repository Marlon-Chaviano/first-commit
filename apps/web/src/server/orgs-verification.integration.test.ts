/**
 * Creating an organization with a verified work email, against real Postgres (`docker compose up -d`).
 * Skipped unless KITS_INTEGRATION=1:
 *
 *   KITS_INTEGRATION=1 pnpm vitest run apps/web/src/server/orgs-verification.integration.test.ts
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), cacheLife: vi.fn(), cacheTag: vi.fn() }));

const run = process.env.KITS_INTEGRATION === "1";

describe.skipIf(!run)("org work-email verification (Postgres)", () => {
  Object.assign(process.env, { DATABASE_URL: process.env.DATABASE_URL ?? "postgres://kits:kits@localhost:5433/kits", RESEND_API_KEY: "" });
  const tag = randomUUID().slice(0, 8);
  const viewer = { id: `it-user-${tag}`, handle: `it-${tag}`, role: "user", name: "It" };
  let m: {
    verification: typeof import("./org-verification");
    orgs: typeof import("./orgs");
    db: typeof import("./db");
    schema: typeof import("./db/schema");
    orm: typeof import("drizzle-orm");
  };
  // Without Resend the email is logged: the code is read from that log.
  const logged: string[] = [];
  const lastCode = () => /code: (\d{6})/.exec(logged.at(-1) ?? "")?.[1] ?? "";

  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation((line: string) => void logged.push(line));
    m = {
      verification: await import("./org-verification"),
      orgs: await import("./orgs"),
      db: await import("./db"),
      schema: await import("./db/schema"),
      orm: await import("drizzle-orm"),
    };
    await m.db.db!.insert(m.schema.user).values({ id: viewer.id, name: "It", email: `${viewer.handle}@example.test`, emailVerified: false, handle: viewer.handle });
  });
  afterAll(async () => {
    await m.db.db!.delete(m.schema.orgs).where(m.orm.eq(m.schema.orgs.slug, `it-org-${tag}`));
    await m.db.db!.delete(m.schema.user).where(m.orm.eq(m.schema.user.id, viewer.id));
  });

  it("rejects personal mailboxes", () => {
    expect(() => m.verification.workEmailDomain("ana@gmail.com")).toThrow(/work email/);
    expect(() => m.verification.workEmailDomain("ana@yahoo.co.uk")).toThrow(/work email/);
    expect(m.verification.workEmailDomain(" Ana@Acme.io ")).toEqual({ email: "ana@acme.io", domain: "acme.io" });
  });

  it("limits wrong codes, throttles resends and consumes the right code once", async () => {
    await m.verification.sendOrgCode(viewer, "ana@acme.io", "acme");
    const code = lastCode();
    expect(code).toMatch(/^\d{6}$/);
    await expect(m.verification.sendOrgCode(viewer, "ana@acme.io", "acme")).rejects.toThrow(/Wait a minute/);
    const wrong = code === "000000" ? "111111" : "000000";
    await expect(m.verification.consumeOrgCode(viewer, wrong)).rejects.toThrow(/4 tries left/);
    expect(await m.verification.consumeOrgCode(viewer, code)).toEqual({ email: "ana@acme.io", domain: "acme.io" });
    await expect(m.verification.consumeOrgCode(viewer, code)).rejects.toThrow(/Ask for a code first/);
  });

  it("locks the code after 5 wrong tries and rejects expired codes", async () => {
    await m.db.db!.delete(m.schema.orgEmailVerifications).where(m.orm.eq(m.schema.orgEmailVerifications.userId, viewer.id));
    await m.verification.sendOrgCode(viewer, "ana@acme.io", "acme");
    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await m.verification.consumeOrgCode(viewer, wrong).catch(() => undefined);
    await expect(m.verification.consumeOrgCode(viewer, code)).rejects.toThrow(/Too many wrong codes/);

    await m.db.db!.update(m.schema.orgEmailVerifications).set({ attempts: 0, expiresAt: new Date(Date.now() - 1000) }).where(m.orm.eq(m.schema.orgEmailVerifications.userId, viewer.id));
    await expect(m.verification.consumeOrgCode(viewer, code)).rejects.toThrow(/expired/);
  });

  it("creates the org with the verified domain, then only an owner deletes it", async () => {
    const slug = `it-org-${tag}`;
    expect(await m.orgs.assertOrgSlugFree(slug)).toBe(slug);
    const org = await m.orgs.createOrg(viewer, { slug, name: "Acme", verified: { email: "ana@acme.io", domain: "acme.io" } });
    expect(org.verifiedDomain).toBe("acme.io");
    expect(org.verifiedAt).toBeInstanceOf(Date);
    await expect(m.orgs.assertOrgSlugFree(slug)).rejects.toThrow(/already exists/);
    await expect(m.orgs.deleteOrg(org, { ...viewer, id: "someone-else" })).rejects.toThrow(/permission/);
    await m.orgs.deleteOrg(org, viewer);
    expect(await m.orgs.getOrg(slug)).toBeNull();
  });
});
