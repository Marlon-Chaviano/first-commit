import "server-only";

import { cp, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defaultSelections, kitLanguage, loadKitFrom, BRAND } from "@kits/schema";
import { hashKitDir, packDir } from "@kits/schema/node";
import { and, eq, ne, sql } from "drizzle-orm";
import { downloadTemplate } from "giget";
import { revalidateTag } from "next/cache";

import { db } from "./db";
import { account, kits, kitVersions } from "./db/schema";
import { devLogin } from "./env";
import { getOrg, roleIn } from "./orgs";
import { effectivePlan, MAX_KITS_PER_ACCOUNT, planAllows } from "./plans";
import { billingEnabled } from "./stripe";
import { kitSource, REGISTRY_TAG } from "./registry";
import type { TokenUser } from "./tokens";
import { DomainError } from "./errors";

/** Publish errors for the person; see DomainError. */
export class PublishError extends DomainError {}

export interface PublishSource {
  /** "owner/repo" on GitHub. */
  repo?: string;
  /** Folder of kit.json inside the repo ("" = root). */
  path?: string;
  /** Branch, tag or commit; pinned to a commit before publishing. Default "main". */
  ref?: string;
  /** Development only: an absolute folder on this machine. */
  local?: string;
  /** Publish into this organization's private registry ("acme/kit") instead of the user's namespace. */
  org?: string;
}

const REPO = /^[\w.-]+\/[\w.-]+$/;

/**
 * Publishes a version of a community kit. The slug is "<handle>/<kit name>",
 * so a user can only publish under their own GitHub login, and only from a
 * repository they can push to. Versions are immutable.
 */
export async function publishKit(publisher: TokenUser, source: PublishSource): Promise<{ slug: string; version: string; created: boolean }> {
  if (!db) throw new PublishError(503, "Publishing isn't available (no database)");
  if (!publisher.handle) throw new PublishError(403, "Your account has no linked GitHub username");

  // Org kits: any member can publish; the org needs the Teams plan for a private registry.
  const org = source.org ? await getOrg(source.org) : null;
  if (source.org && !org) throw new PublishError(404, `The "${source.org}" organization doesn't exist`);
  if (org) {
    if (!(await roleIn(org.id, publisher.id))) throw new PublishError(403, `You aren't a member of ${org.slug}`);
    if (!planAllows(effectivePlan(org.plan, billingEnabled), "privateKits")) throw new PublishError(402, `${org.slug} needs the Teams plan to publish private kits`);
  }

  const { dir, repo, path, commitSha } = await fetchSource(publisher, source, Boolean(org));

  // Validate exactly as the CLI and the website will read it.
  const raw = JSON.parse(await readFile(join(dir, "kit.json"), "utf8").catch(() => {
    throw new PublishError(400, `No hay kit.json en ${repo}${path ? `/${path}` : ""}`);
  })) as Record<string, unknown>;
  let kit;
  try {
    kit = await loadKitFrom({ raw, dir }, kitSource, { admit: true });
  } catch (error) {
    throw new PublishError(400, `The kit isn't valid: ${(error as Error).message}`);
  }

  // The org's policy applies to its own kits too: their defaults can't use a forbidden library.
  if (org) {
    const chosen = Object.values(defaultSelections(kit).options).flat();
    const forbidden = chosen.filter((id) => org.policy.forbidden.includes(id));
    if (forbidden.length) throw new PublishError(400, `${org.slug}'s policy forbids: ${forbidden.join(", ")}`);
  }

  const slug = `${org?.slug ?? publisher.handle}/${kit.name}`;
  const existing = (await db.select().from(kits).where(eq(kits.slug, slug)).limit(1))[0];
  // Anti-spam: a new kit counts against the publisher's limit; new versions of a kit don't.
  if (!existing && publisher.role !== "admin") {
    const owned = await countActiveKits(publisher.id);
    if (owned >= MAX_KITS_PER_ACCOUNT) {
      throw new PublishError(429, `You've reached the maximum of ${MAX_KITS_PER_ACCOUNT} kits per account. Retire one you no longer use (in your account) to publish another.`);
    }
  }
  // Personal kits: only their owner republishes. Org kits: any member of that org.
  if (existing && (org ? existing.orgId !== org.id : existing.ownerId !== publisher.id)) throw new PublishError(403, `${slug} pertenece a otra cuenta`);
  if (existing) {
    const taken = await db
      .select({ v: kitVersions.version })
      .from(kitVersions)
      .where(and(eq(kitVersions.kitId, existing.id), eq(kitVersions.version, kit.version)))
      .limit(1);
    if (taken.length) throw new PublishError(409, `Version ${kit.version} of ${slug} is already published. Bump "version" in kit.json.`);
  }

  const summary = { title: kit.title, description: kit.description, category: kit.category, tags: kit.tags, language: kitLanguage(kit) };
  await db.transaction(async (tx) => {
    const [row] = existing
      ? await tx
          .update(kits)
          .set({ ...summary, repo, path, latestVersion: kit.version, status: existing.status === "retired" ? "active" : existing.status, updatedAt: new Date() })
          .where(eq(kits.id, existing.id))
          .returning({ id: kits.id })
      : await tx
          .insert(kits)
          .values({ ...summary, slug, ownerId: publisher.id, official: false, repo, path, latestVersion: kit.version, visibility: org ? "org" : "public", orgId: org?.id ?? null })
          .returning({ id: kits.id });
    await tx.insert(kitVersions).values({
      kitId: row!.id,
      version: kit.version,
      commitSha,
      manifest: raw,
      integrity: hashKitDir(dir),
      // Every community kit is served from the registry (members of a private org, buyers of a
      // premium kit and everyone else alike), so its files can't change or be read around the rules.
      archive: archive(dir),
      publishedById: publisher.id,
    });
  });
  revalidateTag(REGISTRY_TAG, { expire: 0 });
  revalidateTag(`kit:${slug}`, { expire: 0 });
  return { slug, version: kit.version, created: !existing };
}

