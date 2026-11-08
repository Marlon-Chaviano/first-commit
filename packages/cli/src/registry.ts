import { existsSync, rmSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  BRAND,
  catalogSchema,
  cliCommand,
  loadKitFrom,
  splitKitRef,
  type LoadedRawKit,
  REGISTRY_RAW_BASE,
  REGISTRY_SOURCE,
  type Catalog,
  type Kit,
  type RegistryEntry,
} from "@kits/schema";
import { downloadTemplate } from "giget";

import { hashKitDir, unpackArchive, verifyIntegrity, type IntegrityMap } from "@kits/schema/node";

import { api, apiUrl } from "./api";
import { isLocalPath, locateKit, needsPublishedLookup, versionMismatch, type KitLocation, type PublishedKit } from "./kit-location";

/** Where official kits live. Override with KITS_REGISTRY (a local path or gh:owner/repo/path). */
export const DEFAULT_REGISTRY = REGISTRY_SOURCE;
const DEFAULT_RAW_BASE = REGISTRY_RAW_BASE;

export interface LoadedKit {
  kit: Kit;
  /** Local directory with kit.json and the kit's files. */
  dir: string;
  /** How the user referred to the kit (used in generated commands). */
  ref: string;
}

function registry(): string {
  return process.env.KITS_REGISTRY ?? DEFAULT_REGISTRY;
}

/**
 * Kit references (all accept @version except local paths):
 *   mobile-expo[@1.2.0]           official kit from the registry
 *   owner/repo[/path][@v1.0.0]    community kit on GitHub (version = git tag)
 *   ./path/to/kit                 local kit (handy while authoring one)
 */
export async function loadKit(ref: string): Promise<LoadedKit> {
  const top = await loadRawKit(ref);
  // Parents of `extends` are fetched the same way, so they can be official, community or local.
  // Community kits use the official library catalog too.
  const kit = await loadKitFrom(top, { read: (parentRef) => loadRawKit(parentRef, top.dir), catalog: loadCatalog, resolvePath: resolve });
  return { kit, dir: top.dir, ref };
}

/** Downloads (or reads) one kit.json without resolving `extends`. Local refs are relative to `from`. */
export async function loadRawKit(ref: string, from = process.cwd()): Promise<LoadedRawKit> {
  const published = needsPublishedLookup(ref) ? await lookupPublished(splitKitRef(ref).base, splitKitRef(ref).version) : null;
  const { name, version, location } = locateKit(ref, { registry: registry(), from, published });
  const dir = await fetchKit(ref, location);

  const manifest = join(dir, "kit.json");
  if (!existsSync(manifest)) {
    // The download folder is a temp dir: only a local path is worth showing.
    throw new Error(location.kind === "local" || location.kind === "local-registry" ? `Kit "${ref}" not found (no kit.json in ${dir})` : `Kit "${ref}" not found. ${cliCommand("list")} shows every kit.`);
  }
  const raw = JSON.parse(await readFile(manifest, "utf8")) as Record<string, unknown>;
  // Each location is trusted its own way (see KitLocation).
  if (location.kind === "official") {
    verifyIntegrity(dir, name, String(raw.version), (await readRegistryFile("integrity.json")) as IntegrityMap);
  } else if ((location.kind === "published" || location.kind === "private") && hashKitDir(dir) !== location.published.integrity) {
    throw new Error(`The downloaded kit ${name}@${location.published.version} doesn't match the published one (integrity). Nothing was run.`);
  }
  const mismatch = versionMismatch(name, version, String(raw.version));
  if (mismatch) throw new Error(mismatch);
  return { raw, dir };
}

/** Download folders, removed when the process ends (the plan copies files from them until then). */
const downloads = new Set<string>();
process.once("exit", () => {
  for (const dir of downloads) rmSync(dir, { recursive: true, force: true });
});

/** The kit's files on disk: in place for local kits, otherwise downloaded to a temporary folder. */
async function fetchKit(ref: string, location: KitLocation): Promise<string> {
  if (location.kind === "local" || location.kind === "local-registry") return location.dir;
  const dir = await mkdtemp(join(tmpdir(), "kits-"));
  downloads.add(dir);
  try {
    // Private (org) kits come from the registry itself, with the user's token.
    if (location.kind === "private") unpackArchive(await downloadArchive(location.slug, location.published.version), dir);
    else await downloadTemplate(location.source, { dir, force: true });
  } catch (error) {
    // "acme/kit" that the registry didn't return may be a private kit we have no access to.
    const hint = location.kind === "github" ? `. If it's a private kit of your organization, log in with \`${BRAND.cli} login\`` : "";
    const from = location.kind === "private" ? "private registry" : location.source;
    throw new Error(`Couldn't download the kit "${ref}" (${from}): ${(error as Error).message}${hint}`);
  }
  return dir;
}

export async function loadIndex(): Promise<RegistryEntry[]> {
  return (await readRegistryFile("index.json")) as RegistryEntry[];
}

/** UI and animation libraries shared by every kit (registry/libraries.json). */
export async function loadCatalog(): Promise<Catalog> {
  return catalogSchema.parse(await readRegistryFile("libraries.json"));
}

async function readRegistryFile(file: string): Promise<unknown> {
  const base = registry();
  if (isLocalPath(base)) return JSON.parse(await readFile(resolve(base, file), "utf8"));
  const url = `${process.env.KITS_REGISTRY ? githubRawBase(base) : DEFAULT_RAW_BASE}/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${file} from the registry (${res.status} ${url})`);
  return res.json();
}

function githubRawBase(source: string): string {
  const [owner, repo, ...path] = source.replace(/^gh:/, "").split("/");
  return `https://raw.githubusercontent.com/${owner}/${repo}/main/${path.join("/")}`;
}

async function downloadArchive(slug: string, version: string): Promise<Buffer> {
  const res = await api<Buffer>(`/api/v1/kits/${slug}?version=${encodeURIComponent(version)}&archive=1`, { as: "buffer", timeoutMs: 60_000 });
  if (res.ok) return res.data;
  if (res.status === 402) throw new Error(`it's a paid kit. Buy it at ${(res.body?.buyUrl as string | undefined) ?? apiUrl()} and log in with \`${BRAND.cli} login\``);
  if (res.status === 401 || res.status === 404) throw new Error(`you don't have access. If it belongs to your organization, log in with \`${BRAND.cli} login\``);
  throw new Error(res.status ? `the registry responded ${res.status}` : res.error!);
}

/** Asks the registry whether "owner/name" is a published kit. Unreachable or 404: treat it as a GitHub path. */
async function lookupPublished(slug: string, version?: string): Promise<PublishedKit | null> {
  if (slug.split("/").length !== 2) return null;
  // With a token, members also see their organization's private kits.
  const res = await api<PublishedKit & { official?: boolean }>(`/api/v1/kits/${slug}${version ? `?version=${encodeURIComponent(version)}` : ""}`, { timeoutMs: 3000 });
  return res.ok && !res.data.official ? res.data : null;
}
