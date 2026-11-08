"use server";

import { action, type Result } from "@/server/action";
import { recordManualVerification, setUserRole } from "@/server/admin";
import { fail } from "@/server/errors";
import { REGISTRY_TAG } from "@/server/registry";
import { verificationTag } from "@/server/verifications/queries";

/** Admin: give or take the admin role. Your own role stays, so the panel can't lock you out. */
export async function setUserRoleAction(userId: string, role: "admin" | "user"): Promise<Result> {
  return action({ auth: "admin", revalidate: { paths: ["/admin"] } }, async (viewer) => {
    if (viewer.id === userId) fail("You can't change your own role", 400);
    await setUserRole(userId, role);
  });
}

/** Admin: mark the latest version of a kit as verified (or revoke it) after reviewing it by hand. */
export async function setKitVerifiedAction(slug: string, verified: boolean): Promise<Result> {
  return action({ auth: "admin", revalidate: { paths: ["/admin"], tags: [verificationTag(slug), REGISTRY_TAG, `kit:${slug}`] } }, async (viewer) => {
    await recordManualVerification(slug, verified, viewer.handle ?? viewer.id);
  });
}
