"use server";

import { revalidatePath } from "next/cache";

import { syncSeats } from "@/server/billing";
import { consumeOrgCode, sendOrgCode } from "@/server/org-verification";
import { addMember, assertOrgSlugFree, createOrg, deleteOrg, getOrg, OrgError, removeMember, setPolicy, type OrgRole } from "@/server/orgs";
import { getCatalog } from "@/server/registry";
import { getViewer } from "@/server/session";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof OrgError) return { ok: false, error: error.message };
    if (error instanceof Error && error.name === "ZodError") return { ok: false, error: "Invalid name: lowercase letters, numbers and hyphens" };
    console.error("[orgs]", error);
    return { ok: false, error: "Something went wrong, try again" };
  }
}

async function context(slug: string) {
  const viewer = await getViewer();
  if (!viewer) throw new OrgError(401, "Log in first");
  const org = await getOrg(slug);
  if (!org) throw new OrgError(404, "Organization not found");
  return { viewer, org };
}

/** Step 1 of creating an org: check the name is free, then email a code to the work address. */
export async function sendOrgCodeAction(slug: string, email: string): Promise<Result<{ email: string }>> {
  return run(async () => {
    const viewer = await getViewer();
    if (!viewer) throw new OrgError(401, "Log in first");
    const free = await assertOrgSlugFree(slug);
    return sendOrgCode(viewer, email, free);
  });
}

/** Step 2: the code proves the work email; the org is created with that domain as verified. */
export async function createOrgAction(slug: string, name: string, code: string): Promise<Result<string>> {
  return run(async () => {
    const viewer = await getViewer();
    if (!viewer) throw new OrgError(401, "Log in first");
    await assertOrgSlugFree(slug);
    const verified = await consumeOrgCode(viewer, code);
    const org = await createOrg(viewer, { slug, name, verified });
    revalidatePath("/account", "layout");
    return org.slug;
  });
}

export async function deleteOrgAction(slug: string, confirm: string): Promise<Result> {
  return run(async () => {
    const { viewer, org } = await context(slug);
    if (confirm.trim() !== org.slug) throw new OrgError(400, `Type ${org.slug} to confirm`);
    await deleteOrg(org, viewer);
    revalidatePath("/account", "layout");
    return undefined;
  });
}

export async function addMemberAction(slug: string, handle: string, role: OrgRole): Promise<Result> {
  return run(async () => {
    const { viewer, org } = await context(slug);
    await addMember(org, viewer, handle, role);
    await syncSeats(org.id);
    revalidatePath(`/orgs/${slug}`);
    return undefined;
  });
}

export async function removeMemberAction(slug: string, userId: string): Promise<Result> {
  return run(async () => {
    const { viewer, org } = await context(slug);
    await removeMember(org, viewer, userId);
    await syncSeats(org.id);
    revalidatePath(`/orgs/${slug}`);
    return undefined;
  });
}

/** Library ids, comma or space separated. Unknown ids are rejected so a typo can't silently disable a rule. */
export async function setPolicyAction(slug: string, required: string, forbidden: string): Promise<Result> {
  return run(async () => {
    const { viewer, org } = await context(slug);
    const ids = new Set((await getCatalog()).map((l) => l.id));
    const parse = (text: string) => text.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
    const policy = { required: parse(required), forbidden: parse(forbidden) };
    const unknown = [...policy.required, ...policy.forbidden].filter((id) => !ids.has(id));
    if (unknown.length) throw new OrgError(400, `Not in the catalog: ${unknown.join(", ")}`);
    await setPolicy(org, viewer, policy);
    revalidatePath(`/orgs/${slug}`);
    return undefined;
  });
}
