import type { NextRequest } from "next/server";

import { BRAND } from "@kits/schema";

import { hasLicense } from "@/server/billing";
import { canReadKit } from "@/server/orgs";
import { findCommunityVersion, getArchive, getIndex } from "@/server/registry";
import { getRequestUser, isAdmin } from "@/server/session";

/**
 * GET /api/v1/kits/<slug>[?version=] — where to download a kit and how to check it.
 * The CLI uses it for community kits: files come from `?archive=1` (private kits
 * for members, premium kits with a license) and must match `integrity`.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/v1/kits/[...slug]">) {
  const slug = (await params).slug.join("/");
  const version = request.nextUrl.searchParams.get("version") ?? undefined;

  if (!slug.includes("/")) {
    const entry = (await getIndex()).find((e) => e.name === slug);
    return entry ? Response.json({ slug, official: true, version: entry.version }) : notFound(slug);
  }
  const row = await findCommunityVersion(slug, version);
  if (!row || row.status !== "active") return notFound(slug);
  const user = await getRequestUser(request);
  // Private kits: members only, and the same 404 as a missing kit for everyone else.
  if (row.visibility !== "public" && !(await canReadKit(row, user))) return notFound(slug);

  // Premium kits: the files need a license (or being the owner or an admin).
  const locked = Boolean(row.priceCents) && row.ownerId !== user?.id && !isAdmin(user) && !(await hasLicense(row.kitId, user?.id));
  if (request.nextUrl.searchParams.get("archive") === "1") {
    if (locked) {
      return Response.json({ error: `${slug} is a paid kit: buy it at ${BRAND.siteUrl}/kits/${slug}`, buyUrl: `${BRAND.siteUrl}/kits/${slug}` }, { status: 402 });
    }
    const archive = await getArchive(row.kitId, row.version);
    if (!archive) return notFound(slug);
    return new Response(new Uint8Array(archive), {
      headers: { "content-type": "application/gzip", "cache-control": "private, no-store", "x-kit-integrity": row.integrity },
    });
  }
  return Response.json({
    slug,
    official: false,
    version: row.version,
    latestVersion: row.latestVersion,
    repo: row.repo,
    path: row.path,
    commitSha: row.commitSha,
    integrity: row.integrity,
    /** Download from the registry (?archive=1). Versions published before archives existed come from GitHub. */
    archive: row.hasArchive,
    priceCents: row.priceCents,
    licensed: !locked,
    owner: row.handle,
    publishedAt: row.publishedAt,
  });
}

function notFound(slug: string) {
  return Response.json({ error: `${slug} isn't published` }, { status: 404 });
}
