/**
 * Who may do what with a kit, against real Postgres (`docker compose up -d`). Skipped unless KITS_INTEGRATION=1:
 *
 *   KITS_INTEGRATION=1 pnpm vitest run apps/web/src/server/kit-access.integration.test.ts
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), cacheLife: vi.fn(), cacheTag: vi.fn() }));

const run = process.env.KITS_INTEGRATION === "1";

describe.skipIf(!run)("kit access (Postgres)", () => {
  Object.assign(process.env, { DATABASE_URL: process.env.DATABASE_URL ?? "postgres://kits:kits@localhost:5433/kits" });
  const tag = randomUUID().slice(0, 8);
  const people = ["owner", "orgAdmin", "member", "admin", "buyer", "stranger"] as const;
  type Person = (typeof people)[number];
  const user = (who: Person) => ({ id: `it-${who}-${tag}`, handle: `it-${who.toLowerCase()}-${tag}`, role: who === "admin" ? "admin" : "user", name: who });
  let m: { access: typeof import("./kit-access"); db: typeof import("./db"); schema: typeof import("./db/schema"); orm: typeof import("drizzle-orm") };
  const kits: Record<"free" | "paid" | "org", import("./kit-access").AccessKit> = {} as never;
  let orgId = "";

  beforeAll(async () => {
    m = { access: await import("./kit-access"), db: await import("./db"), schema: await import("./db/schema"), orm: await import("drizzle-orm") };
    const { db } = m.db;
    const s = m.schema;
    await db!.insert(s.user).values(people.map((who) => ({ ...user(who), email: `${user(who).id}@example.test`, emailVerified: false })));
    const [org] = await db!.insert(s.orgs).values({ slug: `it-org-${tag}`, name: "It" }).returning();
    orgId = org!.id;
    await db!.insert(s.orgMembers).values([
      { orgId, userId: user("owner").id, role: "owner" },
      { orgId, userId: user("orgAdmin").id, role: "admin" },
      { orgId, userId: user("member").id, role: "member" },
    ]);
    const base = { repo: "it/it", latestVersion: "1.0.0", title: "It", description: "", category: "web", ownerId: user("owner").id };
    const rows = await db!
      .insert(s.kits)
      .values([
        { ...base, slug: `it-free-${tag}` },
        { ...base, slug: `it-paid-${tag}`, priceCents: 900 },
        { ...base, slug: `it-org-kit-${tag}`, orgId, visibility: "org" },
      ])
      .returning();
    for (const [key, row] of [["free", rows[0]!], ["paid", rows[1]!], ["org", rows[2]!]] as const) kits[key] = { ...row, kitId: row.id };
    await db!.insert(s.licenses).values({ kitId: kits.paid.kitId, userId: user("buyer").id, status: "active", amountCents: 900, feeCents: 90, checkoutSessionId: `cs_it_${tag}` });
  });
  afterAll(async () => {
    const { db } = m.db;
    await db!.delete(m.schema.kits).where(m.orm.like(m.schema.kits.slug, `%${tag}`));
    await db!.delete(m.schema.orgs).where(m.orm.eq(m.schema.orgs.id, orgId));
    await db!.delete(m.schema.user).where(m.orm.like(m.schema.user.id, `%${tag}`));
  });

  const answers = async (kit: "free" | "paid" | "org") =>
    Object.fromEntries(
      await Promise.all(
        [...people, "nobody" as const].map(async (who) => {
          const a = await m.access.kitAccess(kits[kit], who === "nobody" ? null : user(who));
          return [who, `${a.read ? "R" : "-"}${a.manage ? "M" : "-"}${a.moderate ? "H" : "-"}${a.install ? "I" : "-"}`];
        }),
      ),
    );

  // R read · M manage (stats, retire, delete) · H hide (moderate) · I install
  it("free public kit: everyone reads and installs; owner and admins manage", async () => {
    expect(await answers("free")).toEqual({ owner: "RM-I", orgAdmin: "R--I", member: "R--I", admin: "RMHI", buyer: "R--I", stranger: "R--I", nobody: "R--I" });
  });

  it("paid kit: only the owner, admins and buyers install", async () => {
    expect(await answers("paid")).toEqual({ owner: "RM-I", orgAdmin: "R---", member: "R---", admin: "RMHI", buyer: "R--I", stranger: "R---", nobody: "R---" });
  });

  it("org kit: members read and install; the org's owners and admins manage; site admins manage but can't read it", async () => {
    expect(await answers("org")).toEqual({ owner: "RM-I", orgAdmin: "RM-I", member: "R--I", admin: "-MH-", buyer: "----", stranger: "----", nobody: "----" });
  });

  it("while billing is off, every kit gets every extra (the team plan)", async () => {
    expect(await m.access.kitPlan(kits.org, user("stranger").id)).toBe("team");
    expect(await m.access.kitPlan(kits.free, user("stranger").id)).toBe("team");
  });
});
