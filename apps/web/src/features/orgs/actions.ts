"use server";

import { action, type Result } from "@/server/action";
import { syncSeats } from "@/server/billing";
import { fail } from "@/server/errors";
import { consumeOrgCode, sendOrgCode } from "@/server/org-verification";
import { addMember, assertOrgSlugFree, createOrg, deleteOrg, getOrg, removeMember, setPolicy, type OrgRole } from "@/server/orgs";
import { getCatalog } from "@/server/registry";

async function orgBySlug(slug: string) {
  return (await getOrg(slug)) ?? fail("Organization not found", 404);
}

/** Step 1 of creating an org: check the name is free, then email a code to the work address. */
export async function sendOrgCodeAction(slug: string, email: string): Promise<Result<{ email: string }>> {
  return action({}, async (viewer) => sendOrgCode(viewer, email, await assertOrgSlugFree(slug)));
}

/** Step 2: the code proves the work email; the org is created with that domain as verified. */
export async function createOrgAction(slug: string, name: string, code: string): Promise<Result<string>> {
  return action({ revalidate: { paths: [["/account", "layout"]] } }, async (viewer) => {
    await assertOrgSlugFree(slug);
    const verified = await consumeOrgCode(viewer, code);
    return (await createOrg(viewer, { slug, name, verified })).slug;
  });
}

export async function deleteOrgAction(slug: string, confirm: string): Promise<Result> {
  return action({ revalidate: { paths: [["/account", "layout"]] } }, async (viewer) => {
    const org = await orgBySlug(slug);
    if (confirm.trim() !== org.slug) fail(`Type ${org.slug} to confirm`);
    await deleteOrg(org, viewer);
  });
}

export async function addMemberAction(slug: string, handle: string, role: OrgRole): Promise<Result> {
  return action({ revalidate: { paths: [`/orgs/${slug}`] } }, async (viewer) => {
    const org = await orgBySlug(slug);
    await addMember(org, viewer, handle, role);
    await syncSeats(org.id);
  });
}

export async function removeMemberAction(slug: string, userId: string): Promise<Result> {
  return action({ revalidate: { paths: [`/orgs/${slug}`] } }, async (viewer) => {
    const org = await orgBySlug(slug);
    await removeMember(org, viewer, userId);
    await syncSeats(org.id);
  });
}

/** Library ids, comma or space separated. Unknown ids are rejected so a typo can't silently disable a rule. */
export async function setPolicyAction(slug: string, required: string, forbidden: string): Promise<Result> {
  return action({ revalidate: { paths: [`/orgs/${slug}`] } }, async (viewer) => {
    const org = await orgBySlug(slug);
    const ids = new Set((await getCatalog()).map((l) => l.id));
    const parse = (text: string) => text.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
    const policy = { required: parse(required), forbidden: parse(forbidden) };
    const unknown = [...policy.required, ...policy.forbidden].filter((id) => !ids.has(id));
    if (unknown.length) fail(`Not in the catalog: ${unknown.join(", ")}`);
    await setPolicy(org, viewer, policy);
  });
}
