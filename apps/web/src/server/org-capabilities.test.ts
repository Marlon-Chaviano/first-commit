import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ db: null }));

import { capabilitiesFor, type OrgRole } from "./orgs";

const flags = (role: OrgRole | null) => {
  const c = capabilitiesFor(role, "me");
  return {
    member: c.isMember,
    addMembers: c.canAddMembers,
    addOwners: c.canAddOwners,
    policy: c.canEditPolicy,
    brands: c.canEditBrands,
    kits: c.canManageKits,
    billing: c.canManageBilling,
    delete: c.canDelete,
  };
};

describe("capabilitiesFor", () => {
  it("grants by role: members use, admins manage, owners own", () => {
    expect(flags("member")).toEqual({ member: true, addMembers: false, addOwners: false, policy: false, brands: false, kits: false, billing: false, delete: false });
    expect(flags("admin")).toEqual({ member: true, addMembers: true, addOwners: false, policy: true, brands: true, kits: true, billing: false, delete: false });
    expect(flags("owner")).toEqual({ member: true, addMembers: true, addOwners: true, policy: true, brands: true, kits: true, billing: true, delete: true });
    expect(Object.values(flags(null)).every((v) => v === false)).toBe(true);
  });

  it("removing: anyone leaves, admins remove non-owners, only owners remove owners", () => {
    const owner = { userId: "o", role: "owner" as const };
    const admin = { userId: "a", role: "admin" as const };
    const member = { userId: "m", role: "member" as const };
    expect(capabilitiesFor("member", "m").canRemove(member)).toBe(true);
    expect(capabilitiesFor("member", "m").canRemove(admin)).toBe(false);
    expect(capabilitiesFor("admin", "a").canRemove(member)).toBe(true);
    expect(capabilitiesFor("admin", "a").canRemove(owner)).toBe(false);
    expect(capabilitiesFor("owner", "o").canRemove(admin)).toBe(true);
    expect(capabilitiesFor(null, "x").canRemove({ userId: "x", role: "member" })).toBe(false);
  });
});
