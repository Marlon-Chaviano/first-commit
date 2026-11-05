/**
 * Orgs, private kits, billing and premium kits against real Postgres and
 * stripe-mock (`docker compose up -d`). Skipped unless KITS_INTEGRATION=1:
 *
 *   KITS_INTEGRATION=1 pnpm vitest run apps/web/src/server/billing.integration.test.ts
 */
import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), cacheLife: vi.fn(), cacheTag: vi.fn() }));

const run = process.env.KITS_INTEGRATION === "1";
const WEBHOOK_SECRET = "whsec_integration_test";

describe.skipIf(!run)("orgs, billing and premium kits (Postgres + stripe-mock)", () => {
  Object.assign(process.env, {
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://kits:kits@localhost:5433/kits",
    STRIPE_SECRET_KEY: "sk_test_integration",
    STRIPE_API_URL: process.env.STRIPE_API_URL ?? "http://localhost:12111",
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_PRICE_PRO: "price_pro_test",
    STRIPE_PRICE_TEAM: "price_team_test",
    BETTER_AUTH_URL: "http://localhost:3200",
  });

  const tag = randomUUID().slice(0, 8);
  const users = ["ana", "bob", "eve"].map((name) => ({ id: `it-${name}-${tag}`, name, email: `${name}-${tag}@test.local`, handle: `it-${name}-${tag}` }));
  const [ana, bob, eve] = users.map((u) => ({ id: u.id, handle: u.handle, role: "user", name: u.name }));
  let m: {
    db: typeof import("./db");
    schema: typeof import("./db/schema");
    orgs: typeof import("./orgs");
    billing: typeof import("./billing");
    stripe: typeof import("./stripe");
    orm: typeof import("drizzle-orm");
  };
  let orgId = "";
  const kitId = randomUUID();
  const slug = `it-ana-${tag}/paid-kit`;
  let seq = 0;
  const event = (type: string, object: Record<string, unknown>, created = Math.floor(Date.now() / 1000)) =>
    ({ id: `evt_${tag}_${++seq}`, type, created, data: { object } }) as never;

  beforeAll(async () => {
    m = {
      db: await import("./db"),
      schema: await import("./db/schema"),
      orgs: await import("./orgs"),
      billing: await import("./billing"),
      stripe: await import("./stripe"),
      orm: await import("drizzle-orm"),
    };
    await m.db.db!.insert(m.schema.user).values(users);
  });

  afterAll(async () => {
    if (!m) return;
    const { db } = m.db;
    const { inArray, eq } = m.orm;
    if (orgId) await db!.delete(m.schema.orgs).where(eq(m.schema.orgs.id, orgId));
    await db!.delete(m.schema.kits).where(eq(m.schema.kits.id, kitId));
    await db!.delete(m.schema.subscriptions).where(eq(m.schema.subscriptions.subjectId, orgId));
    await db!.delete(m.schema.user).where(inArray(m.schema.user.id, users.map((u) => u.id)));
  });

  it("creates an org, adds a member and refuses outsiders", async () => {
    const org = await m.orgs.createOrg(ana!, { slug: `it-acme-${tag}`, name: "Acme" });
    orgId = org.id;
    await m.orgs.addMember(org, ana!, bob!.handle, "member");
    expect(await m.orgs.roleIn(org.id, bob!.id)).toBe("member");
    await expect(m.orgs.addMember(org, bob!, eve!.handle, "member")).rejects.toThrow(/permiso/);
    await expect(m.orgs.createOrg(eve!, { slug: ana!.handle, name: "x" })).rejects.toThrow(/usuario/);
    expect(await m.orgs.canReadKit({ visibility: "org", orgId: org.id }, bob!)).toBe(true);
    expect(await m.orgs.canReadKit({ visibility: "org", orgId: org.id }, eve!)).toBe(false);
  });

  it("opens a Teams checkout accepted by Stripe's API (stripe-mock validates every parameter)", async () => {
    const url = await m.billing.createSubscriptionCheckout(ana!, { kind: "org", id: orgId }, "team", 2);
    expect(url).toMatch(/^https?:\/\//);
  });

  it("applies subscription webhooks once, in order", async () => {
    const { db } = m.db;
    const { eq } = m.orm;
    const sub = (status: string) => ({
      id: `sub_${tag}`,
      customer: `cus_${tag}`,
      status,
      metadata: { subjectType: "org", subjectId: orgId, plan: "team" },
      items: { data: [{ id: "si_1", quantity: 2, current_period_end: Math.floor(Date.now() / 1000) + 2_592_000 }] },
    });
    const now = Math.floor(Date.now() / 1000);
    const created = event("customer.subscription.created", sub("active"), now);
    expect(await m.billing.handleStripeEvent(created)).toBe(true);
    expect(await m.billing.handleStripeEvent(created)).toBe(false); // retry: nothing happens
    const plan = async () => (await db!.select().from(m.schema.orgs).where(eq(m.schema.orgs.id, orgId)))[0]!.plan;
    expect(await plan()).toBe("team");
    // An older "canceled" arriving late doesn't undo the newer state.
    await m.billing.handleStripeEvent(event("customer.subscription.updated", sub("canceled"), now - 3600));
    expect(await plan()).toBe("team");
    await m.billing.handleStripeEvent(event("customer.subscription.deleted", sub("canceled"), now + 60));
    expect(await plan()).toBe("free");
  });

  it("verifies the webhook signature on the raw body", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const payload = JSON.stringify({ id: `evt_${tag}_sig`, object: "event", type: "ping.test", created: 1, data: { object: {} } });
    const header = m.stripe.stripe!.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    const ok = await POST(new Request("http://x/api/webhooks/stripe", { method: "POST", body: payload, headers: { "stripe-signature": header } }));
    expect(ok.status).toBe(200);
    const bad = await POST(new Request("http://x/api/webhooks/stripe", { method: "POST", body: payload, headers: { "stripe-signature": "t=1,v1=nope" } }));
    expect(bad.status).toBe(400);
  });

  it("sells a premium kit: Connect onboarding, price, checkout, license and refund", async () => {
    const { db } = m.db;
    const { eq } = m.orm;
    const { packDir } = await import("@kits/schema/node");
    const dir = mkdtempSync(join(tmpdir(), "it-kit-"));
    writeFileSync(join(dir, "kit.json"), '{"name":"paid-kit"}');

    expect(await m.billing.creatorOnboarding(ana!)).toMatch(/^https?:\/\//);
    const account = (await m.billing.creatorStatus(ana!.id))!;
    await db!.insert(m.schema.kits).values({ id: kitId, slug, ownerId: ana!.id, repo: "local/dev", latestVersion: "1.0.0", title: "Paid", description: "d", category: "web" });
    await db!.insert(m.schema.kitVersions).values({ kitId, version: "1.0.0", commitSha: "local", manifest: {}, integrity: "x", archive: packDir(dir) });

    await expect(m.billing.setKitPrice(ana!, slug, 1900)).rejects.toThrow(/cobros/);
    await m.billing.handleStripeEvent(event("account.updated", { id: account.stripeAccountId, charges_enabled: true, payouts_enabled: true }));
    await m.billing.setKitPrice(ana!, slug, 1900);
    await expect(m.billing.setKitPrice(bob!, slug, 500)).rejects.toThrow(/no encontrado/i);

    expect(await m.billing.createKitCheckout(eve!, slug)).toMatch(/^https?:\/\//);
    await expect(m.billing.createKitCheckout(ana!, slug)).rejects.toThrow(/Ya tienes/);

    expect(await m.billing.hasLicense(kitId, eve!.id)).toBe(false);
    const paid = event("checkout.session.completed", {
      id: `cs_${tag}`,
      mode: "payment",
      payment_status: "paid",
      amount_total: 1900,
      payment_intent: `pi_${tag}`,
      metadata: { kind: "kit", kitId, userId: eve!.id },
    });
    await m.billing.handleStripeEvent(paid);
    expect(await m.billing.hasLicense(kitId, eve!.id)).toBe(true);
    const [license] = await db!.select().from(m.schema.licenses).where(eq(m.schema.licenses.kitId, kitId));
    expect(license!.feeCents).toBe(285); // 15 %

    await m.billing.handleStripeEvent(event("charge.refunded", { id: `ch_${tag}`, payment_intent: `pi_${tag}`, refunded: true }));
    expect(await m.billing.hasLicense(kitId, eve!.id)).toBe(false);
  });
});
