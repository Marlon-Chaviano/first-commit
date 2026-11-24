import { randomUUID } from "node:crypto";

import { emptyBrandProfile } from "@kits/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe.skipIf(process.env.KITS_INTEGRATION !== "1")("brand publishing and access", () => {
  const tag = randomUUID().slice(0, 8);
  const [owner, member, outsider] = ["owner", "member", "visitor"].map((name) => ({
    id: `${name}-${tag}`, name, handle: `${name}-${tag}`, role: "user", email: `${name}-${tag}@test.local`,
  })) as [TestUser, TestUser, TestUser];
  type TestUser = { id: string; name: string; handle: string; role: string; email: string };
  let brands: typeof import("./brands");
  let catalog: typeof import("./brand-catalog");
  let orgs: typeof import("./orgs");
  let db: NonNullable<typeof import("./db").db>;
  let tables: typeof import("./db/schema");
  let orgId: string | undefined;
  const profile = { ...emptyBrandProfile(), name: "design", title: `Studio ${tag}`, fonts: { sans: `Sans ${tag}` } };

  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgres://kits:kits@localhost:5433/kits";
    [brands, catalog, orgs, tables] = await Promise.all([
      import("./brands"), import("./brand-catalog"), import("./orgs"), import("./db/schema"),
    ]);
    db = (await import("./db")).db!;
    await db.insert(tables.user).values([owner, member, outsider]);
  });

  afterAll(async () => {
    if (!db) return;
    if (orgId) await db.delete(tables.orgs).where(eq(tables.orgs.id, orgId));
    await db.delete(tables.user).where(inArray(tables.user.id, [owner.id, member.id, outsider.id]));
  });

  it("publishes by default, then removes a private profile from discovery and guest access", async () => {
    const slug = await brands.saveBrand(owner, owner.handle, profile, "create");
    expect((await brands.getBrand(slug, null))?.canEdit).toBe(false);
    expect(await brands.availableBrandChoices(null)).toContainEqual(expect.objectContaining({ slug }));
    for (const query of [profile.title.toUpperCase(), slug, profile.fonts.sans]) {
      const page = await catalog.brandCatalogPage(1, query);
      expect(page.items).toMatchObject([{ href: `/brands/${slug}`, publisher: owner.handle, fonts: profile.fonts }]);
    }
    expect(await brands.listBrands(outsider)).toHaveLength(0);
    await expect(brands.deleteBrand(outsider, slug)).rejects.toThrow(/permission/);
    await expect(brands.saveBrand(outsider, owner.handle, profile, "update", true)).rejects.toThrow();
    await brands.saveBrand(owner, owner.handle, profile, "update", true);
    // An older editor omits visibility when updating and must preserve the stored choice.
    await brands.saveBrand(owner, owner.handle, profile, "update");
    expect((await brands.getBrand(slug, owner))?.canEdit).toBe(true);
    expect(await brands.getBrand(slug, null)).toBeNull();
    expect(await brands.getBrand(slug, outsider)).toBeNull();
    expect(await brands.availableBrandChoices(outsider)).not.toContainEqual(expect.objectContaining({ slug }));
    expect(await catalog.brandCatalogPage(1, profile.title)).toMatchObject({ items: [], total: 0 });
    await brands.saveBrand(owner, owner.handle, profile, "update", false);
    expect((await brands.getBrand(slug, outsider))?.profile.title).toBe(profile.title);
  });

  it("keeps a private organization brand available only to members, with edits restricted to admins and owners", async () => {
    const org = await orgs.createOrg(owner, {
      slug: `studio-${tag}`, name: "Studio", verified: { email: "owner@studio.test", domain: "studio.test" },
    });
    orgId = org.id;
    await orgs.addMember(org, owner, member.handle, "member");
    const slug = await brands.saveBrand(owner, org.slug, profile, "create", true);
    expect(await brands.getBrand(slug, outsider)).toBeNull();
    expect((await brands.getBrand(slug, member))?.canEdit).toBe(false);
    expect(await brands.availableBrandChoices(member)).toContainEqual(expect.objectContaining({ slug }));
    await expect(brands.saveBrand(member, org.slug, profile, "update", false)).rejects.toThrow();
    await expect(brands.deleteBrand(member, slug)).rejects.toThrow();
    expect((await catalog.brandCatalogPage(1, org.slug)).total).toBe(0);
    await brands.saveBrand(owner, org.slug, profile, "update", false);
    expect((await catalog.brandCatalogPage(1, org.slug)).total).toBe(1);
  });
});