/** Downloads the kit at a fixed commit, after checking the publisher can push to the repo. */
async function fetchSource(publisher: TokenUser, source: PublishSource, allowPrivate: boolean) {
  const dir = await mkdtemp(join(tmpdir(), "kits-publish-"));

  if (source.local) {
    if (!devLogin) throw new PublishError(400, "Publishing from a local folder only works in development");
    await cp(source.local, dir, { recursive: true, filter: (p) => !p.includes("node_modules") });
    return { dir, repo: "local/dev", path: source.local, commitSha: "local" };
  }

  const repo = source.repo?.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "") ?? "";
  if (!REPO.test(repo)) throw new PublishError(400, 'Invalid repository: use "user/repo"');
  const path = (source.path ?? "").replace(/^\/+|\/+$/g, "");
  if (path.split("/").includes("..")) throw new PublishError(400, "Invalid path");

  const token = await githubToken(publisher.id);
  if (!token) throw new PublishError(403, "Log in with GitHub to publish");
  const gh = (url: string, accept = "application/vnd.github+json") =>
    fetch(`https://api.github.com${url}`, { headers: { authorization: `Bearer ${token}`, accept, "user-agent": BRAND.name } });

  const repoRes = await gh(`/repos/${repo}`);
  if (!repoRes.ok) throw new PublishError(404, `${repo} wasn't found on GitHub`);
  const info = (await repoRes.json()) as { private?: boolean; permissions?: { push?: boolean; admin?: boolean } };
  // A public kit must come from a public repo (anyone can read its files); org kits can be private.
  if (info.private && !allowPrivate) throw new PublishError(400, "Only kits from public repositories can be published (or in an organization)");
  if (!info.permissions?.push && !info.permissions?.admin) throw new PublishError(403, `You don't have write access to ${repo}`);

  const commitRes = await gh(`/repos/${repo}/commits/${encodeURIComponent(source.ref || "main")}`, "application/vnd.github.sha");
  if (!commitRes.ok) throw new PublishError(404, `The branch, tag or commit "${source.ref || "main"}" doesn't exist`);
  const commitSha = (await commitRes.text()).trim();

  try {
    await downloadTemplate(`gh:${repo}${path ? `/${path}` : ""}#${commitSha}`, { dir, force: true, auth: info.private ? token : undefined });
  } catch (error) {
    throw new PublishError(400, `Couldn't download the kit: ${(error as Error).message}`);
  }
  return { dir, repo, path, commitSha };
}

async function githubToken(userId: string): Promise<string | null> {
  const rows = await db!
    .select({ token: account.accessToken })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "github")))
    .limit(1);
  return rows[0]?.token ?? null;
}

function archive(dir: string): Buffer {
  try {
    return packDir(dir);
  } catch (error) {
    throw new PublishError(413, (error as Error).message);
  }
}

/** Kits the user published that still count against the limit (everything but retired ones). */
export async function countActiveKits(userId: string): Promise<number> {
  const [row] = await db!
    .select({ n: sql<number>`count(*)::int` })
    .from(kits)
    .where(and(eq(kits.ownerId, userId), ne(kits.status, "retired")));
  return row?.n ?? 0;
}
