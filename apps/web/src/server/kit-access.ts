import "server-only";

import { userPlan, hasLicense } from "./billing";
import { capabilitiesFor, getOrgById, roleIn } from "./orgs";
import { effectivePlan, type PlanId } from "./plans";
import { billingEnabled } from "./stripe";
import { isAdmin } from "./session";
import type { TokenUser } from "./tokens";

/** What any kit row carries that access depends on (a `kits` row, or `findCommunityVersion`'s). */
export interface AccessKit {
  kitId: string;
  ownerId: string | null;
  orgId: string | null;
  visibility: string;
  priceCents?: number | null;
}

/**
 * Every access question about one kit, for one viewer. The only place these rules live:
 * pages, routes and actions ask here instead of combining roles, licenses and admin checks.
 */
export interface KitAccess {
  /** See it and its page. Public kits: everyone. Org kits: members of the org. */
  read: boolean;
  /** Statistics, retire/reactivate, delete: the owner, the org's owners and admins, site admins. */
  manage: boolean;
  /** Hide it from the catalog (moderation): site admins only. */
  moderate: boolean;
  /** Paid kit. */
  paid: boolean;
  /** Download its files: read access, and for paid kits the owner, a site admin or a license. */
  install: boolean;
}

/** Org members can always read; private kits are invisible to site admins too (they're the org's). */
export async function canReadKit(kit: Pick<AccessKit, "visibility" | "orgId">, viewer: TokenUser | null): Promise<boolean> {
  if (kit.visibility === "public") return true;
  return Boolean(kit.orgId && (await roleIn(kit.orgId, viewer?.id)));
}

export async function kitAccess(kit: AccessKit, viewer: TokenUser | null): Promise<KitAccess> {
  const admin = isAdmin(viewer);
  const owner = Boolean(viewer && kit.ownerId === viewer.id);
  // One lookup each, only when the answer depends on it.
  const role = kit.orgId && viewer ? await roleIn(kit.orgId, viewer.id) : null;
  const paid = Boolean(kit.priceCents);
  const read = kit.visibility === "public" || Boolean(role);
  // An org kit is managed by whoever the org lets manage its kits.
  const manage = owner || admin || capabilitiesFor(role, viewer?.id).canManageKits;
  const licensed = paid && viewer && !owner && !admin ? await hasLicense(kit.kitId, viewer.id) : false;
  return { read, manage, moderate: admin, paid, install: read && (!paid || owner || admin || licensed) };
}

/** The plan that pays for a kit's extras (statistics history, CSV): its org's, otherwise its owner's. */
export async function kitPlan(kit: Pick<AccessKit, "orgId" | "ownerId">, fallbackUserId: string): Promise<PlanId> {
  const plan = kit.orgId ? (await getOrgById(kit.orgId))?.plan : await userPlan(kit.ownerId ?? fallbackUserId);
  return effectivePlan(plan, billingEnabled);
}
