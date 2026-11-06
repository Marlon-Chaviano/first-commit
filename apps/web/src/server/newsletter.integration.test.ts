/**
 * Newsletter double opt-in against real Postgres (`docker compose up -d`). Skipped unless KITS_INTEGRATION=1:
 *
 *   KITS_INTEGRATION=1 pnpm vitest run apps/web/src/server/newsletter.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), cacheLife: vi.fn(), cacheTag: vi.fn() }));

const run = process.env.KITS_INTEGRATION === "1";

describe.skipIf(!run)("newsletter (Postgres)", () => {
  Object.assign(process.env, { DATABASE_URL: process.env.DATABASE_URL ?? "postgres://kits:kits@localhost:5433/kits", RESEND_API_KEY: "" });
  const email = `newsletter-${Date.now()}@example.com`;
  let m: {
    newsletter: typeof import("./newsletter");
    db: typeof import("./db");
    schema: typeof import("./db/schema");
    orm: typeof import("drizzle-orm");
  };
  // Without Resend the confirm email is logged: the token is read from that log.
  const logged: string[] = [];

  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation((line: string) => void logged.push(line));
    m = { newsletter: await import("./newsletter"), db: await import("./db"), schema: await import("./db/schema"), orm: await import("drizzle-orm") };
  });
  afterAll(async () => {
    await m.db.db!.delete(m.schema.newsletterSubscribers).where(m.orm.eq(m.schema.newsletterSubscribers.email, email));
  });

  const lastToken = () => /token=([\w-]+)/.exec(logged.at(-1) ?? "")?.[1] ?? "";
  const row = async () =>
    (await m.db.db!.select().from(m.schema.newsletterSubscribers).where(m.orm.eq(m.schema.newsletterSubscribers.email, email)))[0]!;

  it("subscribes as pending and confirms once with the emailed token", async () => {
    expect(await m.newsletter.subscribe(email.toUpperCase())).toBe("sent");
    expect((await row()).status).toBe("pending");
    expect(await m.newsletter.confirmSubscription("not-a-token")).toBe(false);
    const token = lastToken();
    expect(await m.newsletter.confirmSubscription(token)).toBe(true);
    expect(await m.newsletter.confirmSubscription(token)).toBe(false);
    expect((await row()).status).toBe("confirmed");
    expect(await m.newsletter.subscribe(email)).toBe("already");
  });

  it("rejects a confirm link older than a week", async () => {
    await m.db.db!.update(m.schema.newsletterSubscribers).set({ status: "unsubscribed" }).where(m.orm.eq(m.schema.newsletterSubscribers.email, email));
    expect(await m.newsletter.subscribe(email)).toBe("sent");
    await m.db.db!
      .update(m.schema.newsletterSubscribers)
      .set({ createdAt: new Date(Date.now() - 8 * 86_400_000) })
      .where(m.orm.eq(m.schema.newsletterSubscribers.email, email));
    expect(await m.newsletter.confirmSubscription(lastToken())).toBe(false);
  });

  it("unsubscribes only with a valid signature", async () => {
    const { id } = await row();
    const sig = new URL(m.newsletter.unsubscribeUrl(id)).searchParams.get("sig")!;
    expect(new URL(m.newsletter.oneClickUnsubscribeUrl(id)).searchParams.get("sig")).toBe(sig);
    expect(await m.newsletter.unsubscribe(id, "forged")).toBe(false);
    expect(await m.newsletter.unsubscribe(id, sig)).toBe(true);
    expect((await row()).status).toBe("unsubscribed");
  });
});
